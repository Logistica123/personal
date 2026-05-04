import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PolizaSolicitud } from '../features/polizas/types';

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

type SolicitudDetalle = PolizaSolicitud & {
  asegurados?: Array<{
    id: number;
    asegurado_id: number;
    asegurado: {
      id: number;
      identificador: string;
      identificador_tipo: string;
      nombre_apellido_pdf: string | null;
      marca_modelo_pdf: string | null;
      estado: string;
      persona?: { id: number; apellidos: string | null; nombres: string | null; cuil: string | null } | null;
    };
  }>;
};

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'estado-badge--default',
  enviado: 'estado-badge--enviado',
  respondida_ok: 'estado-badge--activo',
  respondida_rechazada: 'estado-badge--baja',
  cancelada: 'estado-badge--baja',
};

export const PolizaSolicitudDetallePage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { solicitudId } = useParams<{ solicitudId: string }>();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [solicitud, setSolicitud] = useState<SolicitudDetalle | null>(null);
  const [resumen, setResumen] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolicitud = useCallback(async () => {
    if (!solicitudId) return;
    const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${solicitudId}`, { cache: 'no-store' });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: SolicitudDetalle };
      setSolicitud(data);
    } else {
      setError(`Error ${resp.status}`);
    }
  }, [solicitudId, apiBaseUrl]);

  useEffect(() => { fetchSolicitud(); }, [fetchSolicitud]);

  const confirmar = useCallback(async (tipoRespuesta: 'ok' | 'rechazada') => {
    if (!solicitud) return;
    if (!window.confirm(
      tipoRespuesta === 'ok'
        ? '¿Confirmar que la aseguradora aceptó la solicitud?'
        : '¿Confirmar que la aseguradora rechazó la solicitud? Los asegurados volverán al estado anterior.'
    )) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${solicitud.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tipo_respuesta: tipoRespuesta, respuesta_resumen: resumen || null }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      await fetchSolicitud();
      setResumen('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [solicitud, resumen, apiBaseUrl, fetchSolicitud]);

  const enviar = useCallback(async () => {
    if (!solicitud) return;
    try {
      setLoading(true);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${solicitud.id}/enviar`, { method: 'POST' });
      if (!resp.ok) throw new Error(await resp.text());
      await fetchSolicitud();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [solicitud, apiBaseUrl, fetchSolicitud]);

  if (!solicitud) return <DashboardLayout title="Solicitud"><div style={{ padding: '2rem' }}>Cargando…</div></DashboardLayout>;

  return (
    <DashboardLayout
      title={`Solicitud #${solicitud.id} — ${solicitud.tipo}`}
      subtitle={solicitud.poliza ? `${solicitud.poliza.aseguradora?.nombre} · N° ${solicitud.poliza.numero_poliza}` : ''}
      headerContent={<Link to="/polizas/solicitudes" className="secondary-action secondary-action--ghost">← Bandeja</Link>}
    >
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>{error}</div>
      )}

      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Estado</h3>
          <span className={`estado-badge ${ESTADO_BADGE[solicitud.estado] ?? 'estado-badge--default'}`}>
            {solicitud.estado}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={cellLbl}>Tipo</td><td style={cellVal}>{solicitud.tipo}</td></tr>
            <tr><td style={cellLbl}>Administrativo</td><td style={cellVal}>{solicitud.administrativo?.name} ({solicitud.administrativo?.email})</td></tr>
            <tr><td style={cellLbl}>Asegurados</td><td style={cellVal}>{solicitud.asegurados?.length ?? 0}</td></tr>
            <tr><td style={cellLbl}>Enviado</td><td style={cellVal}>{solicitud.enviado_en ? new Date(solicitud.enviado_en).toLocaleString('es-AR') : '—'}</td></tr>
            <tr><td style={cellLbl}>Message-ID</td><td style={cellVal}><code style={{ fontSize: '0.75rem' }}>{solicitud.email_message_id ?? '—'}</code></td></tr>
            {solicitud.respuesta_recibida_en && (
              <tr><td style={cellLbl}>Respuesta recibida</td><td style={cellVal}>{new Date(solicitud.respuesta_recibida_en).toLocaleString('es-AR')}</td></tr>
            )}
            {solicitud.respuesta_resumen && (
              <tr><td style={cellLbl}>Resumen respuesta</td><td style={cellVal}>{solicitud.respuesta_resumen}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Acciones según estado */}
      {solicitud.estado === 'borrador' && (
        <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Acciones</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
            La solicitud está en borrador. Hacé el preview en la pantalla de selección, o enviála ahora con los datos guardados.
          </p>
          <button type="button" disabled={loading} onClick={enviar}
            style={{ background: '#0a8c3a', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
            {loading ? 'Enviando…' : '✉ Enviar email'}
          </button>
        </div>
      )}

      {solicitud.estado === 'enviado' && (
        <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Confirmar respuesta de la aseguradora</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
            Cuando la aseguradora responda por mail, marcá acá el resultado.
          </p>
          <textarea
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            placeholder="Resumen de la respuesta (opcional)"
            rows={3}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #ddd' }}
          />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" disabled={loading} onClick={() => confirmar('ok')}
              style={{ background: '#0a8c3a', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
              ✓ Confirmar OK
            </button>
            <button type="button" disabled={loading} onClick={() => confirmar('rechazada')}
              style={{ background: '#c4392a', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
              ✗ Marcar rechazada
            </button>
          </div>
        </div>
      )}

      {/* Email enviado */}
      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Email</h3>
        <div style={{ fontSize: '0.85rem' }}><b>To:</b> {solicitud.destinatarios_to_resueltos?.join(', ') || '—'}</div>
        {solicitud.destinatarios_cc_resueltos && solicitud.destinatarios_cc_resueltos.length > 0 && (
          <div style={{ fontSize: '0.85rem' }}><b>CC:</b> {solicitud.destinatarios_cc_resueltos.join(', ')}</div>
        )}
        <div style={{ fontSize: '0.85rem' }}><b>Asunto:</b> {solicitud.asunto || <i>(sin renderizar)</i>}</div>
        {solicitud.body && (
          <pre style={{
            whiteSpace: 'pre-wrap', background: '#f7f9fc', padding: '1rem',
            borderRadius: 8, fontSize: '0.85rem', maxHeight: 400, overflowY: 'auto', margin: 0,
          }}>{solicitud.body}</pre>
        )}
      </div>

      {/* Asegurados */}
      <div className="dashboard-card">
        <h3 style={{ margin: 0 }}>Asegurados ({solicitud.asegurados?.length ?? 0})</h3>
        <div className="table-wrapper">
          <table className="bdd-activos-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Identificador</th><th>Nombre / Vehículo</th><th>Persona</th><th>Estado actual</th></tr>
            </thead>
            <tbody>
              {(solicitud.asegurados ?? []).map((sa) => (
                <tr key={sa.id}>
                  <td><code>{sa.asegurado.identificador}</code></td>
                  <td>{sa.asegurado.nombre_apellido_pdf ?? sa.asegurado.marca_modelo_pdf ?? '—'}</td>
                  <td>
                    {sa.asegurado.persona ? (
                      <Link to={`/personal/${sa.asegurado.persona.id}/editar`}>
                        {sa.asegurado.persona.apellidos}, {sa.asegurado.persona.nombres}
                      </Link>
                    ) : <span style={{ color: '#c00' }}>sin match</span>}
                  </td>
                  <td>{sa.asegurado.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

const cellLbl: React.CSSProperties = { padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#666', width: 200 };
const cellVal: React.CSSProperties = { padding: '0.4rem 0.75rem', fontSize: '0.9rem' };
