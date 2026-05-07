import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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

type OAuthStatus = {
  vinculado: boolean;
  activo?: boolean;
  email?: string | null;
  token_expires_at?: string | null;
  last_refresh_at?: string | null;
  last_error?: string | null;
  scope?: string | null;
};

/**
 * ADDENDUM 9 Parte A — Vinculación de Outlook por administrativo.
 *
 * El admin entra acá, click "Vincular mi Outlook" → redirect a Microsoft (donde
 * aparece MFA si aplica) → vuelta al callback del backend → este redirige acá
 * con `?ok=1&email=...` o `?ok=0&error=...`.
 *
 * Después de vincular, los emails de pólizas que él envíe salen desde su
 * propia casilla de Outlook (Microsoft Graph) en lugar del SMTP institucional.
 */
export const PolizasConfigMiOutlookPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/oauth/microsoft/status`, { cache: 'no-store' });
      if (resp.ok) {
        const { data } = (await resp.json()) as { data: OAuthStatus };
        setStatus(data);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Procesa el feedback del callback (?ok=1 / ?ok=0&error=...) y limpia la URL.
  useEffect(() => {
    const ok = params.get('ok');
    const err = params.get('error');
    const email = params.get('email');
    if (ok === '1') {
      setFeedback({ tipo: 'ok', texto: `Vinculación correcta${email ? ` (${email})` : ''}.` });
      const next = new URLSearchParams(params);
      next.delete('ok');
      next.delete('email');
      setParams(next, { replace: true });
    } else if (ok === '0') {
      setFeedback({ tipo: 'error', texto: `No se pudo vincular: ${err ?? 'error desconocido'}` });
      const next = new URLSearchParams(params);
      next.delete('ok');
      next.delete('error');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const onVincular = () => {
    // Navegación full-page (no fetch) porque Microsoft redirige al user y el
    // callback responde con redirect → la página entera vuelve acá.
    window.location.href = `${apiBaseUrl}/api/oauth/microsoft/authorize`;
  };

  const onDesvincular = async () => {
    if (!window.confirm('¿Desvincular tu Outlook? Los próximos emails saldrán por SMTP institucional con Reply-To a tu cuenta.')) {
      return;
    }
    const resp = await fetch(`${apiBaseUrl}/api/oauth/microsoft/unlink`, { method: 'POST' });
    if (resp.ok) {
      setFeedback({ tipo: 'ok', texto: 'Desvinculado.' });
      fetchStatus();
    } else {
      setFeedback({ tipo: 'error', texto: 'Error al desvincular.' });
    }
  };

  return (
    <DashboardLayout
      title="Mi Outlook — Pólizas"
      subtitle="Vinculá tu cuenta para que los emails salgan desde tu Outlook personal"
      headerContent={
        <Link to="/polizas" className="secondary-action secondary-action--ghost">← Volver</Link>
      }
    >
      {feedback && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: 12,
          background: feedback.tipo === 'ok' ? '#e7f7ed' : '#fee',
          color: feedback.tipo === 'ok' ? '#0a8c3a' : '#900',
          border: `1px solid ${feedback.tipo === 'ok' ? '#0a8c3a44' : '#90044'}`,
        }}>
          {feedback.texto}
        </div>
      )}

      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>¿Cómo funciona?</h3>
        <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.5, margin: 0 }}>
          Al vincular tu Outlook, los emails de solicitudes de alta/baja a aseguradoras
          salen desde tu casilla personal (con tu firma, en tu carpeta "Enviados",
          quedando en tu hilo de respuestas). Microsoft te va a pedir login y MFA
          la primera vez — después el sistema renueva la sesión solo cada hora.
          Si no vinculás, los emails salen desde la casilla institucional con
          Reply-To apuntando a tu cuenta.
        </p>
      </div>

      <div className="dashboard-card">
        <h3 style={{ margin: 0 }}>Estado de la vinculación</h3>
        {loading && <div style={{ padding: '0.5rem', color: '#666' }}>Cargando…</div>}
        {!loading && status && !status.vinculado && (
          <>
            <div style={{ padding: '0.5rem 0', color: '#666' }}>
              No tenés Outlook vinculado. Los emails se mandan vía SMTP institucional.
            </div>
            <button
              type="button"
              onClick={onVincular}
              style={{
                background: '#1d74f5', color: '#fff', padding: '0.6rem 1.2rem',
                borderRadius: 10, border: 0, cursor: 'pointer',
              }}
            >
              ✉ Vincular mi Outlook
            </button>
          </>
        )}
        {!loading && status && status.vinculado && (
          <>
            <table style={{ width: '100%', fontSize: '0.9rem' }}>
              <tbody>
                <tr><td style={{ color: '#666', width: 200 }}>Cuenta</td><td><b>{status.email ?? '—'}</b></td></tr>
                <tr><td style={{ color: '#666' }}>Estado</td><td>
                  {status.activo
                    ? <span style={{ color: '#0a8c3a' }}>● Activa</span>
                    : <span style={{ color: '#c4392a' }}>● Inactiva — re-vinculación necesaria</span>}
                </td></tr>
                <tr><td style={{ color: '#666' }}>Token expira</td><td>
                  {status.token_expires_at ? new Date(status.token_expires_at).toLocaleString('es-AR') : '—'}
                </td></tr>
                <tr><td style={{ color: '#666' }}>Último refresh</td><td>
                  {status.last_refresh_at ? new Date(status.last_refresh_at).toLocaleString('es-AR') : '—'}
                </td></tr>
                {status.last_error && (
                  <tr><td style={{ color: '#666' }}>Último error</td><td style={{ color: '#c4392a' }}>{status.last_error}</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              {!status.activo && (
                <button
                  type="button"
                  onClick={onVincular}
                  style={{
                    background: '#1d74f5', color: '#fff', padding: '0.5rem 1rem',
                    borderRadius: 8, border: 0, cursor: 'pointer',
                  }}
                >
                  ↻ Re-vincular
                </button>
              )}
              <button
                type="button"
                onClick={onDesvincular}
                style={{
                  background: 'transparent', color: '#c4392a', padding: '0.5rem 1rem',
                  borderRadius: 8, border: '1px solid #c4392a', cursor: 'pointer',
                }}
              >
                Desvincular
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
