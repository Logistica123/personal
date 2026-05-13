import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PolizaAsegurado } from '../features/polizas/types';

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

type PersonaInfo = {
  id: number;
  apellidos: string | null;
  nombres: string | null;
  cuil: string | null;
  patente: string | null;
};

const ESTADO_BADGE: Record<string, string> = {
  activo: 'estado-badge--activo',
  alta_solicitada: 'estado-badge--pendiente',
  baja_solicitada: 'estado-badge--pendiente',
  dado_de_baja: 'estado-badge--baja',
  no_matcheado: 'estado-badge--default',
};

// Tolera 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ssZ' (Laravel cast date en prod).
const fmtDate = (s: string): string => new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-AR');

export const PersonaPolizasPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { personaId } = useParams<{ personaId: string }>();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [persona, setPersona] = useState<PersonaInfo | null>(null);
  const [asegurados, setAsegurados] = useState<AseguradoConPoliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;
    const ctrl = new AbortController();
    setLoading(true);

    Promise.all([
      fetch(`${apiBaseUrl}/api/personal/${personaId}`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Persona no encontrada'))))
        .then((p) => setPersona(p?.data ?? p)),
      fetch(`${apiBaseUrl}/api/personal/${personaId}/polizas`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => r.json())
        .then(({ data }) => setAsegurados(data ?? [])),
    ])
      .catch((e) => { if ((e as Error).name !== 'AbortError') setError((e as Error).message); })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [personaId, apiBaseUrl]);

  const nombreCompleto = persona
    ? `${persona.apellidos ?? ''}, ${persona.nombres ?? ''}`.replace(/^,\s|,\s*$/, '').trim() || 'Proveedor'
    : 'Proveedor';

  const activos = asegurados.filter((a) => a.estado === 'activo');
  const otros = asegurados.filter((a) => a.estado !== 'activo');

  // ADDENDUM 15 Bloque 1.B — modal "Solicitar baja" que envía a la bandeja en lugar del wizard directo.
  const [modalBaja, setModalBaja] = useState(false);

  return (
    <DashboardLayout
      title={`Pólizas de ${nombreCompleto}`}
      subtitle={persona ? `CUIL: ${persona.cuil ?? '—'} · Patente: ${persona.patente ?? '—'}` : ''}
      headerContent={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to={`/personal/${personaId}/editar`} className="secondary-action secondary-action--ghost">
            ← Editar proveedor
          </Link>
          <Link to="/polizas" className="secondary-action secondary-action--ghost">
            Pólizas
          </Link>
          {activos.length > 0 && (
            <button
              type="button"
              onClick={() => setModalBaja(true)}
              className="secondary-action"
              style={{ background: '#c4392a', color: '#fff' }}
            >
              Solicitar baja…
            </button>
          )}
        </div>
      }
    >
      {modalBaja && persona && (
        <SolicitarBajaModal
          apiBaseUrl={apiBaseUrl}
          personaId={persona.id}
          nombreCompleto={nombreCompleto}
          polizasActivas={activos}
          onClose={() => setModalBaja(false)}
          onCreada={() => { setModalBaja(false); }}
        />
      )}
      {loading && <div style={{ padding: '2rem' }}>Cargando…</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12 }}>{error}</div>
      )}

      {!loading && !error && asegurados.length === 0 && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0 }}>Sin cobertura</h3>
          <p style={{ margin: 0, color: '#666' }}>
            Este proveedor no figura como asegurado en ninguna póliza activa.
            Si debería estar cubierto, hacé una solicitud de alta desde la póliza correspondiente.
          </p>
        </div>
      )}

      {activos.length > 0 && (
        <Section
          title={`✓ Activas (${activos.length})`}
          asegurados={activos}
          accion="baja"
        />
      )}

      {otros.length > 0 && (
        <Section
          title={`Histórico / pendientes (${otros.length})`}
          asegurados={otros}
          accion={null}
        />
      )}
    </DashboardLayout>
  );
};

type SectionProps = {
  title: string;
  asegurados: AseguradoConPoliza[];
  accion: 'alta' | 'baja' | null;
};

