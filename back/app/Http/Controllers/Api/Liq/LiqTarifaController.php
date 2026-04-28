<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqDimensionValor;
use App\Models\LiqLineaTarifa;
use App\Models\LiqAuditoriaTarifa;
use App\Models\LiqOperacion;
use App\Models\LiqTarifaPatente;
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

        // Agregar count de overrides por línea
        $overrideCounts = LiqTarifaPatente::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->selectRaw('linea_tarifa_id, COUNT(*) as total')
            ->groupBy('linea_tarifa_id')
            ->pluck('total', 'linea_tarifa_id');

        $lineas->each(function ($linea) use ($overrideCounts) {
            $linea->overrides_count = $overrideCounts->get($linea->id, 0);
        });

        return response()->json(['data' => $lineas]);
    }

    // GET /liq/esquemas/{esquema}/tarifas-patente
    public function tarifasPatente(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $query = LiqTarifaPatente::where('esquema_id', $esquema->id)
            ->with([
                'lineaTarifa:id,esquema_id,dimensiones_valores,precio_original,porcentaje_agencia,precio_distribuidor,vigencia_desde,vigencia_hasta,activo,aprobado_por',
            ])
            ->orderBy('activo', 'desc')
            ->orderBy('vigencia_desde', 'desc');

        if ($request->boolean('solo_activas')) {
            $query->where('activo', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    // POST /liq/esquemas/{esquema}/tarifas-patente
    public function storeTarifaPatente(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para crear tarifas por patente.'], 403);
        }

        $data = $request->validate([
            'patente' => 'required|string|max:40',
            'dimensiones_valores' => 'required|array',
            'linea_tarifa_id' => 'required|integer',
            'vigencia_desde' => 'required|date',
            'vigencia_hasta' => 'nullable|date|after_or_equal:vigencia_desde',
            'motivo' => 'nullable|string|min:3',
        ]);

        $patenteNorm = $this->normalizarPatente((string) $data['patente']);
        if ($patenteNorm === '') {
            return response()->json(['error' => 'Patente inválida'], 422);
        }

        $dimMatch = $this->filtrarDimensionesValoresParaMatch($esquema, (array) $data['dimensiones_valores']);
        if (isset($dimMatch['error'])) {
            return response()->json(['error' => $dimMatch['error']], 422);
        }

        /** @var LiqLineaTarifa|null $lineaDestino */
        $lineaDestino = LiqLineaTarifa::where('id', (int) $data['linea_tarifa_id'])
            ->where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->first();

        if (! $lineaDestino) {
            return response()->json(['error' => 'La línea destino no existe, no pertenece al esquema o está inactiva'], 422);
        }
        if (! $lineaDestino->aprobado_por) {
            return response()->json(['error' => 'La línea destino debe estar aprobada para poder usarse por patente'], 422);
        }

        $vigDesde = Carbon::parse($data['vigencia_desde'])->toDateString();
        $vigHasta = isset($data['vigencia_hasta']) ? Carbon::parse($data['vigencia_hasta'])->toDateString() : null;

        $exists = LiqTarifaPatente::where('esquema_id', $esquema->id)
            ->where('patente_norm', $patenteNorm)
            ->where('activo', true)
            ->where($this->tarifaPatenteDimensionesCallback($dimMatch))
            ->where($this->vigenciaSolapaCallback($vigDesde, $vigHasta))
            ->exists();
        if ($exists) {
            return response()->json(['error' => 'Ya existe una tarifa por patente activa con esas dimensiones y vigencia superpuesta'], 422);
        }

        $tp = LiqTarifaPatente::create([
            'esquema_id' => $esquema->id,
            'patente_norm' => $patenteNorm,
            'dimensiones_valores' => $dimMatch,
            'linea_tarifa_id' => $lineaDestino->id,
            'vigencia_desde' => $vigDesde,
            'vigencia_hasta' => $vigHasta,
            'creado_por' => $request->user()?->id,
            'activo' => true,
        ]);

        return response()->json(['data' => $tp->load([
            'lineaTarifa:id,esquema_id,dimensiones_valores,precio_original,porcentaje_agencia,precio_distribuidor,vigencia_desde,vigencia_hasta,activo,aprobado_por',
        ]), 'message' => 'Tarifa por patente creada'], 201);
    }

    // PUT /liq/tarifas-patente/{tarifaPatente}/desactivar
    public function desactivarTarifaPatente(Request $request, LiqTarifaPatente $tarifaPatente): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (! in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['message' => 'No tenés permisos para desactivar tarifas por patente.'], 403);
        }
        $tarifaPatente->update(['activo' => false]);
        return response()->json(['message' => 'Tarifa por patente desactivada']);
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
            // OCASA fields
            'modelo_tarifa' => 'nullable|string|in:JORNADA,JORNADA_KM,PRODUCTIVIDAD',
            'costo_fijo_base' => 'nullable|numeric|min:0',
            'tarifa_km_original' => 'nullable|numeric|min:0',
            'tarifa_km_distribuidor' => 'nullable|numeric|min:0',
            'umbral_km' => 'nullable|integer|min:0',
            'modo_productividad' => 'nullable|string|in:porcentaje,por_parada,por_bulto',
            'tarifa_parada_distrib' => 'nullable|numeric|min:0',
            'tarifa_bulto_distrib' => 'nullable|numeric|min:0',
            'capacidad_vehiculo_kg' => 'nullable|integer|min:0',
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

        $lineaData = [
            'esquema_id' => $esquema->id,
            'dimensiones_valores' => $dimensionesValores,
            'precio_original' => $data['precio_original'],
            'porcentaje_agencia' => $data['porcentaje_agencia'],
            'precio_distribuidor' => $precioDistribuidor,
            'vigencia_desde' => $data['vigencia_desde'],
            'vigencia_hasta' => $data['vigencia_hasta'] ?? null,
            'creado_por' => $request->user()?->id,
            'activo' => true,
        ];

        // OCASA fields
        $ocasaFields = ['modelo_tarifa', 'costo_fijo_base', 'tarifa_km_original', 'tarifa_km_distribuidor',
            'umbral_km', 'modo_productividad', 'tarifa_parada_distrib', 'tarifa_bulto_distrib', 'capacidad_vehiculo_kg'];
        foreach ($ocasaFields as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $lineaData[$field] = $data[$field];
            }
        }

        $linea = LiqLineaTarifa::create($lineaData);

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

    // PUT /liq/lineas/{lineaTarifa} — Feature B: editar línea existente
    public function updateLinea(Request $request, LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $data = $request->validate([
            'precio_original' => 'nullable|numeric|min:0.01',
            'precio_distribuidor' => 'nullable|numeric|min:0',
            'porcentaje_agencia' => 'nullable|numeric|min:0|max:99.99',
            'modelo_tarifa' => 'nullable|string|in:JORNADA,JORNADA_KM,PRODUCTIVIDAD',
            'tarifa_km_original' => 'nullable|numeric|min:0',
            'tarifa_km_distribuidor' => 'nullable|numeric|min:0',
            'umbral_km' => 'nullable|integer|min:0',
            'modo_productividad' => 'nullable|string|in:porcentaje,por_parada,por_bulto',
            'tarifa_parada_distrib' => 'nullable|numeric|min:0',
            'tarifa_bulto_distrib' => 'nullable|numeric|min:0',
            'costo_fijo_base' => 'nullable|numeric|min:0',
            'capacidad_vehiculo_kg' => 'nullable|integer|min:0',
            // SPEC v4 — overrides distribuidor/patente
            'factor_km' => 'nullable|numeric|min:0|max:5',
            'distribuidor_nombre' => 'nullable|string|max:120',
            'patente_match' => 'nullable|string|max:20',
            'vigencia_desde' => 'nullable|date',
            'vigencia_hasta' => 'nullable|date|after_or_equal:vigencia_desde',
            'motivo' => 'required|string|min:5',
        ]);

        $valoresAnteriores = $lineaTarifa->toArray();

        // Recalcular precio_distribuidor o porcentaje según cuál venga
        $precioOriginal = $data['precio_original'] ?? (float) $lineaTarifa->precio_original;
        if (isset($data['precio_distribuidor']) && $data['precio_distribuidor'] > 0) {
            $pctAgencia = $precioOriginal > 0
                ? round((1 - $data['precio_distribuidor'] / $precioOriginal) * 100, 4)
                : 0;
            $precioDistribuidor = (float) $data['precio_distribuidor'];
        } elseif (isset($data['porcentaje_agencia'])) {
            $pctAgencia = (float) $data['porcentaje_agencia'];
            $precioDistribuidor = round($precioOriginal * (1 - $pctAgencia / 100), 2);
        } else {
            $pctAgencia = (float) $lineaTarifa->porcentaje_agencia;
            $precioDistribuidor = (float) $lineaTarifa->precio_distribuidor;
        }

        $updateData = [
            'precio_original' => $precioOriginal,
            'porcentaje_agencia' => $pctAgencia,
            'precio_distribuidor' => $precioDistribuidor,
        ];

        if (isset($data['vigencia_desde'])) $updateData['vigencia_desde'] = $data['vigencia_desde'];
        if (isset($data['vigencia_hasta'])) $updateData['vigencia_hasta'] = $data['vigencia_hasta'];

        // Campos OCASA opcionales + SPEC v4 overrides distribuidor/patente
        $ocasaFields = [
            'modelo_tarifa', 'costo_fijo_base', 'tarifa_km_original', 'tarifa_km_distribuidor',
            'umbral_km', 'modo_productividad', 'tarifa_parada_distrib', 'tarifa_bulto_distrib',
            'capacidad_vehiculo_kg', 'factor_km', 'distribuidor_nombre', 'patente_match',
        ];
        foreach ($ocasaFields as $field) {
            // Permitir setear a null/string vacío explícitamente para limpiar override
            if (array_key_exists($field, $data)) {
                $updateData[$field] = $data[$field] === '' ? null : $data[$field];
            }
        }

        // Si estaba aprobada, vuelve a borrador
        $volvioABorrador = false;
        if ($lineaTarifa->aprobado_por) {
            $updateData['aprobado_por'] = null;
            $updateData['fecha_aprobacion'] = null;
            $volvioABorrador = true;
        }

        $lineaTarifa->update($updateData);

        // Auditoría
        LiqAuditoriaTarifa::create([
            'linea_tarifa_id' => $lineaTarifa->id,
            'accion' => 'edicion',
            'valores_anteriores' => $valoresAnteriores,
            'valores_nuevos' => $lineaTarifa->fresh()->toArray(),
            'usuario_id' => $request->user()?->id,
            'motivo' => $data['motivo'],
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => $lineaTarifa->fresh(),
            'message' => $volvioABorrador
                ? 'Línea actualizada. Volvió a borrador y requiere aprobación.'
                : 'Línea actualizada.',
        ]);
    }

    /**
     * SPEC v4 · GET /liq/lineas/{id}/historial
     * Devuelve la cronología de cambios de una línea con campos modificados,
     * motivo, usuario y snapshots para preservar auditoría.
     */
    public function historialLinea(LiqLineaTarifa $lineaTarifa): JsonResponse
    {
        $historial = LiqAuditoriaTarifa::query()
            ->where('linea_tarifa_id', $lineaTarifa->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        // Por cada entrada, calcular qué campos cambiaron entre antes y después
        $cronologia = $historial->map(function ($h) {
            $antes = is_array($h->valores_anteriores) ? $h->valores_anteriores : [];
            $despues = is_array($h->valores_nuevos) ? $h->valores_nuevos : [];
            $camposModificados = [];
            foreach ($despues as $key => $val) {
                $valAntes = $antes[$key] ?? null;
                if ((string) $valAntes !== (string) $val) {
                    $camposModificados[$key] = ['antes' => $valAntes, 'despues' => $val];
                }
            }
            // Resolver nombre/email del usuario
            $userInfo = null;
            if ($h->usuario_id) {
                $u = \DB::table('users')->where('id', $h->usuario_id)->select('id', 'name', 'email')->first();
                if ($u) $userInfo = ['id' => $u->id, 'name' => $u->name ?? $u->email, 'email' => $u->email];
            }
            return [
                'id'          => $h->id,
                'accion'      => $h->accion,
                'motivo'      => $h->motivo,
                'usuario'     => $userInfo,
                'created_at'  => $h->created_at,
                'campos_modificados' => $camposModificados,
                'valores_anteriores' => $antes,
                'valores_nuevos'     => $despues,
            ];
        });

        return response()->json(['data' => $cronologia]);
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

    // POST /liq/esquemas/{esquema}/importar-oca - importar tarifas OCA desde Excel multi-sección
    public function importarOca(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
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
        ]);

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

        $parsed = [];
        $warnings = [];
        $sheetCount = $spreadsheet->getSheetCount();

        for ($si = 0; $si < $sheetCount; $si++) {
            $ws = $spreadsheet->getSheet($si);
            $sheetName = $ws->getTitle();
            $maxRow = (int) $ws->getHighestDataRow();
            $maxColIdx = Coordinate::columnIndexFromString($ws->getHighestDataColumn());

            $currentSection = null;

            for ($r = 1; $r <= $maxRow; $r++) {
                // Leer todas las celdas de la fila
                $cells = [];
                for ($c = 1; $c <= $maxColIdx; $c++) {
                    $ref = Coordinate::stringFromColumnIndex($c) . $r;
                    $cells[$c] = trim((string) ($ws->getCell($ref)->getFormattedValue() ?? ''));
                }

                $nonEmpty = array_filter($cells, fn ($v) => $v !== '');
                if (empty($nonEmpty)) {
                    continue;
                }

                // Detectar fila de encabezado de sección (una sola celda prominente o header de sección)
                $firstCell = $cells[1] ?? '';
                $secondCell = $cells[2] ?? '';
                $thirdCell = $cells[3] ?? '';
                $firstUpper = mb_strtoupper(trim($firstCell));

                // Detectar header de tabla: SUCURSAL | CHOFER | ORIGINAL | DISTRIBUIDOR
                if ($this->normHeader($firstCell) === 'sucursal' && Str::contains($this->normHeader($secondCell), 'chofer')) {
                    // Es una fila de headers, encontrar columnas
                    $colSucursal = null;
                    $colChofer = null;
                    $colOriginal = null;
                    $colDist = null;
                    for ($c = 1; $c <= $maxColIdx; $c++) {
                        $norm = $this->normHeader($cells[$c] ?? '');
                        if ($norm === 'sucursal') $colSucursal = $c;
                        if (Str::contains($norm, 'chofer') || Str::contains($norm, 'distribuidor_nombre')) $colChofer = $c;
                        if ($norm === 'original') $colOriginal = $c;
                        if ($norm === 'distribuidor') $colDist = $c;
                    }
                    continue;
                }

                // Detectar sección: fila con solo una celda en col A que no es datos
                // Ejemplos: "CHASIS", "UNIDAD 700 KG", "TARIFAS ORIGINALES..."
                if ($firstCell !== '' && $thirdCell === '' && $secondCell === '' && ! is_numeric(str_replace(['$', '.', ',', ' '], '', $firstCell))) {
                    $currentSection = trim($firstCell);
                    continue;
                }

                // También detectar secciones tipo "UNIDADES 0.5 T" con algo en col B
                if ($firstCell !== '' && Str::startsWith($firstUpper, 'UNIDADES') || Str::startsWith($firstUpper, 'TARIFA')) {
                    $sectionLabel = trim($firstCell . ' ' . $secondCell);
                    if ($sectionLabel !== '' && $this->parseMoney($firstCell) === null) {
                        $currentSection = $sectionLabel;
                        continue;
                    }
                }

                // Detectar filas de precio en formato: concepto | precio
                // Ejemplo: "Paquete entregado" | "$1.820,00"  o  "Paquetes comunes" | "$2.165,80"
                if ($firstCell !== '' && $this->parseMoney($firstCell) === null) {
                    $priceVal = $this->parseMoney($secondCell);
                    $distVal = $thirdCell !== '' ? $this->parseMoney($thirdCell) : null;

                    // Fila con concepto + precio en col B (formato Interior)
                    if ($priceVal !== null && $priceVal > 0 && count($nonEmpty) <= 3) {
                        $concepto = trim($firstCell);
                        $porcentaje = ($distVal !== null && $distVal > 0)
                            ? round((1 - ($distVal / $priceVal)) * 100, 2)
                            : 0.0;
                        $precioDistribuidor = ($distVal !== null && $distVal > 0) ? $distVal : $priceVal;

                        $parsed[] = [
                            'dimensiones_valores' => [
                                'sucursal' => $currentSection ?? $sheetName,
                                'concepto' => $concepto,
                            ],
                            'precio_original' => $priceVal,
                            'porcentaje_agencia' => $porcentaje,
                            'precio_distribuidor' => round($precioDistribuidor, 2),
                            'seccion' => $currentSection,
                            'hoja' => $sheetName,
                        ];
                        continue;
                    }
                }

                // Detectar filas de datos tabulares: SUCURSAL | CHOFER | $ORIGINAL | $DISTRIBUIDOR
                // (cuando hay columnas con formato moneda en posiciones 3 y 4)
                if (count($nonEmpty) >= 3) {
                    $sucursal = trim($cells[1] ?? '');
                    $chofer = trim($cells[2] ?? '');
                    $origVal = $this->parseMoney($cells[3] ?? '');
                    $distVal = (isset($cells[4]) && $cells[4] !== '') ? $this->parseMoney($cells[4]) : null;

                    if ($sucursal !== '' && $chofer !== '' && $origVal !== null && $origVal > 0) {
                        $porcentaje = ($distVal !== null && $distVal > 0)
                            ? round((1 - ($distVal / $origVal)) * 100, 2)
                            : 0.0;
                        $precioDistribuidor = ($distVal !== null && $distVal > 0) ? $distVal : $origVal;

                        $parsed[] = [
                            'dimensiones_valores' => [
                                'sucursal' => $sucursal,
                                'concepto' => $currentSection ?? 'General',
                            ],
                            'precio_original' => $origVal,
                            'porcentaje_agencia' => $porcentaje,
                            'precio_distribuidor' => round($precioDistribuidor, 2),
                            'chofer' => $chofer,
                            'seccion' => $currentSection,
                            'hoja' => $sheetName,
                        ];
                        continue;
                    }
                }

                // Detectar filas de precio de Ultima Milla (múltiples precios en fila)
                // Ejemplo: $2.165,80 | $2.412,76 | $1.313,75 | $1.368,33
                $allMoney = true;
                $moneyValues = [];
                foreach ($nonEmpty as $c => $v) {
                    $mv = $this->parseMoney($v);
                    if ($mv === null) {
                        $allMoney = false;
                        break;
                    }
                    $moneyValues[$c] = $mv;
                }
                // No auto-importar filas de precios sueltos sin contexto, solo advertir
                if ($allMoney && count($moneyValues) >= 2) {
                    $warnings[] = [
                        'row' => $r,
                        'sheet' => $sheetName,
                        'warning' => "Fila con múltiples precios sin encabezado de columna — revisar manualmente: " . implode(' | ', array_map(fn($v) => '$' . number_format($v, 2, ',', '.'), $moneyValues)),
                    ];
                }
            }
        }

        if (empty($parsed)) {
            return response()->json([
                'error' => 'No se encontraron líneas de tarifa importables. ' .
                    'El Excel OCA debe tener secciones con formato SUCURSAL | CHOFER | ORIGINAL | DISTRIBUIDOR, ' .
                    'o concepto | precio.',
                'warnings' => array_slice($warnings, 0, 50),
            ], 422);
        }

        $userId = $request->user()?->id;
        $inserted = 0;
        $skipped = 0;

        DB::beginTransaction();
        try {
            // Crear dimension values
            foreach ($parsed as $item) {
                foreach (($item['dimensiones_valores'] ?? []) as $dim => $val) {
                    $val = trim((string) $val);
                    if ($val === '') continue;
                    if (! in_array($dim, $esquema->dimensiones ?? [], true)) continue;
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

            // Crear líneas de tarifa
            foreach ($parsed as $item) {
                $dimVals = [];
                foreach (($item['dimensiones_valores'] ?? []) as $dim => $val) {
                    if (in_array($dim, $esquema->dimensiones ?? [], true)) {
                        $dimVals[$dim] = trim((string) $val);
                    }
                }
                if (empty($dimVals)) continue;

                // Verificar si ya existe
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
                // Para OCA también comparar precio original (puede haber mismas dims con distinto precio por chofer)
                $q->where('precio_original', $item['precio_original']);

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
                    'valores_nuevos' => array_merge($linea->toArray(), array_filter([
                        'chofer' => $item['chofer'] ?? null,
                        'seccion' => $item['seccion'] ?? null,
                        'hoja' => $item['hoja'] ?? null,
                    ])),
                    'usuario_id' => $userId,
                    'motivo' => $data['motivo'] . ' (importación OCA)',
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
            'message' => "Importación OCA completa: $inserted líneas creadas, $skipped omitidas.",
            'data' => [
                'inserted' => $inserted,
                'skipped' => $skipped,
                'total_parseadas' => count($parsed),
                'preview' => array_slice($parsed, 0, 30),
                'warnings' => array_slice($warnings, 0, 100),
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

            $err = $this->aprobarLineaLocked($linea, (int) $userId, (string) $data['motivo']);
            if ($err) {
                return response()->json(['error' => $err], 422);
            }

            return response()->json(['data' => $linea->fresh(), 'message' => 'Línea aprobada']);
        });
    }

    // POST /liq/esquemas/{esquema}/lineas/aprobar-todas - aprobar todas las líneas activas pendientes del esquema
    public function aprobarTodasLineas(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
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
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'Solo Admin/Admin2 puede aprobar en lote'], 403);
        }

        return DB::transaction(function () use ($esquema, $userId, $data) {
            $pendientes = LiqLineaTarifa::where('esquema_id', $esquema->id)
                ->where('activo', true)
                ->whereNull('aprobado_por')
                ->orderBy('vigencia_desde', 'asc')
                ->lockForUpdate()
                ->get();

            if ($pendientes->isEmpty()) {
                return response()->json(['message' => 'No hay líneas pendientes para aprobar']);
            }

            // Agrupar por combinación de dimensiones, para aprobar en orden cronológico por cada combinación.
            $groups = $pendientes->groupBy(function (LiqLineaTarifa $l) {
                $dims = (array) ($l->dimensiones_valores ?? []);
                ksort($dims);
                return json_encode($dims, JSON_UNESCAPED_UNICODE);
            });

            $approved = 0;
            foreach ($groups as $key => $lines) {
                /** @var \Illuminate\Support\Collection<int, LiqLineaTarifa> $lines */
                $sorted = $lines->sortBy(fn (LiqLineaTarifa $l) => $l->vigencia_desde?->toDateString() ?? '9999-12-31')->values();
                foreach ($sorted as $linea) {
                    // Re-lock puntual por id para garantizar estado actual en caso de re-queries.
                    $locked = LiqLineaTarifa::whereKey($linea->id)->lockForUpdate()->first();
                    if (!$locked) continue;
                    if (!$locked->activo || $locked->aprobado_por) continue;

                    $err = $this->aprobarLineaLocked($locked, (int) $userId, (string) $data['motivo']);
                    if ($err) {
                        // Abortamos todo el lote para mantener atomicidad.
                        return response()->json(['error' => $err], 422);
                    }
                    $approved++;
                }
            }

            return response()->json([
                'message' => "Aprobadas {$approved} líneas.",
                'data' => ['approved' => $approved],
            ]);
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

    private function filtrarDimensionesValoresParaMatch(LiqEsquemaTarifario $esquema, array $dimensionesValores): array
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
            $filtered[$dim] = $this->canonicalizarDimensionValorMatch($esquema->id, (string) $dim, (string) $valor);
        }

        return $filtered;
    }

    private function canonicalizarDimensionValorMatch(int $esquemaId, string $nombreDimension, string $raw): string
    {
        $rawNorm = $this->normalizarTextoMatch($raw);
        if ($rawNorm === '') {
            return '';
        }

        $valores = LiqDimensionValor::where('esquema_id', $esquemaId)
            ->where('nombre_dimension', $nombreDimension)
            ->where('activo', true)
            ->get(['valor']);

        foreach ($valores as $v) {
            if ($this->normalizarTextoMatch((string) $v->valor) === $rawNorm) {
                return (string) $v->valor;
            }
        }

        return $rawNorm;
    }

    private function normalizarTextoMatch(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }
        $value = Str::upper($value);
        $value = preg_replace('/[^\pL\pN]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        return trim($value);
    }

    private function normalizarPatente(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') return '';
        return strtoupper(preg_replace('/[\s\-]/', '', $raw) ?? $raw);
    }

    private function tarifaPatenteDimensionesCallback(array $dimensionesValores): \Closure
    {
        return function ($q) use ($dimensionesValores) {
            foreach ($dimensionesValores as $dim => $valor) {
                $q->where("dimensiones_valores->{$dim}", $valor);
            }
        };
    }

    /**
     * Arma la query de líneas "mismas dimensiones". Soporta dos esquemas:
     *
     * - Antiguo (dimensiones_valores JSON): filtra por cada clave → valor.
     * - v5 (OCASA unificado, ruta_codigo + capacidad + distribuidor + patente + es_tarifa_base):
     *   si $dimensionesValores está vacío Y se pasa $linea con ruta_codigo, se usan esas columnas.
     *
     * Sin fix, una línea v5 con dimensiones_valores=[] matcheaba TODAS las del esquema y
     * disparaba "Existe una línea aprobada con vigencia_desde >= a la nueva" aun entre
     * overrides de distribuidores distintos.
     */
    private function queryLineasPorDimensiones(int $esquemaId, array $dimensionesValores, ?LiqLineaTarifa $linea = null)
    {
        $q = LiqLineaTarifa::where('esquema_id', $esquemaId);

        if (!empty($dimensionesValores)) {
            foreach ($dimensionesValores as $dim => $valor) {
                $q->where("dimensiones_valores->{$dim}", $valor);
            }
            return $q;
        }

        // Fallback schema v5: usar identificadores de la línea
        if ($linea && $linea->ruta_codigo !== null) {
            $q->where('ruta_codigo', $linea->ruta_codigo)
              ->where('capacidad_vehiculo_kg', $linea->capacidad_vehiculo_kg)
              ->where('es_tarifa_base', $linea->es_tarifa_base);
            $linea->distribuidor_nombre
                ? $q->where('distribuidor_nombre', $linea->distribuidor_nombre)
                : $q->whereNull('distribuidor_nombre');
            $linea->patente_match
                ? $q->where('patente_match', $linea->patente_match)
                : $q->whereNull('patente_match');
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

    private function aprobarLineaLocked(LiqLineaTarifa $linea, int $userId, string $motivo): ?string
    {
        $dimensiones = $linea->dimensiones_valores ?? [];
        $desde = $linea->vigencia_desde?->toDateString();
        $hasta = $linea->vigencia_hasta?->toDateString();
        if (!$desde) {
            return 'La línea no tiene vigencia_desde válida';
        }

        // Cerrar automáticamente líneas aprobadas previas que solapan vigencia para la misma combinación
        $otras = $this->queryLineasPorDimensiones($linea->esquema_id, $dimensiones, $linea)
            ->where('activo', true)
            ->whereNotNull('aprobado_por')
            ->where('id', '!=', $linea->id)
            ->where($this->vigenciaSolapaCallback($desde, $hasta))
            ->lockForUpdate()
            ->get();

        $cierreHasta = Carbon::parse($desde)->subDay()->toDateString();
        foreach ($otras as $otra) {
            if (Carbon::parse($otra->vigencia_desde)->greaterThanOrEqualTo(Carbon::parse($desde))) {
                return 'Existe una línea aprobada con vigencia_desde >= a la nueva. Revise el historial antes de aprobar.';
            }
            if (Carbon::parse($cierreHasta)->lessThan(Carbon::parse($otra->vigencia_desde))) {
                return 'No se puede cerrar la línea anterior: el cierre quedaría antes de su vigencia_desde';
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
                'motivo' => $motivo,
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
            'motivo' => $motivo,
            'created_at' => now(),
        ]);

        return null;
    }

    // =====================================================================
    // POST /liq/esquemas/{esquema}/aumento-preview — Previsualización de aumento porcentual
    // =====================================================================
    public function aumentoPreview(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $data = $request->validate([
            'porcentaje' => 'required|numeric',
            'sucursal' => 'nullable|string',
        ]);

        $pct = (float) $data['porcentaje'];
        $sucursalFilter = $data['sucursal'] ?? null;

        $query = LiqLineaTarifa::where('esquema_id', $esquema->id)->where('activo', true);
        if ($sucursalFilter) {
            $query->where('dimensiones_valores->sucursal', $sucursalFilter);
        }
        $lineas = $query->get();

        $preview = [];
        foreach ($lineas as $linea) {
            $dims = is_array($linea->dimensiones_valores) ? $linea->dimensiones_valores : [];
            $precioActual = (float) $linea->precio_original;
            $precioNuevo = round($precioActual * (1 + $pct / 100), 2);
            $variacion = $precioActual > 0 ? round(($precioNuevo - $precioActual) / $precioActual * 100, 2) : 0;
            $pctAg = (float) $linea->porcentaje_agencia;
            $distribNuevo = round($precioNuevo * (1 - $pctAg / 100), 2);

            // Buscar overrides
            $overrides = LiqTarifaPatente::where('esquema_id', $esquema->id)
                ->where('linea_tarifa_id', $linea->id)
                ->where('activo', true)
                ->with('lineaTarifa')
                ->get()
                ->map(function ($tp) {
                    $persona = \App\Models\Persona::find($tp->linea_tarifa_id ? null : null);
                    return [
                        'id' => $tp->id,
                        'patente' => $tp->patente_norm,
                        'precio_original_actual' => $tp->precio_original,
                        'modo_calculo' => $tp->modo_calculo,
                        'valor_referencia' => $tp->valor_referencia,
                    ];
                });

            $preview[] = [
                'linea_id' => $linea->id,
                'sucursal' => $dims['sucursal'] ?? null,
                'concepto' => $dims['concepto'] ?? $dims['contrato'] ?? null,
                'precio_actual' => $precioActual,
                'precio_nuevo' => $precioNuevo,
                'variacion_pct' => $variacion,
                'porcentaje_agencia' => $pctAg,
                'precio_distribuidor_nuevo' => $distribNuevo,
                'overrides_count' => $overrides->count(),
                'overrides' => $overrides,
            ];
        }

        return response()->json([
            'data' => [
                'lineas' => $preview,
                'resumen' => [
                    'total_lineas' => count($preview),
                    'con_overrides' => collect($preview)->where('overrides_count', '>', 0)->count(),
                    'porcentaje' => $pct,
                ],
            ],
        ]);
    }

    // =====================================================================
    // POST /liq/esquemas/{esquema}/aumento-aplicar — Aplicar aumento porcentual
    // =====================================================================
    public function aumentoAplicar(Request $request, LiqEsquemaTarifario $esquema): JsonResponse
    {
        $data = $request->validate([
            'motivo' => 'required|string|min:3',
            'lineas' => 'required|array',
            'lineas.*.linea_id' => 'required|integer',
            'lineas.*.precio_nuevo' => 'required|numeric|min:0',
            'lineas.*.overrides' => 'nullable|array',
            'lineas.*.overrides.*.id' => 'required|integer',
            'lineas.*.overrides.*.accion' => 'required|in:proporcional,mantener,eliminar',
        ]);

        $userId = $request->user()?->id;
        $motivo = $data['motivo'];
        $stats = ['actualizadas' => 0, 'overrides_ajustados' => 0, 'overrides_mantenidos' => 0, 'overrides_eliminados' => 0];

        DB::beginTransaction();
        try {
            foreach ($data['lineas'] as $cambio) {
                $linea = LiqLineaTarifa::where('esquema_id', $esquema->id)->findOrFail($cambio['linea_id']);
                $precioAnterior = (float) $linea->precio_original;
                $precioNuevo = (float) $cambio['precio_nuevo'];
                $variacion = $precioAnterior > 0 ? ($precioNuevo - $precioAnterior) / $precioAnterior : 0;
                $pctAg = (float) $linea->porcentaje_agencia;

                // Auditoría
                \App\Models\LiqAuditoriaTarifaLog::registrar(
                    $esquema->id, 'precio_original', $precioAnterior, $precioNuevo,
                    'aumento_porcentual', $motivo, $linea->id, null, $userId
                );

                // Actualizar línea genérica
                $linea->update([
                    'precio_original' => $precioNuevo,
                    'precio_distribuidor' => round($precioNuevo * (1 - $pctAg / 100), 2),
                ]);
                $stats['actualizadas']++;

                // Procesar overrides
                foreach ($cambio['overrides'] ?? [] as $ov) {
                    $override = LiqTarifaPatente::find($ov['id']);
                    if (!$override) continue;

                    switch ($ov['accion']) {
                        case 'proporcional':
                            $anteriorOv = (float) ($override->precio_original ?? 0);
                            if ($anteriorOv > 0) {
                                $nuevoOv = round($anteriorOv * (1 + $variacion), 2);
                                \App\Models\LiqAuditoriaTarifaLog::registrar(
                                    $esquema->id, 'precio_original', $anteriorOv, $nuevoOv,
                                    'aumento_porcentual', $motivo, null, $override->id, $userId
                                );
                                $override->update(['precio_original' => $nuevoOv, 'requiere_revision' => false]);
                            }
                            $stats['overrides_ajustados']++;
                            break;

                        case 'mantener':
                            $override->update(['requiere_revision' => true]);
                            $stats['overrides_mantenidos']++;
                            break;

                        case 'eliminar':
                            \App\Models\LiqAuditoriaTarifaLog::registrar(
                                $esquema->id, 'precio_original', (float) $override->precio_original, null,
                                'aumento_porcentual', $motivo, null, $override->id, $userId
                            );
                            $override->delete();
                            $stats['overrides_eliminados']++;
                            break;
                    }
                }
            }

            DB::commit();
            return response()->json(['message' => "Aumento aplicado: {$stats['actualizadas']} líneas.", 'data' => $stats]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error aplicando aumento: ' . $e->getMessage()], 500);
        }
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
