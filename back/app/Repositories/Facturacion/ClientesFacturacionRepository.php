<?php

namespace App\Repositories\Facturacion;

use App\Models\ClientesFacturacionConsolidado;
use App\Models\FacturaCabecera;
use Illuminate\Database\Eloquent\Builder;

class ClientesFacturacionRepository
{
    public function summaryQuery(array $filters = []): Builder
    {
        $query = ClientesFacturacionConsolidado::query();

        if (! empty($filters['cliente_id'])) {
            $query->where('cliente_id', (int) $filters['cliente_id']);
        }
        if (! empty($filters['sucursal_id'])) {
            $query->where('sucursal_id', (int) $filters['sucursal_id']);
        }
        if (! empty($filters['anio'])) {
            $query->where('anio_facturado', (int) $filters['anio']);
        }
        if (! empty($filters['mes'])) {
            $query->where('mes_facturado', (int) $filters['mes']);
        }
        if (! empty($filters['periodo'])) {
            $query->where('periodo_facturado', (string) $filters['periodo']);
        }
        if (! empty($filters['estado_cobranza'])) {
            $query->whereExists(function ($subQuery) use ($filters) {
                $subQuery->selectRaw('1')
                    ->from('factura_cabecera as fc')
                    ->whereColumn('fc.cliente_id', 'vw_clientes_facturacion_consolidado.cliente_id')
                    ->whereColumn('fc.sucursal_id', 'vw_clientes_facturacion_consolidado.sucursal_id')
                    ->whereColumn('fc.anio_facturado', 'vw_clientes_facturacion_consolidado.anio_facturado')
                    ->whereColumn('fc.mes_facturado', 'vw_clientes_facturacion_consolidado.mes_facturado')
                    ->whereColumn('fc.periodo_facturado', 'vw_clientes_facturacion_consolidado.periodo_facturado')
                    ->where('fc.estado_cobranza', (string) $filters['estado_cobranza']);
            });
        }

        return $query->orderBy('cliente_nombre')->orderBy('sucursal_nombre')->orderByDesc('anio_facturado')->orderByDesc('mes_facturado');
    }

    public function groupInvoices(int $clienteId, int $sucursalId, int $anio, int $mes, string $periodo)
    {
        return FacturaCabecera::query()
            ->with(['cliente', 'sucursal', 'detallePdf', 'ivaItems', 'tributos', 'historialCobranza.usuario'])
            ->where('cliente_id', $clienteId)
            ->where('sucursal_id', $sucursalId)
            ->where('anio_facturado', $anio)
            ->where('mes_facturado', $mes)
            ->where('periodo_facturado', $periodo)
            ->orderByDesc('fecha_cbte')
            ->orderByDesc('id')
            ->get();
    }
}
