<?php

namespace App\Services\Liq;

use App\Models\LiqOperacion;
use App\Models\LiqTarifaOcasaLa;

/**
 * SPEC v4.2 · Resolver de tarifa esperada OCASA → LA.
 *
 * Para cada (op, grupo de paradas YCC con mismo material/motivo) busca la regla más
 * específica que matchee. Mismo algoritmo que ResolverTarifaDistribuidor pero del lado
 * OCASA→LA y sin distribuidor_id/patente (a OCASA no le importa quién entrega).
 */
class ResolverTarifaOcasaLa
{
    /** @var array<string, array<int, LiqTarifaOcasaLa>> */
    private array $cacheTarifas = [];

    /**
     * Devuelve la tarifa más específica vigente que matchee la op + grupo YCC.
     *
     * @param  array{material_la?: string|null, zona?: string|null, motivo?: string|null,
     *               distrito?: string|null}  $contexto
     */
    public function resolver(LiqOperacion $op, string $fecha, array $contexto = []): ?LiqTarifaOcasaLa
    {
        $clienteId = (int) \DB::table('liq_liquidaciones_cliente')
            ->where('id', $op->liquidacion_cliente_id)
            ->value('cliente_id');

        $tarifas = $this->cargarTarifasVigentes($clienteId, $fecha);

        $opRuta      = $op->concepto;
        $opSucursal  = $op->sucursal_tarifa;
        $opCapacidad = $op->capacidad_vehiculo_kg;
        $ctxDistrito = $contexto['distrito']    ?? null;
        $ctxMaterial = $contexto['material_la'] ?? null;
        $ctxZona     = $contexto['zona']        ?? null;
        $ctxMotivo   = $contexto['motivo']      ?? null;

        foreach ($tarifas as $t) {
            if ($t->ruta               !== null && $t->ruta               !== $opRuta) continue;
            if ($t->sucursal           !== null && $t->sucursal           !== $opSucursal) continue;
            if ($t->distrito           !== null && $t->distrito           !== $ctxDistrito) continue;
            if ($t->material_la        !== null && $t->material_la        !== $ctxMaterial) continue;
            if ($t->zona               !== null && $t->zona               !== $ctxZona) continue;
            if ($t->motivo             !== null && $t->motivo             !== $ctxMotivo) continue;
            if ($t->capacidad_vehiculo !== null && (int) $t->capacidad_vehiculo !== (int) $opCapacidad) continue;
            return $t;
        }

        return null;
    }

    /**
     * Calcula lo que OCASA debería pagar según la tarifa contractual.
     */
    public function calcular(int $bultos, LiqTarifaOcasaLa $t): float
    {
        $valor = (float) $t->valor;

        return match ($t->tipo_tarifa) {
            'monto_parada' => $t->aplica_multibulto && $bultos >= 5
                ? (int) ceil($bultos / 5) * $valor
                : $valor,
            'monto_bulto'  => $valor * max($bultos, 0),
            'jornada'      => $valor,
            'jornada_km'   => 0.0, // jornada_km se maneja por flujo separado en liq_tarifas_contrato_cliente
        };
    }

    /** @return array<int, LiqTarifaOcasaLa> */
    private function cargarTarifasVigentes(int $clienteId, string $fecha): array
    {
        $key = $clienteId . '|' . $fecha;
        if (isset($this->cacheTarifas[$key])) {
            return $this->cacheTarifas[$key];
        }

        $this->cacheTarifas[$key] = LiqTarifaOcasaLa::query()
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
}
