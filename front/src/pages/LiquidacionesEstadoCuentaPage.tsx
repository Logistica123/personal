import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiqApi } from '../features/liquidaciones/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EstadoCuentaRow = {
  id: number;
  cliente_id: number;
  cliente_nombre: string | null;
  sucursal: string;
  jurisdiccion_id: number | null;
  jurisdiccion_nombre: string | null;
  periodo: string;
  quincena: string;
  neto_gravado: string | number;
  no_gravado: string | number;
  iva: string | number;
  importe_a_cobrar: string | number;
  observaciones: string | null;
  tipo_comprobante: string;
  liquidacion_cliente_id: number | null;
  factura_id: number | null;
  numero_factura: string | null;
  cae: string | null;
  fecha_factura: string | null;
  vencimiento_pago: string | null;
  fecha_cobro: string | null;
  importe_cobrado: string | number | null;
  retenciones_gcias: string | number;
  otras_retenciones: string | number;
  numero_op_cobro: string | null;
  forma_cobro: string | null;
  diferencia: string | number;
  estado: string;
  usuario: string | null;
  created_at: string | null;
};

type Jurisdiccion = { id: number; nombre: string };
type LiqCliente = { id: number; nombre_corto?: string | null; razon_social?: string | null };

type Props = {
  DashboardLayout: React.ComponentType<{ title: string; subtitle?: string; children: React.ReactNode }>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => unknown;
  buildActorHeaders: (user: unknown) => Record<string, string>;
  formatCurrency?: (n: number) => string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmtCurrency = (v: number, formatter?: (n: number) => string): string => {
  if (formatter) return formatter(v);
  return v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: '#e2a300',
  FACTURADA: '#2563eb',
  COBRADA: '#16a34a',
  NC_EMITIDA: '#dc2626',
};

const FORMAS_COBRO = ['ECHEQ', 'Transferencia', 'Cheque', 'Deposito', 'Efectivo'];
const ESTADOS = ['PENDIENTE', 'FACTURADA', 'COBRADA', 'NC_EMITIDA'];
const TIPOS_COMPROBANTE = ['FA', 'NC', 'ND'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LiquidacionesEstadoCuentaPage({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
  formatCurrency: formatCurrencyProp,
}: Props) {
  const authUser = useStoredAuthUser();
  const navigate = useNavigate();
  const api = useLiqApi({ resolveApiBaseUrl, buildActorHeaders, authUser });

  // ---- Data state ----
  const [rows, setRows] = useState<EstadoCuentaRow[]>([]);
  const [clientes, setClientes] = useState<LiqCliente[]>([]);
  const [jurisdicciones, setJurisdicciones] = useState<Jurisdiccion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ---- Filters ----
  const [filterCliente, setFilterCliente] = useState('');
  const [filterSucursal, setFilterSucursal] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterPeriodo, setFilterPeriodo] = useState('');

  // ---- Modals ----
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [showCobrarModal, setShowCobrarModal] = useState<EstadoCuentaRow | null>(null);
  const [showJurisdiccionModal, setShowJurisdiccionModal] = useState<EstadoCuentaRow | null>(null);

  // ---- Create form ----
  const [crearClienteId, setCrearClienteId] = useState('');
  const [crearSucursal, setCrearSucursal] = useState('');
  const [crearPeriodo, setCrearPeriodo] = useState('');
  const [crearQuincena, setCrearQuincena] = useState('MC');
  const [crearNeto, setCrearNeto] = useState('');
  const [crearTipo, setCrearTipo] = useState('NC');
  const [crearObs, setCrearObs] = useState('');

  // ---- Cobrar form ----
  const [cobrarFecha, setCobrarFecha] = useState('');
  const [cobrarImporte, setCobrarImporte] = useState('');
  const [cobrarRetGcias, setCobrarRetGcias] = useState('0');
  const [cobrarOtrasRet, setCobrarOtrasRet] = useState('0');
  const [cobrarNumOP, setCobrarNumOP] = useState('');
  const [cobrarForma, setCobrarForma] = useState('');

  // ---- Jurisdiccion form ----
  const [jurisdiccionId, setJurisdiccionId] = useState('');

  // ---- Load initial data ----
  useEffect(() => {
    const load = async () => {
      try {
        const [clientesRes, jurisdiccionesRes] = await Promise.all([
          api.get('/clientes'),
          api.get('/jurisdicciones'),
        ]);
        setClientes(clientesRes.data ?? []);
        setJurisdicciones(jurisdiccionesRes.data ?? []);
      } catch { /* ignore */ }
    };
    load();
  }, [api]);

  // ---- Fetch rows ----
  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterCliente) params.set('cliente_id', filterCliente);
      if (filterSucursal) params.set('sucursal', filterSucursal);
      if (filterEstado) params.set('estado', filterEstado);
      if (filterTipo) params.set('tipo_comprobante', filterTipo);
      if (filterPeriodo) params.set('periodo', filterPeriodo);
      const qs = params.toString();
      const res = await api.get(`/estado-cuenta${qs ? `?${qs}` : ''}`);
      setRows(res.data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [api, filterCliente, filterSucursal, filterEstado, filterTipo, filterPeriodo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const pendientes = rows.filter(r => r.estado === 'PENDIENTE');
    const facturadas = rows.filter(r => r.estado === 'FACTURADA');
    const cobradas = rows.filter(r => r.estado === 'COBRADA');
    return {
      total: rows.length,
      totalImporte: rows.reduce((s, r) => s + num(r.importe_a_cobrar), 0),
      pendientes: pendientes.length,
      pendientesImporte: pendientes.reduce((s, r) => s + num(r.importe_a_cobrar), 0),
      facturadas: facturadas.length,
      facturadasImporte: facturadas.reduce((s, r) => s + num(r.importe_a_cobrar), 0),
      cobradas: cobradas.length,
      cobradasImporte: cobradas.reduce((s, r) => s + num(r.importe_a_cobrar), 0),
    };
  }, [rows]);

  // ---- Unique sucursales for filter ----
  const sucursalOptions = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.sucursal))).sort();
  }, [rows]);

  // ---- Actions ----
  const clearMsg = () => { setError(null); setSuccessMsg(null); };

  const handleCrear = async () => {
    clearMsg();
    try {
      await api.post('/estado-cuenta', {
        cliente_id: parseInt(crearClienteId),
        sucursal: crearSucursal,
        periodo: crearPeriodo,
        quincena: crearQuincena,
        neto_gravado: parseFloat(crearNeto),
        tipo_comprobante: crearTipo,
        observaciones: crearObs || null,
      });
      setSuccessMsg('Fila creada correctamente.');
      setShowCrearModal(false);
      fetchRows();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFacturar = async (row: EstadoCuentaRow) => {
    clearMsg();
    if (!row.jurisdiccion_id) {
      setShowJurisdiccionModal(row);
      return;
    }
    try {
      const res = await api.post(`/estado-cuenta/${row.id}/facturar`, {});
      // Redirigir a /facturacion/nueva con datos precargados
      if (res.prefill) {
        navigate('/facturacion/nueva', {
          state: {
            prefill: res.prefill,
            estado_cuenta_id: res.estado_cuenta_id,
            fromEstadoCuenta: true,
          },
        });
      } else {
        setSuccessMsg(res.message ?? 'Datos preparados.');
        fetchRows();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCobrar = async () => {
    if (!showCobrarModal) return;
    clearMsg();
    try {
      await api.post(`/estado-cuenta/${showCobrarModal.id}/cobrar`, {
        fecha_cobro: cobrarFecha,
        importe_cobrado: parseFloat(cobrarImporte),
        retenciones_gcias: parseFloat(cobrarRetGcias || '0'),
        otras_retenciones: parseFloat(cobrarOtrasRet || '0'),
        numero_op_cobro: cobrarNumOP || null,
        forma_cobro: cobrarForma || null,
      });
      setSuccessMsg('Cobranza registrada.');
      setShowCobrarModal(null);
      fetchRows();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEliminar = async (row: EstadoCuentaRow) => {
    if (!window.confirm('Eliminar esta fila?')) return;
    clearMsg();
    try {
      await api.delete(`/estado-cuenta/${row.id}`);
      setSuccessMsg('Fila eliminada.');
      fetchRows();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGuardarJurisdiccion = async () => {
    if (!showJurisdiccionModal || !jurisdiccionId) return;
    clearMsg();
    try {
      await api.post('/jurisdicciones/sucursal', {
        cliente_id: showJurisdiccionModal.cliente_id,
        sucursal: showJurisdiccionModal.sucursal,
        jurisdiccion_id: parseInt(jurisdiccionId),
      });
      await api.patch(`/estado-cuenta/${showJurisdiccionModal.id}`, {
        jurisdiccion_id: parseInt(jurisdiccionId),
      });
      setShowJurisdiccionModal(null);
      setJurisdiccionId('');
      setSuccessMsg('Jurisdiccion asignada.');
      fetchRows();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportar = () => {
    const params = new URLSearchParams();
    if (filterCliente) params.set('cliente_id', filterCliente);
    if (filterSucursal) params.set('sucursal', filterSucursal);
    if (filterEstado) params.set('estado', filterEstado);
    const qs = params.toString();
    const base = resolveApiBaseUrl();
    window.open(`${base}/api/liq/estado-cuenta/exportar${qs ? `?${qs}` : ''}`, '_blank');
  };

  const openCobrarModal = (row: EstadoCuentaRow) => {
    setCobrarFecha('');
    setCobrarImporte(String(num(row.importe_a_cobrar)));
    setCobrarRetGcias('0');
    setCobrarOtrasRet('0');
    setCobrarNumOP('');
    setCobrarForma('');
    setShowCobrarModal(row);
  };

  // ---- Render ----
  return (
    <DashboardLayout title="Estado de Cuenta" subtitle="Cara del cliente: liquidacion a facturacion">

      {/* Messages */}
      {error && <div className="form-info form-info--error" style={{ margin: '0 0 16px' }}>{error}</div>}
      {successMsg && <div className="form-info" style={{ margin: '0 0 16px', background: '#e8f5e9', color: '#1b5e20' }}>{successMsg}</div>}

      {/* Summary cards */}
      <section className="summary-grid" style={{ marginBottom: 20 }}>
        <div className="summary-card">
          <span className="summary-card__label">Total filas</span>
          <strong className="summary-card__value">{kpis.total}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Pendientes</span>
          <strong className="summary-card__value" style={{ color: ESTADO_COLORS.PENDIENTE }}>
            {kpis.pendientes} &middot; {fmtCurrency(kpis.pendientesImporte, formatCurrencyProp)}
          </strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Facturadas</span>
          <strong className="summary-card__value" style={{ color: ESTADO_COLORS.FACTURADA }}>
            {kpis.facturadas} &middot; {fmtCurrency(kpis.facturadasImporte, formatCurrencyProp)}
          </strong>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Cobradas</span>
          <strong className="summary-card__value" style={{ color: ESTADO_COLORS.COBRADA }}>
            {kpis.cobradas} &middot; {fmtCurrency(kpis.cobradasImporte, formatCurrencyProp)}
          </strong>
        </div>
      </section>

      {/* Filters */}
      <section className="dashboard-card" style={{ marginBottom: 20, padding: 16 }}>
        <div className="filters-grid" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="input-control" style={{ flex: '1 1 180px' }}>
            <span>Cliente</span>
            <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_corto ?? c.razon_social}</option>)}
            </select>
          </label>
          <label className="input-control" style={{ flex: '1 1 140px' }}>
            <span>Sucursal</span>
            <select value={filterSucursal} onChange={e => setFilterSucursal(e.target.value)}>
              <option value="">Todas</option>
              {sucursalOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="input-control" style={{ flex: '1 1 120px' }}>
            <span>Periodo</span>
            <input type="text" placeholder="ej: mar-26" value={filterPeriodo} onChange={e => setFilterPeriodo(e.target.value)} />
          </label>
          <label className="input-control" style={{ flex: '1 1 120px' }}>
            <span>Estado</span>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="input-control" style={{ flex: '1 1 100px' }}>
            <span>Tipo</span>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_COMPROBANTE.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary-action" onClick={fetchRows}>Buscar</button>
            <button className="secondary-action" onClick={() => setShowCrearModal(true)}>+ NC / ND</button>
            <button className="secondary-action" onClick={handleExportar}>Exportar CSV</button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="dashboard-card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No hay datos para los filtros seleccionados.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Jurisd.</th>
                  <th>Sucursal</th>
                  <th>Periodo</th>
                  <th>Q</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Neto Gravado</th>
                  <th style={{ textAlign: 'right' }}>IVA</th>
                  <th style={{ textAlign: 'right' }}>Imp. a Cobrar</th>
                  <th>N Factura</th>
                  <th>Fecha Fact.</th>
                  <th>Fecha Cobro</th>
                  <th style={{ textAlign: 'right' }}>Imp. Cobrado</th>
                  <th style={{ textAlign: 'right' }}>Diferencia</th>
                  <th>Estado</th>
                  <th>Obs.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      {row.jurisdiccion_id ? (
                        <span title={row.jurisdiccion_nombre ?? ''}>{row.jurisdiccion_id}</span>
                      ) : (
                        <button
                          className="secondary-action--ghost"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => { setJurisdiccionId(''); setShowJurisdiccionModal(row); }}
                        >
                          Asignar
                        </button>
                      )}
                    </td>
                    <td>{row.sucursal}</td>
                    <td>{row.periodo}</td>
                    <td>{row.quincena}</td>
                    <td><span className="tag">{row.tipo_comprobante}</span></td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(num(row.neto_gravado), formatCurrencyProp)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(num(row.iva), formatCurrencyProp)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(num(row.importe_a_cobrar), formatCurrencyProp)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.numero_factura ?? ''}</td>
                    <td>{row.fecha_factura ?? ''}</td>
                    <td>{row.fecha_cobro ?? ''}</td>
                    <td style={{ textAlign: 'right' }}>{row.importe_cobrado != null ? fmtCurrency(num(row.importe_cobrado), formatCurrencyProp) : ''}</td>
                    <td style={{ textAlign: 'right' }}>{num(row.diferencia) !== 0 ? fmtCurrency(num(row.diferencia), formatCurrencyProp) : ''}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: ESTADO_COLORS[row.estado] ?? '#999', color: '#fff',
                      }}>
                        {row.estado}
                      </span>
                    </td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.observaciones ?? ''}>
                      {row.observaciones ?? ''}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                        {row.estado === 'PENDIENTE' && (
                          <>
                            <button className="primary-action" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => handleFacturar(row)}>Facturar</button>
                            <button className="secondary-action" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }} onClick={() => handleEliminar(row)}>Eliminar</button>
                          </>
                        )}
                        {row.estado === 'FACTURADA' && (
                          <>
                            {row.factura_id && (
                              <button className="secondary-action" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => window.open(`/facturacion/detalle/${row.factura_id}`, '_blank')}>Ver Factura</button>
                            )}
                            <button className="primary-action" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => openCobrarModal(row)}>Cobrar</button>
                          </>
                        )}
                        {row.estado === 'COBRADA' && row.factura_id && (
                          <button className="secondary-action" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => window.open(`/facturacion/detalle/${row.factura_id}`, '_blank')}>Ver Factura</button>
                        )}
                        {row.estado === 'NC_EMITIDA' && row.factura_id && (
                          <button className="secondary-action" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => window.open(`/facturacion/detalle/${row.factura_id}`, '_blank')}>Ver NC</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal: Crear NC/ND */}
      {showCrearModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px' }}>Crear Nota de Credito / Debito</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="input-control">
                <span>Cliente</span>
                <select value={crearClienteId} onChange={e => setCrearClienteId(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_corto ?? c.razon_social}</option>)}
                </select>
              </label>
              <label className="input-control"><span>Sucursal</span><input value={crearSucursal} onChange={e => setCrearSucursal(e.target.value)} /></label>
              <label className="input-control"><span>Periodo (ej: mar-26)</span><input value={crearPeriodo} onChange={e => setCrearPeriodo(e.target.value)} /></label>
              <label className="input-control">
                <span>Quincena</span>
                <select value={crearQuincena} onChange={e => setCrearQuincena(e.target.value)}>
                  <option value="MC">Mes completo</option>
                  <option value="Q1">1ra quincena</option>
                  <option value="Q2">2da quincena</option>
                </select>
              </label>
              <label className="input-control">
                <span>Tipo</span>
                <select value={crearTipo} onChange={e => setCrearTipo(e.target.value)}>
                  <option value="NC">Nota de Credito</option>
                  <option value="ND">Nota de Debito</option>
                </select>
              </label>
              <label className="input-control"><span>Neto gravado</span><input type="number" step="0.01" value={crearNeto} onChange={e => setCrearNeto(e.target.value)} /></label>
              <label className="input-control"><span>Observaciones</span><textarea value={crearObs} onChange={e => setCrearObs(e.target.value)} rows={2} /></label>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="secondary-action" onClick={() => setShowCrearModal(false)}>Cancelar</button>
              <button className="primary-action" onClick={handleCrear} disabled={!crearClienteId || !crearSucursal || !crearPeriodo || !crearNeto}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cobrar */}
      {showCobrarModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px' }}>Registrar Cobranza</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
              {showCobrarModal.sucursal} &middot; {showCobrarModal.periodo} &middot; Importe: {fmtCurrency(num(showCobrarModal.importe_a_cobrar), formatCurrencyProp)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="input-control"><span>Fecha cobro</span><input type="date" value={cobrarFecha} onChange={e => setCobrarFecha(e.target.value)} /></label>
              <label className="input-control"><span>Importe cobrado</span><input type="number" step="0.01" value={cobrarImporte} onChange={e => setCobrarImporte(e.target.value)} /></label>
              <label className="input-control"><span>Retenciones GCIAS</span><input type="number" step="0.01" value={cobrarRetGcias} onChange={e => setCobrarRetGcias(e.target.value)} /></label>
              <label className="input-control"><span>Otras retenciones</span><input type="number" step="0.01" value={cobrarOtrasRet} onChange={e => setCobrarOtrasRet(e.target.value)} /></label>
              <label className="input-control"><span>N OP / Recibo</span><input value={cobrarNumOP} onChange={e => setCobrarNumOP(e.target.value)} /></label>
              <label className="input-control">
                <span>Forma de cobro</span>
                <select value={cobrarForma} onChange={e => setCobrarForma(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {FORMAS_COBRO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="secondary-action" onClick={() => setShowCobrarModal(null)}>Cancelar</button>
              <button className="primary-action" onClick={handleCobrar} disabled={!cobrarFecha || !cobrarImporte}>Registrar cobranza</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Jurisdiccion */}
      {showJurisdiccionModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px' }}>Asignar Jurisdiccion IIBB</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
              Sucursal: <strong>{showJurisdiccionModal.sucursal}</strong>
            </p>
            <label className="input-control">
              <span>Jurisdiccion</span>
              <select value={jurisdiccionId} onChange={e => setJurisdiccionId(e.target.value)}>
                <option value="">Seleccionar</option>
                {jurisdicciones.map(j => <option key={j.id} value={j.id}>{j.id} - {j.nombre}</option>)}
              </select>
            </label>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="secondary-action" onClick={() => setShowJurisdiccionModal(null)}>Cancelar</button>
              <button className="primary-action" onClick={handleGuardarJurisdiccion} disabled={!jurisdiccionId}>Guardar</button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal styles                                                       */
/* ------------------------------------------------------------------ */

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--card, #fff)', borderRadius: 12, padding: 24,
  width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 8px 30px rgba(0,0,0,.2)',
};
