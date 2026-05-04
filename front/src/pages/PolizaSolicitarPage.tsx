import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  Poliza,
  PolizaAsegurado,
  PolizaSolicitud,
  SolicitudPreview,
  TipoEmail,
} from '../features/polizas/types';

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

type Paso = 'seleccion' | 'preview' | 'enviado';

export const PolizaSolicitarPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const tipoInicial = (searchParams.get('tipo') === 'baja' ? 'baja' : 'alta') as TipoEmail;
  const [tipo, setTipo] = useState<TipoEmail>(tipoInicial);
  const [paso, setPaso] = useState<Paso>('seleccion');

  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [asegurados, setAsegurados] = useState<PolizaAsegurado[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [solicitud, setSolicitud] = useState<PolizaSolicitud | null>(null);
  const [preview, setPreview] = useState<SolicitudPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Cargar póliza y asegurados ----
  useEffect(() => {
    if (!polizaId) return;
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setPoliza(data))
      .catch(() => setError('Error al cargar póliza'));
  }, [polizaId, apiBaseUrl]);

  useEffect(() => {
    if (!polizaId) return;
    // Para alta sugerimos no_matcheado, para baja sugerimos activos
    const filtro = tipo === 'alta' ? 'no_matcheado' : 'activo';
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}/asegurados?estado=${filtro}`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setAsegurados(data ?? []))
      .catch(() => setError('Error al cargar asegurados'));
    setSeleccion(new Set());
  }, [polizaId, apiBaseUrl, tipo]);

  // ---- Acciones ----
  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const seleccionarTodos = () => {
    setSeleccion(seleccion.size === asegurados.length ? new Set() : new Set(asegurados.map((a) => a.id)));
  };

  const crearBorradorYPreview = useCallback(async () => {
    if (!polizaId || seleccion.size === 0) return;
    try {
      setLoading(true);
      setError(null);

      const respCrear = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tipo, asegurado_ids: Array.from(seleccion) }),
      });
      if (!respCrear.ok) throw new Error(await respCrear.text());
      const { data: sol } = (await respCrear.json()) as { data: PolizaSolicitud };
      setSolicitud(sol);

      const respPrev = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${sol.id}/preview`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!respPrev.ok) throw new Error(await respPrev.text());
      const { data: prev } = (await respPrev.json()) as { data: SolicitudPreview };
      setPreview(prev);
      setPaso('preview');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [polizaId, seleccion, tipo, apiBaseUrl]);

  const enviarSolicitud = useCallback(async () => {
    if (!solicitud) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${solicitud.id}/enviar`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = (await resp.json()) as { data: PolizaSolicitud };
      setSolicitud(data);
      setPaso('enviado');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [solicitud, apiBaseUrl]);

  return (
    <DashboardLayout
      title={`Solicitar ${tipo} — ${poliza?.nombre_descriptivo ?? 'Póliza'}`}
      subtitle={poliza ? `${poliza.aseguradora?.nombre} · N° ${poliza.numero_poliza}` : ''}
      headerContent={
        <Link to={polizaId ? `/polizas/${polizaId}` : '/polizas'} className="secondary-action secondary-action--ghost">
          ← Volver
        </Link>
      }
    >
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {paso === 'seleccion' && (
        <>
          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Paso 1 — Seleccionar asegurados</h3>
            <div className="liq-tabbar" style={{ alignSelf: 'flex-start' }}>
              {(['alta', 'baja'] as const).map((t) => (
                <button key={t} type="button" className="tab-btn" onClick={() => setTipo(t)}
                  style={tipo === t ? { background: '#1d74f5', color: '#fff' } : undefined}>
                  Solicitar {t}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              {tipo === 'alta'
                ? 'Mostrando asegurados sin match en personas (candidatos a dar de alta).'
                : 'Mostrando asegurados activos (candidatos a dar de baja).'}
            </div>
          </div>

          <div className="dashboard-card">
            {asegurados.length === 0 ? (
              <div style={{ padding: '0.5rem', color: '#666' }}>No hay asegurados disponibles para esta acción.</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <button type="button" className="secondary-action secondary-action--ghost" onClick={seleccionarTodos}>
                    {seleccion.size === asegurados.length ? 'Deseleccionar todos' : `Seleccionar todos (${asegurados.length})`}
                  </button>
                  <span style={{ fontSize: '0.85rem' }}>{seleccion.size} seleccionados</span>
                </div>
                <div className="table-wrapper">
                  <table className="bdd-activos-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th></th>
                        <th>Identificador</th>
                        <th>Nombre / Vehículo</th>
                        <th>Persona</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asegurados.map((a) => (
                        <tr key={a.id}>
                          <td><input type="checkbox" checked={seleccion.has(a.id)} onChange={() => toggle(a.id)} /></td>
                          <td><code>{a.identificador}</code> <small style={{ color: '#888' }}>({a.identificador_tipo})</small></td>
                          <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}</td>
                          <td>{a.persona ? `${a.persona.apellidos}, ${a.persona.nombres}` : <span style={{ color: '#c00' }}>sin match</span>}</td>
                          <td>{a.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    disabled={seleccion.size === 0 || loading}
                    onClick={crearBorradorYPreview}
                    style={{
                      background: seleccion.size === 0 ? '#aaa' : '#1d74f5',
                      color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
                    }}
                  >
                    {loading ? 'Generando preview…' : `Generar preview de email (${seleccion.size})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {paso === 'preview' && preview && (
        <>
          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Paso 2 — Preview del email</h3>
            <div style={{ fontSize: '0.85rem' }}><b>To:</b> {preview.destinatarios_to.join(', ') || '—'}</div>
            {preview.destinatarios_cc.length > 0 && (
              <div style={{ fontSize: '0.85rem' }}><b>CC:</b> {preview.destinatarios_cc.join(', ')}</div>
            )}
            <div style={{ fontSize: '0.85rem' }}><b>Asunto:</b> {preview.asunto}</div>
            {preview.adjuntos_requeridos.length > 0 && (
              <div style={{
                background: preview.adjuntos_check.ok ? '#e8f5ec' : '#fff5e6',
                border: `1px solid ${preview.adjuntos_check.ok ? '#0a8c3a' : '#c70'}`,
                borderRadius: 8, padding: '0.5rem', fontSize: '0.85rem',
              }}>
                <b>{preview.adjuntos_check.ok ? '✓' : '⚠'} Adjuntos requeridos:</b> {preview.adjuntos_requeridos.join(', ')}
                {!preview.adjuntos_check.ok && (
                  <ul style={{ marginTop: '0.5rem' }}>
                    {preview.adjuntos_check.faltantes.map((f) => (
                      <li key={f.asegurado_id}>
                        <code>{f.identificador}</code>: faltan {f.faltan.join(', ')}
                        {f.motivo === 'sin_persona_asociada' && ' (sin persona vinculada)'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <pre style={{
              whiteSpace: 'pre-wrap', background: '#f7f9fc', padding: '1rem',
              borderRadius: 8, fontSize: '0.85rem', maxHeight: 400, overflowY: 'auto',
            }}>
              {preview.body}
            </pre>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => setPaso('seleccion')}>
                ← Editar selección
              </button>
              <button
                type="button"
                disabled={loading || !preview.adjuntos_check.ok}
                onClick={enviarSolicitud}
                style={{
                  background: preview.adjuntos_check.ok ? '#0a8c3a' : '#aaa',
                  color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
                }}
              >
                {loading ? 'Enviando…' : preview.adjuntos_check.ok ? '✉ Enviar email' : 'No se puede enviar (faltan adjuntos)'}
              </button>
            </div>
          </div>
        </>
      )}

      {paso === 'enviado' && solicitud && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0, color: '#0a8c3a' }}>✓ Solicitud enviada</h3>
          <ul style={{ lineHeight: 1.8, margin: 0 }}>
            <li>ID solicitud: #{solicitud.id}</li>
            <li>Estado: <b>{solicitud.estado}</b></li>
            <li>Enviado: {solicitud.enviado_en ? new Date(solicitud.enviado_en).toLocaleString('es-AR') : '—'}</li>
            <li>Message-ID: <code>{solicitud.email_message_id}</code></li>
          </ul>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => navigate(`/polizas/${polizaId}`)} className="secondary-action"
              style={{ background: '#1d74f5', color: '#fff', padding: '0.5rem 1rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
              Volver al detalle
            </button>
            <button type="button" onClick={() => navigate('/polizas/solicitudes')} className="secondary-action secondary-action--ghost">
              Ver bandeja de solicitudes
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
