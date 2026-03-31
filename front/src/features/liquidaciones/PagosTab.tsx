import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LiqClienteLiq } from './types';

type Props = {
  apiBaseUrl: string;
  buildActorHeaders: () => Record<string, string>;
};

const readApiErrorMessage = async (res: Response): Promise<string> => {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) return body.message;
    } catch {
      // ignore
    }
  }

  let text = '';
  try {
    text = (await res.text()) ?? '';
  } catch {
    // ignore
  }

  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    return `La API devolvió HTML (status ${res.status}) en ${res.url}. Revisar apiBaseUrl / sesión.`;
  }

  const suffix = text ? ` ${text.slice(0, 160)}` : '';
  return `Error HTTP ${res.status}.${suffix}`;
};

const readJsonOrThrow = async <T,>(res: Response): Promise<T> => {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(await readApiErrorMessage(res));
  }
  return (await res.json()) as T;
};

type PagoEstado = 'generado' | 'pagado' | 'anulado';

type LiqPago = {
  id: number;
  cliente_id: number;
  cliente_nombre?: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_generacion: string;
  estado: PagoEstado;
  cantidad_items: number;
  total_monto: number;
  fecha_pago?: string | null;
  referencia?: string | null;
  usuario_nombre?: string | null;
};

type LiqPagoItem = {
  id: number;
  pago_id: number;
  liquidacion_distribuidor_id: number;
  distribuidor_id: number;
  distribuidor_nombre?: string | null;
  distribuidor_patente?: string | null;
  distribuidor_cuit?: string | null;
  cbu_alias?: string | null;
  monto: number;
};

type MissingCbuItem = {
  liquidacion_distribuidor_id: number;
  distribuidor_id: number | null;
  distribuidor_nombre?: string | null;
  distribuidor_patente?: string | null;
};

type PagoDryRun = {
  cliente_id: number;
  periodo_desde: string;
  periodo_hasta: string;
  cantidad_items: number;
  total_monto: number;
};

const ESTADO_BADGE: Record<PagoEstado, React.CSSProperties> = {
  generado: { background: '#fef3c7', color: '#92400e' },
  pagado: { background: '#d1fae5', color: '#065f46' },
  anulado: { background: '#fee2e2', color: '#991b1b' },
};

