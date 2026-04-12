<?php

namespace App\Services\Liq;

use App\Models\LiqConfigBanco;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOrdenPago;
use App\Models\LiqOrdenPagoConcepto;
use App\Models\LiqOrdenPagoDetalle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class OrdenPagoService
{
    public function __construct(
        private readonly BeneficiarioResolver $beneficiarioResolver,
    ) {
    }

    // -------------------------------------------------------------------------
    // Listar liquidaciones disponibles para pago
    // -------------------------------------------------------------------------

    public function liquidacionesDisponibles(array $filtros = []): Collection
    {
        $query = LiqLiquidacionDistribuidor::query()
            ->with([
                'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta,estado',
                'liquidacionCliente.cliente:id,nombre_corto,razon_social',
                'distribuidor:id,apellidos,nombres,cuil,cbu_alias,es_cobrador,cobrador_nombre,cobrador_cuil,cobrador_cbu_alias',
                'ordenPagoDetalle.ordenPago:id,numero_display,estado',
            ])
            ->whereIn('estado', [
                LiqLiquidacionDistribuidor::ESTADO_GENERADA,
                LiqLiquidacionDistribuidor::ESTADO_APROBADA,
            ])
            ->where('total_a_pagar', '>', 0);

        // Filtros opcionales
        if (!empty($filtros['cliente_id'])) {
            $query->whereHas('liquidacionCliente', function ($q) use ($filtros) {
                $q->where('cliente_id', $filtros['cliente_id']);
            });
        }

        if (!empty($filtros['sucursal'])) {
            $query->whereHas('liquidacionCliente', function ($q) use ($filtros) {
                $q->where('sucursal_tarifa', $filtros['sucursal']);
            });
        }

        if (!empty($filtros['distribuidor_id'])) {
            $query->where('distribuidor_id', $filtros['distribuidor_id']);
        }

        if (!empty($filtros['periodo_desde'])) {
            $query->where('periodo_desde', '>=', $filtros['periodo_desde']);
        }

        if (!empty($filtros['periodo_hasta'])) {
            $query->where('periodo_hasta', '<=', $filtros['periodo_hasta']);
        }

        return $query->orderByDesc('periodo_desde')->orderByDesc('id')->get();
    }

    // -------------------------------------------------------------------------
    // Crear ordenes de pago
    // -------------------------------------------------------------------------

    /**
     * Crea una o varias OPs a partir de liquidaciones seleccionadas.
     *
     * @param array $params [concepto_id, numero (nullable), agrupacion, liquidacion_ids, anio, mes, observaciones, usuario_id]
     * @return array ['ordenes' => LiqOrdenPago[], 'errores' => []]
     */
    public function crear(array $params): array
    {
        $concepto = LiqOrdenPagoConcepto::findOrFail($params['concepto_id']);
        $agrupacion = $params['agrupacion'] ?? LiqOrdenPago::AGRUPACION_INDIVIDUAL;

        // Validar beneficiarios
        $resultado = $this->beneficiarioResolver->validar($params['liquidacion_ids']);

        if (empty($resultado['validas'])) {
            return [
                'ordenes' => [],
                'errores' => $resultado['errores'],
            ];
        }

        $ordenes = [];

        DB::beginTransaction();

        try {
            if ($agrupacion === LiqOrdenPago::AGRUPACION_INDIVIDUAL) {
                $grupos = $this->beneficiarioResolver->agruparPorBeneficiario($resultado['validas']);

                foreach ($grupos as $beneficiarioId => $liquidaciones) {
                    $primerBenef = $liquidaciones->first();
                    $numero = $params['numero'] ?? $concepto->proximoNumero();

                    // Si es el segundo grupo en adelante y no se pasó número manual, usar el siguiente
                    if (count($ordenes) > 0 && empty($params['numero'])) {
                        $numero = $this->siguienteNumeroDisponible($concepto->id, $numero);
                    }

                    $op = $this->crearOrdenPago($concepto, $numero, $primerBenef, $liquidaciones, $agrupacion, $params);
                    $ordenes[] = $op;

                    // Para el siguiente grupo, incrementar
                    if (empty($params['numero'])) {
                        $params['numero'] = null; // forzar auto-increment en el próximo
                    }
                }
            } else {
                // GLOBAL: 1 sola OP
                $primerBenef = $resultado['validas'][0];
                $numero = $params['numero'] ?? $concepto->proximoNumero();

                $op = $this->crearOrdenPago($concepto, $numero, $primerBenef, collect($resultado['validas']), $agrupacion, $params);
                $ordenes[] = $op;
            }

            // Actualizar ultimo_numero del concepto
            $maxNumero = LiqOrdenPago::where('concepto_id', $concepto->id)->max('numero') ?? 0;
            $concepto->update(['ultimo_numero' => $maxNumero]);

            DB::commit();

            return [
                'ordenes' => $ordenes,
                'errores' => $resultado['errores'],
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // -------------------------------------------------------------------------
    // Cambiar estado
    // -------------------------------------------------------------------------

    public function confirmar(LiqOrdenPago $op): LiqOrdenPago
    {
        if ($op->estado !== LiqOrdenPago::ESTADO_BORRADOR) {
            throw new \RuntimeException('Solo se puede confirmar una OP en estado BORRADOR.');
        }

        $op->update(['estado' => LiqOrdenPago::ESTADO_PENDIENTE_PAGO]);

        return $op->fresh();
    }

    public function anular(LiqOrdenPago $op): LiqOrdenPago
    {
        if (!$op->puedeAnularse()) {
            throw new \RuntimeException('No se puede anular una OP en estado ' . $op->estado);
        }

        DB::transaction(function () use ($op) {
            $op->update(['estado' => LiqOrdenPago::ESTADO_ANULADA]);

            // Liberar liquidaciones
            $op->detalles()->delete();
        });

        return $op->fresh();
    }

    public function eliminar(LiqOrdenPago $op): void
    {
        if (!$op->esEditable()) {
            throw new \RuntimeException('Solo se puede eliminar una OP en estado BORRADOR.');
        }

        $op->delete(); // cascade elimina detalles
    }

    // -------------------------------------------------------------------------
    // Resumen formateado para preview
    // -------------------------------------------------------------------------

    public function resumen(LiqOrdenPago $op): array
    {
        $op->load(['concepto', 'detalles', 'usuario:id,name']);

        $detallesAgrupados = $op->detalles
            ->sortBy(['cliente_nombre', 'sucursal', 'distribuidor_nombre'])
            ->values();

        return [
            'id'               => $op->id,
            'numero_display'   => $op->numero_display,
            'fecha_emision'    => $op->fecha_emision->format('d/m/Y'),
            'concepto'         => $op->concepto->nombre ?? '',
            'anio'             => $op->anio,
            'mes'              => $op->mes,
            'estado'           => $op->estado,
            'agrupacion'       => $op->agrupacion,
            'beneficiario'     => [
                'tipo'   => $op->beneficiario_tipo,
                'nombre' => $op->beneficiario_nombre,
                'cuil'   => $op->beneficiario_cuil,
                'cbu'    => $op->beneficiario_cbu,
            ],
            'cantidad_liquidaciones' => $detallesAgrupados->count(),
            'subtotal'         => $op->subtotal,
            'total_descuentos' => $op->total_descuentos,
            'total_a_pagar'    => $op->total_a_pagar,
            'observaciones'    => $op->observaciones,
            'usuario'          => $op->usuario?->name,
            'detalles'         => $detallesAgrupados->map(fn ($d) => [
                'id'                     => $d->id,
                'liquidacion_distribuidor_id' => $d->liquidacion_distribuidor_id,
                'cliente_nombre'         => $d->cliente_nombre,
                'sucursal'               => $d->sucursal,
                'periodo'                => $d->periodo,
                'distribuidor_nombre'    => $d->distribuidor_nombre,
                'cobrador_nombre'        => $d->cobrador_nombre,
                'subtotal_liquidacion'   => $d->subtotal_liquidacion,
                'gastos_admin'           => $d->gastos_admin,
                'descuento_combustible'  => $d->descuento_combustible,
                'descuento_paquete'      => $d->descuento_paquete,
                'descuento_ajuste'       => $d->descuento_ajuste,
                'otros_descuentos'       => $d->otros_descuentos,
                'detalle_otros_descuentos' => $d->detalle_otros_descuentos,
                'importe_final'          => $d->importe_final,
            ])->all(),
        ];
    }

    // -------------------------------------------------------------------------
    // Marcar como pagada (post-confirmación bancaria)
    // -------------------------------------------------------------------------

    public function marcarPagada(LiqOrdenPago $op): void
    {
        DB::transaction(function () use ($op) {
            $op->update(['estado' => LiqOrdenPago::ESTADO_CONFIRMADA]);

            // Actualizar estado de cada liquidacion_distribuidor a 'pagada'
            foreach ($op->detalles as $detalle) {
                $liqDist = $detalle->liquidacionDistribuidor;
                if ($liqDist) {
                    $liqDist->update(['estado' => LiqLiquidacionDistribuidor::ESTADO_PAGADA]);

                    // Integración post-pago con módulo de documentos (archivo pagado)
                    $this->marcarDocumentoPagado($liqDist);
                }
            }
        });
    }

    // =========================================================================
    // PRIVATE
    // =========================================================================

    private function crearOrdenPago(
        LiqOrdenPagoConcepto $concepto,
        int $numero,
        array $primerBenef,
        Collection $liquidaciones,
        string $agrupacion,
        array $params,
    ): LiqOrdenPago {
        $subtotal = $liquidaciones->sum('total_a_pagar');

        $op = LiqOrdenPago::create([
            'concepto_id'        => $concepto->id,
            'numero'             => $numero,
            'numero_display'     => LiqOrdenPago::formatNumeroDisplay($concepto->nombre, $numero),
            'anio'               => $params['anio'] ?? now()->year,
            'mes'                => $params['mes'] ?? now()->month,
            'fecha_emision'      => now()->toDateString(),
            'beneficiario_tipo'  => $primerBenef['beneficiario_tipo'],
            'beneficiario_id'    => $primerBenef['beneficiario_id'],
            'beneficiario_nombre' => $primerBenef['beneficiario_nombre'],
            'beneficiario_cuil'  => $primerBenef['beneficiario_cuil'],
            'beneficiario_cbu'   => $primerBenef['beneficiario_cbu'],
            'subtotal'           => $subtotal,
            'total_descuentos'   => 0, // se recalcula abajo
            'total_a_pagar'      => $subtotal, // se recalcula abajo
            'estado'             => LiqOrdenPago::ESTADO_BORRADOR,
            'agrupacion'         => $agrupacion,
            'observaciones'      => $params['observaciones'] ?? null,
            'usuario_id'         => $params['usuario_id'] ?? null,
        ]);

        $totalDescuentos = 0;
        $totalFinal = 0;

        foreach ($liquidaciones as $liqData) {
            $liqDist = LiqLiquidacionDistribuidor::with([
                'liquidacionCliente.cliente:id,nombre_corto',
                'distribuidor:id,apellidos,nombres,es_cobrador,cobrador_nombre',
            ])->find($liqData['liquidacion_id']);

            if (!$liqDist) {
                continue;
            }

            $clienteNombre = $liqDist->liquidacionCliente?->cliente?->nombre_corto ?? 'N/A';
            $sucursal = $liqDist->liquidacionCliente?->sucursal_tarifa ?? 'N/A';

            // Formatear periodo
            $periodoDesde = $liqDist->periodo_desde?->format('Y-m');
            $periodoHasta = $liqDist->periodo_hasta?->format('Y-m');
            $periodo = $periodoDesde === $periodoHasta ? $periodoDesde : "{$periodoDesde} a {$periodoHasta}";

            $distribuidorNombre = $liqData['distribuidor_nombre'];
            $cobradorNombre = $liqData['beneficiario_tipo'] === 'COBRADOR'
                ? $liqData['beneficiario_nombre']
                : null;

            $subtotalLiq = (float) $liqDist->subtotal;
            $gastosAdmin = (float) $liqDist->gastos_administrativos;
            $importeFinal = (float) $liqDist->total_a_pagar;

            // Buscar descuentos desglosados en archivos
            $descCombustible = $this->buscarDescuentoArchivo($liqDist->distribuidor_id, 'DESCUENTO_COMBUSTIBLE', $liqDist);
            $descPaquete = $this->buscarDescuentoArchivo($liqDist->distribuidor_id, 'DESCUENTO_PAQUETE', $liqDist);
            $descAjuste = $this->buscarDescuentoArchivo($liqDist->distribuidor_id, 'AJUSTE_LIQUIDACION', $liqDist);

            $detalle = LiqOrdenPagoDetalle::create([
                'orden_pago_id'              => $op->id,
                'liquidacion_distribuidor_id' => $liqDist->id,
                'cliente_nombre'             => $clienteNombre,
                'sucursal'                   => $sucursal,
                'periodo'                    => $periodo,
                'distribuidor_nombre'        => $distribuidorNombre,
                'cobrador_nombre'            => $cobradorNombre,
                'subtotal_liquidacion'       => $subtotalLiq,
                'gastos_admin'               => $gastosAdmin,
                'descuento_combustible'      => $descCombustible,
                'descuento_paquete'          => $descPaquete,
                'descuento_ajuste'           => $descAjuste,
                'otros_descuentos'           => 0,
                'importe_final'              => $importeFinal,
            ]);

            $totalDescuentos += $gastosAdmin + $descCombustible + $descPaquete + $descAjuste;
            $totalFinal += $importeFinal;
        }

        // Recalcular totales reales
        $op->update([
            'subtotal'         => $op->detalles()->sum('subtotal_liquidacion'),
            'total_descuentos' => $totalDescuentos,
            'total_a_pagar'    => $totalFinal,
        ]);

        return $op->fresh(['detalles']);
    }

    private function siguienteNumeroDisponible(int $conceptoId, int $desde): int
    {
        $num = $desde;
        while (LiqOrdenPago::where('concepto_id', $conceptoId)->where('numero', $num)->exists()) {
            $num++;
        }
        return $num;
    }

    /**
     * Busca importe de un descuento específico en la tabla archivos.
     */
    private function buscarDescuentoArchivo(int $personaId, string $tipoArchivo, LiqLiquidacionDistribuidor $liqDist): float
    {
        $archivo = \App\Models\Archivo::where('persona_id', $personaId)
            ->whereHas('tipo', fn ($q) => $q->where('nombre', $tipoArchivo))
            ->where(function ($q) use ($liqDist) {
                $q->where('liquidacion_id', $liqDist->id)
                  ->orWhere('fortnight_key', 'like', $liqDist->periodo_desde?->format('Y-m') . '%');
            })
            ->first();

        if ($archivo && $archivo->importe_facturar) {
            return (float) $archivo->importe_facturar;
        }

        return 0;
    }

    /**
     * Integración post-pago: marca como pagado el documento en el módulo legacy.
     */
    private function marcarDocumentoPagado(LiqLiquidacionDistribuidor $liqDist): void
    {
        // Buscar archivo asociado a esta liquidacion via la relación persona/documentos
        $archivo = \App\Models\Archivo::where('persona_id', $liqDist->distribuidor_id)
            ->where('liquidacion_id', $liqDist->id)
            ->first();

        if ($archivo && !$archivo->pagado) {
            $archivo->update(['pagado' => true]);
        }
    }
}
