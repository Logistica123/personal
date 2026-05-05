<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaClausula;
use App\Models\PolizaClausulaAplicada;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * CRUD de cláusulas + aplicación/remoción a pólizas (con histórico).
 */
class ClausulaService
{
    public function crear(array $data): PolizaClausula
    {
        return PolizaClausula::create([
            'nombre_corto'         => $data['nombre_corto'],
            'alias'                => $data['alias'] ?? '',
            'cliente_id'           => $data['cliente_id'] ?? null,
            'sucursal_id'          => $data['sucursal_id'] ?? null,
            'cuit_titular'         => $data['cuit_titular'],
            'razon_social_titular' => $data['razon_social_titular'],
            'tipo'                 => $data['tipo'] ?? 'no_repeticion',
            'descripcion_corta'    => $data['descripcion_corta'] ?? null,
            'activa'               => $data['activa'] ?? true,
            'notas'                => $data['notas'] ?? null,
        ]);
    }

    public function actualizar(PolizaClausula $clausula, array $data): PolizaClausula
    {
        $clausula->fill(array_intersect_key($data, array_flip([
            'nombre_corto', 'alias', 'cliente_id', 'sucursal_id', 'cuit_titular',
            'razon_social_titular', 'tipo', 'descripcion_corta', 'activa', 'notas',
        ])))->save();
        return $clausula;
    }

    public function aplicar(Poliza $poliza, int $clausulaId, string $aplicadaDesde, string $tipoAplicacion = 'global'): PolizaClausulaAplicada
    {
        if (!in_array($tipoAplicacion, ['global', 'individual'], true)) {
            throw new RuntimeException("tipo_aplicacion debe ser 'global' o 'individual'");
        }
        return DB::transaction(function () use ($poliza, $clausulaId, $aplicadaDesde, $tipoAplicacion) {
            return PolizaClausulaAplicada::updateOrCreate(
                [
                    'poliza_id'      => $poliza->id,
                    'clausula_id'    => $clausulaId,
                    'aplicada_desde' => $aplicadaDesde,
                ],
                ['tipo_aplicacion' => $tipoAplicacion]
            );
        });
    }

    public function remover(PolizaClausulaAplicada $aplicacion, string $aplicadaHasta): PolizaClausulaAplicada
    {
        if ($aplicacion->aplicada_hasta) {
            throw new RuntimeException("La cláusula ya estaba removida (aplicada_hasta = {$aplicacion->aplicada_hasta})");
        }
        $aplicacion->update(['aplicada_hasta' => $aplicadaHasta]);
        return $aplicacion;
    }
}
