<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqDimensionValor;
use App\Models\LiqLineaTarifa;
use App\Models\LiqAuditoriaTarifa;
use App\Models\LiqOperacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;

class LiqTarifaController extends Controller
{
    // PUT /liq/esquemas/{esquema}/activar - activar un esquema (desactiva el resto del cliente)
    public function activarEsquema(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        DB::beginTransaction();
        try {
            LiqEsquemaTarifario::where('cliente_id', $esquema->cliente_id)
                ->where('id', '!=', $esquema->id)
                ->where('activo', true)
                ->update(['activo' => false]);

            $esquema->update(['activo' => true]);
            DB::commit();

            return response()->json(['data' => $esquema, 'message' => 'Esquema activado']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo activar el esquema: ' . $e->getMessage()], 500);
        }
    }

    // PUT /liq/esquemas/{esquema}/desactivar - desactivar (borrado lógico)
    public function desactivarEsquema(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $esquema->update(['activo' => false]);
        return response()->json(['data' => $esquema, 'message' => 'Esquema desactivado']);
    }

    // DELETE /liq/esquemas/{esquema} - borrado físico (solo si no está en uso)
    public function destroyEsquema(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para eliminar esquemas.'], 403);
        }
        if ($esquema->activo) {
            return response()->json(['error' => 'No se puede eliminar un esquema activo. Desactiválo primero.'], 422);
        }

        $enUso = LiqOperacion::whereHas('lineaTarifa', function ($q) use ($esquema) {
            $q->where('esquema_id', $esquema->id);
        })->exists();
        if ($enUso) {
            return response()->json(['error' => 'No se puede eliminar: el esquema está usado en operaciones históricas.'], 422);
        }

        try {
            $esquema->delete();
            return response()->json(['message' => 'Esquema eliminado']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo eliminar el esquema: ' . $e->getMessage()], 500);
        }
    }

    // GET /liq/esquemas/{esquema}/dimensiones
    public function dimensiones(LiqEsquemaTarifario $esquema): JsonResponse
    {
        $dimensiones = LiqDimensionValor::where('esquema_id', $esquema->id)
            ->orderBy('nombre_dimension')
            ->orderBy('orden_display')
            ->get();
        // Group by nombre_dimension
        $grouped = $dimensiones->groupBy('nombre_dimension')->map(fn($items) => $items->values());
        return response()->json(['data' => $grouped]);
    }

    // POST /liq/esquemas/{esquema}/dimensiones - add dimension value
    public function storeDimension(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $data = $request->validate([
            'nombre_dimension' => 'required|string|max:80|in:' . implode(',', $esquema->dimensiones ?? []),
            'valor' => 'required|string|max:150',
            'orden_display' => 'integer|min:0',
        ]);
        // Check if dimension name is valid for this scheme
        $existing = LiqDimensionValor::where('esquema_id', $esquema->id)
            ->where('nombre_dimension', $data['nombre_dimension'])
            ->where('valor', $data['valor'])
            ->first();
        if ($existing) {
            if (!$existing->activo) {
                $existing->update(['activo' => true, 'orden_display' => $data['orden_display'] ?? $existing->orden_display]);
                return response()->json(['data' => $existing, 'message' => 'Valor reactivado']);
            }
            return response()->json(['error' => 'Este valor ya existe para esta dimensión'], 422);
        }
        $dimension = LiqDimensionValor::create([
            'esquema_id' => $esquema->id,
            'nombre_dimension' => $data['nombre_dimension'],
            'valor' => $data['valor'],
            'orden_display' => $data['orden_display'] ?? 0,
            'activo' => true,
        ]);
        return response()->json(['data' => $dimension, 'message' => 'Valor de dimensión creado'], 201);
    }

    // PUT /liq/dimension-valores/{dimensionValor}/desactivar
    public function desactivarDimension(Request $request, LiqDimensionValor $dimensionValor): JsonResponse
    {
        $dimensionValor->update(['activo' => false]);
        return response()->json(['message' => 'Valor desactivado']);
    }

    // GET /liq/esquemas/{esquema}/lineas
    public function lineas(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $query = LiqLineaTarifa::where('esquema_id', $esquema->id)
            ->with(['creadoPor:id,name,email', 'aprobadoPor:id,name,email'])
            ->orderBy('activo', 'desc')
            ->orderBy('vigencia_desde', 'desc');
        if ($request->boolean('solo_activas')) {
            $query->where('activo', true);
        }
        $lineas = $query->get();
        return response()->json(['data' => $lineas]);
    }

    // POST /liq/esquemas/{esquema}/lineas - create tariff line
    public function storeLinea(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $data = $request->validate([
            'dimensiones_valores' => 'required|array',
            'precio_original' => 'required|numeric|min:0.01',
            'porcentaje_agencia' => 'required|numeric|min:0|max:99.99',
            'vigencia_desde' => 'required|date',
            'vigencia_hasta' => 'nullable|date|after_or_equal:vigencia_desde',
            'motivo' => 'required|string|min:3',
        ]);

        $dimensionesRequeridas = $esquema->dimensiones ?? [];
        $dimensionesValores = $this->filtrarYValidarDimensionesValores($esquema, $data['dimensiones_valores']);
        if (isset($dimensionesValores['error'])) {
            return response()->json(['error' => $dimensionesValores['error']], 422);
        }

        // No permitir solapamiento con otra línea activa NO aprobada (borrador)
        $solapadasNoAprobadas = $this->queryLineasPorDimensiones($esquema->id, $dimensionesValores)
            ->where('activo', true)
            ->whereNull('aprobado_por')
            ->where($this->vigenciaSolapaCallback($data['vigencia_desde'], $data['vigencia_hasta'] ?? null))
            ->count();
        if ($solapadasNoAprobadas > 0) {
            return response()->json(['error' => 'Ya existe una línea en borrador con las mismas dimensiones y vigencia superpuesta'], 422);
        }

        // Evitar crear una versión con vigencia_desde anterior/igual a la última aprobada (misma combinación)
        $ultimaAprobada = $this->queryLineasPorDimensiones($esquema->id, $dimensionesValores)
            ->where('activo', true)
            ->whereNotNull('aprobado_por')
            ->orderByDesc('vigencia_desde')
            ->first();
        if ($ultimaAprobada && Carbon::parse($data['vigencia_desde'])->lessThanOrEqualTo($ultimaAprobada->vigencia_desde)) {
            return response()->json(['error' => 'La vigencia_desde debe ser posterior a la última línea aprobada para estas dimensiones'], 422);
        }

        $precioDistribuidor = round($data['precio_original'] * (1 - $data['porcentaje_agencia'] / 100), 2);

        $linea = LiqLineaTarifa::create([
            'esquema_id' => $esquema->id,
            'dimensiones_valores' => $dimensionesValores,
            'precio_original' => $data['precio_original'],
            'porcentaje_agencia' => $data['porcentaje_agencia'],
            'precio_distribuidor' => $precioDistribuidor,
            'vigencia_desde' => $data['vigencia_desde'],
            'vigencia_hasta' => $data['vigencia_hasta'] ?? null,
            'creado_por' => $request->user()?->id,
            'activo' => true,
        ]);

        // Audit
        LiqAuditoriaTarifa::create([
            'linea_tarifa_id' => $linea->id,
            'accion' => 'creacion',
            'valores_anteriores' => null,
            'valores_nuevos' => $linea->toArray(),
            'usuario_id' => $request->user()?->id,
            'motivo' => $data['motivo'],
            'created_at' => now(),
        ]);

        return response()->json(['data' => $linea, 'message' => 'Línea de tarifa creada'], 201);
    }

    // POST /liq/esquemas/{esquema}/importar-excel - importar líneas/dimensiones desde un Excel (asistido)
    public function importarExcel(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para importar tarifas.'], 403);
        }

        $data = $request->validate([
            'archivo' => 'required|file|mimes:xlsx,xls',
            'vigencia_desde' => 'required|date',
            'vigencia_hasta' => 'nullable|date|after_or_equal:vigencia_desde',
            'motivo' => 'required|string|min:3',
            'dry_run' => 'nullable|boolean',
        ]);

        $dryRun = (bool) ($data['dry_run'] ?? false);
        $vigDesde = Carbon::parse($data['vigencia_desde'])->toDateString();
        $vigHasta = isset($data['vigencia_hasta']) ? Carbon::parse($data['vigencia_hasta'])->toDateString() : null;

        $file = $request->file('archivo');
        $path = $file?->getRealPath();
        if (! $path) {
            return response()->json(['error' => 'No se pudo leer el archivo'], 422);
        }

        try {
            $spreadsheet = IOFactory::load($path);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo abrir el Excel: ' . $e->getMessage()], 422);
        }

        $ws = $spreadsheet->getSheet(0);
        $maxRow = (int) $ws->getHighestDataRow();
        $maxCol = (string) $ws->getHighestDataColumn();
        $maxColIndex = Coordinate::columnIndexFromString($maxCol);

        // Header row (fila 1)
        $headers = [];
        for ($c = 1; $c <= $maxColIndex; $c++) {
            $cellRef = Coordinate::stringFromColumnIndex($c) . '1';
            $raw = (string) ($ws->getCell($cellRef)->getFormattedValue() ?? '');
            $norm = $this->normHeader($raw);
            if ($norm !== '' && ! isset($headers[$norm])) {
                $headers[$norm] = $c;
            }
        }

        // Columnas para dimensiones configuradas en el esquema
        $dimCols = [];
        foreach (($esquema->dimensiones ?? []) as $dim) {
            $dimNorm = $this->normHeader((string) $dim);
            $found = null;
            foreach ($headers as $h => $colIndex) {
                if ($h === $dimNorm || Str::contains($h, $dimNorm)) {
                    $found = $colIndex;
                    break;
                }
            }
            if (! $found) {
                return response()->json(['error' => "No se encontró la columna para la dimensión \"$dim\" en el Excel."], 422);
            }
            $dimCols[$dim] = $found;
        }

        $colOriginal = $this->findCol($headers, ['original']);
        if (! $colOriginal) {
            return response()->json(['error' => 'No se encontró la columna "Original" en el Excel.'], 422);
        }
        $colPct = $this->findCol($headers, ['porcentaje', 'agencia']) ?? $this->findCol($headers, ['%']);
        $colDist = $this->findCol($headers, ['distribuidor']);

        if (! $colPct && ! $colDist) {
            return response()->json(['error' => 'No se encontró "Porcentaje agencia" ni "Distribuidor" para calcular el porcentaje.'], 422);
        }

        $lastDimValues = [];
        $parsed = [];
        $warnings = [];

        for ($r = 2; $r <= $maxRow; $r++) {
            $dimValues = [];
            foreach ($dimCols as $dim => $c) {
                $cellRef = Coordinate::stringFromColumnIndex($c) . $r;
                $raw = trim((string) ($ws->getCell($cellRef)->getFormattedValue() ?? ''));
                if ($raw === '' && array_key_exists($dim, $lastDimValues)) {
                    $raw = $lastDimValues[$dim];
                }
                $raw = trim($raw);
                if ($raw !== '') {
                    $lastDimValues[$dim] = $raw;
                }
                $dimValues[$dim] = $raw;
            }

            if (collect($dimValues)->contains(fn ($v) => trim((string) $v) === '')) {
                continue;
            }

            $origRef = Coordinate::stringFromColumnIndex($colOriginal) . $r;
            $pctRef = $colPct ? (Coordinate::stringFromColumnIndex($colPct) . $r) : null;
            $distRef = $colDist ? (Coordinate::stringFromColumnIndex($colDist) . $r) : null;

            $origStr = trim((string) ($ws->getCell($origRef)->getFormattedValue() ?? ''));
            $pctStr = $pctRef ? trim((string) ($ws->getCell($pctRef)->getFormattedValue() ?? '')) : '';
            $distStr = $distRef ? trim((string) ($ws->getCell($distRef)->getFormattedValue() ?? '')) : '';

            $precioOriginal = $this->parseMoney($origStr);
            if ($precioOriginal === null || $precioOriginal <= 0) {
                if ($origStr !== '') {
                    $warnings[] = ['row' => $r, 'warning' => 'Precio original inválido: ' . $origStr];
                }
                continue;
            }

            $porcentaje = $this->parsePercent($pctStr);
            $distValue = $this->parseMoney($distStr);
            if ($porcentaje === null && $distValue !== null && $distValue > 0) {
                $porcentaje = round((1 - ($distValue / $precioOriginal)) * 100, 2);
            }

            if ($porcentaje === null || $porcentaje < 0 || $porcentaje >= 100) {
                $warnings[] = ['row' => $r, 'warning' => 'Porcentaje agencia inválido (vacío o fuera de rango).'];
                continue;
            }

            $precioDistribuidor = round($precioOriginal * (1 - $porcentaje / 100), 2);
            if ($distValue !== null && $distValue > 0 && abs($distValue - $precioDistribuidor) > 5) {
                $warnings[] = ['row' => $r, 'warning' => 'El valor Distribuidor no coincide con la fórmula (se calculará con %).'];
            }

            $parsed[] = [
                'dimensiones_valores' => $dimValues,
                'precio_original' => $precioOriginal,
                'porcentaje_agencia' => $porcentaje,
                'precio_distribuidor' => $precioDistribuidor,
            ];
        }

        if ($dryRun) {
            return response()->json([
                'message' => 'Previsualización generada',
                'data' => [
                    'total_encontradas' => count($parsed),
                    'preview' => array_slice($parsed, 0, 50),
                    'warnings' => array_slice($warnings, 0, 100),
                ],
            ]);
        }

        $userId = $request->user()?->id;
        $inserted = 0;
        $skipped = 0;

        DB::beginTransaction();
        try {
            foreach ($parsed as $item) {
                foreach (($item['dimensiones_valores'] ?? []) as $dim => $val) {
                    $val = trim((string) $val);
                    if ($val === '') continue;
                    $dv = LiqDimensionValor::where('esquema_id', $esquema->id)
                        ->where('nombre_dimension', $dim)
                        ->where('valor', $val)
                        ->first();
                    if (! $dv) {
                        LiqDimensionValor::create([
                            'esquema_id' => $esquema->id,
                            'nombre_dimension' => $dim,
                            'valor' => $val,
                            'orden_display' => 0,
                            'activo' => true,
                        ]);
                    } elseif (! $dv->activo) {
                        $dv->update(['activo' => true]);
                    }
                }
            }

            foreach ($parsed as $item) {
                $dimVals = (array) ($item['dimensiones_valores'] ?? []);
                $q = LiqLineaTarifa::where('esquema_id', $esquema->id)
                    ->whereDate('vigencia_desde', $vigDesde);
                if ($vigHasta) {
                    $q->whereDate('vigencia_hasta', $vigHasta);
                } else {
                    $q->whereNull('vigencia_hasta');
                }
                foreach ($dimVals as $dim => $val) {
                    $q->where("dimensiones_valores->$dim", (string) $val);
                }
                if ($q->exists()) {
                    $skipped++;
                    continue;
                }

                $linea = LiqLineaTarifa::create([
                    'esquema_id' => $esquema->id,
                    'dimensiones_valores' => $dimVals,
                    'precio_original' => $item['precio_original'],
                    'porcentaje_agencia' => $item['porcentaje_agencia'],
                    'precio_distribuidor' => $item['precio_distribuidor'],
                    'vigencia_desde' => $vigDesde,
                    'vigencia_hasta' => $vigHasta,
                    'creado_por' => $userId,
                    'activo' => true,
                ]);

                LiqAuditoriaTarifa::create([
                    'linea_tarifa_id' => $linea->id,
                    'accion' => 'creacion',
                    'valores_anteriores' => null,
                    'valores_nuevos' => $linea->toArray(),
                    'usuario_id' => $userId,
                    'motivo' => $data['motivo'],
                    'created_at' => now(),
                ]);

                $inserted++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'No se pudo importar: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Importación completa: $inserted líneas creadas, $skipped omitidas.",
            'data' => [
                'inserted' => $inserted,
                'skipped' => $skipped,
                'warnings' => array_slice($warnings, 0, 200),
            ],
        ], 201);
    }

