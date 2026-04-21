<?php

namespace App\Services\Liq;

use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqLineaTarifa;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;

/**
 * SPEC INTEGRAL Fase B — importador físico del Excel v5 OCASA.
 *
 * Lee un xlsx con la estructura real que acordamos con Matías (Excel que pasó el 21/04):
 * 1 hoja con columnas ruta | capacidad_vehiculo | modelo_tarifa | distribuidor_nombre |
 * patente | es_tarifa_base | costo_fijo_distrib | factor_km_distrib | factor_prod_distrib |
 * factor_cant_distrib | n_ops_observadas | observaciones.
 *
 * Permite actualizar tarifas sin redeploy del seeder hardcodeado.
 *
 * Uso:
 *   $svc->importar('/path/al/Excel.xlsx', clienteNombre: 'OCASA', reemplazar: true);
 */
class LiqExcelV5ImportService
{
    private const COLUMNAS_OBLIGATORIAS = [
        'ruta', 'capacidad_vehiculo', 'modelo_tarifa', 'es_tarifa_base', 'costo_fijo_distrib',
    ];

    private const COLUMNAS_OPCIONALES = [
        'distribuidor_nombre', 'patente', 'factor_km_distrib',
        'factor_prod_distrib', 'factor_cant_distrib',
        'n_ops_observadas', 'observaciones',
    ];

    /**
     * @return array{
     *   esquema_id:int,
     *   base:int, overrides:int,
     *   skipped:array,
     *   advertencias:array,
     * }
     */
    public function importar(
        string $path,
        string $clienteNombre = 'OCASA',
        bool $reemplazar = false,
        ?string $nombreEsquema = null
    ): array {
        if (!is_readable($path)) {
            throw new RuntimeException("No se puede leer el archivo: {$path}");
        }

        $cliente = LiqCliente::where('nombre_corto', $clienteNombre)
            ->orWhere('razon_social', 'like', "%{$clienteNombre}%")
            ->first();
        if (!$cliente) {
            throw new RuntimeException("Cliente '{$clienteNombre}' no existe en liq_clientes");
        }

        $spreadsheet = IOFactory::load($path);
        $sheet = $this->resolverHoja($spreadsheet);
        $filas = $sheet->toArray(null, true, true, false);
        if (empty($filas)) {
            throw new RuntimeException('El archivo está vacío');
        }

        // Header row: intentar detectar (primera fila con al menos 3 de las obligatorias)
        $headerIdx = null;
        foreach ($filas as $idx => $row) {
            $normalized = array_map(fn ($c) => $this->normHeader((string) $c), $row);
            $matches = count(array_intersect($normalized, self::COLUMNAS_OBLIGATORIAS));
            if ($matches >= 3) {
                $headerIdx = $idx;
                break;
            }
        }
        if ($headerIdx === null) {
            throw new RuntimeException('No se pudo detectar la fila de headers. Se esperan columnas: ' . implode(', ', self::COLUMNAS_OBLIGATORIAS));
        }

        $headers = array_map(fn ($c) => $this->normHeader((string) $c), $filas[$headerIdx]);
        $colMap = array_flip($headers);
        foreach (self::COLUMNAS_OBLIGATORIAS as $obl) {
            if (!isset($colMap[$obl])) {
                throw new RuntimeException("Columna obligatoria faltante: '{$obl}'. Headers detectados: " . implode(', ', $headers));
            }
        }

        $dataRows = array_slice($filas, $headerIdx + 1);
        $advertencias = [];
        $skipped = [];
        $parsedBase = [];
        $parsedOverride = [];

        foreach ($dataRows as $rowNum => $row) {
            $ruta = trim((string) ($row[$colMap['ruta']] ?? ''));
            if ($ruta === '') continue; // fila vacía

            $capRaw  = $row[$colMap['capacidad_vehiculo']] ?? null;
            $modelo  = trim((string) ($row[$colMap['modelo_tarifa']] ?? ''));
            $esBase  = (bool) ($row[$colMap['es_tarifa_base']] ?? false);
            $costoF  = $this->parseDecimal($row[$colMap['costo_fijo_distrib']] ?? null);

            if (!is_numeric($capRaw) || $modelo === '') {
                $advertencias[] = "Fila {$rowNum}: capacidad/modelo inválidos (ruta={$ruta})";
                continue;
            }

            $fila = [
                'ruta_codigo' => strtoupper($ruta),
                'capacidad_vehiculo_kg' => (int) $capRaw,
                'modelo_tarifa' => strtoupper($modelo),
                'es_tarifa_base' => $esBase,
                'costo_fijo_base' => $costoF ?? 0,
                'distribuidor_nombre' => $this->valOpt($row, $colMap, 'distribuidor_nombre'),
                'patente_match'       => $this->valOpt($row, $colMap, 'patente') ? strtoupper($this->valOpt($row, $colMap, 'patente')) : null,
                'factor_km'           => $this->parseDecimal($this->valOpt($row, $colMap, 'factor_km_distrib')),
                'factor_prod_distrib' => $this->parseDecimal($this->valOpt($row, $colMap, 'factor_prod_distrib')),
                'factor_cant_distrib' => $this->parseDecimal($this->valOpt($row, $colMap, 'factor_cant_distrib')),
                'n_ops_observadas'    => (int) ($this->valOpt($row, $colMap, 'n_ops_observadas') ?? 0),
                'observaciones_v5'    => $this->valOpt($row, $colMap, 'observaciones'),
            ];

            // Validación: override debe tener distribuidor_nombre o patente
            if (!$esBase && !$fila['distribuidor_nombre'] && !$fila['patente_match']) {
                $advertencias[] = "Fila {$rowNum}: override sin distribuidor_nombre ni patente (ruta={$ruta}, cap={$capRaw}) — skip";
                $skipped[] = $fila;
                continue;
            }

            if ($esBase) $parsedBase[] = $fila;
            else $parsedOverride[] = $fila;
        }

        // Persistir en transacción
        return DB::transaction(function () use ($cliente, $parsedBase, $parsedOverride, $reemplazar, $nombreEsquema, $advertencias, $skipped) {
            if ($reemplazar) {
                LiqEsquemaTarifario::where('cliente_id', $cliente->id)->update(['activo' => false]);
            }

            $esquema = LiqEsquemaTarifario::create([
                'cliente_id' => $cliente->id,
                'nombre' => $nombreEsquema ?? ("{$cliente->nombre_corto} v5 · " . now()->format('Y-m-d H:i')),
                'descripcion' => 'Importado desde Excel v5 — motor unificado con factores',
                'dimensiones' => ['ruta', 'capacidad_vehiculo'],
                'activo' => true,
            ]);

            $cargadas = ['base' => 0, 'overrides' => 0];
            $attrs = fn (array $fila, bool $base) => array_merge($fila, [
                'esquema_id' => $esquema->id,
                'activo' => true,
                'vigencia_desde' => now()->startOfMonth()->toDateString(),
                'precio_original' => 0,
                'precio_distribuidor' => 0,
                'porcentaje_agencia' => 0,
                'dimensiones_valores' => json_encode(new \stdClass),
                'es_tarifa_base' => $base,
            ]);

            foreach ($parsedBase as $f) {
                LiqLineaTarifa::create($attrs($f, true));
                $cargadas['base']++;
            }
            foreach ($parsedOverride as $f) {
                LiqLineaTarifa::create($attrs($f, false));
                $cargadas['overrides']++;
            }

            return [
                'esquema_id'  => $esquema->id,
                'base'        => $cargadas['base'],
                'overrides'   => $cargadas['overrides'],
                'skipped'     => $skipped,
                'advertencias' => $advertencias,
            ];
        });
    }

