import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClienteSelectOption, FacturaSummaryDto, SucursalSelectOption } from '../../features/facturacion/types';
import {
  FACTURACION_ESTADOS_COBRANZA,
  FACTURACION_ESTADOS_FISCALES,
  FACTURACION_PERIODOS,
  TARIFA_MONTH_OPTIONS,
} from '../../features/facturacion/constants';
import { formatDateOnly, parseNumberOrZero } from '../../features/facturacion/utils';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionListadoPage = (ctx: FacturacionPageContext) => {
  const { FacturacionShell, useFacturacionApi, buildDownloadUrl, formatCurrency } = ctx;

  const FacturacionListadoPage: React.FC = () => {
    const { apiBaseUrl, requestJson } = useFacturacionApi();
    const navigate = useNavigate();
    const [clientes, setClientes] = useState<ClienteSelectOption[]>([]);
    const [sucursales, setSucursales] = useState<SucursalSelectOption[]>([]);
    const [facturas, setFacturas] = useState<FacturaSummaryDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
      cliente_id: '',
      sucursal_id: '',
      estado: '',
      estado_cobranza: '',
      anio: '',
      mes: '',
      periodo: '',
      fecha_desde: '',
      fecha_hasta: '',
      fecha_aprox_desde: '',
      fecha_aprox_hasta: '',
      buscar: '',
    });
    const [queryFilters, setQueryFilters] = useState(filters);

    useEffect(() => {
      const loadClientes = async () => {
        try {
          const payload = (await requestJson('/api/clientes/select?limit=500')) as { data?: ClienteSelectOption[] };
          setClientes(Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
          setError((err as Error).message ?? 'No se pudieron cargar clientes.');
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
      const fetchFacturas = async () => {
        try {
          setLoading(true);
          setError(null);
          const params = new URLSearchParams();
          Object.entries(queryFilters).forEach(([key, value]) => {
            if (value) {
              params.set(key, value);
            }
          });
          const payload = (await requestJson(`/api/facturas?${params.toString()}`)) as { data?: FacturaSummaryDto[] };
          setFacturas(Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
          setError((err as Error).message ?? 'No se pudieron cargar las facturas.');
        } finally {
          setLoading(false);
        }
      };

      void fetchFacturas();
    }, [queryFilters, requestJson]);

    const canDeleteFactura = useCallback((estado: string | null | undefined) => {
      const value = (estado ?? '').toUpperCase();
      return ['BORRADOR', 'VALIDADA_LOCAL', 'LISTA_PARA_ENVIO', 'RECHAZADA_ARCA', 'ERROR_TECNICO'].includes(value);
    }, []);

    const handleDeleteFactura = useCallback(
      async (factura: FacturaSummaryDto) => {
        if (!canDeleteFactura(factura.estado)) {
          setError('Solo se pueden eliminar borradores o facturas rechazadas/errores.');
          return;
        }

        const comprobante = `${factura.cbte_tipo}-${String(factura.pto_vta).padStart(4, '0')}-${String(factura.cbte_numero ?? 0).padStart(8, '0')}`;
        const ok = window.confirm(`¿Eliminar la factura ${comprobante} del cliente "${factura.cliente_nombre}"? Esta acción no se puede deshacer.`);
        if (!ok) {
          return;
        }

        try {
          setLoading(true);
          setError(null);
          await requestJson(`/api/facturas/${factura.id}`, { method: 'DELETE' });
          setFacturas((prev) => prev.filter((item) => item.id !== factura.id));
        } catch (err) {
          setError((err as Error).message ?? 'No se pudo eliminar la factura.');
        } finally {
          setLoading(false);
        }
      },
      [canDeleteFactura, requestJson]
    );

    const kpis = useMemo(() => {
      const totalFacturas = facturas.length;
      let totalFacturado = 0;
      let totalCobrado = 0;
      let totalPendiente = 0;
      let totalVencido = 0;

      facturas.forEach((factura) => {
        const total = parseNumberOrZero(factura.imp_total);
        totalFacturado += total;
        const estado = (factura.estado_cobranza ?? '').toUpperCase();
        if (estado === 'COBRADA') {
          totalCobrado += total;
        } else if (estado === 'VENCIDA') {
          totalVencido += total;
        } else {
          totalPendiente += total;
        }
      });

      return { totalFacturas, totalFacturado, totalCobrado, totalPendiente, totalVencido };
    }, [facturas]);

    return (
      <FacturacionShell
        title="Facturación"
        subtitle="Listado de facturas y estados"
        headerActions={
          <button type="button" className="primary-action" onClick={() => navigate('/facturacion/nueva')}>
            Nueva factura
          </button>
        }
      >
        <section className="dashboard-card facturacion-section">
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Cliente</span>
              <select
                value={filters.cliente_id}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, cliente_id: event.target.value, sucursal_id: '' }))
                }
              >
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
              <select
                value={filters.sucursal_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, sucursal_id: event.target.value }))}
                disabled={!filters.cliente_id}
              >
                <option value="">Todas</option>
                {sucursales.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Estado fiscal</span>
              <select value={filters.estado} onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}>
                <option value="">Todos</option>
                {FACTURACION_ESTADOS_FISCALES.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Estado cobranza</span>
              <select
                value={filters.estado_cobranza}
                onChange={(event) => setFilters((prev) => ({ ...prev, estado_cobranza: event.target.value }))}
              >
                <option value="">Todos</option>
                {FACTURACION_ESTADOS_COBRANZA.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Año</span>
              <input type="number" value={filters.anio} onChange={(event) => setFilters((prev) => ({ ...prev, anio: event.target.value }))} />
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
              <select
                value={filters.periodo}
                onChange={(event) => setFilters((prev) => ({ ...prev, periodo: event.target.value }))}
              >
                <option value="">Todos</option>
                {FACTURACION_PERIODOS.map((periodo) => (
                  <option key={periodo.value} value={periodo.value}>
                    {periodo.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Emisión desde</span>
              <input
                type="date"
                value={filters.fecha_desde}
                onChange={(event) => setFilters((prev) => ({ ...prev, fecha_desde: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Emisión hasta</span>
              <input
                type="date"
                value={filters.fecha_hasta}
                onChange={(event) => setFilters((prev) => ({ ...prev, fecha_hasta: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Cobro desde</span>
              <input
                type="date"
                value={filters.fecha_aprox_desde}
                onChange={(event) => setFilters((prev) => ({ ...prev, fecha_aprox_desde: event.target.value }))}
              />
            </label>
            <label className="input-control">
              <span>Cobro hasta</span>
              <input
                type="date"
                value={filters.fecha_aprox_hasta}
                onChange={(event) => setFilters((prev) => ({ ...prev, fecha_aprox_hasta: event.target.value }))}
              />
            </label>
            <label className="input-control facturacion-search">
              <span>Buscar</span>
              <input
                type="text"
                value={filters.buscar}
                onChange={(event) => setFilters((prev) => ({ ...prev, buscar: event.target.value }))}
                placeholder="Nro, CAE, CUIT o cliente"
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={() => setQueryFilters(filters)}>
              Actualizar
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                const reset = {
                  cliente_id: '',
                  sucursal_id: '',
                  estado: '',
                  estado_cobranza: '',
                  anio: '',
                  mes: '',
                  periodo: '',
                  fecha_desde: '',
                  fecha_hasta: '',
                  fecha_aprox_desde: '',
                  fecha_aprox_hasta: '',
                  buscar: '',
                };
                setFilters(reset);
                setQueryFilters(reset);
              }}
            >
              Limpiar
            </button>
          </div>
        </section>

        <section className="summary-grid">
          <div className="summary-card">
            <span className="summary-card__label">Facturas</span>
            <strong className="summary-card__value">{kpis.totalFacturas}</strong>
          </div>
          <div className="summary-card summary-card--info">
            <span className="summary-card__label">Total facturado</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalFacturado)}</strong>
          </div>
          <div className="summary-card summary-card--warning">
            <span className="summary-card__label">Total pendiente</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalPendiente)}</strong>
          </div>
          <div className="summary-card summary-card--danger">
            <span className="summary-card__label">Total vencido</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalVencido)}</strong>
          </div>
          <div className="summary-card summary-card--success">
            <span className="summary-card__label">Total cobrado</span>
            <strong className="summary-card__value">{formatCurrency(kpis.totalCobrado)}</strong>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          {error ? <p className="form-info form-info--error">{error}</p> : null}
          {loading ? <p className="form-info">Cargando facturas...</p> : null}
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Sucursal</th>
                  <th>Comprobante</th>
                  <th>Emisión</th>
                  <th>Neto</th>
                  <th>IVA</th>
                  <th>No gravado</th>
                  <th>Total</th>
                  <th>Cobro aprox.</th>
                  <th>Pago</th>
                  <th>Cobranza</th>
                  <th>Fiscal</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 ? (
                  <tr>
                    <td colSpan={13}>No hay facturas para los filtros seleccionados.</td>
                  </tr>
                ) : (
                  facturas.map((factura) => (
                    <tr key={factura.id}>
                      <td>{factura.cliente_nombre}</td>
                      <td>{factura.sucursal_nombre ?? '—'}</td>
                      <td>
                        {factura.cbte_tipo}-{String(factura.pto_vta).padStart(4, '0')}-{String(factura.cbte_numero ?? 0).padStart(8, '0')}
                      </td>
                      <td>{formatDateOnly(factura.fecha_cbte)}</td>
                      <td>{formatCurrency(parseNumberOrZero(factura.imp_neto))}</td>
                      <td>{formatCurrency(parseNumberOrZero(factura.imp_iva))}</td>
                      <td>{formatCurrency(parseNumberOrZero(factura.imp_tot_conc) + parseNumberOrZero(factura.imp_op_ex))}</td>
                      <td>{formatCurrency(parseNumberOrZero(factura.imp_total))}</td>
                      <td>{formatDateOnly(factura.fecha_aprox_cobro)}</td>
                      <td>{formatDateOnly(factura.fecha_pago_manual)}</td>
                      <td>
                        <span className={`facturacion-status facturacion-status--${(factura.estado_cobranza ?? '').toLowerCase().replace(/_/g, '-')}`}>
                          {factura.estado_cobranza ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`facturacion-status facturacion-status--${(factura.estado ?? '').toLowerCase().replace(/_/g, '-')}`}>
                          {factura.estado ?? '—'}
                        </span>
                      </td>
                      <td className="facturacion-actions">
                        <button type="button" className="secondary-action secondary-action--ghost" onClick={() => navigate(`/facturacion/facturas/${factura.id}`)}>
                          Detalle
                        </button>
                        {factura.pdf_url ? (
                          <a
                            className="secondary-action secondary-action--ghost"
                            href={buildDownloadUrl(apiBaseUrl, factura.pdf_url) ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="facturacion-icon-action"
                          onClick={() => void handleDeleteFactura(factura)}
                          disabled={loading || !canDeleteFactura(factura.estado)}
                          aria-label="Eliminar factura"
                          title={
                            canDeleteFactura(factura.estado)
                              ? 'Eliminar'
                              : 'No se puede eliminar una factura autorizada/enviada.'
                          }
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path
                              d="M9 3h6m-7 4h8m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7h10Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M10 11v7M14 11v7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
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

  return FacturacionListadoPage;
};
