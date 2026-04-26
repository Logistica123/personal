<?php

namespace App\Services\Liq;

use App\Models\LiqOperacion;
use App\Models\LiqTarifaDistribuidor;

/**
 * SPEC v4 · Resolver de tarifa LA → Distribuidor.
 *
 * Para cada (op, grupo de paradas YCC con mismo material/motivo) busca la regla más
 * específica que matchee. Más dimensiones NOT NULL en la regla → mayor prioridad.
 *
 * Regla Default OCASA con prioridad=0 (todas las dimensiones NULL) actúa como fallback.
 *
 * Multibulto se evalúa con los bultos del GRUPO (sumados de varias filas YCC), no por
 * fila individual — esto refleja correctamente que OCASA puede partir una parada con
 * múltiples bultos en varias filas YCC.
 */
class ResolverTarifaDistribuidor
{
    /**
     * Cache de tarifas por cliente_id + fecha para evitar N+1 queries.
     * @var array<string, array<int, LiqTarifaDistribuidor>>
     */
    private array $cacheTarifas = [];

    /**
     * Devuelve la tarifa más específica vigente que matchee la op + parada/grupo YCC.
     *
     * @param  array{material_la?: string|null, zona?: string|null, motivo?: string|null,
     *               distrito?: string|null}  $contexto
     */
    public function resolver(LiqOperacion $op, string $fecha, array $contexto = []): ?LiqTarifaDistribuidor
    {
        $tarifas = $this->cargarTarifasVigentes((int) $op->liquidacionCliente?->cliente_id ?: $this->resolverClienteId($op), $fecha);

        $opRuta              = $op->concepto;
        $opSucursal          = $op->sucursal_tarifa;
        $opCapacidad         = $op->capacidad_vehiculo_kg;
        $opPatente           = $op->dominio;
        $opDistribuidorId    = $op->distribuidor_id;
        $ctxDistrito         = $contexto['distrito']    ?? null;
        $ctxMaterial         = $contexto['material_la'] ?? null;
        $ctxZona             = $contexto['zona']        ?? null;
        $ctxMotivo           = $contexto['motivo']      ?? null;

        foreach ($tarifas as $t) {
            // Cada dimensión: si la regla la define (NOT NULL), tiene que matchear
            if ($t->ruta               !== null && $t->ruta               !== $opRuta) continue;
            if ($t->sucursal           !== null && $t->sucursal           !== $opSucursal) continue;
            if ($t->distrito           !== null && $t->distrito           !== $ctxDistrito) continue;
            if ($t->material_la        !== null && $t->material_la        !== $ctxMaterial) continue;
            if ($t->zona               !== null && $t->zona               !== $ctxZona) continue;
            if ($t->motivo             !== null && $t->motivo             !== $ctxMotivo) continue;
            if ($t->capacidad_vehiculo !== null && (int) $t->capacidad_vehiculo !== (int) $opCapacidad) continue;
            if ($t->patente            !== null && $t->patente            !== $opPatente) continue;
            if ($t->distribuidor_id    !== null && (int) $t->distribuidor_id    !== (int) $opDistribuidorId) continue;
            return $t;
        }

        return null;
    }

    /**
     * Calcula el pago al distribuidor para un grupo de paradas YCC ya agrupadas.
     * Devuelve sin redondear — el motor redondea al final del op para evitar acumular
     * pérdida de centavos cuando hay muchos grupos.
     *
     *   monto_parada → tarifa fija. Si aplica_multibulto y bultos ≥ 5 → ceil(b/5) × valor.
     *   monto_bulto  → valor × bultos.
     *   factor_ocasa → costo_ocasa × valor.
     */
    public function calcular(float $costoOcasa, int $bultos, LiqTarifaDistribuidor $t): float
    {
        $valor = (float) $t->valor;

        return match ($t->tipo_tarifa) {
            'monto_parada' => $t->aplica_multibulto && $bultos >= 5
                ? (int) ceil($bultos / 5) * $valor
                : $valor,
            'monto_bulto'  => $valor * max($bultos, 0),
            'factor_ocasa' => $costoOcasa * $valor,
        };
    }

    /**
     * Carga (con cache) todas las tarifas vigentes para un cliente, ordenadas por
     * prioridad DESC + id DESC. La primera que matchee es la ganadora.
     *
     * @return array<int, LiqTarifaDistribuidor>
     */
    private function cargarTarifasVigentes(int $clienteId, string $fecha): array
    {
        $key = $clienteId . '|' . $fecha;
        if (isset($this->cacheTarifas[$key])) {
            return $this->cacheTarifas[$key];
        }

        $this->cacheTarifas[$key] = LiqTarifaDistribuidor::query()
            ->where('cliente_id', $clienteId)
            ->where('vigencia_desde', '<=', $fecha)
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha);
            })
            ->orderByDesc('prioridad')
            ->orderByDesc('id')
            ->get()
            ->all();

        return $this->cacheTarifas[$key];
    }

    private function resolverClienteId(LiqOperacion $op): int
    {
        return (int) \DB::table('liq_liquidaciones_cliente')
            ->where('id', $op->liquidacion_cliente_id)
            ->value('cliente_id');
    }
}
