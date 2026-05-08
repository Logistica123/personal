import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput } from '../polizas/SearchInput';
import { EstadoDistribuidorBadge } from '../polizas/EstadoDistribuidorBadge';
import type { DistribuidorEnriquecido, EstadoPersonaSnapshot } from '../polizas/types';

type ChoferRelacion = {
  relacion_id: number;
  fecha_vinculacion: string | null;
  fecha_desvinculacion: string | null;
  rol: 'chofer' | 'reemplazo' | 'familiar' | string;
  notas: string | null;
  activo: boolean;
  persona: (DistribuidorEnriquecido & { email: string | null; telefono: string | null }) | null;
  polizas_ap_activas: Array<{
    asegurado_id: number;
    poliza_id: number;
    nombre: string | null;
    numero: string | null;
    aseguradora: string | null;
    estado: string;
  }>;
};

type Props = {
  apiBaseUrl: string;
  titularPersonaId: number;
  /** Si false (proveedor desactivado / read-only) se ocultan acciones de edición. */
  isReadOnly?: boolean;
};

/**
 * Subset del shape de PersonalRecord — los campos que heredamos al crear un
 * chofer nuevo desde el atajo. Los traemos del endpoint
 * GET /api/personal/{id}, no del padre, para que ChoferesSection sea
 * autocontenido y no necesite recablear ProveedorEditarPage.
 */
type TitularDefaults = {
  clienteId: number | null;
  cliente: string | null;
  sucursalId: number | null;
  sucursal: string | null;
  agenteId: number | null;
  agente: string | null;
  agenteResponsableId: number | null;
};

/**
 * ADDENDUM 10 Parte C — sección "Choferes vinculados" embebida en
 * ProveedorEditarPage. Permite vincular/desvincular choferes existentes y
 * dispara el wizard "Solicitar alta AP" si un chofer no tiene cobertura.
 */
