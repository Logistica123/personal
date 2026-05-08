import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EstadoSolicitud, PolizaSolicitud, TipoEmail } from '../features/polizas/types';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};

type Props = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

const ESTADO_BADGE: Record<EstadoSolicitud, string> = {
  borrador:             'estado-badge--default',
  enviado:              'estado-badge--enviado',
  respondida_ok:        'estado-badge--activo',
  respondida_rechazada: 'estado-badge--baja',
  cancelada:            'estado-badge--baja',
};

export const PolizaSolicitudesPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [solicitudes, setSolicitudes] = useState<PolizaSolicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitud | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<TipoEmail | ''>('');

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (filtroTipo) params.set('tipo', filtroTipo);
    setLoading(true);
    fetch(`${apiBaseUrl}/api/polizas/solicitudes${params.toString() ? '?' + params : ''}`, {
      signal: ctrl.signal, cache: 'no-store',
    })
      .then((r) => r.json())
      .then(({ data }) => setSolicitudes(data ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [apiBaseUrl, filtroEstado, filtroTipo]);

  return (
    <DashboardLayout
      title="Bandeja de solicitudes"
      subtitle="Altas y bajas enviadas a las aseguradoras"
      headerContent={<Link to="/polizas" className="secondary-action secondary-action--ghost">← Pólizas</Link>}
    >
      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <div className="filters-bar">
          <label className="filter-field">
            <span>Estado</span>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoSolicitud | '')}>
              <option value="">Todos</option>
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="respondida_ok">Respondida OK</option>
              <option value="respondida_rechazada">Rechazada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Tipo</span>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoEmail | '')}>
              <option value="">Todos</option>
              <option value="alta">Alta</option>
              <option value="baja">Baja</option>
            </select>
          </label>
        </div>
      </div>

      <div className="dashboard-card">
        {loading && <div style={{ padding: '1rem' }}>Cargando…</div>}
        {!loading && solicitudes.length === 0 && (
          <div style={{ padding: '1rem', color: '#666' }}>No hay solicitudes con esos filtros.</div>
        )}
        {!loading && solicitudes.length > 0 && (
          <div className="table-wrapper">
            <table className="bdd-activos-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Póliza</th>
                  <th>Tipo</th>
                  <th>Asegurados</th>
                  <th>Admin</th>
                  <th>Estado</th>
                  <th>Enviado</th>
                  {/* ADDENDUM 11 — reemplaza el cron de recordatorios eliminado.
                      Indica visualmente cuánto hace que se mandó la solicitud y
                      sigue sin respuesta. >7 días = badge ámbar de seguimiento. */}
                  <th>Días esperando</th>
                  <th>Asunto</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => {
                  const diasEsperando = s.enviado_en && s.estado === 'enviado'
                    ? Math.floor((Date.now() - new Date(s.enviado_en).getTime()) / 86400000)
                    : null;
                  // ADDENDUM 12 Parte A — threshold configurable por póliza (default 7).
                  const umbral = s.poliza?.dias_alerta_sin_respuesta ?? 7;
                  const sinRespuestaProlongada = diasEsperando !== null && diasEsperando >= umbral;
                  return (
                    <tr key={s.id}>
                      <td><Link to={`/polizas/solicitudes/${s.id}`}>#{s.id}</Link></td>
                      <td>
                        <Link to={`/polizas/${s.poliza_id}`}>
                          {s.poliza?.aseguradora?.nombre} · {s.poliza?.numero_poliza}
                        </Link>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{s.tipo}</td>
                      <td>{s.asegurados_count ?? 0}</td>
                      <td>{s.administrativo?.name ?? '—'}</td>
                      <td><span className={`estado-badge ${ESTADO_BADGE[s.estado]}`}>{s.estado}</span></td>
                      <td>{s.enviado_en ? new Date(s.enviado_en).toLocaleDateString('es-AR') : '—'}</td>
                      <td>
                        {diasEsperando === null ? (
                          <span style={{ color: '#888' }}>—</span>
                        ) : sinRespuestaProlongada ? (
                          <span
                            title="Más de 7 días sin respuesta de la aseguradora — considerá hacer follow-up manual"
                            style={{
                              background: '#fff5e6', color: '#c70',
                              padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
                            }}
                          >
                            ⚠ {diasEsperando} días
                          </span>
                        ) : (
                          <span style={{ color: '#0a8c3a', fontSize: '0.85rem' }}>{diasEsperando} días</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.asunto || <i style={{ color: '#888' }}>(borrador sin renderizar)</i>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
