<?php

namespace App\Services\Liq;

use App\Models\LiqLiquidacionDistribuidor;
use App\Models\Persona;
use Illuminate\Support\Collection;

class BeneficiarioResolver
{
    /**
     * Para cada liquidacion, determina el beneficiario (distribuidor o cobrador)
     * y valida que tenga CUIL y CBU cargados.
     *
     * Retorna ['validas' => [...], 'errores' => [...]]
     */
    public function validar(array $liquidacionIds): array
    {
        $liquidaciones = LiqLiquidacionDistribuidor::with('distribuidor')
            ->whereIn('id', $liquidacionIds)
            ->get();

        $validas  = [];
        $errores  = [];

        foreach ($liquidaciones as $liq) {
            $persona = $liq->distribuidor;

            if (!$persona) {
                $errores[] = [
                    'liquidacion_id' => $liq->id,
                    'motivo'         => 'Distribuidor no encontrado',
                ];
                continue;
            }

            $datos = $persona->datosBeneficiario();
            $problemas = [];

            if (empty($datos['cuil'])) {
                $problemas[] = 'Sin CUIL';
            } elseif (!$this->cuilValido($datos['cuil'])) {
                $problemas[] = 'CUIL invalido (debe tener 11 digitos)';
            }
            if (empty($datos['cbu'])) {
                $problemas[] = 'Sin CBU';
            } elseif (!$this->cbuValido($datos['cbu'])) {
                $problemas[] = 'CBU invalido (debe tener 22 digitos)';
            }
            if ((float) $liq->total_a_pagar <= 0) {
                $problemas[] = 'Importe <= 0';
            }
            if ($liq->tieneOrdenPagoActiva()) {
                $problemas[] = 'Ya incluida en otra OP activa';
            }

            if (!empty($problemas)) {
                $errores[] = [
                    'liquidacion_id'     => $liq->id,
                    'distribuidor_id'    => $persona->id,
                    'distribuidor_nombre' => trim($persona->apellidos . ', ' . $persona->nombres),
                    'beneficiario_tipo'  => $datos['tipo'],
                    'beneficiario_nombre' => $datos['nombre'],
                    'motivos'            => $problemas,
                ];
                continue;
            }

            $validas[] = [
                'liquidacion_id'     => $liq->id,
                'distribuidor_id'    => $persona->id,
                'distribuidor_nombre' => trim($persona->apellidos . ', ' . $persona->nombres),
                'beneficiario_tipo'  => $datos['tipo'],
                'beneficiario_id'    => $persona->id,
                'beneficiario_nombre' => $datos['nombre'],
                'beneficiario_cuil'  => $datos['cuil'],
                'beneficiario_cbu'   => $datos['cbu'],
                'total_a_pagar'      => (float) $liq->total_a_pagar,
            ];
        }

        return [
            'validas' => $validas,
            'errores' => $errores,
        ];
    }

    /**
     * Agrupa liquidaciones validadas por beneficiario_id.
     * Retorna una Collection indexada por beneficiario_id.
     */
    public function agruparPorBeneficiario(array $validas): Collection
    {
        return collect($validas)->groupBy('beneficiario_id');
    }

    /**
     * Valida formato de CUIL: 11 dígitos numéricos.
     */
    private function cuilValido(?string $cuil): bool
    {
        if (!$cuil) return false;
        $digits = preg_replace('/\D/', '', $cuil);
        return strlen($digits) === 11;
    }

    /**
     * Valida formato de CBU: 22 dígitos numéricos.
     */
    private function cbuValido(?string $cbu): bool
    {
        if (!$cbu) return false;
        $digits = preg_replace('/\D/', '', $cbu);
        return strlen($digits) === 22;
    }
}