export const ChoferesSection: React.FC<Props> = ({ apiBaseUrl, titularPersonaId, isReadOnly = false }) => {
  const [choferes, setChoferes] = useState<ChoferRelacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCrear, setShowCrear] = useState(false);
  const [titularDefaults, setTitularDefaults] = useState<TitularDefaults | null>(null);

  const fetchChoferes = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/personal/${titularPersonaId}/choferes`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = (await resp.json()) as { data: ChoferRelacion[] };
      setChoferes(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apiBaseUrl, titularPersonaId]);

  // Carga de datos del titular para heredar cliente/sucursal/agente al crear
  // un chofer nuevo. Se hace una sola vez por mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/personal/${titularPersonaId}`, { cache: 'no-store' });
        if (!resp.ok || cancelled) return;
        const payload = await resp.json();
        const d = (payload?.data ?? payload) as Record<string, unknown>;
        if (cancelled) return;
        setTitularDefaults({
          clienteId:           (d.clienteId as number | null) ?? null,
          cliente:             (d.cliente as string | null) ?? null,
          sucursalId:          (d.sucursalId as number | null) ?? null,
          sucursal:            (d.sucursal as string | null) ?? null,
          agenteId:            (d.agenteId as number | null) ?? null,
          agente:              (d.agente as string | null) ?? null,
          agenteResponsableId: (d.agenteResponsableId as number | null) ?? null,
        });
      } catch {
        // Silencioso — si falla, el modal de crear igual deja al user llenar manualmente.
      }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, titularPersonaId]);

  useEffect(() => { fetchChoferes(); }, [fetchChoferes]);

  const desvincular = async (rel: ChoferRelacion) => {
    if (!window.confirm(`¿Desvincular a ${rel.persona?.nombre_completo ?? 'este chofer'}?\n\nLa relación se preserva en histórico (soft-disable).`)) {
      return;
    }
    const resp = await fetch(`${apiBaseUrl}/api/personal/relacion-chofer/${rel.relacion_id}`, { method: 'DELETE' });
    if (resp.ok) fetchChoferes();
    else window.alert('No se pudo desvincular.');
  };

  return (
    <section className="personal-edit-section">
      <h2>Choferes vinculados {choferes ? `(${choferes.length})` : ''}</h2>
      <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.75rem 0' }}>
        Personas que manejan el vehículo del titular. Si no tienen cobertura AP,
        podés solicitar el alta directo desde acá.
      </p>

      {error && (
        <div style={{ background: '#fee', color: '#900', padding: '0.5rem', borderRadius: 6, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {!isReadOnly && (
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowCrear(true)}
            style={{
              background: '#0a8c3a', color: '#fff', padding: '0.45rem 0.9rem',
              borderRadius: 8, border: 0, cursor: 'pointer', fontSize: '0.85rem',
            }}
            title="Crea una nueva persona como chofer y la vincula automáticamente al titular"
          >
            + Crear chofer nuevo
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              background: '#1d74f5', color: '#fff', padding: '0.45rem 0.9rem',
              borderRadius: 8, border: 0, cursor: 'pointer', fontSize: '0.85rem',
            }}
            title="Vincular una persona que ya existe en la base"
          >
            + Vincular chofer existente
          </button>
        </div>
      )}

      {choferes === null && <div style={{ color: '#888' }}>Cargando…</div>}
      {choferes !== null && choferes.length === 0 && (
        <div style={{ color: '#888', fontStyle: 'italic' }}>
          Sin choferes vinculados todavía.
        </div>
      )}

      {choferes !== null && choferes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {choferes.map((rel) => (
            <div
              key={rel.relacion_id}
              style={{
                border: '1px solid #d0d7e1', borderRadius: 10, padding: '0.75rem',
                background: '#f7f9fc',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                    {rel.persona ? (
                      <Link to={`/personal/${rel.persona.id}/editar`}>{rel.persona.nombre_completo}</Link>
                    ) : '—'}
                    {' '}
                    <EstadoDistribuidorBadge estado={(rel.persona?.estado_actual as EstadoPersonaSnapshot) ?? null} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    CUIL <code>{rel.persona?.cuil ?? '—'}</code>
                    {' · '}
                    Vinculado: {rel.fecha_vinculacion ?? '—'}
                    {' · '}
                    Rol: <b>{rel.rol}</b>
                  </div>
                  {rel.notas && (
                    <div style={{ fontSize: '0.85rem', color: '#444', marginTop: '0.25rem' }}>
                      {rel.notas}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  {rel.polizas_ap_activas.length === 0 ? (
                    <Link
                      to={`/polizas?solicitar_alta_persona=${rel.persona?.id}`}
                      title="Abrir wizard para solicitar alta AP de este chofer"
                      style={{
                        background: '#fff5e6', color: '#c70', border: '1px solid #c70',
                        padding: '0.3rem 0.6rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⚠ Sin AP — Solicitar alta →
                    </Link>
                  ) : (
                    <span
                      title={rel.polizas_ap_activas.map((p) => `${p.nombre} (#${p.numero})`).join(' · ')}
                      style={{
                        background: '#e7f7ed', color: '#0a8c3a', padding: '0.3rem 0.6rem',
                        borderRadius: 6, fontSize: '0.8rem', whiteSpace: 'nowrap',
                      }}
                    >
                      ✅ AP en {rel.polizas_ap_activas.length === 1
                        ? rel.polizas_ap_activas[0].aseguradora ?? 'aseguradora'
                        : `${rel.polizas_ap_activas.length} pólizas`}
                    </span>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => desvincular(rel)}
                      style={{
                        background: 'transparent', color: '#c4392a',
                        border: '1px solid #c4392a', padding: '0.3rem 0.6rem',
                        borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                      }}
                    >
                      Desvincular
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <VincularChoferModal
          apiBaseUrl={apiBaseUrl}
          titularPersonaId={titularPersonaId}
          choferesYaVinculadosIds={(choferes ?? []).map((c) => c.persona?.id).filter((id): id is number => id != null)}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchChoferes(); }}
        />
      )}

      {showCrear && (
        <CrearChoferModal
          apiBaseUrl={apiBaseUrl}
          titularPersonaId={titularPersonaId}
          titularDefaults={titularDefaults}
          onClose={() => setShowCrear(false)}
          onCreated={() => { setShowCrear(false); fetchChoferes(); }}
        />
      )}
    </section>
  );
};

// ─── Modal "Vincular chofer existente" ───────────────────────────────────────

type ModalProps = {
  apiBaseUrl: string;
  titularPersonaId: number;
  choferesYaVinculadosIds: number[];
  onClose: () => void;
  onAdded: () => void;
};

type PersonaCandidato = DistribuidorEnriquecido & { perfil?: string | null };

const VincularChoferModal: React.FC<ModalProps> = ({
  apiBaseUrl, titularPersonaId, choferesYaVinculadosIds, onClose, onAdded,
}) => {
  const [search, setSearch] = useState('');
  const [candidatos, setCandidatos] = useState<PersonaCandidato[] | null>(null);
  const [seleccionada, setSeleccionada] = useState<PersonaCandidato | null>(null);
  const [rol, setRol] = useState<'chofer' | 'reemplazo' | 'familiar'>('chofer');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda contra el endpoint de personas-disponibles-para-alta de la
  // primera póliza AP del sistema. Como ese endpoint no existe sin póliza,
  // usamos /api/personal con search libre client-side. Para volumen actual
  // (~700 personas) anda OK; cuando crezca, conviene un endpoint dedicado.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resp = await fetch(`${apiBaseUrl}/api/personal?includePending=1`, { cache: 'no-store' });
      if (!resp.ok || cancelled) return;
      const { data } = (await resp.json()) as { data: Array<{
        id: number; nombre: string | null; cuil: string | null; patente: string | null;
        estado: string | null; perfil: string | null;
        esSolicitud: boolean; aprobado: boolean; fechaBaja: string | null;
      }> };
      const candidatos = (data ?? [])
        .filter((p) => p.id !== titularPersonaId)
        .filter((p) => !choferesYaVinculadosIds.includes(p.id))
        .map((p) => ({
          id: p.id,
          nombre_completo: p.nombre ?? '—',
          cuil: p.cuil,
          patente: p.patente,
          estado_actual: estadoPersonaSnapshotFromRaw(p),
          es_solicitud: p.esSolicitud,
          aprobado: p.aprobado,
          fecha_baja: p.fechaBaja,
          perfil: p.perfil,
        } as PersonaCandidato));
      setCandidatos(candidatos);
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, titularPersonaId, choferesYaVinculadosIds]);

  const candidatosFiltrados = useMemo(() => {
    if (!candidatos) return null;
    const q = search.trim().toLowerCase();
    if (!q) return candidatos.slice(0, 50);
    const cuilDigits = q.replace(/\D/g, '');
    return candidatos.filter((p) => {
      const fields = [p.nombre_completo, p.cuil, p.patente].filter(Boolean) as string[];
      if (fields.some((s) => s.toLowerCase().includes(q))) return true;
      if (cuilDigits && (p.cuil ?? '').replace(/\D/g, '').includes(cuilDigits)) return true;
      return false;
    }).slice(0, 50);
  }, [candidatos, search]);

  const guardar = async () => {
    if (!seleccionada) return;
    setSaving(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/personal/${titularPersonaId}/choferes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chofer_persona_id: seleccionada.id,
          fecha_vinculacion: fecha,
          rol,
          notas: notas || null,
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `Error ${resp.status}`);
      }
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="dashboard-card" style={{ width: 'min(720px, 92vw)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Vincular chofer existente</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer' }}
          >×</button>
        </div>

        {!seleccionada ? (
          <>
            <div style={{ marginTop: '0.5rem', maxWidth: 500 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar persona por nombre, CUIL o patente…"
              />
            </div>
            <div style={{ marginTop: '0.5rem', maxHeight: 400, overflowY: 'auto', border: '1px solid #eef1f6', borderRadius: 8 }}>
              {candidatosFiltrados === null && <div style={{ padding: '0.75rem', color: '#888' }}>Cargando…</div>}
              {candidatosFiltrados !== null && candidatosFiltrados.length === 0 && (
                <div style={{ padding: '0.75rem', color: '#888' }}>No se encontraron personas.</div>
              )}
              {candidatosFiltrados !== null && candidatosFiltrados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSeleccionada(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.5rem 0.75rem', border: 0, borderBottom: '1px solid #eef1f6',
                    background: 'transparent', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><b>{p.nombre_completo}</b> · <code style={{ fontSize: '0.75rem' }}>{p.cuil ?? '—'}</code></span>
                    <EstadoDistribuidorBadge estado={p.estado_actual} />
                  </div>
                  {p.patente && <small style={{ color: '#888' }}>Patente {p.patente}</small>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f7f9fc', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>{seleccionada.nombre_completo}</div>
              <small style={{ color: '#666' }}>CUIL {seleccionada.cuil ?? '—'} · estado <EstadoDistribuidorBadge estado={seleccionada.estado_actual} /></small>
              <button
                type="button"
                onClick={() => setSeleccionada(null)}
                style={{ marginLeft: '0.5rem', background: 'transparent', border: 0, color: '#1d74f5', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Cambiar persona
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
              <label className="input-control">
                <span>Fecha vinculación</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              <label className="input-control">
                <span>Rol</span>
                <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)}>
                  <option value="chofer">Chofer</option>
                  <option value="reemplazo">Reemplazo</option>
                  <option value="familiar">Familiar</option>
                </select>
              </label>
            </div>
            <label className="input-control" style={{ display: 'block', marginTop: '0.5rem' }}>
              <span>Notas (opcional)</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
            </label>

            {error && (
              <div style={{ background: '#fee', color: '#900', padding: '0.5rem', borderRadius: 6, marginTop: '0.5rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={onClose} className="secondary-action secondary-action--ghost">Cancelar</button>
              <button
                type="button"
                onClick={guardar}
                disabled={saving}
                style={{
                  background: saving ? '#aaa' : '#0a8c3a', color: '#fff',
                  padding: '0.5rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Vincular'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function estadoPersonaSnapshotFromRaw(p: { esSolicitud: boolean; aprobado: boolean; fechaBaja: string | null; estado: string | null }): EstadoPersonaSnapshot {
  if (p.fechaBaja) return 'baja';
  const e = (p.estado ?? '').toLowerCase();
  if (e.includes('suspend')) return 'suspendido';
  if (p.esSolicitud) return 'solicitud_pendiente';
  if (!p.aprobado) return 'sin_aprobar';
  return 'activo';
}

// ─── Modal "Crear chofer nuevo" — atajo titular → POST persona → POST vincular ──

type CrearProps = {
  apiBaseUrl: string;
  titularPersonaId: number;
  titularDefaults: TitularDefaults | null;
  onClose: () => void;
  onCreated: () => void;
};

const CrearChoferModal: React.FC<CrearProps> = ({
  apiBaseUrl, titularPersonaId, titularDefaults, onClose, onCreated,
}) => {
  const [apellidos, setApellidos] = useState('');
  const [nombres, setNombres]     = useState('');
  const [cuil, setCuil]           = useState('');
  const [email, setEmail]         = useState('');
  const [telefono, setTelefono]   = useState('');
  const [rol, setRol]             = useState<'chofer' | 'reemplazo' | 'familiar'>('chofer');
  const [notas, setNotas]         = useState('');
  const [fecha, setFecha]         = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const guardar = async () => {
    if (!nombres.trim()) {
      setError('Ingresá al menos el nombre.');
      return;
    }
    setSaving(true); setError(null);
    try {
      // 1) Crear la persona como chofer (perfilValue=2). Hereda cliente / sucursal /
      //    agente del titular para que ya quede asignado al mismo grupo operativo.
      const personaPayload: Record<string, unknown> = {
        nombres: nombres.trim(),
        apellidos: apellidos.trim() || null,
        cuil: cuil.trim() || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        perfilValue: 2,                    // 2 = Chofer
        combustible: false,
        tarifaEspecial: false,
        clienteId:           titularDefaults?.clienteId ?? null,
        sucursalId:          titularDefaults?.sucursalId ?? null,
        agenteId:            titularDefaults?.agenteId ?? null,
        agenteResponsableId: titularDefaults?.agenteResponsableId ?? null,
      };

      const respPersona = await fetch(`${apiBaseUrl}/api/personal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(personaPayload),
      });
      if (!respPersona.ok) {
        const body = await respPersona.text();
        // Intentamos extraer el primer mensaje de validación, sino devolvemos el body crudo.
        let msg = body;
        try {
          const j = JSON.parse(body);
          if (j?.errors) {
            const firstField = Object.keys(j.errors)[0];
            msg = `${firstField}: ${j.errors[firstField][0]}`;
          } else if (j?.message) {
            msg = j.message;
          }
        } catch { /* noop */ }
        throw new Error(msg);
      }
      const personaJson = await respPersona.json();
      // El endpoint puede devolver `{data: {...}}` o el record directo (depende del shape).
      const choferId = (personaJson?.data?.id ?? personaJson?.id ?? personaJson?.personalRecord?.id) as number | undefined;
      if (!choferId) {
        throw new Error('La persona se creó pero no recibí el ID; recargá y vinculá manualmente.');
      }

      // 2) Vincular como chofer del titular.
      const respLink = await fetch(`${apiBaseUrl}/api/personal/${titularPersonaId}/choferes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          chofer_persona_id: choferId,
          fecha_vinculacion: fecha,
          rol,
          notas: notas || null,
        }),
      });
      if (!respLink.ok) {
        const t = await respLink.text();
        throw new Error('Persona creada pero falló la vinculación: ' + t);
      }

      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="dashboard-card" style={{ width: 'min(720px, 92vw)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Crear chofer nuevo</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer' }}
          >×</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.4rem' }}>
          Crea una persona nueva como chofer y la vincula automáticamente al titular.
          Los datos básicos (cliente / sucursal / agente) se heredan del titular —
          podés editarlos después en el perfil del chofer si hace falta.
        </p>

        {/* Heredados read-only */}
        {titularDefaults && (titularDefaults.cliente || titularDefaults.sucursal || titularDefaults.agente) && (
          <div style={{ background: '#f7f9fc', padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.85rem', marginTop: '0.5rem' }}>
            <b>Heredado del titular:</b>{' '}
            {titularDefaults.cliente && <span>cliente <i>{titularDefaults.cliente}</i> · </span>}
            {titularDefaults.sucursal && <span>sucursal <i>{titularDefaults.sucursal}</i> · </span>}
            {titularDefaults.agente && <span>agente <i>{titularDefaults.agente}</i></span>}
          </div>
        )}

        {/* Form mínimo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <label className="input-control">
            <span>Nombres *</span>
            <input type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} />
          </label>
          <label className="input-control">
            <span>Apellidos</span>
            <input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </label>
          <label className="input-control">
            <span>CUIL</span>
            <input type="text" value={cuil} onChange={(e) => setCuil(e.target.value)} placeholder="20-12345678-9" />
          </label>
          <label className="input-control">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="input-control">
            <span>Teléfono</span>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
        </div>

        {/* Datos del vínculo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <label className="input-control">
            <span>Fecha vinculación</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="input-control">
            <span>Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)}>
              <option value="chofer">Chofer</option>
              <option value="reemplazo">Reemplazo</option>
              <option value="familiar">Familiar</option>
            </select>
          </label>
        </div>
        <label className="input-control" style={{ display: 'block', marginTop: '0.5rem' }}>
          <span>Notas (opcional)</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
        </label>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '0.5rem', borderRadius: 6, marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} className="secondary-action secondary-action--ghost">Cancelar</button>
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !nombres.trim()}
            style={{
              background: saving || !nombres.trim() ? '#aaa' : '#0a8c3a', color: '#fff',
              padding: '0.5rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
            }}
          >
            {saving ? 'Creando…' : 'Crear y vincular'}
          </button>
        </div>
      </div>
    </div>
  );
};