const formatPeso = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const formatFecha = (iso: string): string => {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const PagosTab: React.FC<Props> = ({ apiBaseUrl, buildActorHeaders }) => {
  const [clientes, setClientes] = useState<LiqClienteLiq[]>([]);
  const [pagos, setPagos] = useState<LiqPago[]>([]);
  const [seleccionado, setSeleccionado] = useState<LiqPago | null>(null);
  const [items, setItems] = useState<LiqPagoItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoItems, setCargandoItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refPago, setRefPago] = useState('');
  const [fechaPago, setFechaPago] = useState<string>('');

  const [dryRun, setDryRun] = useState<PagoDryRun | null>(null);
  const [missingCbu, setMissingCbu] = useState<MissingCbuItem[]>([]);
  const [dryRunLoading, setDryRunLoading] = useState(false);

  const [form, setForm] = useState({
    clienteId: '',
    periodoDesde: '',
    periodoHasta: '',
  });

  const canCreate = form.clienteId && form.periodoDesde && form.periodoHasta;

  const loadClientes = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/clientes`, {
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ data?: LiqClienteLiq[] }>(res);
      setClientes(data.data ?? []);
    } catch {
      // ignore
    }
  }, [apiBaseUrl, buildActorHeaders]);

  const loadPagos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (form.clienteId) params.set('cliente_id', form.clienteId);
      if (form.periodoDesde) params.set('periodo_desde', form.periodoDesde);
      if (form.periodoHasta) params.set('periodo_hasta', form.periodoHasta);
      params.set('per_page', '50');

      const res = await fetch(`${apiBaseUrl}/api/liq/pagos?${params.toString()}`, {
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ data?: LiqPago[] }>(res);
      setPagos(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pagos.');
    } finally {
      setCargando(false);
    }
  }, [apiBaseUrl, buildActorHeaders, form.clienteId, form.periodoDesde, form.periodoHasta]);

  const loadItems = useCallback(
    async (pago: LiqPago) => {
      setCargandoItems(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/pagos/${pago.id}/items`, {
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const data = await readJsonOrThrow<{ data?: LiqPagoItem[] }>(res);
        setItems(data.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los ítems del pago.');
      } finally {
        setCargandoItems(false);
      }
    },
    [apiBaseUrl, buildActorHeaders],
  );

  useEffect(() => {
    void loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    void loadPagos();
  }, [loadPagos]);

  useEffect(() => {
    if (seleccionado) {
      void loadItems(seleccionado);
    } else {
      setItems([]);
    }
  }, [seleccionado, loadItems]);

  useEffect(() => {
    if (seleccionado) {
      setRefPago(seleccionado.referencia ?? '');
      setFechaPago(seleccionado.fecha_pago ? String(seleccionado.fecha_pago).slice(0, 10) : '');
    }
  }, [seleccionado]);

  useEffect(() => {
    setDryRun(null);
    setMissingCbu([]);
  }, [form.clienteId, form.periodoDesde, form.periodoHasta]);

  const handleDryRun = useCallback(async () => {
    if (!canCreate) return;
    setDryRunLoading(true);
    setError(null);
    setDryRun(null);
    setMissingCbu([]);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/pagos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...buildActorHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          cliente_id: Number(form.clienteId),
          periodo_desde: form.periodoDesde,
          periodo_hasta: form.periodoHasta,
          dry_run: true,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const payload = (await res.json()) as { message?: string; missing_cbu?: MissingCbuItem[] };
          setMissingCbu(payload.missing_cbu ?? []);
          throw new Error(payload.message ?? 'No se pudo simular el lote.');
        }
        throw new Error(await readApiErrorMessage(res));
      }

      const payload = await readJsonOrThrow<{ data?: PagoDryRun }>(res);
      setDryRun(payload.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo simular el lote.');
    } finally {
      setDryRunLoading(false);
    }
  }, [apiBaseUrl, buildActorHeaders, canCreate, form.clienteId, form.periodoDesde, form.periodoHasta]);

  const handleCrear = useCallback(async () => {
    if (!canCreate) return;
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/pagos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...buildActorHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          cliente_id: Number(form.clienteId),
          periodo_desde: form.periodoDesde,
          periodo_hasta: form.periodoHasta,
        }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const payload = await readJsonOrThrow<{ data?: LiqPago; message?: string; missing_cbu?: MissingCbuItem[] }>(res);
      if (payload.data) {
        setSeleccionado(payload.data);
      }
      await loadPagos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el lote de pagos.');
    }
  }, [apiBaseUrl, buildActorHeaders, canCreate, form.clienteId, form.periodoDesde, form.periodoHasta, loadPagos]);

  const handleMarcarPagado = useCallback(async () => {
    if (!seleccionado) return;
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/pagos/${seleccionado.id}/marcar-pagado`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...buildActorHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          referencia: refPago.trim() || null,
          fecha_pago: fechaPago || null,
        }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const payload = await readJsonOrThrow<{ data?: LiqPago; message?: string }>(res);
      await loadPagos();
      if (payload.data) setSeleccionado(payload.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar como pagado.');
    }
  }, [apiBaseUrl, buildActorHeaders, fechaPago, loadPagos, refPago, seleccionado]);

  const totalSeleccionado = useMemo(() => items.reduce((sum, i) => sum + i.monto, 0), [items]);

  const handleExportCsv = useCallback(async () => {
    if (!seleccionado) return;
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/liq/pagos/${seleccionado.id}/export.csv`, {
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'text/csv' },
      });
      if (!res.ok) {
        setError(await readApiErrorMessage(res));
        return;
      }
      const disposition = res.headers.get('content-disposition') ?? '';
      const fileMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = fileMatch?.[1] ? fileMatch[1] : `pago_${seleccionado.id}.csv`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo exportar el CSV.');
    }
  }, [apiBaseUrl, buildActorHeaders, seleccionado]);

  return (
    <div style={panelStyle}>
      <h2 style={sectionTitleStyle}>Pagos</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Generá un lote a partir de liquidaciones de distribuidores aprobadas, exportá CSV y marcá el lote como pagado.
      </p>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {missingCbu.length > 0 && (
        <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fff7f7' }}>
          <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>
            Falta CBU/Alias en {missingCbu.length} liquidaciones
          </div>
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 10 }}>
            Completá el `cbu_alias` del distribuidor y volvé a simular/generar el lote.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fef2f2' }}>
                  <th style={thStyle}>Liq. distribuidor</th>
                  <th style={thStyle}>Distribuidor</th>
                  <th style={thStyle}>Patente</th>
                </tr>
              </thead>
              <tbody>
                {missingCbu.slice(0, 50).map((m) => (
                  <tr key={`${m.liquidacion_distribuidor_id}-${m.distribuidor_id ?? 0}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>#{m.liquidacion_distribuidor_id}</td>
                    <td style={tdStyle}>{m.distribuidor_nombre ?? (m.distribuidor_id ? `#${m.distribuidor_id}` : '—')}</td>
                    <td style={tdStyle}>{m.distribuidor_patente ?? '—'}</td>
                  </tr>
                ))}
                {missingCbu.length > 50 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 10, color: '#6b7280' }}>
                      … y {missingCbu.length - 50} más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        {/* Panel izquierdo: crear + lista */}
        <div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nuevo lote</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Cliente</label>
                <select
                  style={inputStyle}
                  value={form.clienteId}
                  onChange={(e) => setForm((p) => ({ ...p, clienteId: e.target.value }))}
                >
                  <option value="">— Seleccionar cliente —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_corto}
                    </option>
                  ))}
                </select>
              </div>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Período desde</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.periodoDesde}
                  onChange={(e) => setForm((p) => ({ ...p, periodoDesde: e.target.value }))}
                />
              </div>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Período hasta</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.periodoHasta}
                  onChange={(e) => setForm((p) => ({ ...p, periodoHasta: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  style={btnSmallStyle}
                  disabled={!canCreate || dryRunLoading}
                  onClick={() => void handleDryRun()}
                  title="Valida qué liquidaciones entrarían al lote y chequea CBU/Alias"
                >
                  {dryRunLoading ? 'Simulando…' : 'Simular'}
                </button>
                <button
                  style={btnPrimaryStyle}
                  disabled={!canCreate || dryRunLoading || missingCbu.length > 0}
                  onClick={() => void handleCrear()}
                  title={missingCbu.length > 0 ? 'Hay liquidaciones sin CBU/Alias' : ''}
                >
                  Generar lote
                </button>
              </div>
              {dryRun && (
                <div
                  style={{
                    marginTop: 6,
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#f9fafb',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Vista previa</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>
                      Ítems: <strong>{dryRun.cantidad_items}</strong>
                    </span>
                    <span style={{ fontSize: 13, color: '#374151' }}>
                      Total: <strong>{formatPeso(dryRun.total_monto)}</strong>
                    </span>
                  </div>
                </div>
              )}
              {missingCbu.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '10px 12px',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    background: '#fef2f2',
                    color: '#991b1b',
                    fontSize: 13,
                  }}
                >
                  Hay {missingCbu.length} liquidaciones sin CBU/Alias. Cargalo en el distribuidor y volvé a simular.
                </div>
              )}
              <button style={btnSmallStyle} onClick={() => void loadPagos()}>
                Refrescar
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Lotes</h3>
            {cargando && <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>}
            {!cargando && pagos.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin lotes.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pagos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  style={{
                    textAlign: 'left',
                    background: seleccionado?.id === p.id ? '#eff6ff' : '#f9fafb',
                    border: seleccionado?.id === p.id ? '1px solid #2563eb' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  onClick={() => {
                    setSeleccionado(p);
                    setRefPago(p.referencia ?? '');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      #{p.id} · {p.cliente_nombre ?? `Cliente ${p.cliente_id}`}
                    </div>
                    <span
                      style={{
                        ...ESTADO_BADGE[p.estado],
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {p.estado.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Período: {formatFecha(p.periodo_desde)} – {formatFecha(p.periodo_hasta)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{p.cantidad_items} ítems</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatPeso(p.total_monto)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel derecho: detalle */}
        <div>
          {!seleccionado && (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#9ca3af', padding: 60 }}>
              Seleccioná un lote para ver el detalle.
            </div>
          )}

          {seleccionado && (
            <>
              <div style={{ ...cardStyle, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      Lote #{seleccionado.id} · {seleccionado.cliente_nombre ?? `Cliente ${seleccionado.cliente_id}`}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      Período: {formatFecha(seleccionado.periodo_desde)} – {formatFecha(seleccionado.periodo_hasta)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <button style={btnSmallStyle} onClick={() => void handleExportCsv()}>
                      Export CSV
                    </button>
                    {seleccionado.estado === 'generado' && (
                      <>
                        <input
                          style={{ ...inputStyle, width: 160 }}
                          type="date"
                          value={fechaPago}
                          onChange={(e) => setFechaPago(e.target.value)}
                          title="Fecha de pago (opcional). Si está vacía, usa hoy."
                        />
                        <input
                          style={{ ...inputStyle, width: 220 }}
                          placeholder="Referencia (opcional)"
                          value={refPago}
                          onChange={(e) => setRefPago(e.target.value)}
                        />
                        <button style={btnPrimaryStyle} onClick={() => void handleMarcarPagado()}>
                          Marcar pagado
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>
                    Ítems: <strong>{items.length || seleccionado.cantidad_items}</strong>
                  </span>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>
                    Total: <strong>{formatPeso(items.length ? totalSeleccionado : seleccionado.total_monto)}</strong>
                  </span>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ítems</h3>
                {cargandoItems && <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>}
                {!cargandoItems && items.length === 0 && (
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin ítems.</p>
                )}
                {!cargandoItems && items.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={thStyle}>Distribuidor</th>
                          <th style={thStyle}>Patente</th>
                          <th style={thStyle}>CBU/Alias</th>
                          <th style={thStyle}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={tdStyle}>{i.distribuidor_nombre ?? `#${i.distribuidor_id}`}</td>
                            <td style={tdStyle}>{i.distribuidor_patente ?? '—'}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{i.cbu_alias ?? '—'}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>
                              {formatPeso(i.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const panelStyle: React.CSSProperties = { padding: '0 0 40px' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginBottom: 6 };
const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
};
const errorBoxStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#dc2626',
  fontSize: 14,
  marginBottom: 16,
};
const formFieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151' };
const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
};
const btnPrimaryStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  cursor: 'pointer',
  fontWeight: 700,
};
const btnSmallStyle: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#111827',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
  fontWeight: 600,
};
const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13 };
