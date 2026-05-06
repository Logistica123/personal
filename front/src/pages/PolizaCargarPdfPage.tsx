import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  CargaPreview,
  Poliza,
} from '../features/polizas/types';
import { SearchInput } from '../features/polizas/SearchInput';

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

// BUGFIX 02 Issue 2 — `eliminado` es una 4ta decisión: la fila queda en el
// preview pero no se envía al backend al confirmar.
type Decision = 'vincular' | 'crear' | 'ignorar' | 'eliminado';

// Filtro por estado del match — categoriza filas según qué ofrece el matching.
type FiltroEstadoMatch = '' | 'exacto' | 'sin_match' | 'con_sugerencia';
type FiltroDecision = '' | Decision;

type FilaDecision = {
  decision: Decision;
  persona_id?: number;
  persona_id_default?: number;
  match_score?: number;
  match_metodo?: 'cuil_exacto' | 'dni_exacto' | 'patente_exacto' | 'manual';
  revision_manual_pendiente?: boolean;
  // sugerencia fuzzy: se preserva incluso si el admin ignora la sugerencia.
  sugerencia_fuzzy_persona_id?: number;
  sugerencia_fuzzy_score?: number;
};

export const PolizaCargarPdfPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CargaPreview | null>(null);
  const [decisiones, setDecisiones] = useState<Record<number, FilaDecision>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultadoConfirmacion, setResultadoConfirmacion] = useState<{
    endoso_id: number | null;
    asegurados_creados: number;
    asegurados_actualizados: number;
    ignorados: number;
  } | null>(null);

  // ---- Cargar póliza para mostrar contexto ----
  useEffect(() => {
    if (!polizaId) return;
    fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data }) => setPoliza(data))
      .catch(() => setError('No se pudo cargar la póliza'));
  }, [polizaId, apiBaseUrl]);

  // ---- Subir PDF al backend → preview ----
  const subirPdf = useCallback(async () => {
    if (!file || !polizaId) return;
    try {
      setLoading(true);
      setError(null);
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/cargar-pdf`, {
        method: 'POST',
        body: form,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Error ${resp.status}: ${text}`);
      }
      const { data } = (await resp.json()) as { data: CargaPreview };
      setPreview(data);
      // Inicializar decisiones por defecto. Las filas con sugerencia fuzzy NO
      // se autovinculan — quedan en 'crear' (BUGFIX 02 Issue 1) y la sugerencia
      // se persiste en el state para que el admin pueda confirmarla manualmente.
      const inicial: Record<number, FilaDecision> = {};
      data.asegurados.forEach((a, i) => {
        const m = a.match_propuesto;
        const s = a.sugerencia_fuzzy;
        inicial[i] = {
          decision: m ? 'vincular' : 'crear',
          persona_id_default: m?.persona_id,
          persona_id: m?.persona_id,
          match_score: m?.score,
          match_metodo: m?.metodo,
          revision_manual_pendiente: m?.revision_manual_pendiente ?? Boolean(s),
          sugerencia_fuzzy_persona_id: s?.persona_id,
          sugerencia_fuzzy_score: s?.score,
        };
      });
      setDecisiones(inicial);
      setPaso(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [file, polizaId, apiBaseUrl]);

  // ---- Confirmar carga ----
  const confirmar = useCallback(async () => {
    if (!preview || !polizaId) return;
    try {
      setLoading(true);
      setError(null);
      // Filas marcadas como `eliminado` no se envían al backend.
      const filas = preview.asegurados
        .map((a, i) => ({ a, d: decisiones[i] }))
        .filter(({ d }) => d.decision !== 'eliminado');

      const payload = {
        endoso: preview.endoso,
        asegurados: filas.map(({ a, d }) => ({
          tipo: a.tipo,
          identificador: a.identificador,
          identificador_tipo: a.identificador_tipo,
          numero_orden_aseguradora: a.numero_orden_aseguradora ?? null,
          nombre_apellido: a.nombre_apellido ?? null,
          marca_modelo: a.marca_modelo ?? null,
          tipo_vehiculo: a.tipo_vehiculo ?? null,
          localidad: a.localidad ?? null,
          suma_asegurada: a.suma_asegurada ?? null,
          premio_individual: a.premio_individual ?? null,
          decision: d.decision,
          persona_id: d.decision === 'vincular' ? d.persona_id ?? null : null,
          match_score: d.match_score ?? null,
          match_metodo: d.match_metodo ?? null,
          revision_manual_pendiente: d.revision_manual_pendiente ?? false,
          // BUGFIX 02 Issue 1 — la sugerencia fuzzy se persiste aunque la decisión
          // sea "crear" o "ignorar"; sirve para auditoría y revisión posterior.
          sugerencia_fuzzy_persona_id: d.sugerencia_fuzzy_persona_id ?? null,
          sugerencia_fuzzy_score: d.sugerencia_fuzzy_score ?? null,
        })),
      };
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/confirmar-carga`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Error ${resp.status}: ${text}`);
      }
      const { data } = (await resp.json()) as { data: typeof resultadoConfirmacion };
      setResultadoConfirmacion(data);
      setPaso(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [preview, polizaId, decisiones, apiBaseUrl]);

  const totales = useMemo(() => {
    const t = { vincular: 0, crear: 0, ignorar: 0, eliminado: 0, dudosos: 0 };
    Object.values(decisiones).forEach((d) => {
      t[d.decision]++;
      if (d.revision_manual_pendiente && d.decision !== 'eliminado') t.dudosos++;
    });
    return t;
  }, [decisiones]);

  return (
    <DashboardLayout
      title={`Cargar PDF — ${poliza?.nombre_descriptivo ?? 'Póliza'}`}
      subtitle={poliza ? `${poliza.aseguradora?.nombre} · N° ${poliza.numero_poliza}` : ''}
      headerContent={
        <Link to={polizaId ? `/polizas/${polizaId}` : '/polizas'} className="secondary-action secondary-action--ghost">
          ← Volver
        </Link>
      }
    >
      <Stepper paso={paso} />

      {error && (
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12, margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {paso === 1 && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0 }}>Paso 1 — Subir PDF</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            Aceptamos PDFs de constancia de cobertura o endoso de las 3 aseguradoras
            (MAPFRE, San Cristóbal, La Segunda).
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ padding: '0.5rem 0' }}
          />
          {file && (
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              Seleccionado: <b>{file.name}</b> ({(file.size / 1024).toFixed(0)} KB)
            </div>
          )}
          <div>
            <button
              type="button"
              className="secondary-action"
              disabled={!file || loading}
              onClick={subirPdf}
              style={{ background: '#1d74f5', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer' }}
            >
              {loading ? 'Procesando…' : 'Parsear PDF'}
            </button>
          </div>
        </div>
      )}

      {paso === 2 && preview && (
        <PreviewMatching
          preview={preview}
          decisiones={decisiones}
          setDecisiones={setDecisiones}
          totales={totales}
          loading={loading}
          onConfirmar={confirmar}
          onVolver={() => setPaso(1)}
        />
      )}

      {paso === 3 && resultadoConfirmacion && (
        <div className="dashboard-card">
          <h3 style={{ margin: 0, color: '#0a8c3a' }}>✓ Carga confirmada</h3>
          <ul style={{ margin: 0, lineHeight: 1.8 }}>
            <li>Endoso creado: <code>#{resultadoConfirmacion.endoso_id ?? 'sin endoso'}</code></li>
            <li>Asegurados creados: <b>{resultadoConfirmacion.asegurados_creados}</b></li>
            <li>Asegurados actualizados: <b>{resultadoConfirmacion.asegurados_actualizados}</b></li>
            <li>Ignorados: {resultadoConfirmacion.ignorados}</li>
          </ul>
          <div>
            <button
              type="button"
              onClick={() => navigate(`/polizas/${polizaId}`)}
              className="secondary-action"
              style={{ background: '#1d74f5', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer' }}
            >
              Ver detalle de la póliza
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const Stepper: React.FC<{ paso: 1 | 2 | 3 }> = ({ paso }) => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '1rem 0' }}>
    {([1, 2, 3] as const).map((n) => (
      <React.Fragment key={n}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: paso >= n ? '#1d74f5' : '#e0e7f0',
          color: paso >= n ? '#fff' : '#666',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
        }}>{n}</div>
        <div style={{ fontSize: '0.85rem', color: paso >= n ? '#222' : '#888' }}>
          {n === 1 ? 'Subir PDF' : n === 2 ? 'Revisar matching' : 'Confirmado'}
        </div>
        {n < 3 && <div style={{ width: 30, height: 2, background: paso > n ? '#1d74f5' : '#e0e7f0' }} />}
      </React.Fragment>
    ))}
  </div>
);

type PreviewMatchingProps = {
  preview: CargaPreview;
  decisiones: Record<number, FilaDecision>;
  setDecisiones: React.Dispatch<React.SetStateAction<Record<number, FilaDecision>>>;
  totales: { vincular: number; crear: number; ignorar: number; eliminado: number; dudosos: number };
  loading: boolean;
  onConfirmar: () => void;
  onVolver: () => void;
};

const PreviewMatching: React.FC<PreviewMatchingProps> = ({
  preview, decisiones, setDecisiones, totales, loading, onConfirmar, onVolver,
}) => {
  const setDecision = (i: number, partial: Partial<FilaDecision>) => {
    setDecisiones((prev) => ({ ...prev, [i]: { ...prev[i], ...partial } }));
  };

  // BUGFIX 02 Issue 2 — filtros + buscador + selección múltiple.
  const [filterMatch, setFilterMatch] = useState<FiltroEstadoMatch>('');
  const [filterDecision, setFilterDecision] = useState<FiltroDecision>('');
  const [search, setSearch] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());

  const filaEstadoMatch = (i: number): FiltroEstadoMatch => {
    const a = preview.asegurados[i];
    if (a.match_propuesto) return 'exacto';
    if (a.sugerencia_fuzzy) return 'con_sugerencia';
    return 'sin_match';
  };

  const indicesVisibles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return preview.asegurados
      .map((_, i) => i)
      .filter((i) => {
        const a = preview.asegurados[i];
        const d = decisiones[i] ?? { decision: 'crear' };
        if (filterMatch && filaEstadoMatch(i) !== filterMatch) return false;
        if (filterDecision && d.decision !== filterDecision) return false;
        if (!needle) return true;
        return [
          a.identificador,
          a.nombre_apellido,
          a.marca_modelo,
          a.tipo_vehiculo,
          a.localidad,
        ].some((s) => (s ?? '').toLowerCase().includes(needle));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.asegurados, decisiones, filterMatch, filterDecision, search]);

  const todasSeleccionadasVisibles = indicesVisibles.length > 0
    && indicesVisibles.every((i) => seleccionadas.has(i));

  const toggleTodas = () => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (todasSeleccionadasVisibles) {
        indicesVisibles.forEach((i) => next.delete(i));
      } else {
        indicesVisibles.forEach((i) => next.add(i));
      }
      return next;
    });
  };

  const toggleFila = (i: number) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const aplicarMasiva = (decision: Decision) => {
    if (seleccionadas.size === 0) return;
    setDecisiones((prev) => {
      const next = { ...prev };
      seleccionadas.forEach((i) => {
        next[i] = { ...next[i], decision };
      });
      return next;
    });
  };

  return (
    <>
      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Paso 2 — Revisar matching</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <div><b>Aseguradora:</b> {preview.aseguradora_detectada ?? '?'}</div>
          <div><b>Tipo doc:</b> {preview.tipo_documento ?? '?'}</div>
          {preview.endoso?.numero_endoso && <div><b>Endoso:</b> {preview.endoso.numero_endoso}</div>}
          <div><b>Asegurados:</b> {preview.asegurados.length}</div>
        </div>
        {preview.warnings.length > 0 && (
          <div style={{ background: '#fff7d6', padding: '0.75rem', borderRadius: 8, fontSize: '0.85rem' }}>
            <b>⚠ Warnings:</b>
            <ul style={{ margin: '0.25rem 0' }}>
              {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <span>🔵 Vincular: <b>{totales.vincular}</b></span>
          <span>🟢 Crear nuevo: <b>{totales.crear}</b></span>
          <span>⚪ Ignorar: <b>{totales.ignorar}</b></span>
          <span>🗑 Eliminado: <b>{totales.eliminado}</b></span>
          {totales.dudosos > 0 && <span style={{ color: '#c70' }}>⚠ Dudosos: <b>{totales.dudosos}</b></span>}
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: '0.75rem' }}>
        <div className="filters-bar" style={{ alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label className="filter-field">
            <span>Estado match</span>
            <select value={filterMatch} onChange={(e) => setFilterMatch(e.target.value as FiltroEstadoMatch)}>
              <option value="">Todos</option>
              <option value="exacto">Exacto</option>
              <option value="sin_match">Sin match</option>
              <option value="con_sugerencia">Con sugerencia fuzzy</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Decisión</span>
            <select value={filterDecision} onChange={(e) => setFilterDecision(e.target.value as FiltroDecision)}>
              <option value="">Todas</option>
              <option value="vincular">Vincular</option>
              <option value="crear">Crear</option>
              <option value="ignorar">Ignorar</option>
              <option value="eliminado">Eliminado</option>
            </select>
          </label>
          <label className="filter-field" style={{ flex: '1 1 240px', minWidth: 220 }}>
            <span>Buscar</span>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="patente, CUIL, nombre, modelo…"
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
          <span>
            Mostrando <b>{indicesVisibles.length}</b> de {preview.asegurados.length}
            {seleccionadas.size > 0 && ` · ${seleccionadas.size} seleccionadas`}
          </span>
          {seleccionadas.size > 0 && (
            <>
              <span style={{ marginLeft: 'auto' }}>Aplicar a seleccionadas:</span>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => aplicarMasiva('vincular')}>
                Vincular
              </button>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => aplicarMasiva('crear')}>
                Crear
              </button>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => aplicarMasiva('ignorar')}>
                Ignorar
              </button>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => aplicarMasiva('eliminado')}>
                Eliminar
              </button>
              <button type="button" className="secondary-action secondary-action--ghost" onClick={() => setSeleccionadas(new Set())}>
                Limpiar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-card">
        <div className="table-wrapper">
          <table className="bdd-activos-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={todasSeleccionadasVisibles}
                    onChange={toggleTodas}
                    aria-label="Seleccionar todas las visibles"
                  />
                </th>
                <th>#</th>
                <th>Identificador</th>
                <th>Nombre / Vehículo</th>
                <th>Match / Sugerencia</th>
                <th>Decisión</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {indicesVisibles.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '1rem', color: '#888', textAlign: 'center' }}>
                  {search ? `No se encontraron resultados para "${search}".` : 'No hay filas que coincidan con los filtros.'}
                </td></tr>
              )}
              {indicesVisibles.map((i) => {
                const a = preview.asegurados[i];
                const d = decisiones[i] ?? { decision: 'crear' as Decision };
                const eliminado = d.decision === 'eliminado';
                const dudoso = (d.revision_manual_pendiente ?? false) && !eliminado;
                const filaStyle: React.CSSProperties | undefined = eliminado
                  ? { opacity: 0.45, textDecoration: 'line-through', background: '#f5f5f5' }
                  : dudoso
                    ? { background: '#fffbe6' }
                    : undefined;
                const sug = a.sugerencia_fuzzy;
                return (
                  <tr key={i} style={filaStyle}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(i)}
                        onChange={() => toggleFila(i)}
                        aria-label={`Seleccionar fila ${i + 1}`}
                      />
                    </td>
                    <td>{a.numero_orden_aseguradora ?? i + 1}</td>
                    <td>
                      <code>{a.identificador}</code>
                      <small style={{ color: '#888', display: 'block' }}>{a.identificador_tipo}</small>
                    </td>
                    <td>{a.nombre_apellido ?? a.marca_modelo ?? '—'}</td>
                    <td>
                      {a.match_propuesto ? (
                        <small>
                          <b>persona #{a.match_propuesto.persona_id}</b>
                          <br />método: {a.match_propuesto.metodo}
                        </small>
                      ) : sug ? (
                        <small style={{ color: '#c70' }}>
                          <b>sin match exacto</b>
                          <br />sugerencia: persona #{sug.persona_id}
                          {sug.persona && ` (${sug.persona.apellidos ?? ''} ${sug.persona.nombres ?? ''})`}
                          {' '}({sug.score.toFixed(2)})
                          <br />
                          <button
                            type="button"
                            onClick={() => setDecision(i, {
                              decision: 'vincular',
                              persona_id: sug.persona_id,
                              match_metodo: 'manual',
                              match_score: sug.score,
                              revision_manual_pendiente: false,
                            })}
                            style={{ marginTop: 4, padding: '0.15rem 0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Vincular sugerencia
                          </button>
                        </small>
                      ) : <span style={{ color: '#c00' }}>sin match</span>}
                    </td>
                    <td>
                      <select
                        value={d.decision}
                        onChange={(e) => setDecision(i, { decision: e.target.value as Decision })}
                      >
                        <option value="vincular" disabled={!d.persona_id}>
                          Vincular {d.persona_id ? `→ #${d.persona_id}` : '(falta persona_id)'}
                        </option>
                        <option value="crear">Crear sin persona</option>
                        <option value="ignorar">Ignorar</option>
                        <option value="eliminado">Eliminado</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        title="Quitar del preview"
                        aria-label="Eliminar fila"
                        onClick={() => setDecision(i, { decision: 'eliminado' })}
                        style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#c4392a', fontSize: '1.1rem' }}
                      >
                        ✗
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-action secondary-action--ghost" onClick={onVolver}>
            ← Volver
          </button>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            A persistir: <b>{totales.vincular + totales.crear}</b>
            {' · '}Ignorados: {totales.ignorar}
            {' · '}Eliminados: {totales.eliminado}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirmar}
            style={{ background: '#0a8c3a', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer', marginLeft: 'auto' }}
          >
            {loading ? 'Confirmando…' : `Confirmar carga (${totales.vincular + totales.crear})`}
          </button>
        </div>
      </div>
    </>
  );
};
