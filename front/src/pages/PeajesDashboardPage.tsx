import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiqApi } from '../features/liquidaciones/api';
import type { LiqCliente } from '../features/liquidaciones/types';

type Props = {
  DashboardLayout: React.ComponentType<{ title: string; subtitle?: string; children: React.ReactNode }>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => unknown;
  buildActorHeaders: (user: unknown) => Record<string, string>;
};

type Metricas = {
  total_ops: number;
  total_bruto: number;
  total_autorizado: number;
  total_rechazado: number;
  total_pendiente: number;
  ops_autorizadas: number;
  ops_rechazadas: number;
  ops_pendientes: number;
  porcentaje_autorizacion: number;
};

type TopDistribuidor = {
  distribuidor_id: number | null;
  distribuidor: string;
  patente: string | null;
  ops: number;
  total_autorizado: number;
  total_bruto: number;
};

type SerieMes = { mes: string; ops: number; total_autorizado: number; total_bruto: number };
type Motivo = { motivo: string; cantidad: number; monto: number };

const fmtMoney = (v: number | null | undefined) =>
  `$${Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PeajesDashboardPage({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
}: Props) {
  const authUser = useStoredAuthUser();
  const api = useLiqApi({ resolveApiBaseUrl, buildActorHeaders, authUser });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<LiqCliente[]>([]);
  const [filters, setFilters] = useState({
    cliente_id: '',
    distribuidor_id: '',
    desde: '',
    hasta: '',
    estado: '',
  });
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [top, setTop] = useState<TopDistribuidor[]>([]);
  const [serie, setSerie] = useState<SerieMes[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [filters]);

  const loadClientes = useCallback(async () => {
    try {
      const res = await api.get('/clientes');
      setClientes(res.data ?? []);
    } catch {
      // ignore
    }
  }, [api]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/peajes/dashboard${queryString}`);
      const d = res.data ?? {};
      setMetricas(d.metricas ?? null);
      setTop(d.top_distribuidores ?? []);
      setSerie(d.serie_temporal ?? []);
      setMotivos(d.motivos ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar dashboard');
    } finally {
      setLoading(false);
    }
  }, [api, queryString]);

  useEffect(() => { void loadClientes(); }, [loadClientes]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const handleExport = async () => {
    try {
      const base = resolveApiBaseUrl();
      const headers = { Accept: 'text/csv', ...buildActorHeaders(authUser) };
      const r = await fetch(`${base}/api/liq/peajes/dashboard/export${queryString}`, {
        credentials: 'include',
        headers,
      });
      if (!r.ok) throw new Error('Error al exportar');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `peajes_dashboard_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? 'Error al exportar');
    }
  };

  const maxBruto = Math.max(1, ...serie.map(s => s.total_bruto));

  return (
    <DashboardLayout title="Dashboard de peajes" subtitle="Métricas del split Imp.Gravado / No Gravado cross-liquidación">
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
        <strong>Nota (BUGFIX 25):</strong> para OCASA, el Imp.No Gravado es clasificación fiscal interna del cliente — se usa para facturar LA → OCASA, no se paga al distribuidor. El panel de autorización por liquidación sólo aparece para clientes con <code>pagar_peajes_a_distribuidor=true</code>.
      </div>
      {error && <div style={{ color: '#991b1b', background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}

      <div className="dashboard-card" style={{ marginBottom: 16 }}>
        <header className="card-header"><h3>Filtros</h3></header>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Cliente</label>
              <select className="form-input" value={filters.cliente_id}
                onChange={(e) => setFilters(f => ({ ...f, cliente_id: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">Todos</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre_corto ?? c.razon_social}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Desde</label>
              <input type="date" className="form-input" value={filters.desde}
                onChange={(e) => setFilters(f => ({ ...f, desde: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Hasta</label>
              <input type="date" className="form-input" value={filters.hasta}
                onChange={(e) => setFilters(f => ({ ...f, hasta: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Estado</label>
              <select className="form-input" value={filters.estado}
                onChange={(e) => setFilters(f => ({ ...f, estado: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">Todos</option>
                <option value="autorizado">Autorizado</option>
                <option value="rechazado">Rechazado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>ID Distribuidor</label>
              <input type="number" className="form-input" value={filters.distribuidor_id}
                onChange={(e) => setFilters(f => ({ ...f, distribuidor_id: e.target.value }))}
                style={{ width: '100%' }} placeholder="Opcional" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button type="button" className="btn-sm" onClick={() => setFilters({ cliente_id: '', distribuidor_id: '', desde: '', hasta: '', estado: '' })}>
                Limpiar
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleExport()}>
                ↓ Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: 20 }}>Cargando dashboard…</div>}

      {metricas && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <MetricCard title="Ops con peajes" value={metricas.total_ops.toLocaleString('es-AR')} accent="#3730a3" bg="#e0e7ff" />
            <MetricCard title="Total bruto (TMS)" value={fmtMoney(metricas.total_bruto)} accent="#374151" bg="#f3f4f6" />
            <MetricCard title="Total autorizado" value={fmtMoney(metricas.total_autorizado)} accent="#166534" bg="#dcfce7" />
            <MetricCard title="Total rechazado" value={fmtMoney(metricas.total_rechazado)} accent="#991b1b" bg="#fee2e2" />
            <MetricCard title="Total pendiente" value={fmtMoney(metricas.total_pendiente)} accent="#92400e" bg="#fef3c7" />
            <MetricCard title="% autorización" value={`${metricas.porcentaje_autorizacion.toFixed(1)}%`} accent="#1e40af" bg="#dbeafe" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="dashboard-card">
              <header className="card-header"><h3>Top 10 distribuidores (autorizado)</h3></header>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Distribuidor</th>
                      <th>Patente</th>
                      <th style={{ textAlign: 'right' }}>Ops</th>
                      <th style={{ textAlign: 'right' }}>Bruto</th>
                      <th style={{ textAlign: 'right' }}>Autorizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((d, i) => (
                      <tr key={`${d.distribuidor_id}-${i}`}>
                        <td>{d.distribuidor}</td>
                        <td>{d.patente ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{d.ops}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMoney(d.total_bruto)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMoney(d.total_autorizado)}</td>
                      </tr>
                    ))}
                    {top.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 10, color: '#6b7280', textAlign: 'center' }}>Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-card">
              <header className="card-header"><h3>Motivos más frecuentes</h3></header>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Motivo</th>
                      <th style={{ textAlign: 'right' }}>Ops</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motivos.map((m, i) => (
                      <tr key={i}>
                        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.motivo}</td>
                        <td style={{ textAlign: 'right' }}>{m.cantidad}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMoney(m.monto)}</td>
                      </tr>
                    ))}
                    {motivos.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: 10, color: '#6b7280', textAlign: 'center' }}>Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <header className="card-header"><h3>Serie mensual</h3></header>
            <div className="card-body">
              {serie.length === 0 ? (
                <div style={{ color: '#6b7280' }}>Sin datos</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {serie.map((s) => {
                    const pctBruto = (s.total_bruto / maxBruto) * 100;
                    const pctAut = maxBruto > 0 ? (s.total_autorizado / maxBruto) * 100 : 0;
                    return (
                      <div key={s.mes} style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <strong>{s.mes}</strong>
                          <span>{fmtMoney(s.total_autorizado)} / {fmtMoney(s.total_bruto)} — {s.ops} ops</span>
                        </div>
                        <div style={{ background: '#f3f4f6', height: 18, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: `${pctBruto}%`, height: '100%', background: '#e5e7eb', position: 'absolute', top: 0, left: 0 }} />
                          <div style={{ width: `${pctAut}%`, height: '100%', background: '#16a34a', position: 'absolute', top: 0, left: 0 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function MetricCard({ title, value, accent, bg }: { title: string; value: string; accent: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, color: accent, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}
