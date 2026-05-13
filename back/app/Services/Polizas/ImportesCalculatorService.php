<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaEndoso;
use Illuminate\Support\Facades\Log;

/**
 * ADDENDUM 15 Bloque 2 — calcula el importe mensual que LA paga por cada
 * asegurado, en base a cómo cada aseguradora reporta el dato.
 *
 *   MAPFRE (AP):        premio_anual_poliza / 12 / vidas_vigentes
 *   San Cristóbal (AP): premio_endoso / cant_asegurados_endoso / 12
 *   La Segunda (veh):   premio_individual_asegurado / 12
 *
 * El precio a descontar al distribuidor = importe_mensual_la × (1 - %dto/100).
 * %dto default es 20%, editable manualmente por asegurado.
 */
class ImportesCalculatorService
{
    public function calcularImporteMensualLa(PolizaAsegurado $asegurado, Poliza $poliza, ?PolizaEndoso $endoso = null): ?float
    {
        $perfil = $poliza->aseguradora?->parser_perfil;

        if ($perfil === 'la_segunda') {
            // Premio individual anual cargado por vehículo en el certificado.
            if ($asegurado->premio_individual) {
                return round(((float) $asegurado->premio_individual) / 12, 2);
            }
            return null;
        }

        if ($perfil === 'san_cristobal') {
            // El parser carga `premio_endoso` y `cantidad_asegurados_incorporados`
            // al procesar un endoso de incorporación. Si el asegurado tiene
            // `alta_endoso_id` apuntando a ese endoso, distribuir uniformemente.
            $altaEndoso = $endoso ?? ($asegurado->alta_endoso_id
                ? PolizaEndoso::find($asegurado->alta_endoso_id) : null);
            if ($altaEndoso && $altaEndoso->premio_endoso && $altaEndoso->cantidad_asegurados_incorporados > 0) {
                $anualPorAsegurado = ((float) $altaEndoso->premio_endoso) / $altaEndoso->cantidad_asegurados_incorporados;
                return round($anualPorAsegurado / 12, 2);
            }
            return null;
        }

        if ($perfil === 'mapfre') {
            // Premio anual total dividido entre vidas vigentes.
            if ($poliza->premio_anual && ($poliza->cantidad_vidas_unidades ?? 0) > 0) {
                return round(((float) $poliza->premio_anual) / 12 / $poliza->cantidad_vidas_unidades, 2);
            }
            return null;
        }

        return null;
    }

    public function calcularImporteDistribuidor(float $importeLa, float $porcentajeDescuento = 20.00): float
    {
        $factor = max(0.0, 1 - ((float) $porcentajeDescuento) / 100);
        return round($importeLa * $factor, 2);
    }

    /**
     * Recalcula y persiste los importes de todos los asegurados activos de
     * una póliza. Llamar después de cargar un endoso/PDF para que los datos
     * de plata queden sincronizados con la última info de la aseguradora.
     *
     * NO sobrescribe asegurados con `importe_mensual_origen='manual'` o
     * `'editado'` — esos son sticky para preservar ajustes del admin.
     *
     * @return array{recalculados:int, omitidos_manual:int, sin_dato:int}
     */
    public function recalcularPostCarga(Poliza $poliza, ?PolizaEndoso $endoso = null): array
    {
        $poliza->loadMissing('aseguradora:id,nombre,parser_perfil');
        $stats = ['recalculados' => 0, 'omitidos_manual' => 0, 'sin_dato' => 0];

        $asegurados = PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->whereIn('estado', ['activo', 'alta_solicitada'])
            ->get();

        foreach ($asegurados as $a) {
            if (in_array($a->importe_mensual_origen, ['manual', 'editado'], true)) {
                $stats['omitidos_manual']++;
                continue;
            }

            $importeLa = $this->calcularImporteMensualLa($a, $poliza, $endoso);
            if ($importeLa === null) {
                $stats['sin_dato']++;
                continue;
            }

            $dto = (float) ($a->porcentaje_descuento_distribuidor ?? 20.00);
            $importeDistribuidor = $this->calcularImporteDistribuidor($importeLa, $dto);

            $a->update([
                'importe_mensual_la'           => $importeLa,
                'importe_mensual_distribuidor' => $importeDistribuidor,
                'importe_mensual_origen'       => 'endoso',
            ]);
            $stats['recalculados']++;
        }

        Log::info("ImportesCalculator.recalcularPostCarga(poliza={$poliza->id}): " . json_encode($stats));
        return $stats;
    }
}
