import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  DistribuidorEnriquecido,
  Poliza,
  PolizaAsegurado,
  PolizaEmailConfig,
  PolizaSolicitud,
  SolicitudPreview,
} from '../features/polizas/types';
import { EstadoDistribuidorBadge } from '../features/polizas/EstadoDistribuidorBadge';

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

/**
 * ADDENDUM 16 Parte B — wizard para crear y enviar un correo combinado
 * (Altas + Bajas en un único correo a la aseguradora).
 *
 * Solo se llega acá si la póliza tiene `polizas_email_config` con
 * `tipo='combinado'` y `activo=true` (la existencia de esa fila es la
 * señal de "soporta combinado").
 */
export const PolizaSolicitarCombinadoPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const [poliza, setPoliza] = useState<(Poliza & { email_configs?: PolizaEmailConfig[] }) | null>(null);
  const [personas, setPersonas] = useState<DistribuidorEnriquecido[]>([]);
  const [asegurados, setAsegurados] = useState<PolizaAsegurado[]>([]);
  const [selAltas, setSelAltas] = useState<Set<number>>(new Set()); // persona_id
  const [selBajas, setSelBajas] = useState<Set<number>>(new Set()); // asegurado_id

  const [paso, setPaso] = useState<Paso>('seleccion');
  const [solicitud, setSolicitud] = useState<PolizaSolicitud | null>(null);
  const [preview, setPreview] = useState<SolicitudPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<{ razon: string; message: string; revincular_url: string } | null>(null);

  const cfgCombinado = useMemo(
    () => (poliza?.email_configs ?? []).find((c) => c.tipo === 'combinado' && c.activo),
    [poliza]
  );

  useEffect(() => {
    if (!polizaId) return;
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setPoliza(data))
      .catch(() => setError('Error al cargar póliza'));
  }, [polizaId, apiBaseUrl]);

  useEffect(() => {
    if (!polizaId) return;
    // Cargar candidatos a alta (personas que no son asegurados activos)
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}/personas-disponibles-para-alta`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setPersonas(data ?? []))
      .catch(() => setError('Error al cargar candidatos a alta'));
    // Cargar asegurados activos (candidatos a baja)
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}/asegurados?estado=activo`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setAsegurados(data ?? []))
      .catch(() => setError('Error al cargar asegurados activos'));
  }, [polizaId, apiBaseUrl]);

  const toggleAlta = (personaId: number) => {
    setSelAltas((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId); else next.add(personaId);
      return next;
    });
  };
  const toggleBaja = (aseguradoId: number) => {
    setSelBajas((prev) => {
      const next = new Set(prev);
      if (next.has(aseguradoId)) next.delete(aseguradoId); else next.add(aseguradoId);
      return next;
    });
  };

  const crearBorradorYPreview = useCallback(async () => {
    if (!polizaId) return;
    if (selAltas.size === 0 || selBajas.size === 0) {
      setError('Combinado requiere al menos 1 alta y 1 baja seleccionadas.');
      return;
    }
    try {
      setLoading(true); setError(null);
      const respCrear = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          tipo: 'combinado',
          alta_persona_ids: Array.from(selAltas),
          baja_asegurado_ids: Array.from(selBajas),
        }),
      });
      if (!respCrear.ok) throw new Error(await respCrear.text());
      const { data: sol } = (await respCrear.json()) as { data: PolizaSolicitud };
      setSolicitud(sol);

      const respPrev = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${sol.id}/preview`, {
        method: 'POST', headers: { Accept: 'application/json' },
      });
      if (!respPrev.ok) throw new Error(await respPrev.text());
      const { data: prev } = (await respPrev.json()) as { data: SolicitudPreview };
      setPreview(prev);
      setPaso('preview');
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [polizaId, selAltas, selBajas, apiBaseUrl]);

  const enviarSolicitud = useCallback(async () => {
    if (!solicitud) return;
    try {
      setLoading(true); setError(null); setOauthError(null);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${solicitud.id}/enviar`, {
        method: 'POST', headers: { Accept: 'application/json' },
      });
      if (resp.status === 422) {
        const body = await resp.json().catch(() => null) as
          | { oauth_required?: boolean; razon?: string; message?: string; revincular_url?: string }
          | null;
        if (body?.oauth_required) {
          setOauthError({
            razon: body.razon ?? 'desconocido',
            message: body.message ?? 'No se puede enviar — re-vinculá tu Outlook.',
            revincular_url: body.revincular_url ?? '/polizas/configuracion/mi-outlook',
          });
          return;
        }
        throw new Error(body?.message ?? 'Error 422');
      }
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = (await resp.json()) as { data: PolizaSolicitud };
      setSolicitud(data);
      setPaso('enviado');
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [solicitud, apiBaseUrl]);

  return (
    <DashboardLayout
      title={`Solicitar combinado — ${poliza?.nombre_descriptivo ?? 'Póliza'}`}
      subtitle={poliza ? `${poliza.aseguradora?.nombre} · N° ${poliza.numero_poliza}` : ''}
      headerContent={
        <Link to={polizaId ? `/polizas/${polizaId}` : '/polizas'} className="secondary-action secondary-action--ghost">
          ← Volver
        </Link>
      }
    >
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>{error}</div>
      )}
      {oauthError && (
        <div style={{ padding: '1rem', background: '#fff7e6', color: '#7a5400', borderRadius: 12, margin: '1rem 0' }}>
          <div><b>Re-vinculá tu Outlook:</b> {oauthError.message}</div>
          <Link to={oauthError.revincular_url} className="secondary-action">Vincular Outlook</Link>
        </div>
      )}

      {poliza && !cfgCombinado && (
        <div className="dashboard-card" style={{ background: '#fff7e6', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Esta póliza no tiene configurado el correo combinado</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#444' }}>
            Para usar el modo combinado, primero hay que configurar la casilla destino en&nbsp;
            <Link to={`/polizas/${polizaId}/configuracion`}>Configuración → Correo combinado</Link>.
          </p>
        </div>
      )}

      {paso === 'seleccion' && cfgCombinado && (
        <>
          <div className="dashboard-card" style={{ marginBottom: '1rem', background: '#f4f7ff' }}>
            <div style={{ fontSize: '0.9rem' }}>
              <b>Destinatario:</b> {(cfgCombinado.destinatarios_to ?? []).join(', ')}
              {(cfgCombinado.destinatarios_cc?.length ?? 0) > 0 && (
                <> · CC: {cfgCombinado.destinatarios_cc!.join(', ')}</>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              Asunto: <code>{cfgCombinado.asunto_template}</code>
            </div>
          </div>

          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Altas a incluir ({selAltas.size} de {personas.length})</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0' }}>
              Personas que aún no son asegurados activos en esta póliza.
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
              {personas.length === 0 && (
                <div style={{ padding: '0.75rem', color: '#888', fontStyle: 'italic' }}>(sin candidatos)</div>
              )}
              {personas.map((p) => (
                <label key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.75rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={selAltas.has(p.id)} onChange={() => toggleAlta(p.id)} />
                  <span style={{ flex: 1 }}>{p.nombre_completo}</span>
                  <code style={{ fontSize: '0.8rem', color: '#666' }}>{p.cuil ?? p.patente ?? '—'}</code>
                  <EstadoDistribuidorBadge estado={p.estado_actual} />
                </label>
              ))}
            </div>
          </div>

          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Bajas a incluir ({selBajas.size} de {asegurados.length})</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0' }}>
              Asegurados activos en esta póliza para dar de baja.
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
              {asegurados.length === 0 && (
                <div style={{ padding: '0.75rem', color: '#888', fontStyle: 'italic' }}>(sin asegurados activos)</div>
              )}
              {asegurados.map((a) => (
                <label key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.75rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={selBajas.has(a.id)} onChange={() => toggleBaja(a.id)} />
                  <span style={{ flex: 1 }}>
                    {a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}
                  </span>
                  <code style={{ fontSize: '0.8rem', color: '#666' }}>{a.identificador}</code>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={loading || selAltas.size === 0 || selBajas.size === 0}
              onClick={crearBorradorYPreview}
              style={{
                background: loading || selAltas.size === 0 || selBajas.size === 0 ? '#aaa' : '#1d74f5',
                color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
              }}
            >
              {loading ? 'Generando preview…' : 'Generar preview →'}
            </button>
          </div>
        </>
      )}

      {paso === 'preview' && preview && (
        <>
          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Preview del correo combinado</h3>
            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              <div><b>To:</b> {preview.destinatarios_to.join(', ')}</div>
              {preview.destinatarios_cc.length > 0 && <div><b>CC:</b> {preview.destinatarios_cc.join(', ')}</div>}
              <div><b>Asunto:</b> {preview.asunto}</div>
              <div><b>Asegurados:</b> {preview.asegurados_count}</div>
            </div>
            <pre style={{
              whiteSpace: 'pre', background: '#f7f9fc', padding: '1rem',
              borderRadius: 8, fontSize: '0.85rem', maxHeight: 480, overflow: 'auto',
              fontFamily: 'monospace',
            }}>{preview.body}</pre>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
              ⓘ Las columnas están separadas por TAB. Al pegar el bloque en Excel cada
              valor cae en su celda automáticamente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setPaso('seleccion')} className="secondary-action secondary-action--ghost">
              ← Volver a selección
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={enviarSolicitud}
              style={{
                background: loading ? '#aaa' : '#0a8c3a', color: '#fff',
                padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
              }}
            >
              {loading ? 'Enviando…' : '✉ Enviar correo combinado'}
            </button>
          </div>
        </>
      )}

      {paso === 'enviado' && solicitud && (
        <div className="dashboard-card" style={{ background: '#e7f7ed', borderColor: '#0a8c3a' }}>
          <h3 style={{ margin: 0, color: '#0a8c3a' }}>✓ Correo combinado enviado</h3>
          <p style={{ margin: 0 }}>
            Solicitud <code>#{solicitud.id}</code> pasada a estado <code>enviado</code>.
            Las altas quedaron en <code>alta_solicitada</code> y las bajas en <code>baja_solicitada</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Link to={`/polizas/solicitudes/${solicitud.id}`} className="secondary-action">
              Ver solicitud →
            </Link>
            <Link to={`/polizas/${polizaId}`} className="secondary-action secondary-action--ghost">
              Volver a la póliza
            </Link>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
