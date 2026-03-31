import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  LiqClienteLiq,
  LiquidacionDistribuidor,
  LiquidacionDistribuidorEstado,
  Operacion,
  OperacionEstado,
} from './types';
import {
  LIQ_DISTRIBUIDOR_ESTADO_LABEL,
  OPERACION_ESTADO_COLOR,
  OPERACION_ESTADO_LABEL,
  formatFecha,
  formatPeso,
} from './types';
import { LIQ_DISTRIBUIDORES_PREFILL_KEY } from './storageKeys';

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

const ESTADO_BADGE: Record<LiquidacionDistribuidorEstado, React.CSSProperties> = {
  generada: { background: '#fef3c7', color: '#92400e' },
  aprobada: { background: '#d1fae5', color: '#065f46' },
  pagada: { background: '#e0f2fe', color: '#0369a1' },
  anulada: { background: '#fee2e2', color: '#991b1b' },
};

// ─── Detalle de una liquidación por distribuidor ─────────────────────────────

const LiquidacionDetalle: React.FC<{
  liq: LiquidacionDistribuidor;
  operaciones: Operacion[];
  cargando: boolean;
  onAprobar: () => Promise<void>;
  aprobando: boolean;
  onDescargarPdf: () => void;
}> = ({ liq, operaciones, cargando, onAprobar, aprobando, onDescargarPdf }) => {
  return (
    <div>
      {/* Header del distribuidor */}
      <div style={{ ...cardStyle, background: '#f0fdf4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {liq.distribuidor_nombre ?? `Distribuidor ${liq.distribuidor_id}`}
            </div>
            {liq.distribuidor_patente && (
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                Patente: <strong>{liq.distribuidor_patente}</strong>
                {liq.distribuidor_cuit && (
                  <> · CUIT: <strong>{liq.distribuidor_cuit}</strong></>
                )}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              Período: {formatFecha(liq.periodo_desde)} – {formatFecha(liq.periodo_hasta)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span
              style={{
                ...ESTADO_BADGE[liq.estado],
                padding: '4px 12px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {LIQ_DISTRIBUIDOR_ESTADO_LABEL[liq.estado]}
            </span>
            {liq.pdf_url && (
              <button type="button" style={{ ...btnPrimaryStyle, background: '#059669' }} onClick={onDescargarPdf}>
                ↓ PDF
              </button>
            )}
            {liq.estado === 'generada' && (
              <button type="button" style={btnPrimaryStyle} disabled={aprobando} onClick={() => void onAprobar()}>
                {aprobando ? '…' : '✓ Aprobar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resumen monetario */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <TotalCard label="Cantidad de operaciones" value={String(liq.cantidad_operaciones)} />
        <TotalCard label="Subtotal" value={formatPeso(liq.subtotal)} accent />
        <TotalCard label="Gastos administrativos" value={`− ${formatPeso(liq.gastos_administrativos)}`} warn />
        <TotalCard label="Total a pagar" value={formatPeso(liq.total_a_pagar)} green />
      </div>

      {/* Detalle de operaciones */}
      <div style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Operaciones</h4>
        {cargando && <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando operaciones…</p>}
        {!cargando && operaciones.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin operaciones.</p>
        )}
        {!cargando && operaciones.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={thStyle}>Concepto</th>
                  <th style={thStyle}>Val. cliente</th>
                  <th style={thStyle}>Val. distribuidor</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{o.concepto ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                      {formatPeso(o.valor_cliente)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>
                      {o.valor_tarifa_distribuidor != null
                        ? formatPeso(o.valor_tarifa_distribuidor)
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          background: OPERACION_ESTADO_COLOR[o.estado] + '22',
                          color: OPERACION_ESTADO_COLOR[o.estado],
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {OPERACION_ESTADO_LABEL[o.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Subtotal</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>
                    {formatPeso(liq.subtotal)}
                  </td>
                  <td style={tdStyle}></td>
                </tr>
                <tr style={{ background: '#fef9c3' }}>
                  <td style={{ ...tdStyle, color: '#92400e' }}>Gastos administrativos</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#92400e' }}>
                    − {formatPeso(liq.gastos_administrativos)}
                  </td>
                  <td style={tdStyle}></td>
                </tr>
                <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 14 }}>TOTAL A PAGAR</td>
                  <td style={tdStyle}></td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#065f46',
                    }}
                  >
                    {formatPeso(liq.total_a_pagar)}
                  </td>
                  <td style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const TotalCard: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  green?: boolean;
}> = ({ label, value, accent, warn, green }) => (
  <div
    style={{
      background: green ? '#dcfce7' : warn ? '#fef9c3' : '#f9fafb',
      border: `1px solid ${green ? '#86efac' : warn ? '#fde68a' : '#e5e7eb'}`,
      borderRadius: 8,
      padding: '10px 14px',
    }}
  >
    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
    <div
      style={{
        fontSize: green ? 18 : 16,
        fontWeight: 700,
        fontFamily: 'monospace',
        color: green ? '#065f46' : warn ? '#92400e' : accent ? '#1e40af' : '#111827',
      }}
    >
      {value}
    </div>
  </div>
);

// ─── Componente principal ────────────────────────────────────────────────────

export const DistribuidoresTab: React.FC<Props> = ({ apiBaseUrl, buildActorHeaders }) => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<LiqClienteLiq[]>([]);
  const [filtros, setFiltros] = useState({ clienteId: '', periodoDesde: '', periodoHasta: '', estado: '' as LiquidacionDistribuidorEstado | '' });
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionDistribuidor[]>([]);
  const [seleccionada, setSeleccionada] = useState<LiquidacionDistribuidor | null>(null);
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoOps, setCargandoOps] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');

  const normalizeLiquidacion = useCallback((l: LiquidacionDistribuidor): LiquidacionDistribuidor => {
    const num = (v: unknown): number => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    };

    return {
      ...l,
      cantidad_operaciones: num((l as unknown as { cantidad_operaciones?: unknown }).cantidad_operaciones),
      subtotal: num((l as unknown as { subtotal?: unknown }).subtotal),
      gastos_administrativos: num((l as unknown as { gastos_administrativos?: unknown }).gastos_administrativos),
      total_a_pagar: num((l as unknown as { total_a_pagar?: unknown }).total_a_pagar),
    };
  }, []);

  // Prefill de filtros desde Extractos (al generar liquidaciones)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIQ_DISTRIBUIDORES_PREFILL_KEY);
      if (!raw) return;
      localStorage.removeItem(LIQ_DISTRIBUIDORES_PREFILL_KEY);
      const parsed = JSON.parse(raw) as Partial<{ clienteId: number | string; periodoDesde: string; periodoHasta: string }>;

      setFiltros((prev) => ({
        ...prev,
        clienteId: parsed.clienteId != null ? String(parsed.clienteId) : prev.clienteId,
        periodoDesde: typeof parsed.periodoDesde === 'string' ? parsed.periodoDesde : prev.periodoDesde,
        periodoHasta: typeof parsed.periodoHasta === 'string' ? parsed.periodoHasta : prev.periodoHasta,
      }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar clientes ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/liq/clientes`, {
          credentials: 'include',
          headers: { ...buildActorHeaders(), Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const data = await readJsonOrThrow<{ data?: LiqClienteLiq[] }>(res);
        setClientes(data.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.');
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders]);

  // ── Cargar liquidaciones ─────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filtros.clienteId) params.set('cliente_id', filtros.clienteId);
      if (filtros.periodoDesde) params.set('periodo_desde', filtros.periodoDesde);
      if (filtros.periodoHasta) params.set('periodo_hasta', filtros.periodoHasta);
      if (filtros.estado) params.set('estado', filtros.estado);
      const res = await fetch(`${apiBaseUrl}/api/liq/distribuidores?${params.toString()}`, {
        credentials: 'include',
        headers: { ...buildActorHeaders(), Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ data?: LiquidacionDistribuidor[] }>(res);
      setLiquidaciones((data.data ?? []).map((l) => normalizeLiquidacion(l)));
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar las liquidaciones de distribuidores.',
      );
    } finally {
      setCargando(false);
    }
  }, [apiBaseUrl, buildActorHeaders, filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ── Cargar operaciones del seleccionado ──────────────────────────────────
  useEffect(() => {
    if (!seleccionada) {
      setOperaciones([]);
      return;
    }
    const load = async () => {
      setCargandoOps(true);
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/liq/distribuidores/${seleccionada.id}/operaciones`,
          { credentials: 'include', headers: { ...buildActorHeaders(), Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const data = await readJsonOrThrow<{ data?: Operacion[] }>(res);
        setOperaciones(data.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las operaciones.');
      } finally {
        setCargandoOps(false);
      }
    };
    void load();
  }, [apiBaseUrl, buildActorHeaders, seleccionada]);

  // ── Aprobar ──────────────────────────────────────────────────────────────
  const handleAprobar = useCallback(async () => {
    if (!seleccionada) return;
    setAprobando(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/liq/distribuidores/${seleccionada.id}/aprobar`,
        { method: 'POST', credentials: 'include', headers: { ...buildActorHeaders(), Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await readJsonOrThrow<{ data?: LiquidacionDistribuidor }>(res);
      if (data.data) {
        const normalized = normalizeLiquidacion(data.data);
        setSeleccionada(normalized);
        setLiquidaciones((prev) => prev.map((l) => (l.id === normalized.id ? normalized : l)));
        if (normalized.distribuidor_id) {
          navigate(`/liquidaciones/${normalized.distribuidor_id}`);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar.');
    } finally {
      setAprobando(false);
    }
  }, [apiBaseUrl, buildActorHeaders, navigate, normalizeLiquidacion, seleccionada]);

  // ── Descargar PDF ────────────────────────────────────────────────────────
  const handleDescargarPdf = useCallback(() => {
    if (!seleccionada?.pdf_url) return;
    const a = document.createElement('a');
    a.href = seleccionada.pdf_url;
    a.download = `liq_dist_${seleccionada.id}.pdf`;
    a.click();
  }, [seleccionada]);

  // ── Filtrado local por búsqueda ──────────────────────────────────────────
  const listaFiltrada = buscar
    ? liquidaciones.filter((l) => {
        const q = buscar.toLowerCase();
        return (
          (l.distribuidor_nombre ?? '').toLowerCase().includes(q) ||
          (l.distribuidor_patente ?? '').toLowerCase().includes(q) ||
          (l.distribuidor_cuit ?? '').toLowerCase().includes(q)
        );
      })
    : liquidaciones;

  // ── Totales de la lista ──────────────────────────────────────────────────
  const totalAPagar = listaFiltrada.reduce((sum, l) => sum + l.total_a_pagar, 0);

  return (
    <div style={panelStyle}>
      <h2 style={sectionTitleStyle}>Liquidaciones por Distribuidor</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Vista de liquidaciones individuales generadas para cada distribuidor. Desde aquí podés
        aprobar y descargar los PDFs.
      </p>

      {error && (
        <div style={errorBoxStyle}>
          {error}
          <button style={{ marginLeft: 12, fontSize: 12 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* ── Panel izquierdo: filtros + lista ── */}
        <div>
          {/* Filtros */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Filtros</h3>
              <button
                type="button"
                style={{ ...btnPrimaryStyle, background: '#f3f4f6', color: '#111827', padding: '6px 12px' }}
                disabled={cargando}
                onClick={() => void cargar()}
                title="Vuelve a consultar la API"
              >
                {cargando ? '…' : 'Refrescar'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Cliente</label>
                <select
                  style={inputStyle}
                  value={filtros.clienteId}
                  onChange={(e) =>
                    setFiltros((p) => ({ ...p, clienteId: e.target.value }))
                  }
                >
                  <option value="">Todos los clientes</option>
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
                  value={filtros.periodoDesde}
                  onChange={(e) => setFiltros((p) => ({ ...p, periodoDesde: e.target.value }))}
                />
              </div>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Período hasta</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={filtros.periodoHasta}
                  onChange={(e) => setFiltros((p) => ({ ...p, periodoHasta: e.target.value }))}
                />
              </div>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Estado</label>
                <select
                  style={inputStyle}
                  value={filtros.estado}
                  onChange={(e) =>
                    setFiltros((p) => ({
                      ...p,
                      estado: e.target.value as LiquidacionDistribuidorEstado | '',
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="generada">Generada</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="pagada">Pagada</option>
                  <option value="anulada">Anulada</option>
                </select>
              </div>
              <input
                style={inputStyle}
                type="text"
                placeholder="Buscar distribuidor o patente…"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </div>
          </div>

          {/* Totales rápidos */}
          {listaFiltrada.length > 0 && (
            <div style={{ ...cardStyle, background: '#dcfce7' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {listaFiltrada.length} distribuidores · Total a pagar
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: '#065f46' }}>
                {formatPeso(totalAPagar)}
              </div>
            </div>
          )}

          {/* Lista de distribuidores */}
          {cargando && <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>}
          {!cargando && listaFiltrada.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin liquidaciones.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {listaFiltrada.map((l) => (
              <button
                key={l.id}
                type="button"
                style={{
                  textAlign: 'left',
                  background: seleccionada?.id === l.id ? '#f0fdf4' : '#f9fafb',
                  border:
                    seleccionada?.id === l.id
                      ? '1px solid #059669'
                      : '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  width: '100%',
                }}
                onClick={() => setSeleccionada(l)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {l.distribuidor_nombre ?? `Distribuidor ${l.distribuidor_id}`}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {l.distribuidor_patente && <>{l.distribuidor_patente} · </>}
                  {formatFecha(l.periodo_desde)} – {formatFecha(l.periodo_hasta)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 4,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      ...ESTADO_BADGE[l.estado],
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: 4,
                    }}
                  >
                    {LIQ_DISTRIBUIDOR_ESTADO_LABEL[l.estado]}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                    {formatPeso(l.total_a_pagar)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Panel derecho: detalle ── */}
        <div>
          {!seleccionada && (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#9ca3af', padding: 60 }}>
              Seleccioná un distribuidor para ver su liquidación.
            </div>
          )}
          {seleccionada && (
            <LiquidacionDetalle
              liq={seleccionada}
              operaciones={operaciones}
              cargando={cargandoOps}
              onAprobar={handleAprobar}
              aprobando={aprobando}
              onDescargarPdf={handleDescargarPdf}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────────────────

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
const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13 };
const btnPrimaryStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
