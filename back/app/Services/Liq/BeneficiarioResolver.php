<?php

namespace App\Services\Liq;

use App\Models\Archivo;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\LiqOrdenPagoDetalle;
use App\Models\Persona;
use Illuminate\Support\Collection;

class BeneficiarioResolver
{
    /**
     * Valida un array de items unificados (extractos + legacy).
     * Cada item debe tener: fuente, fuente_id (liq_dist id), archivo_id, persona_id, importe.
     *
     * Retorna ['validas' => [...], 'errores' => [...]]
     */
    public function validarUnificado(array $items): array
    {
        $validas = [];
        $errores = [];

        foreach ($items as $item) {
            $fuente = $item['fuente'] ?? 'EXTRACTO';
            $personaId = $item['persona_id'] ?? null;
            $importe = (float) ($item['importe'] ?? 0);

            $persona = $personaId ? Persona::find($personaId) : null;

            if (!$persona) {
                $errores[] = [
                    'item'   => $item,
                    'motivo' => 'Distribuidor no encontrado',
                    'motivos' => ['Distribuidor no encontrado'],
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
            if ($importe <= 0) {
                $problemas[] = 'Importe <= 0';
            }

            // Verificar si ya está en una OP activa
            if ($fuente === 'EXTRACTO' && !empty($item['fuente_id'])) {
                $yaEnOp = LiqOrdenPagoDetalle::where('liquidacion_distribuidor_id', $item['fuente_id'])
                    ->whereHas('ordenPago', fn ($q) => $q->whereNotIn('estado', ['ANULADA']))
                    ->exists();
                if ($yaEnOp) $problemas[] = 'Ya incluida en otra OP activa';
            }
            if ($fuente === 'LEGACY' && !empty($item['archivo_id'])) {
                $yaEnOp = LiqOrdenPagoDetalle::where('archivo_id', $item['archivo_id'])
                    ->whereHas('ordenPago', fn ($q) => $q->whereNotIn('estado', ['ANULADA']))
                    ->exists();
                if ($yaEnOp) $problemas[] = 'Ya incluida en otra OP activa';
            }

            $distribuidorNombre = trim($persona->apellidos . ', ' . $persona->nombres);

            if (!empty($problemas)) {
                $errores[] = [
                    'item'               => $item,
                    'distribuidor_id'    => $persona->id,
                    'distribuidor_nombre' => $distribuidorNombre,
                    'beneficiario_tipo'  => $datos['tipo'],
                    'beneficiario_nombre' => $datos['nombre'],
                    'motivos'            => $problemas,
                ];
                continue;
            }

            $validas[] = [
                'fuente'             => $fuente,
                'fuente_id'          => $item['fuente_id'] ?? null,
                'archivo_id'         => $item['archivo_id'] ?? null,
                'persona_id'         => $persona->id,
                'distribuidor_id'    => $persona->id,
                'distribuidor_nombre' => $distribuidorNombre,
                'beneficiario_tipo'  => $datos['tipo'],
                'beneficiario_id'    => $persona->id,
                'beneficiario_nombre' => $datos['nombre'],
                'beneficiario_cuil'  => $datos['cuil'],
                'beneficiario_cbu'   => $datos['cbu'],
                'total_a_pagar'      => $importe,
            ];
        }

        return ['validas' => $validas, 'errores' => $errores];
    }

    /**
     * Wrapper retrocompatible: valida solo extractos por IDs de liquidacion_distribuidor.
     */
    public function validar(array $liquidacionIds): array
    {
        $items = [];
        foreach ($liquidacionIds as $id) {
            $liq = LiqLiquidacionDistribuidor::find($id);
            if ($liq) {
                $items[] = [
                    'fuente'    => 'EXTRACTO',
                    'fuente_id' => $liq->id,
                    'archivo_id' => null,
                    'persona_id' => $liq->distribuidor_id,
                    'importe'   => (float) $liq->total_a_pagar,
                ];
            }
        }
        return $this->validarUnificado($items);
    }

    /**
     * Agrupa liquidaciones validadas por beneficiario_id.
     */
    public function agruparPorBeneficiario(array $validas): Collection
    {
        return collect($validas)->groupBy('beneficiario_id');
    }

    private function cuilValido(?string $cuil): bool
    {
        if (!$cuil) return false;
        $digits = preg_replace('/\D/', '', $cuil);
        return strlen($digits) === 11;
    }

    private function cbuValido(?string $cbu): bool
    {
        if (!$cbu) return false;
        $digits = preg_replace('/\D/', '', $cbu);
        return strlen($digits) === 22;
    }
}
