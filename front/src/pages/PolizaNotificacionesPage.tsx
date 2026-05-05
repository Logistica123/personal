import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EstadoNotificacionDistribuidor, NotificacionDistribuidor } from '../features/polizas/types';

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

const ESTADO_BADGE: Record<EstadoNotificacionDistribuidor, string> = {
  pendiente: 'estado-badge--default',
  enviado:   'estado-badge--activo',
  rebotado:  'estado-badge--baja',
  sin_email: 'estado-badge--pendiente',
};

export const PolizaNotificacionesPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [notifs, setNotifs] = useState<NotificacionDistribuidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoNotificacionDistribuidor | ''>('');
  const [error, setError] = useState<string | null>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    const params = filtroEstado ? `?estado=${filtroEstado}` : '';
    const resp = await fetch(`${apiBaseUrl}/api/polizas/notificaciones-distribuidor${params}`, { cache: 'no-store' });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: NotificacionDistribuidor[] };
      setNotifs(data ?? []);
    }
    setLoading(false);
  }, [apiBaseUrl, filtroEstado]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const reenviar = async (id: number) => {
    if (!window.confirm('¿Reenviar esta notificación?')) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/notificaciones-distribuidor/${id}/reenviar`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error(await resp.text());
      await fetchNotifs();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <DashboardLayout
      title="Notificaciones a distribuidores"
      subtitle="Avisos a distribuidores de su alta en pólizas"
      headerContent={<Link to="/polizas" className="secondary-action secondary-action--ghost">← Pólizas</Link>}
    >
      {error && <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>{error}</div>}

      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <div className="filters-bar">
          <label className="filter-field">
            <span>Estado</span>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoNotificacionDistribuidor | '')}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="enviado">Enviado</option>
              <option value="rebotado">Rebotado</option>
              <option value="sin_email">Sin email</option>
            </select>
          </label>
        </div>
      </div>

      <div className="dashboard-card">
        {loading && <div style={{ padding: '1rem' }}>Cargando…</div>}
        {!loading && notifs.length === 0 && (
          <div style={{ padding: '1rem', color: '#666' }}>No hay notificaciones registradas.</div>
        )}
        {!loading && notifs.length > 0 && (
          <div className="table-wrapper">
            <table className="bdd-activos-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Distribuidor</th>
                  <th>Email</th>
                  <th>Póliza</th>
                  <th>Estado</th>
                  <th>Enviado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {notifs.map((n) => (
                  <tr key={n.id}>
                    <td>#{n.id}</td>
                    <td>
                      {n.persona ? (
                        <Link to={`/personal/${n.persona.id}/editar`}>
                          {n.persona.apellidos}, {n.persona.nombres}
                        </Link>
                      ) : '—'}
                    </td>
                    <td><code style={{ fontSize: '0.8rem' }}>{n.email_destinatario || '(sin email)'}</code></td>
                    <td>{n.poliza?.aseguradora?.nombre} · {n.poliza?.numero_poliza}</td>
                    <td>
                      <span className={`estado-badge ${ESTADO_BADGE[n.estado]}`}>{n.estado}</span>
                      {n.error_envio && <small style={{ display: 'block', color: '#c00' }}>{n.error_envio.slice(0, 80)}</small>}
                    </td>
                    <td>{n.enviado_en ? new Date(n.enviado_en).toLocaleDateString('es-AR') : '—'}</td>
                    <td>
                      {(n.estado === 'rebotado' || n.estado === 'pendiente') && n.email_destinatario && (
                        <button type="button" onClick={() => reenviar(n.id)}
                          className="secondary-action secondary-action--ghost"
                          style={{ fontSize: '0.8rem' }}>
                          Reenviar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