    private function resolverHoja($spreadsheet)
    {
        // Si hay una hoja con "v5" o "tarifas" en el nombre, preferirla; si no, usar la primera con datos
        foreach ($spreadsheet->getSheetNames() as $name) {
            $n = strtolower($name);
            if (str_contains($n, 'v5') || str_contains($n, 'tarifa')) {
                return $spreadsheet->getSheetByName($name);
            }
        }
        return $spreadsheet->getActiveSheet();
    }

    private function normHeader(string $s): string
    {
        $s = trim(strtolower($s));
        $s = str_replace(['á','é','í','ó','ú','ñ'], ['a','e','i','o','u','n'], $s);
        $s = preg_replace('/[^a-z0-9_]/', '_', $s);
        $s = preg_replace('/_+/', '_', $s);
        return trim($s, '_');
    }

    private function valOpt(array $row, array $colMap, string $key): ?string
    {
        if (!isset($colMap[$key])) return null;
        $v = $row[$colMap[$key]] ?? null;
        if ($v === null) return null;
        $s = trim((string) $v);
        return $s === '' ? null : $s;
    }

    private function parseDecimal($v): ?float
    {
        if ($v === null || $v === '') return null;
        if (is_numeric($v)) return (float) $v;
        $s = str_replace(['$', ' '], '', (string) $v);
        // Formato AR: punto de miles, coma decimal
        if (str_contains($s, ',') && str_contains($s, '.')) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        } elseif (str_contains($s, ',')) {
            $s = str_replace(',', '.', $s);
        }
        return is_numeric($s) ? (float) $s : null;
    }
}