    // PUT /liq/lineas/{lineaTarifa}/aprobar
    public function aprobarLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:3',
        ]);

        $user = $request->user();
        $userId = $user?->id;
        if (!$userId) {
            return response()->json(['error' => 'Usuario no autenticado'], 401);
        }
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $puedeAutoAprobar = in_array($role, ['admin', 'admin2'], true);

        return DB::transaction(function () use ($lineaTarifa, $userId, $data, $puedeAutoAprobar) {
            /** @var LiqLineaTarifa $linea */
            $linea = LiqLineaTarifa::whereKey($lineaTarifa->id)->lockForUpdate()->firstOrFail();

            if (!$linea->activo) {
                return response()->json(['error' => 'No se puede aprobar una línea inactiva'], 422);
            }
            if ($linea->aprobado_por) {
                return response()->json(['error' => 'Esta línea ya fue aprobada'], 422);
            }
            if ($linea->creado_por && (int) $linea->creado_por === (int) $userId && !$puedeAutoAprobar) {
                return response()->json(['error' => 'La aprobación requiere un segundo usuario (salvo Admin/Admin 2)'], 422);
            }

            $dimensiones = $linea->dimensiones_valores ?? [];
            $desde = $linea->vigencia_desde?->toDateString();
            $hasta = $linea->vigencia_hasta?->toDateString();
            if (!$desde) {
                return response()->json(['error' => 'La línea no tiene vigencia_desde válida'], 422);
            }

            // Cerrar automáticamente líneas aprobadas previas que solapan vigencia para la misma combinación
            $otras = $this->queryLineasPorDimensiones($linea->esquema_id, $dimensiones)
                ->where('activo', true)
                ->whereNotNull('aprobado_por')
                ->where('id', '!=', $linea->id)
                ->where($this->vigenciaSolapaCallback($desde, $hasta))
                ->lockForUpdate()
                ->get();

            $cierreHasta = Carbon::parse($desde)->subDay()->toDateString();
            foreach ($otras as $otra) {
                // Si la línea anterior empieza después o igual al inicio de la nueva, no podemos cerrarla sin dejar rango inválido.
                if (Carbon::parse($otra->vigencia_desde)->greaterThanOrEqualTo(Carbon::parse($desde))) {
                    return response()->json(['error' => 'Existe una línea aprobada con vigencia_desde >= a la nueva. Revise el historial antes de aprobar.'], 422);
                }
                if (Carbon::parse($cierreHasta)->lessThan(Carbon::parse($otra->vigencia_desde))) {
                    return response()->json(['error' => 'No se puede cerrar la línea anterior: el cierre quedaría antes de su vigencia_desde'], 422);
                }

                $anterior = $otra->toArray();
                $otra->update([
                    'vigencia_hasta' => $cierreHasta,
                ]);

                LiqAuditoriaTarifa::create([
                    'linea_tarifa_id' => $otra->id,
                    'accion' => 'modificacion',
                    'valores_anteriores' => $anterior,
                    'valores_nuevos' => ['vigencia_hasta' => $cierreHasta],
                    'usuario_id' => $userId,
                    'motivo' => $data['motivo'],
                    'created_at' => now(),
                ]);
            }

            $linea->update([
                'aprobado_por' => $userId,
                'fecha_aprobacion' => now(),
            ]);

            LiqAuditoriaTarifa::create([
                'linea_tarifa_id' => $linea->id,
                'accion' => 'aprobacion',
                'valores_anteriores' => null,
                'valores_nuevos' => ['aprobado_por' => $userId, 'fecha_aprobacion' => now()->toIso8601String()],
                'usuario_id' => $userId,
                'motivo' => $data['motivo'],
                'created_at' => now(),
            ]);

            return response()->json(['data' => $linea->fresh(), 'message' => 'Línea aprobada']);
        });
    }

    // PUT /liq/lineas/{lineaTarifa}/desactivar
    public function desactivarLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:3',
        ]);
        $anterior = $lineaTarifa->toArray();
        $lineaTarifa->update(['activo' => false]);
        LiqAuditoriaTarifa::create([
            'linea_tarifa_id' => $lineaTarifa->id,
            'accion' => 'desactivacion',
            'valores_anteriores' => $anterior,
            'valores_nuevos' => ['activo' => false],
            'usuario_id' => $request->user()?->id,
            'motivo' => $data['motivo'],
            'created_at' => now(),
        ]);
        return response()->json(['message' => 'Línea desactivada']);
    }

    // PUT /liq/mapeos-concepto/{id}/desactivar (delegated from LiqClienteController)
    public function desactivarMapeoConcepto(int $id): JsonResponse
    {
        \App\Models\LiqMapeoConcepto::findOrFail($id)->update(['activo' => false]);
        return response()->json(['message' => 'Mapeo desactivado']);
    }

    // PUT /liq/mapeos-sucursal/{id}/desactivar
    public function desactivarMapeoSucursal(int $id): JsonResponse
    {
        \App\Models\LiqMapeoSucursal::findOrFail($id)->update(['activo' => false]);
        return response()->json(['message' => 'Mapeo desactivado']);
    }

    private function filtrarYValidarDimensionesValores(LiqEsquemaTarifario $esquema, array $dimensionesValores): array
    {
        $dimensionesRequeridas = $esquema->dimensiones ?? [];

        $keysExtra = array_diff(array_keys($dimensionesValores), $dimensionesRequeridas);
        if (count($keysExtra) > 0) {
            return ['error' => 'Dimensiones inválidas para el esquema: ' . implode(', ', $keysExtra)];
        }

        $filtered = [];
        foreach ($dimensionesRequeridas as $dim) {
            $valor = $dimensionesValores[$dim] ?? null;
            $valor = is_string($valor) ? trim($valor) : $valor;

            if ($valor === null || $valor === '') {
                return ['error' => "Falta la dimensión: {$dim}"];
            }
            $filtered[$dim] = $valor;
        }

        // Si la dimensión tiene valores cargados, validar contra esos valores activos para evitar typos.
        foreach ($filtered as $dim => $valor) {
            $tieneCatalogo = LiqDimensionValor::where('esquema_id', $esquema->id)->where('nombre_dimension', $dim)->exists();
            if ($tieneCatalogo) {
                $existe = LiqDimensionValor::where('esquema_id', $esquema->id)
                    ->where('nombre_dimension', $dim)
                    ->where('valor', $valor)
                    ->where('activo', true)
                    ->exists();
                if (!$existe) {
                    return ['error' => "El valor '{$valor}' no existe o está inactivo para la dimensión '{$dim}'"];
                }
            }
        }

        return $filtered;
    }

    private function queryLineasPorDimensiones(int $esquemaId, array $dimensionesValores)
    {
        $q = LiqLineaTarifa::where('esquema_id', $esquemaId);
        foreach ($dimensionesValores as $dim => $valor) {
            $q->where("dimensiones_valores->{$dim}", $valor);
        }
        return $q;
    }

    private function vigenciaSolapaCallback(string $desde, ?string $hasta): \Closure
    {
        return function ($q) use ($desde, $hasta) {
            $hasta = $hasta ?? '9999-12-31';
            $q->where('vigencia_desde', '<=', $hasta)
              ->where(function ($sub) use ($desde) {
                  $sub->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $desde);
              });
        };
    }

    private function normHeader(string $s): string
    {
        $s = Str::ascii(mb_strtolower(trim($s)));
        $s = preg_replace('/\s+/', ' ', $s) ?: $s;
        $s = str_replace([':', '.', ';'], '', $s);
        return trim($s);
    }

    /**
     * @param array<string, int> $headers
     * @param array<int, string> $needles
     */
    private function findCol(array $headers, array $needles): ?int
    {
        foreach ($headers as $h => $colIndex) {
            $ok = true;
            foreach ($needles as $n) {
                $n = $this->normHeader($n);
                if ($n === '') {
                    continue;
                }
                if (! Str::contains($h, $n)) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) {
                return $colIndex;
            }
        }
        return null;
    }

    private function parsePercent(string $s): ?float
    {
        $s = trim($s);
        if ($s === '') {
            return null;
        }
        $s = str_replace('%', '', $s);
        $s = str_replace(',', '.', $s);
        $s = preg_replace('/[^\d.\-]/', '', $s) ?: $s;
        if ($s === '' || $s === '.' || $s === '-') {
            return null;
        }
        $v = (float) $s;
        return is_finite($v) ? $v : null;
    }

    private function parseMoney(string $s): ?float
    {
        $s = trim($s);
        if ($s === '') {
            return null;
        }
        $s = Str::lower($s);
        $s = str_replace(['$', 'ars', 'ar$', ' '], ['', '', '', ''], $s);
        // Mantener dígitos, coma, punto y signo.
        $s = preg_replace('/[^\d,.\-]/', '', $s) ?: $s;
        if ($s === '' || $s === '-' || $s === '.' || $s === ',') {
            return null;
        }

        $lastComma = strrpos($s, ',');
        $lastDot = strrpos($s, '.');
        if ($lastComma !== false && $lastDot !== false) {
            // Si el último separador es coma, asumimos coma decimal (es-AR).
            if ($lastComma > $lastDot) {
                $s = str_replace('.', '', $s);
                $s = str_replace(',', '.', $s);
            } else {
                // Punto decimal (en-US) y coma miles.
                $s = str_replace(',', '', $s);
            }
        } elseif ($lastComma !== false) {
            // Solo coma: asumimos decimal si hay 1-2 dígitos al final, sino miles.
            $decLen = strlen($s) - $lastComma - 1;
            if ($decLen >= 1 && $decLen <= 2) {
                $s = str_replace('.', '', $s);
                $s = str_replace(',', '.', $s);
            } else {
                $s = str_replace(',', '', $s);
            }
        } else {
            // Solo punto: asumimos punto decimal.
            $s = str_replace(',', '', $s);
        }

        $v = (float) $s;
        if (! is_finite($v)) {
            return null;
        }
        return round($v, 2);
    }
}
