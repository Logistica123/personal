import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  Clausula,
  ClausulaAplicada,
  DistribuidorEnriquecido,
  Poliza,
  PolizaAsegurado,
  PolizaSolicitud,
  SolicitudPreview,
  TipoClausulaGlobal,
  TipoEmail,
} from '../features/polizas/types';
import { SearchInput } from '../features/polizas/SearchInput';
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

type Paso = 'seleccion' | 'clausulas' | 'preview' | 'enviado';

export const PolizaSolicitarPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const tipoInicial = (searchParams.get('tipo') === 'baja' ? 'baja' : 'alta') as TipoEmail;
  // ADDENDUM 10 sub-fase 2 — pre-selección por query param. Si llegamos con
  // `?persona_id=N&tipo=alta`, intentamos auto-seleccionar a esa persona en el
  // paso 1 una vez que el listado de candidatos esté cargado. Lo consumimos
  // una sola vez (`prefillConsumido`) para no re-aplicarlo si el user
  // deselecciona manualmente.
  const personaIdPreFill = useMemo(() => {
    const raw = searchParams.get('persona_id');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);
  const [prefillConsumido, setPrefillConsumido] = useState(false);
  const [tipo, setTipo] = useState<TipoEmail>(tipoInicial);
  const [paso, setPaso] = useState<Paso>('seleccion');

  const [poliza, setPoliza] = useState<Poliza | null>(null);
  // Para BAJAS: lista de PolizaAsegurado activos en la póliza.
  const [asegurados, setAsegurados] = useState<PolizaAsegurado[]>([]);
  // Para ALTAS: lista de personas (proveedores + solicitudes) que NO son asegurados.
  const [personasDisponibles, setPersonasDisponibles] = useState<DistribuidorEnriquecido[]>([]);
  // Selección: para baja → asegurado_id, para alta → persona_id (universos disjuntos).
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [searchSeleccion, setSearchSeleccion] = useState('');

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

  // Cargar candidatos según el tipo:
  // - alta: personas (proveedores/solicitudes) que NO son asegurados activos.
  // - baja: asegurados activos en la póliza.
  useEffect(() => {
    if (!polizaId) return;
    // Solo limpiar selección cuando el user cambia tipo o search. NO en el primer
    // load si tenemos un persona_id pendiente de aplicar.
    if (prefillConsumido || !personaIdPreFill || tipo !== 'alta') {
      setSeleccion(new Set());
    }
    const params = new URLSearchParams();
    if (searchSeleccion) params.set('search', searchSeleccion);

    if (tipo === 'alta') {
      const url = `${apiBaseUrl}/api/polizas/${polizaId}/personas-disponibles-para-alta${
        params.toString() ? '?' + params : ''
      }`;
      fetch(url, { cache: 'no-store' })
        .then((r) => r.json())
        .then(({ data }) => {
          setPersonasDisponibles(data ?? []);
          // ADDENDUM 10 sub-fase 2 — auto-seleccionar si vino por ?persona_id=
          // y la persona aparece en la lista (de lo contrario el user vería
          // selección vacía y no entendería el flujo).
          if (!prefillConsumido && personaIdPreFill) {
            const enLista = (data as Array<{ id: number }>)?.some((p) => p.id === personaIdPreFill);
            if (enLista) {
              setSeleccion(new Set([personaIdPreFill]));
            } else {
              setError(
                `La persona #${personaIdPreFill} no está disponible para alta en esta póliza ` +
                `(quizás ya es asegurado activo, o no tiene la patente/CUIL requerido).`
              );
            }
            setPrefillConsumido(true);
          }
        })
        .catch(() => setError('Error al cargar personas disponibles'));
    } else {
      params.set('estado', 'activo');
      fetch(`${apiBaseUrl}/api/polizas/${polizaId}/asegurados?${params}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then(({ data }) => {
          setAsegurados(data ?? []);
          // ADDENDUM 12 Parte G — si venimos de baja masiva, pre-seleccionar los IDs pasados.
          if (searchParams.get('from') === 'baja_masiva') {
            try {
              const raw = sessionStorage.getItem('polizas:baja_masiva_pre_seleccion');
              if (raw) {
                const ids = JSON.parse(raw) as number[];
                const enLista = (data as Array<{ id: number }>).map((a) => a.id);
                setSeleccion(new Set(ids.filter((id) => enLista.includes(id))));
                sessionStorage.removeItem('polizas:baja_masiva_pre_seleccion');
              }
            } catch { /* noop */ }
          }
        })
        .catch(() => setError('Error al cargar asegurados'));
    }
  }, [polizaId, apiBaseUrl, tipo, searchSeleccion, personaIdPreFill, prefillConsumido]);

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
    const ids = tipo === 'alta'
      ? personasDisponibles.map((p) => p.id)
      : asegurados.map((a) => a.id);
    setSeleccion(seleccion.size === ids.length ? new Set() : new Set(ids));
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

      const payload: Record<string, unknown> = { tipo };

      // Alta: el wizard selecciona personas (no asegurados todavía).
      // Baja: el wizard selecciona asegurados activos existentes.
      if (tipo === 'alta') {
        payload.persona_ids = Array.from(seleccion);
        payload.tipo_clausula_global = tipoClausulaGlobal;
        if (tipoClausulaGlobal === 'aplicar' && clausulaGlobalId) {
          payload.clausula_global_id = clausulaGlobalId;
        }
        if (clausulasIndividuales.size > 0) {
          // En alta las cláusulas individuales se asignan por persona_id; el backend
          // las re-mapea al asegurado_id creado on-the-fly.
          payload.clausulas_individuales = Array.from(clausulasIndividuales.entries()).map(
            ([asegurado_id, clausula_id]) => ({ asegurado_id, clausula_id })
          );
        }
      } else {
        payload.asegurado_ids = Array.from(seleccion);
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

  // ADDENDUM 11 — si el envío falla por OAuth (admin sin Outlook vinculado o
  // token vencido/revocado), el backend devuelve 422 con `oauth_required=true`
  // y la solicitud queda en `borrador`. Mostramos un banner con CTA directo a
  // /polizas/configuracion/mi-outlook para que vincule y reintente.
  const [oauthError, setOauthError] = useState<{ razon: string; message: string; revincular_url: string } | null>(null);

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
        throw new Error(body?.message ?? `Error 422`);
      }
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

  // En alta `seleccion` es Set<persona_id>; aquí no aplica el cruce con asegurados.
  // Lo dejamos vacío para alta — el paso "Cláusulas individuales" se mantiene
  // funcional vía persona_ids (ver sub-paso B).
  const aseguradosSeleccionados = tipo === 'baja'
    ? asegurados.filter((a) => seleccion.has(a.id))
    : [];

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

      {/* ADDENDUM 11 — banner OAuth requerido. La solicitud sigue en borrador
          y el admin puede reintentar después de re-vincular. */}
      {oauthError && (
        <div style={{
          padding: '1rem 1.2rem', margin: '1rem 0', borderRadius: 12,
          background: '#fff5e6', border: '1px solid #c70', color: '#7a4a00',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
              ⚠ No se pudo enviar — {oauthError.razon === 'sin_vincular' ? 'tenés que vincular tu Outlook' : 'tu vinculación de Outlook expiró'}
            </div>
            <div style={{ fontSize: '0.9rem' }}>{oauthError.message}</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              La solicitud quedó en borrador. Después de re-vincular volvé acá y tocá "Enviar email" de nuevo.
            </div>
          </div>
          <Link
            to={oauthError.revincular_url}
            style={{
              background: '#1d74f5', color: '#fff', padding: '0.6rem 1rem',
              borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            {oauthError.razon === 'sin_vincular' ? 'Vincular Outlook ▶' : 'Re-vincular ahora ▶'}
          </Link>
        </div>
      )}

      <Stepper paso={paso} tipo={tipo} />

      {paso === 'seleccion' && (
        <SeleccionStep
          tipo={tipo} setTipo={setTipo}
          asegurados={asegurados}
          personasDisponibles={personasDisponibles}
          seleccion={seleccion} toggle={toggle} seleccionarTodos={seleccionarTodos}
          search={searchSeleccion} setSearch={setSearchSeleccion}
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
  tipo: TipoEmail; setTipo: (t: TipoEmail) => void;
  asegurados: PolizaAsegurado[];
  personasDisponibles: DistribuidorEnriquecido[];
  seleccion: Set<number>; toggle: (id: number) => void; seleccionarTodos: () => void;
  search: string; setSearch: (s: string) => void;
  loading: boolean;
  onContinuar: () => void;
};

const SeleccionStep: React.FC<SeleccionProps> = ({
  tipo, setTipo, asegurados, personasDisponibles, seleccion, toggle, seleccionarTodos,
  search, setSearch, loading, onContinuar,
}) => {
  const total = tipo === 'alta' ? personasDisponibles.length : asegurados.length;
  const universo = tipo === 'alta' ? 'personas' : 'asegurados';

  return (
    <>
      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Paso 1 — Seleccionar {tipo === 'alta' ? 'personas' : 'asegurados'}</h3>
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
            ? 'Personas (proveedores y solicitudes pendientes) que NO son asegurados activos en esta póliza. El badge muestra su estado actual en la plataforma.'
            : 'Asegurados activos en la póliza (candidatos a baja).'}
        </div>
        <div style={{ marginTop: '0.5rem', maxWidth: 480 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tipo === 'alta'
              ? 'Buscar por nombre, CUIL, patente…'
              : 'Buscar por patente, CUIL, nombre, distribuidor…'}
          />
        </div>
      </div>

      <div className="dashboard-card">
        {total === 0 ? (
          <div style={{ padding: '0.5rem', color: '#666' }}>
            {search
              ? `No se encontraron ${universo} para "${search}".`
              : tipo === 'alta'
                ? 'No hay personas disponibles para alta — todos los proveedores y solicitudes ya están asegurados en esta póliza.'
                : 'No hay asegurados activos en esta póliza.'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={seleccionarTodos}>
                {seleccion.size === total ? 'Deseleccionar todos' : `Seleccionar todos (${total})`}
              </button>
              <span style={{ fontSize: '0.85rem' }}>{seleccion.size} seleccionados</span>
            </div>

            <div className="table-wrapper">
              {tipo === 'alta' ? (
                <table className="bdd-activos-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Distribuidor</th>
                      <th>CUIL</th>
                      <th>Patente</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personasDisponibles.map((p) => (
                      <tr key={p.id}>
                        <td><input type="checkbox" checked={seleccion.has(p.id)} onChange={() => toggle(p.id)} /></td>
                        <td>
                          <Link to={`/personal/${p.id}/editar`}>{p.nombre_completo}</Link>
                        </td>
                        <td><code style={{ fontSize: '0.8rem' }}>{p.cuil ?? '—'}</code></td>
                        <td><code style={{ fontSize: '0.8rem' }}>{p.patente ?? '—'}</code></td>
                        <td><EstadoDistribuidorBadge estado={p.estado_actual} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="bdd-activos-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Identificador</th>
                      <th>Nombre / Vehículo</th>
                      <th>Distribuidor</th>
                      <th>Estado dist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asegurados.map((a) => (
                      <tr key={a.id}>
                        <td><input type="checkbox" checked={seleccion.has(a.id)} onChange={() => toggle(a.id)} /></td>
                        <td><code>{a.identificador}</code> <small style={{ color: '#888' }}>({a.identificador_tipo})</small></td>
                        <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}</td>
                        <td>{a.persona ? a.persona.nombre_completo : <span style={{ color: '#c00' }}>sin match</span>}</td>
                        <td><EstadoDistribuidorBadge estado={a.persona?.estado_actual ?? null} alerta={a.persona_alerta_estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
};

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
    {/* Bloque A.3 — indicador del remitente. */}
    {preview.remitente && (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        background: preview.remitente.modo === 'oauth' ? '#e7f7ed' : '#eef4ff',
        border: `1px solid ${preview.remitente.modo === 'oauth' ? '#0a8c3a' : '#1d74f5'}`,
        borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.85rem',
      }}>
        <span style={{ fontSize: '1.1rem' }}>{preview.remitente.modo === 'oauth' ? '✉' : '🏢'}</span>
        <div>
          <div>
            <b>De:</b>{' '}
            {preview.remitente.modo === 'oauth'
              ? <>tu Outlook (<code>{preview.remitente.email ?? '—'}</code>)</>
              : <>casilla institucional (<code>{preview.remitente.email ?? '—'}</code>)</>}
          </div>
          <small style={{ color: '#444' }}>{preview.remitente.desc}</small>
        </div>
      </div>
    )}
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
