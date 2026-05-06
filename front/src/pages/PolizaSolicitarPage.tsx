import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  Clausula,
  ClausulaAplicada,
  Poliza,
  PolizaAsegurado,
  PolizaSolicitud,
  SolicitudPreview,
  TipoClausulaGlobal,
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

type Paso = 'seleccion' | 'clausulas' | 'preview' | 'enviado';

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

  // Estado de cláusulas
  const [clausulasCatalogo, setClausulasCatalogo] = useState<Clausula[]>([]);
  const [clausulasVigentes, setClausulasVigentes] = useState<ClausulaAplicada[]>([]);
  const [tipoClausulaGlobal, setTipoClausulaGlobal] = useState<TipoClausulaGlobal>('ninguna');
  const [clausulaGlobalId, setClausulaGlobalId] = useState<number | null>(null);
  const [clausulasIndividuales, setClausulasIndividuales] = useState<Map<number, number>>(new Map());

  const [solicitud, setSolicitud] = useState<PolizaSolicitud | null>(null);
  const [preview, setPreview] = useState<SolicitudPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Cargar póliza, asegurados, cláusulas ----
  useEffect(() => {
    if (!polizaId) return;
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setPoliza(data))
      .catch(() => setError('Error al cargar póliza'));
  }, [polizaId, apiBaseUrl]);

  useEffect(() => {
    if (!polizaId) return;
    const filtro = tipo === 'alta' ? 'no_matcheado' : 'activo';
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}/asegurados?estado=${filtro}`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setAsegurados(data ?? []))
      .catch(() => setError('Error al cargar asegurados'));
    setSeleccion(new Set());
  }, [polizaId, apiBaseUrl, tipo]);

  // Cargar cláusulas + vigentes (sólo si tipo=alta — bajas no las usan)
  useEffect(() => {
    if (!polizaId || tipo !== 'alta') return;
    fetch(`${apiBaseUrl}/api/polizas/clausulas?activas_solo=1`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => setClausulasCatalogo(data ?? []));
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}/clausulas-vigentes`, { cache: 'no-store' })
      .then((r) => r.json()).then(({ data }) => {
        setClausulasVigentes(data ?? []);
        // default: si la póliza tiene cláusulas vigentes y es MAPFRE → previa_existente
        if ((data ?? []).length > 0 && poliza?.aseguradora?.parser_perfil === 'mapfre') {
          setTipoClausulaGlobal('previa_existente');
        }
      });
  }, [polizaId, apiBaseUrl, tipo, poliza?.aseguradora?.parser_perfil]);

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

  const setIndividual = (aseguradoId: number, clausulaId: number | null) => {
    setClausulasIndividuales((prev) => {
      const next = new Map(prev);
      if (clausulaId === null) next.delete(aseguradoId);
      else next.set(aseguradoId, clausulaId);
      return next;
    });
  };

  const irAClausulas = () => {
    if (tipo === 'baja') {
      // Bajas no tienen paso de cláusulas — saltar directo al preview
      crearBorradorYPreview();
    } else {
      setPaso('clausulas');
    }
  };

  const crearBorradorYPreview = useCallback(async () => {
    if (!polizaId || seleccion.size === 0) return;
    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        tipo,
        asegurado_ids: Array.from(seleccion),
      };
      if (tipo === 'alta') {
        payload.tipo_clausula_global = tipoClausulaGlobal;
        if (tipoClausulaGlobal === 'aplicar' && clausulaGlobalId) {
          payload.clausula_global_id = clausulaGlobalId;
        }
        if (clausulasIndividuales.size > 0) {
          payload.clausulas_individuales = Array.from(clausulasIndividuales.entries()).map(
            ([asegurado_id, clausula_id]) => ({ asegurado_id, clausula_id })
          );
        }
      }

      const respCrear = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
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
    } finally {
      setLoading(false);
    }
  }, [polizaId, seleccion, tipo, apiBaseUrl, tipoClausulaGlobal, clausulaGlobalId, clausulasIndividuales]);

  const enviarSolicitud = useCallback(async () => {
    if (!solicitud) return;
    try {
      setLoading(true); setError(null);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitudes/${solicitud.id}/enviar`, {
        method: 'POST', headers: { Accept: 'application/json' },
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

  const aseguradosSeleccionados = asegurados.filter((a) => seleccion.has(a.id));

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
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>{error}</div>
      )}

      <Stepper paso={paso} tipo={tipo} />

      {paso === 'seleccion' && (
        <SeleccionAsegurados
          asegurados={asegurados}
          tipo={tipo} setTipo={setTipo}
          seleccion={seleccion} toggle={toggle} seleccionarTodos={seleccionarTodos}
          loading={loading}
          onContinuar={irAClausulas}
        />
      )}

      {paso === 'clausulas' && (
        <ClausulasStep
          aseguradora={poliza?.aseguradora?.parser_perfil ?? ''}
          clausulasCatalogo={clausulasCatalogo}
          clausulasVigentes={clausulasVigentes}
          tipoClausulaGlobal={tipoClausulaGlobal} setTipoClausulaGlobal={setTipoClausulaGlobal}
          clausulaGlobalId={clausulaGlobalId} setClausulaGlobalId={setClausulaGlobalId}
          clausulasIndividuales={clausulasIndividuales} setIndividual={setIndividual}
          aseguradosSeleccionados={aseguradosSeleccionados}
          loading={loading}
          onVolver={() => setPaso('seleccion')}
          onContinuar={crearBorradorYPreview}
        />
      )}

      {paso === 'preview' && preview && (
        <PreviewStep
          preview={preview}
          loading={loading}
          onVolver={() => setPaso(tipo === 'alta' ? 'clausulas' : 'seleccion')}
          onEnviar={enviarSolicitud}
        />
      )}

      {paso === 'enviado' && solicitud && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0, color: '#0a8c3a' }}>✓ Solicitud enviada</h3>
          <ul style={{ lineHeight: 1.8, margin: 0 }}>
            <li>ID solicitud: #{solicitud.id}</li>
            <li>Estado: <b>{solicitud.estado}</b></li>
            <li>Enviado: {solicitud.enviado_en ? new Date(solicitud.enviado_en).toLocaleString('es-AR') : '—'}</li>
          </ul>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => navigate(`/polizas/${polizaId}`)} className="secondary-action"
              style={{ background: '#1d74f5', color: '#fff', padding: '0.5rem 1rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
              Volver al detalle
            </button>
            <button type="button" onClick={() => navigate('/polizas/solicitudes')} className="secondary-action secondary-action--ghost">
              Bandeja
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

// -----------------------------------------------------------------------------

const Stepper: React.FC<{ paso: Paso; tipo: TipoEmail }> = ({ paso, tipo }) => {
  // Las bajas saltan el paso "Cláusulas" — lo ocultamos del stepper.
  const pasos: Array<[Paso, string]> = tipo === 'alta'
    ? [['seleccion', 'Selección'], ['clausulas', 'Cláusulas'], ['preview', 'Preview'], ['enviado', 'Enviado']]
    : [['seleccion', 'Selección'], ['preview', 'Preview'], ['enviado', 'Enviado']];
  const idx = pasos.findIndex(([p]) => p === paso);

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '1rem 0' }}>
      {pasos.map(([p, label], i) => (
        <React.Fragment key={p}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: i <= idx ? '#1d74f5' : '#e0e7f0',
            color: i <= idx ? '#fff' : '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.85rem',
          }}>{i + 1}</div>
          <div style={{ fontSize: '0.85rem', color: i <= idx ? '#222' : '#888' }}>{label}</div>
          {i < pasos.length - 1 && <div style={{ width: 24, height: 2, background: i < idx ? '#1d74f5' : '#e0e7f0' }} />}
        </React.Fragment>
      ))}
    </div>
  );
};

// -----------------------------------------------------------------------------

type SeleccionProps = {
  asegurados: PolizaAsegurado[];
  tipo: TipoEmail; setTipo: (t: TipoEmail) => void;
  seleccion: Set<number>; toggle: (id: number) => void; seleccionarTodos: () => void;
  loading: boolean;
  onContinuar: () => void;
};

const SeleccionAsegurados: React.FC<SeleccionProps> = ({
  asegurados, tipo, setTipo, seleccion, toggle, seleccionarTodos, loading, onContinuar,
}) => (
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
          ? 'Mostrando asegurados sin match en personas (candidatos a alta).'
          : 'Mostrando asegurados activos (candidatos a baja).'}
      </div>
    </div>

    <div className="dashboard-card">
      {asegurados.length === 0 ? (
        <div style={{ padding: '0.5rem', color: '#666' }}>No hay asegurados disponibles.</div>
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
                <tr><th></th><th>Identificador</th><th>Nombre / Vehículo</th><th>Distribuidor</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {asegurados.map((a) => (
                  <tr key={a.id}>
                    <td><input type="checkbox" checked={seleccion.has(a.id)} onChange={() => toggle(a.id)} /></td>
                    <td><code>{a.identificador}</code> <small style={{ color: '#888' }}>({a.identificador_tipo})</small></td>
                    <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}</td>
                    <td>{a.persona ? a.persona.nombre_completo : <span style={{ color: '#c00' }}>sin match</span>}</td>
                    <td>{a.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button type="button" disabled={seleccion.size === 0 || loading} onClick={onContinuar}
              style={{
                background: seleccion.size === 0 ? '#aaa' : '#1d74f5',
                color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
              }}>
              Continuar ({seleccion.size}) ▶
            </button>
          </div>
        </>
      )}
    </div>
  </>
);

// -----------------------------------------------------------------------------

type ClausulasProps = {
  aseguradora: string;
  clausulasCatalogo: Clausula[];
  clausulasVigentes: ClausulaAplicada[];
  tipoClausulaGlobal: TipoClausulaGlobal;
  setTipoClausulaGlobal: (v: TipoClausulaGlobal) => void;
  clausulaGlobalId: number | null;
  setClausulaGlobalId: (v: number | null) => void;
  clausulasIndividuales: Map<number, number>;
  setIndividual: (aseguradoId: number, clausulaId: number | null) => void;
  aseguradosSeleccionados: PolizaAsegurado[];
  loading: boolean;
  onVolver: () => void;
  onContinuar: () => void;
};

const ClausulasStep: React.FC<ClausulasProps> = ({
  aseguradora, clausulasCatalogo, clausulasVigentes,
  tipoClausulaGlobal, setTipoClausulaGlobal,
  clausulaGlobalId, setClausulaGlobalId,
  clausulasIndividuales, setIndividual,
  aseguradosSeleccionados, loading, onVolver, onContinuar,
}) => {
  const muestraPreviaExistente = aseguradora === 'mapfre' && clausulasVigentes.length > 0;

  return (
    <>
      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Paso 2 — Cláusulas</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
          Configurá la cláusula de no repetición que querés aplicar a este alta.
          Es opcional — podés saltar al preview sin elegir nada.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input type="radio" name="tipoClausulaGlobal" checked={tipoClausulaGlobal === 'ninguna'}
              onChange={() => setTipoClausulaGlobal('ninguna')} />
            <div>
              <b>Sin cláusula</b>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>El email no incluye texto de cláusula.</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input type="radio" name="tipoClausulaGlobal" checked={tipoClausulaGlobal === 'aplicar'}
              onChange={() => setTipoClausulaGlobal('aplicar')} />
            <div style={{ flex: 1 }}>
              <b>Aplicar cláusula</b>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                {aseguradora === 'mapfre' && 'Inline en cada nombre del listado: "Nombre (Con clausula de X)".'}
                {aseguradora === 'san_cristobal' && 'Bloque arriba del listado con guión + numeración 1)_:.'}
                {aseguradora === 'la_segunda' && 'Frase en el body: "tenga las cláusulas de {alias}".'}
              </div>
              {tipoClausulaGlobal === 'aplicar' && (
                <select
                  value={clausulaGlobalId ?? ''}
                  onChange={(e) => setClausulaGlobalId(e.target.value ? Number(e.target.value) : null)}
                  style={{ marginTop: '0.4rem', width: '100%', maxWidth: 500 }}
                >
                  <option value="">— Seleccionar cláusula —</option>
                  {clausulasCatalogo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_corto} · CUIT {c.cuit_titular} · alias "{c.alias}"
                    </option>
                  ))}
                </select>
              )}
            </div>
          </label>

          {muestraPreviaExistente && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input type="radio" name="tipoClausulaGlobal" checked={tipoClausulaGlobal === 'previa_existente'}
                onChange={() => setTipoClausulaGlobal('previa_existente')} />
              <div>
                <b>Usar cláusulas ya vigentes en la póliza</b>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  El email pide a MAPFRE incluir las mismas cláusulas que figuran en endosos previos:
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {clausulasVigentes.map((cv) => (
                    <span key={cv.id} className="chip chip--muted" style={{ marginRight: 4 }}>
                      {cv.clausula?.nombre_corto}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Cláusulas individuales — opcional, sólo si hay cláusulas en catálogo */}
      {clausulasCatalogo.length > 0 && aseguradosSeleccionados.length > 0 && (
        <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
              Paso 2B — Cláusulas individuales (opcional, {clausulasIndividuales.size} elegidas)
            </summary>
            <p style={{ fontSize: '0.85rem', color: '#666' }}>
              Asigná una cláusula adicional a un asegurado específico (caso edge: alguien necesita una cláusula distinta o reforzada al resto).
            </p>
            <div className="table-wrapper">
              <table className="bdd-activos-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Asegurado</th><th>Cláusula individual</th></tr>
                </thead>
                <tbody>
                  {aseguradosSeleccionados.map((a) => (
                    <tr key={a.id}>
                      <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? a.identificador}</td>
                      <td>
                        <select
                          value={clausulasIndividuales.get(a.id) ?? ''}
                          onChange={(e) => setIndividual(a.id, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">(ninguna)</option>
                          {clausulasCatalogo.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre_corto}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" className="secondary-action secondary-action--ghost" onClick={onVolver}>← Volver</button>
        <button type="button" disabled={loading} onClick={onContinuar}
          style={{ background: '#1d74f5', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer' }}>
          {loading ? 'Generando preview…' : 'Generar preview ▶'}
        </button>
      </div>
    </>
  );
};

// -----------------------------------------------------------------------------

type PreviewStepProps = {
  preview: SolicitudPreview;
  loading: boolean;
  onVolver: () => void;
  onEnviar: () => void;
};

const PreviewStep: React.FC<PreviewStepProps> = ({ preview, loading, onVolver, onEnviar }) => (
  <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
    <h3 style={{ margin: 0 }}>Preview del email</h3>
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
    }}>{preview.body}</pre>
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <button type="button" className="secondary-action secondary-action--ghost" onClick={onVolver}>← Editar</button>
      <button type="button" disabled={loading || !preview.adjuntos_check.ok} onClick={onEnviar}
        style={{
          background: preview.adjuntos_check.ok ? '#0a8c3a' : '#aaa',
          color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
        }}>
        {loading ? 'Enviando…' : preview.adjuntos_check.ok ? '✉ Enviar email' : 'No se puede enviar (faltan adjuntos)'}
      </button>
    </div>
  </div>
);