const Section: React.FC<SectionProps> = ({ title, asegurados, accion }) => (
  <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
    <div className="card-header"><h3 style={{ margin: 0 }}>{title}</h3></div>
    <div className="table-wrapper">
      <table className="bdd-activos-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Aseguradora</th>
            <th>Póliza</th>
            <th>Tipo</th>
            <th>Identificador</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {asegurados.map((a) => (
            <tr key={a.id}>
              <td>{a.poliza.aseguradora.nombre}</td>
              <td><Link to={`/polizas/${a.poliza.id}`}>{a.poliza.nombre_descriptivo}</Link></td>
              <td style={{ textTransform: 'capitalize' }}>{a.poliza.tipo_asegurado}</td>
              <td><code>{a.identificador}</code></td>
              <td>{fmtDate(a.poliza.vigencia_desde)} → {fmtDate(a.poliza.vigencia_hasta)}</td>
              <td><span className={`estado-badge ${ESTADO_BADGE[a.estado] ?? 'estado-badge--default'}`}>{a.estado}</span></td>
              <td>
                {/* ADDENDUM 15 Bloque 1.B — el botón individual fue reemplazado por el modal global del header. */}
                {accion === 'baja' && (
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>Usá "Solicitar baja…" arriba</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ADDENDUM 15 Bloque 1.B — Modal "Solicitar baja". POST a la bandeja de pendientes.
const SolicitarBajaModal: React.FC<{
  apiBaseUrl: string;
  personaId: number;
  nombreCompleto: string;
  polizasActivas: AseguradoConPoliza[];
  onClose: () => void;
  onCreada: () => void;
}> = ({ apiBaseUrl, personaId, nombreCompleto, polizasActivas, onClose, onCreada }) => {
  const [motivo, setMotivo] = useState('');
  const [comentarios, setComentarios] = useState('');
  // Por default todas las pólizas activas vienen sugeridas (el admin afina al procesar).
  const [polizasSugeridas, setPolizasSugeridas] = useState<Set<number>>(
    new Set(polizasActivas.map((a) => a.poliza.id))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const togglePoliza = useCallback((id: number) => {
    setPolizasSugeridas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (motivo.trim().length < 3) {
      setError('El motivo es obligatorio (mínimo 3 caracteres).');
      return;
    }
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: personaId,
          motivo_baja: motivo,
          polizas_sugeridas: Array.from(polizasSugeridas),
          comentarios_adicionales: comentarios || undefined,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setOk(true);
      setTimeout(onCreada, 1500);
    } catch (e) { setError(`Error: ${(e as Error).message}`); }
    finally { setLoading(false); }
  }, [apiBaseUrl, personaId, motivo, comentarios, polizasSugeridas, onCreada]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(15, 23, 42, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, maxWidth: '36rem', width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
      }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Solicitar baja — {nombreCompleto}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', color: '#475569' }}>
          {ok ? (
            <div style={{ padding: '1rem', background: '#f0fdf4', color: '#166534', borderRadius: 6, border: '1px solid #bbf7d0' }}>
              ✓ Solicitud creada. Un administrativo la va a revisar desde la bandeja de Pólizas.
            </div>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                Esto crea una solicitud en la <strong>bandeja de bajas pendientes</strong>. Un administrativo
                la revisa y procesa, no se envía correo todavía.
              </p>

              {error && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#991b1b', borderRadius: 6, marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>{error}</div>}

              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Motivo (obligatorio)</span>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                  placeholder='Ej: "Renuncia voluntaria, comunicado por Whatsapp el 09/05"'
                  style={{ width: '100%', borderRadius: 6, borderColor: '#cbd5e1' }} />
              </label>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Pólizas sugeridas a dar de baja (el admin confirma al procesar):
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {polizasActivas.map((a) => (
                    <li key={a.poliza.id} style={{ padding: '0.25rem 0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" checked={polizasSugeridas.has(a.poliza.id)}
                          onChange={() => togglePoliza(a.poliza.id)} />
                        <span>
                          <strong>{a.poliza.aseguradora.nombre}</strong> — {a.poliza.nombre_descriptivo}
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> ({a.identificador})</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Comentarios adicionales (opcional)
                </span>
                <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2}
                  style={{ width: '100%', borderRadius: 6, borderColor: '#cbd5e1' }} />
              </label>
            </>
          )}
        </div>

        {!ok && (
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button onClick={onClose} className="secondary-action secondary-action--ghost">Cancelar</button>
            <button onClick={submit} disabled={loading || motivo.length < 3}
              className="secondary-action"
              style={{ background: loading ? '#94a3b8' : '#c4392a', color: '#fff' }}>
              {loading ? 'Creando…' : 'Crear solicitud de baja ▶'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
