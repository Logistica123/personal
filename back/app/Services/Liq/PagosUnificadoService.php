<?php

namespace App\Services\Liq;

use App\Models\Archivo;
use App\Models\Factura;
use App\Models\FileType;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOrdenPagoDetalle;
use App\Models\Persona;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PagosUnificadoService
{
    /**
     * Retorna la grilla unificada de liquidaciones para pago (extractos + legacy).
     * Cada fila se normaliza a un formato común.
     */
    public function listarUnificado(array $filtros = []): Collection
    {
        $extractos = $this->obtenerExtractos($filtros);
        $legacy = $this->obtenerLegacy($filtros);

        $unificado = $extractos->merge($legacy);

        // Enriquecer con campos parseados del periodo
        $unificado = $unificado->map(function ($row) {
            $parsed = $this->parsePeriodo($row['periodo'] ?? '');
            $row['periodo_mes'] = $parsed['mes'];
            $row['periodo_anio'] = $parsed['anio'];
            $row['periodo_quincena'] = $parsed['quincena'];
            return $row;
        });

        // Filtros post-merge
        if (!empty($filtros['fuente'])) {
            $unificado = $unificado->where('fuente', $filtros['fuente']);
        }
        if (!empty($filtros['facturado'])) {
            $val = strtoupper($filtros['facturado']) === 'SI';
            $unificado = $unificado->where('facturado', $val);
        }
        if (isset($filtros['pagado']) && $filtros['pagado'] !== '') {
            $val = strtoupper($filtros['pagado']) === 'SI';
            $unificado = $unificado->where('pagado', $val);
        }
        if (!empty($filtros['mes'])) {
            $unificado = $unificado->where('periodo_mes', (int) $filtros['mes']);
        }
        if (!empty($filtros['anio'])) {
            $unificado = $unificado->where('periodo_anio', (int) $filtros['anio']);
        }
        if (!empty($filtros['quincena'])) {
            $unificado = $unificado->where('periodo_quincena', $filtros['quincena']);
        }
        if (!empty($filtros['medio_pago'])) {
            $unificado = $unificado->where('medio_pago', $filtros['medio_pago']);
        }

        return $unificado->sortByDesc('periodo_sort')->values();
    }

    // =========================================================================
    // Extractos (liq_liquidaciones_distribuidor)
    // =========================================================================

    private function obtenerExtractos(array $filtros): Collection
    {
        $query = LiqLiquidacionDistribuidor::query()
            ->with([
                'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta,sucursal_tarifa',
                'liquidacionCliente.cliente:id,nombre_corto',
                'distribuidor:id,apellidos,nombres,cuil,cbu_alias,es_cobrador,cobrador_nombre,cobrador_cuil,cobrador_cbu_alias,cliente_id',
                'distribuidor.cliente:id,nombre',
                'ordenPagoDetalle.ordenPago:id,numero_display,estado',
            ])
            ->where('total_a_pagar', '>', 0);

        if (!empty($filtros['cliente_nombre'])) {
            $query->whereHas('liquidacionCliente.cliente', function ($q) use ($filtros) {
                $q->where('nombre_corto', 'like', '%' . $filtros['cliente_nombre'] . '%');
            });
        }
        if (!empty($filtros['distribuidor'])) {
            $term = '%' . $filtros['distribuidor'] . '%';
            $query->whereHas('distribuidor', function ($q) use ($term) {
                $q->where(function ($sub) use ($term) {
                    $sub->where('apellidos', 'like', $term)
                        ->orWhere('nombres', 'like', $term)
                        ->orWhereRaw("CONCAT_WS(' ', apellidos, nombres) like ?", [$term])
                        ->orWhereRaw("CONCAT_WS(' ', nombres, apellidos) like ?", [$term]);
                });
            });
        }
        if (!empty($filtros['estado_liq'])) {
            $query->where('estado', $filtros['estado_liq']);
        }

        return $query->get()->toBase()->map(function (LiqLiquidacionDistribuidor $liq) {
            $dist = $liq->distribuidor;
            $opDetalle = $liq->ordenPagoDetalle;
            $op = $opDetalle?->ordenPago;
            $estado = $liq->estado;

            return [
                'id'                  => $liq->id,
                'fuente'              => 'EXTRACTO',
                'fuente_id'           => $liq->id,
                'archivo_id'          => null,
                'persona_id'          => $liq->distribuidor_id,
                'cliente_nombre'      => $liq->liquidacionCliente?->cliente?->nombre_corto ?? 'N/A',
                'sucursal'            => $liq->liquidacionCliente?->sucursal_tarifa ?? '',
                'periodo'             => $this->formatPeriodoExtracto($liq),
                'periodo_sort'        => $liq->periodo_desde?->format('Y-m-d') ?? '',
                'distribuidor_nombre' => $dist ? trim($dist->apellidos . ', ' . $dist->nombres) : 'N/A',
                'cobrador_nombre'     => $dist?->es_cobrador ? $dist->cobrador_nombre : null,
                'override_cobrador'   => $liq->cobrador_override_cbu ? [
                    'nombre' => $liq->cobrador_override_nombre,
                    'cuit'   => $liq->cobrador_override_cuit,
                    'cbu'    => $liq->cobrador_override_cbu,
                    'motivo' => $liq->cobrador_override_motivo,
                ] : null,
                'importe'             => (float) $liq->total_a_pagar,
                'tipo_comprobante'    => (string) ($liq->tipo_comprobante ?? 'C'),
                'iva_porcentaje'      => $liq->iva_porcentaje !== null ? (float) $liq->iva_porcentaje : null,
                'importe_iva'         => (float) ($liq->importe_iva ?? 0),
                'total_a_pagar_overridido' => (bool) ($liq->total_a_pagar_overridido ?? false),
                'requiere_revision_dual'   => (bool) ($liq->requiere_revision_dual ?? false),
                'enviada'             => in_array($estado, ['subida', 'publicada', 'pagada']),
                'facturado'           => false, // Extractos no tienen archivo padre en tabla archivos
                'factura_doc_id'      => null, // Se usa endpoint factura-distribuidor
                'pagado'              => $estado === 'pagada',
                'estado_liquidacion'  => $estado,
                'estado_pago'         => $op?->estado ?? null,
                'op_numero_display'   => $op?->numero_display ?? null,
                'op_id'               => $op?->id ?? null,
                'tiene_op_activa'     => $op && $op->estado !== 'ANULADA',
                'medio_pago'          => $dist?->medio_pago ?? null,
                // Para descargar PDF
                'pdf_url_tipo'        => 'extracto',
                'pdf_liq_dist_id'     => $liq->id,
            ];
        });
    }

    // =========================================================================
    // Legacy (archivos)
    // =========================================================================

    private function obtenerLegacy(array $filtros): Collection
    {
        // IDs de tipos de archivo que son liquidaciones
        $tipoIds = FileType::where('nombre', 'like', '%liquid%')->pluck('id')->all();
        if (empty($tipoIds)) {
            return collect();
        }

        $query = Archivo::query()
            ->with([
                'persona:id,apellidos,nombres,cuil,cbu_alias,medio_pago,es_cobrador,cobrador_nombre,cobrador_cuil,cobrador_cbu_alias,cliente_id',
                'persona.cliente:id,nombre',
            ])
            ->whereIn('tipo_archivo_id', $tipoIds)
            ->whereNull('parent_document_id') // Solo padres, no hijos (descuentos)
            ->where('es_pendiente', false)
            ->whereNotNull('importe_facturar')
            ->where('importe_facturar', '>', 0)
            ->whereNotNull('persona_id')
            ->whereHas('persona'); // Excluir archivos cuya persona fue eliminada

        if (!empty($filtros['cliente_nombre'])) {
            $query->whereHas('persona.cliente', function ($q) use ($filtros) {
                $q->where('nombre', 'like', '%' . $filtros['cliente_nombre'] . '%');
            });
        }
        if (!empty($filtros['distribuidor'])) {
            $term = '%' . $filtros['distribuidor'] . '%';
            $query->whereHas('persona', function ($q) use ($term) {
                $q->where(function ($sub) use ($term) {
                    $sub->where('apellidos', 'like', $term)
                        ->orWhere('nombres', 'like', $term)
                        ->orWhereRaw("CONCAT_WS(' ', apellidos, nombres) like ?", [$term])
                        ->orWhereRaw("CONCAT_WS(' ', nombres, apellidos) like ?", [$term]);
                });
            });
        }

        return $query->get()->toBase()->map(function (Archivo $archivo) {
            $persona = $archivo->persona;

            // Verificar si ya está en una OP activa
            $opDetalle = LiqOrdenPagoDetalle::where('archivo_id', $archivo->id)
                ->whereHas('ordenPago', fn ($q) => $q->whereNotIn('estado', ['ANULADA']))
                ->with('ordenPago:id,numero_display,estado')
                ->first();
            $op = $opDetalle?->ordenPago;

            // Derivar estado legacy
            $estadoLiq = 'generada';
            if ($archivo->pagado) $estadoLiq = 'pagada';
            elseif ($archivo->enviada) $estadoLiq = 'subida';

            // Calcular importe con descuentos (hijos combustible)
            $descuentos = $archivo->children()
                ->whereNotNull('importe_facturar')
                ->sum('importe_facturar');
            $importeConDescuento = (float) $archivo->importe_facturar + (float) $descuentos; // descuentos son negativos

            return [
                'id'                  => $archivo->id,
                'fuente'              => 'LEGACY',
                'fuente_id'           => null,
                'archivo_id'          => $archivo->id,
                'persona_id'          => $archivo->persona_id,
                'cliente_nombre'      => $persona?->cliente?->nombre ?? 'N/A',
                'sucursal'            => '',
                'periodo'             => $this->formatPeriodoLegacy($archivo),
                'periodo_sort'        => $archivo->created_at?->format('Y-m-d') ?? '',
                'distribuidor_nombre' => $persona ? trim($persona->apellidos . ', ' . $persona->nombres) : 'N/A',
                'cobrador_nombre'     => $persona?->es_cobrador ? $persona->cobrador_nombre : null,
                'importe'             => max($importeConDescuento, 0),
                'enviada'             => (bool) $archivo->enviada,
                'facturado'           => (bool) $archivo->recibido || $this->tieneFacturaDistribuidor($archivo->id),
                'factura_doc_id'      => null, // Se usa endpoint factura-distribuidor
                'pagado'              => (bool) $archivo->pagado,
                'estado_liquidacion'  => $estadoLiq,
                'estado_pago'         => $op?->estado ?? null,
                'op_numero_display'   => $op?->numero_display ?? null,
                'op_id'               => $op?->id ?? null,
                'tiene_op_activa'     => (bool) $op,
                'medio_pago'          => $persona?->medio_pago ?? null,
                // Para descargar PDF
                'pdf_url_tipo'        => 'legacy',
                'pdf_persona_id'      => $archivo->persona_id,
                'pdf_archivo_id'      => $archivo->id,
            ];
        });
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function formatPeriodoExtracto(LiqLiquidacionDistribuidor $liq): string
    {
        $meses = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        $desde = $liq->periodo_desde;
        $hasta = $liq->periodo_hasta;
        if (!$desde) return '';

        $mes = $meses[$desde->month] ?? '';
        $anio = $desde->year;

        if ($hasta && $desde->month === $hasta->month) {
            if ($desde->day === 1 && $hasta->day <= 15) return "1Q {$mes} {$anio}";
            if ($desde->day >= 15 && $hasta->day >= 28) return "2Q {$mes} {$anio}";
            return "{$mes} {$anio}";
        }

        return "{$mes} {$anio}";
    }

    private function formatPeriodoLegacy(Archivo $archivo): string
    {
        $meses = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

        $fk = $archivo->fortnight_key;
        $fecha = $archivo->created_at;

        // Determinar quincena desde fortnight_key
        $prefix = '';
        if ($fk) {
            $fkUpper = strtoupper(trim($fk));
            if (str_contains($fkUpper, 'Q1') || str_contains($fkUpper, '1Q')) {
                $prefix = '1Q ';
            } elseif (str_contains($fkUpper, 'Q2') || str_contains($fkUpper, '2Q')) {
                $prefix = '2Q ';
            }

            // Intentar extraer año-mes del fortnight_key (formato YYYY-MM-QX)
            if (preg_match('/(\d{4})-(\d{2})/', $fk, $m)) {
                $y = $m[1];
                $mesNum = (int) $m[2];
                $mesLabel = $meses[$mesNum] ?? '';
                return "{$prefix}{$mesLabel} {$y}";
            }
        }

        // Fallback: usar fecha de creación + quincena detectada
        if ($fecha) {
            $mes = $meses[$fecha->month] ?? '';
            return "{$prefix}{$mes} {$fecha->year}";
        }

        return '';
    }

    /**
     * Determina si el distribuidor tiene una factura adjuntada para una liquidación.
     * Busca: 1) archivo hijo de la liquidación (no descuento/ajuste), 2) factura IA validada.
     */
    /**
     * Determina si existe factura del distribuidor para una liquidación específica.
     * IMPORTANTE: sin liquidacionArchivoId no se puede determinar → devuelve false.
     */
    /**
     * Determina si existe factura del distribuidor para UNA liquidación específica.
     * Busca SOLO hijos de ESA liquidación, nunca de otra.
     *
     * @param int $liquidacionArchivoId  ID del archivo padre (la liquidación de la agencia)
     */
    private function tieneFacturaDistribuidor(?int $liquidacionArchivoId): bool
    {
        if (!$liquidacionArchivoId) {
            return false;
        }

        static $tiposExcluir = null;
        if ($tiposExcluir === null) {
            $tiposExcluir = FileType::whereIn('nombre', [
                'DESCUENTO_COMBUSTIBLE', 'AJUSTE_LIQUIDACION', 'Factura combustible',
            ])->pluck('id')->all();
        }

        // Estrategia 1: archivo hijo de ESTA liquidación (no descuento/ajuste)
        $tiene = Archivo::where('parent_document_id', $liquidacionArchivoId)
            ->whereNotIn('tipo_archivo_id', $tiposExcluir)
            ->exists();

        if ($tiene) return true;

        // Estrategia 2: factura IA APROBADA vinculada a ESTA liquidación específica
        // Una factura rechazada NO cuenta como "facturado"
        return Factura::where('liquidacion_id', $liquidacionArchivoId)
            ->where('estado', 'aprobada')
            ->exists();
    }

    /**
     * Parsea un string de periodo (ej: '1Q MAR 2026', 'FEB 2026') y extrae mes, año, quincena.
     * @return array{mes: int|null, anio: int|null, quincena: string}
     */
    private function parsePeriodo(string $periodo): array
    {
        $mesMap = [
            'ENE' => 1, 'FEB' => 2, 'MAR' => 3, 'ABR' => 4, 'MAY' => 5, 'JUN' => 6,
            'JUL' => 7, 'AGO' => 8, 'SEP' => 9, 'OCT' => 10, 'NOV' => 11, 'DIC' => 12,
        ];

        $periodo = strtoupper(trim($periodo));
        $quincena = 'MC'; // Mes completo por defecto

        // Detectar quincena
        if (str_starts_with($periodo, '1Q ')) {
            $quincena = '1Q';
            $periodo = substr($periodo, 3);
        } elseif (str_starts_with($periodo, '2Q ')) {
            $quincena = '2Q';
            $periodo = substr($periodo, 3);
        }

        $parts = preg_split('/\s+/', trim($periodo));
        $mes = null;
        $anio = null;

        foreach ($parts as $part) {
            if (isset($mesMap[$part])) {
                $mes = $mesMap[$part];
            } elseif (preg_match('/^\d{4}$/', $part)) {
                $anio = (int) $part;
            }
        }

        // Fallback: intentar formato YYYY-MM
        if (!$mes && preg_match('/(\d{4})-(\d{2})/', $periodo, $m)) {
            $anio = (int) $m[1];
            $mes = (int) $m[2];
        }

        return ['mes' => $mes, 'anio' => $anio, 'quincena' => $quincena];
    }
}
