import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PolizaAsegurado } from '../polizas/types';
import { SolicitarBajaModal } from '../polizas/SolicitarBajaModal';

/**
 * Bloque A.1 — sección "Pólizas" embebida en `ProveedorEditarPage` (reemplaza
 * la necesidad de salir a /personal/:id/polizas para ver la cobertura).
 *
 * Muestra:
 *  - Pólizas activas → con botón "Solicitar baja en póliza".
 *  - Pólizas no-activas (alta solicitada / baja / etc.) → solo lectura.
 *  - Sugeridas según perfil → con botón "Solicitar alta" (si aún no figura como activo).
 *  - Alertas de inconsistencia: proveedor en baja/suspendido pero figura activo en póliza.
 */

type AseguradoConPoliza = PolizaAsegurado & {
  poliza: {
    id: number;
    nombre_descriptivo: string;
    numero_poliza: string;
    vigencia_desde: string;
    vigencia_hasta: string;
    activa: boolean;
    tipo_asegurado: 'persona' | 'vehiculo';
    aseguradora: { id: number; nombre: string; parser_perfil: string };
  };
};

// Bloque D.2 — certificado de póliza individual (PDF) del proveedor.
type CertificadoPoliza = {
  id: number;
  nombre_original: string | null;
  download_url: string | null;
  created_at: string | null;
  tamano_kb: number | null;
  asegurado_id: number | null;
  poliza_nombre: string | null;
  aseguradora: string | null;
};

type PolizaAplicable = {
  poliza_id: number;
  nombre: string | null;
  aseguradora: string | null;
  tipo_asegurado: 'persona' | 'vehiculo';
  razon: string;
};

type Props = {
  apiBaseUrl: string;
  personaId: number;
  /**
   * Nombre completo del proveedor — para mostrar en el modal de "Solicitar baja".
   * Opcional para back-compat; si no se pasa, el modal usa "este proveedor".
   */
  personaNombreCompleto?: string | null;
  /**
   * Estado actual del proveedor en la plataforma — afecta qué alertas
   * mostramos. Si el proveedor está dado de baja pero figura activo en una
   * póliza, sale un warning con CTA "Pedir baja en póliza".
   */
  proveedorEnBaja?: boolean;
  proveedorEnSolicitud?: boolean;
};

const ESTADO_BADGE: Record<string, string> = {
  activo:           'estado-badge--activo',
  alta_solicitada:  'estado-badge--pendiente',
  baja_solicitada:  'estado-badge--pendiente',
  dado_de_baja:     'estado-badge--baja',
  no_matcheado:     'estado-badge--default',
};

const fmtDate = (s: string): string =>
  new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-AR');

