import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ClienteSelectOption,
  ClientesFacturacionResumenDto,
  SucursalSelectOption,
} from '../../features/facturacion/types';
import { FACTURACION_ESTADOS_COBRANZA, FACTURACION_PERIODOS, TARIFA_MONTH_OPTIONS } from '../../features/facturacion/constants';
import { parseNumberOrZero } from '../../features/facturacion/utils';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionClientesPage = (ctx: FacturacionPageContext) => {
  const { FacturacionShell, useFacturacionApi, formatCurrency } = ctx;

  const FacturacionClientesPage: React.FC = () => {
    const { requestJson } = useFacturacionApi();
    const navigate = useNavigate();
    const [clientes, setClientes] = useState<ClienteSelectOption[]>([]);
    const [sucursales, setSucursales] = useState<SucursalSelectOption[]>([]);
    const [filters, setFilters] = useState({
      cliente_id: '',
      sucursal_id: '',
      anio: '',
      mes: '',
      periodo: '',
      estado_cobranza: '',
    });
    const [queryFilters, setQueryFilters] = useState(filters);
    const [rows, setRows] = useState<ClientesFacturacionResumenDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const loadClientes = async () => {
        try {
          const payload = (await requestJson('/api/clientes/select?limit=500')) as { data?: ClienteSelectOption[] };
          setClientes(Array.isArray(payload?.data) ? payload.data : []);
        } catch {
          setClientes([]);
        }
      };
      void loadClientes();
    }, [requestJson]);

    useEffect(() => {
      const clienteId = Number(filters.cliente_id);
      if (!clienteId) {
        setSucursales([]);
        return;
      }
      const loadSucursales = async () => {
        try {
          const payload = (await requestJson(`/api/clientes/${clienteId}/sucursales`)) as { data?: SucursalSelectOption[] };
          setSucursales(Array.isArray(payload?.data) ? payload.data : []);
        } catch {
          setSucursales([]);
        }
      };
      void loadSucursales();
    }, [filters.cliente_id, requestJson]);

    useEffect(() => {
      const fetchResumen = async () => {
        try {
          setLoading(true);
          setError(null);
          const params = new URLSearchParams();
          Object.entries(queryFilters).forEach(([key, value]) => {
            if (value) {
              params.set(key, value);
            }
          });
          const payload = (await requestJson(`/api/clientes-facturacion/resumen?${params.toString()}`)) as {
            data?: ClientesFacturacionResumenDto[];
          };
          setRows(Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
          setError((err as Error).message ?? 'No se pudo cargar el resumen.');
        } finally {
          setLoading(false);
        }
      };
      void fetchResumen();
    }, [queryFilters, requestJson]);

    const kpis = useMemo(() => {
      const totalGrupos = rows.length;
      let totalNeto = 0;
      let totalNoGravado = 0;
      let totalIva = 0;
      let totalFinal = 0;
      let totalVencido = 0;
      let totalPendiente = 0;

      rows.forEach((row) => {
        totalNeto += parseNumberOrZero(row.total_neto_gravado);
        totalNoGravado += parseNumberOrZero(row.total_no_gravado);
        totalIva += parseNumberOrZero(row.total_iva);
        totalFinal += parseNumberOrZero(row.total_final);
        totalVencido += parseNumberOrZero(row.facturas_vencidas);
        totalPendiente += parseNumberOrZero(row.facturas_pendientes);
      });

      return { totalGrupos, totalNeto, totalNoGravado, totalIva, totalFinal, totalVencido, totalPendiente };
    }, [rows]);

    return (
      <FacturacionShell title="Clientes de facturación" subtitle="Resumen por cliente, sucursal y período">
        <section className="dashboard-card facturacion-section">
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Cliente</span>
              <select value={filters.cliente_id} onChange={(event) => setFilters((prev) => ({ ...prev, cliente_id: event.target.value, sucursal_id: '' }))}>
                <option value="">Todos</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre ?? `Cliente #${cliente.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Sucursal</span>
              <select value={filters.sucursal_id} onChange={(event) => setFilters((prev) => ({ ...prev, sucursal_id: event.target.value }))} disabled={!filters.cliente_id}>
                <option value="">Todas</option>
                {sucursales.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Año</span>
              <input value={filters.anio} onChange={(event) => setFilters((prev) => ({ ...prev, anio: event.target.value }))} />
            </label>
            <label className="input-control">
              <span>Mes</span>
              <select value={filters.mes} onChange={(event) => setFilters((prev) => ({ ...prev, mes: event.target.value }))}>
                <option value="">Todos</option>
                {TARIFA_MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Período</span>
              <select value={filters.periodo} onChange={(event) => setFilters((prev) => ({ ...prev, periodo: event.target.value }))}>
                <option value="">Todos</option>
                {FACTURACION_PERIODOS.map((periodo) => (
                  <option key={periodo.value} value={periodo.value}>
                    {periodo.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Estado cobranza</span>
              <select value={filters.estado_cobranza} onChange={(event) => setFilters((prev) => ({ ...prev, estado_cobranza: event.target.value }))}>
                <option value="">Todos</option>
                {FACTURACION_ESTADOS_COBRANZA.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={() => setQueryFilters(filters)}>
              Actualizar
            </button>
          </div>
        </section>

        <section className="summary-grid">
          <div className="summary-card">
            <span className="summary-card__label">Grupos</span>
            <strong className="summary-card__value">{kpis.totalGrupos}</strong>
          </div>
          <div className="summary-card summary-card--info">
            <span className="summary-card__label">Total neto</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalNeto)}</strong>
          </div>
          <div className="summary-card summary-card--neutral">
            <span className="summary-card__label">Total no gravado</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalNoGravado)}</strong>
          </div>
          <div className="summary-card summary-card--success">
            <span className="summary-card__label">Total IVA</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalIva)}</strong>
          </div>
          <div className="summary-card summary-card--warning">
            <span className="summary-card__label">Total final</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalFinal)}</strong>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          {error ? <p className="form-info form-info--error">{error}</p> : null}
          {loading ? <p className="form-info">Cargando resumen...</p> : null}
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Sucursal</th>
                  <th>Período</th>
                  <th>Facturas</th>
                  <th>Neto</th>
                  <th>No gravado</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th>Cobradas</th>
                  <th>Pendientes</th>
                  <th>Vencidas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12}>No hay datos para los filtros seleccionados.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.group_id}>
                      <td>{row.cliente_nombre}</td>
                      <td>{row.sucursal_nombre}</td>
                      <td>
                        {row.anio_facturado}/{String(row.mes_facturado).padStart(2, '0')} {row.periodo_facturado}
                      </td>
                      <td>{row.cantidad_facturas}</td>
                      <td>{formatCurrency(row.total_neto_gravado)}</td>
                      <td>{formatCurrency(row.total_no_gravado)}</td>
                      <td>{formatCurrency(row.total_iva)}</td>
                      <td>{formatCurrency(row.total_final)}</td>
                      <td>{row.facturas_cobradas}</td>
                      <td>{row.facturas_pendientes}</td>
                      <td>{row.facturas_vencidas}</td>
                      <td>
                        <button type="button" className="secondary-action secondary-action--ghost" onClick={() => navigate(`/facturacion/clientes/grupo/${row.group_id}`)}>
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </FacturacionShell>
    );
  };

  return FacturacionClientesPage;
};