export const PolizasDelProveedorSection: React.FC<Props> = ({
  apiBaseUrl, personaId, personaNombreCompleto, proveedorEnBaja = false, proveedorEnSolicitud = false,
}) => {
  const [asegurados, setAsegurados] = useState<AseguradoConPoliza[] | null>(null);
  const [aplicables, setAplicables] = useState<PolizaAplicable[]>([]);
  const [certificados, setCertificados] = useState<CertificadoPoliza[] | null>(null);
  const [enviandoCertId, setEnviandoCertId] = useState<number | null>(null);
  // BUGFIX 04 #2 — modal de "Solicitar baja" en lugar de redirect al wizard del módulo Pólizas.
  const [modalBaja, setModalBaja] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [respPolizas, respAplic, respCerts] = await Promise.all([
        fetch(`${apiBaseUrl}/api/personal/${personaId}/polizas`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/personal/${personaId}/polizas-aplicables`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/personal/${personaId}/certificados-polizas`, { cache: 'no-store' }),
      ]);
      if (respPolizas.ok) {
        const { data } = (await respPolizas.json()) as { data: AseguradoConPoliza[] };
        setAsegurados(data ?? []);
      }
      if (respAplic.ok) {
        const { data } = (await respAplic.json()) as { data: PolizaAplicable[] };
        setAplicables(data ?? []);
      }
      if (respCerts.ok) {
        const { data } = (await respCerts.json()) as { data: CertificadoPoliza[] };
        setCertificados(data ?? []);
      }
    } catch {
      setAsegurados([]);
    }
  }, [apiBaseUrl, personaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const compartirCertificado = async (cert: CertificadoPoliza) => {
    if (!cert.asegurado_id) {
      window.alert('No se pudo identificar el asegurado vinculado a este certificado.');
      return;
    }
    if (!window.confirm(`Enviar el certificado por email al distribuidor (a su email registrado en la ficha)?`)) return;
    setEnviandoCertId(cert.id);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/asegurados/${cert.asegurado_id}/compartir-certificado`, {
        method: 'POST',
      });
      if (!resp.ok) {
        const t = await resp.text();
        let msg = t;
        try { msg = JSON.parse(t)?.message ?? t; } catch { /* noop */ }
        throw new Error(msg);
      }
      const { data } = (await resp.json()) as { data: { enviado_a: string } };
      window.alert(`Certificado enviado a ${data.enviado_a}.`);
    } catch (e) {
      window.alert('No se pudo enviar: ' + (e as Error).message);
    } finally {
      setEnviandoCertId(null);
    }
  };

  const activos = (asegurados ?? []).filter((a) => a.estado === 'activo');
  const noActivos = (asegurados ?? []).filter((a) => a.estado !== 'activo');

  // Pólizas sugeridas que NO se solapan con activas/pendientes ya existentes.
  const polizaIdsExistentes = new Set((asegurados ?? []).map((a) => a.poliza.id));
  const aplicablesNuevas = aplicables.filter((p) => !polizaIdsExistentes.has(p.poliza_id));

  const inconsistencias = activos.length > 0 && (proveedorEnBaja || proveedorEnSolicitud);

  return (
    <section className="personal-edit-section">
      <h2>Pólizas {asegurados ? `(${asegurados.length})` : ''}</h2>

      {/* Alerta: proveedor en baja/solicitud pero con pólizas activas. */}
      {inconsistencias && (
        <div style={{
          background: '#fff5e6', border: '1px solid #c70', color: '#7a4a00',
          borderRadius: 10, padding: '0.7rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.9rem',
        }}>
          ⚠ Este proveedor está en estado{' '}
          <b>{proveedorEnBaja ? 'baja' : 'solicitud pendiente'}</b>{' '}
          pero figura como asegurado activo en {activos.length} póliza{activos.length > 1 ? 's' : ''}.
          {' '}Pedí la baja en cada una para evitar pagar cobertura sobre alguien que no opera.
        </div>
      )}

      {asegurados === null && (
        <div style={{ color: '#888' }}>Cargando…</div>
      )}

      {asegurados !== null && asegurados.length === 0 && aplicablesNuevas.length === 0 && (
        <div style={{ color: '#888', fontStyle: 'italic' }}>
          Sin pólizas vinculadas. Cuando este proveedor sea dado de alta en una aseguradora aparecerá acá.
        </div>
      )}

      {/* Activas */}
      {activos.length > 0 && (
        <PolizasTabla
          titulo={`Activas (${activos.length})`}
          rows={activos}
          mostrarBoton="baja"
          onSolicitarBaja={() => setModalBaja(true)}
        />
      )}

      {/* BUGFIX 04 #2 — Modal "Solicitar baja" (crea entrada en bandeja, NO envía correo). */}
      {modalBaja && (
        <SolicitarBajaModal
          apiBaseUrl={apiBaseUrl}
          personaId={personaId}
          nombreCompleto={personaNombreCompleto || 'este proveedor'}
          polizasActivas={activos.map((a) => ({
            asegurado_id: a.id,
            identificador: a.identificador,
            poliza_id: a.poliza.id,
            poliza_nombre: a.poliza.nombre_descriptivo,
            aseguradora_nombre: a.poliza.aseguradora.nombre,
          }))}
          onClose={() => setModalBaja(false)}
          onCreada={() => { setModalBaja(false); fetchAll(); }}
        />
      )}

      {/* No activas (histórico) */}
      {noActivos.length > 0 && (
        <PolizasTabla
          titulo={`Histórico / pendientes (${noActivos.length})`}
          rows={noActivos}
          mostrarBoton={null}
        />
      )}

      {/* Bloque D.2 — certificados de pólizas (PDFs generados) */}
      {certificados !== null && certificados.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', color: '#444' }}>
            Certificados de pólizas ({certificados.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {certificados.map((cert) => (
              <div
                key={cert.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: '0.5rem', padding: '0.5rem 0.75rem',
                  background: '#f7f9fc', borderRadius: 8, border: '1px solid #d0d7e1',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem' }}>📄 <b>{cert.nombre_original ?? 'Certificado.pdf'}</b></div>
                  <small style={{ color: '#666' }}>
                    {cert.poliza_nombre ?? '—'} {cert.aseguradora ? ` · ${cert.aseguradora}` : ''}
                    {cert.created_at && ` · generado ${new Date(cert.created_at).toLocaleDateString('es-AR')}`}
                    {cert.tamano_kb && ` · ${cert.tamano_kb} KB`}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {cert.download_url && (
                    <a
                      href={cert.download_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#1d74f5', color: '#fff', textDecoration: 'none',
                        padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.78rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Descargar
                    </a>
                  )}
                  {cert.asegurado_id && (
                    <button
                      type="button"
                      onClick={() => compartirCertificado(cert)}
                      disabled={enviandoCertId === cert.id}
                      style={{
                        background: enviandoCertId === cert.id ? '#aaa' : '#0a8c3a', color: '#fff',
                        border: 0, padding: '0.3rem 0.6rem', borderRadius: 6,
                        cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap',
                      }}
                    >
                      {enviandoCertId === cert.id ? 'Enviando…' : '✉ Compartir con distribuidor'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sugeridas para alta */}
      {aplicablesNuevas.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', color: '#444' }}>
            {proveedorEnSolicitud
              ? 'Para aprobar a este distribuidor como activo, primero hay que dar de alta en la póliza correspondiente:'
              : `Pólizas sugeridas según su perfil (${aplicablesNuevas.length})`}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {aplicablesNuevas.map((p) => (
              <div
                key={p.poliza_id}
                style={{
                  border: '1px solid #d0d7e1', borderRadius: 8, padding: '0.5rem 0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                  background: '#f7f9fc',
                }}
              >
                <div>
                  <div><b>{p.nombre ?? `Póliza #${p.poliza_id}`}</b></div>
                  <small style={{ color: '#666' }}>{p.aseguradora ?? '—'} · {p.razon}</small>
                </div>
                <Link
                  to={`/polizas/${p.poliza_id}/solicitar?tipo=alta&persona_id=${personaId}`}
                  style={{
                    background: '#1d74f5', color: '#fff', textDecoration: 'none',
                    padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Solicitar alta →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

type TablaProps = {
  titulo: string;
  rows: AseguradoConPoliza[];
  mostrarBoton: 'baja' | null;
  onSolicitarBaja?: () => void;
};

const PolizasTabla: React.FC<TablaProps> = ({ titulo, rows, mostrarBoton, onSolicitarBaja }) => (
  <div style={{ marginTop: '0.75rem' }}>
    <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', color: '#444' }}>{titulo}</h4>
    <div className="table-wrapper">
      <table className="bdd-activos-table" style={{ width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th>Aseguradora</th>
            <th>Póliza</th>
            <th>Identificador</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.poliza.aseguradora.nombre}</td>
              <td><Link to={`/polizas/${a.poliza.id}`}>{a.poliza.nombre_descriptivo}</Link></td>
              <td><code style={{ fontSize: '0.78rem' }}>{a.identificador}</code></td>
              <td style={{ fontSize: '0.78rem', color: '#666' }}>
                {fmtDate(a.poliza.vigencia_desde)} → {fmtDate(a.poliza.vigencia_hasta)}
              </td>
              <td><span className={`estado-badge ${ESTADO_BADGE[a.estado] ?? 'estado-badge--default'}`}>{a.estado}</span></td>
              <td>
                {/* BUGFIX 04 #2 — abre modal en lugar de redirect al wizard del módulo Pólizas. */}
                {mostrarBoton === 'baja' && (
                  <button
                    type="button"
                    onClick={onSolicitarBaja}
                    style={{
                      background: '#c4392a', color: '#fff', border: 0, cursor: 'pointer',
                      padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.78rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Solicitar baja…
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
