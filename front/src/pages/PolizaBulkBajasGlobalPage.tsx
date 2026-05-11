import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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

type AseguradoMatch = {
  asegurado_id: number;
  poliza_id: number;
  poliza_nombre: string | null;
  aseguradora_nombre: string | null;
  identificador: string;
  identificador_tipo: string;
  estado: string;
  persona_id: number | null;
  nombre: string;
  cuil: string | null;
  sin_match_persona: boolean;
};

type GrupoPoliza = {
  poliza_id: number;
  poliza_nombre: string | null;
  numero_poliza: string | null;
  aseguradora_id: number | null;
  aseguradora_nombre: string | null;
  ramo: string | null;
  tipo_asegurado: string | null;
  cantidad: number;
  asegurados: AseguradoMatch[];
};

type Busqueda = {
  identificadores_input: string[];
  encontrados_por_linea: Array<{ linea_input: string; matches: AseguradoMatch[] }>;
  no_encontrados: Array<{ linea_input: string; razon: string }>;
  agrupacion_por_poliza: GrupoPoliza[];
  totales: {
    identificadores: number;
    encontrados: number;
    no_encontrados: number;
    polizas_afectadas: number;
    aseguradoras: number;
  };
};

type PreviewItem = {
  solicitud_id: number;
  poliza_id: number;
  poliza_nombre: string | null;
  aseguradora_nombre: string | null;
  preview?: {
    asunto: string;
    body: string;
    destinatarios_to: string[];
    destinatarios_cc: string[];
    asegurados_count: number;
    remitente: { modo: string; email: string; desc: string };
  };
  preview_error?: string;
};

type ResultadoEnvio = {
  bulk_id: number;
  enviados: number;
  fallidos: number;
  resultados: Array<{
    solicitud_id: number;
    poliza_id: number;
    ok: boolean;
    message_id?: string | null;
    enviado_en?: string | null;
    error?: string;
  }>;
};

type Paso = 1 | 2 | 3 | 4;

/**
 * ADDENDUM 14 Parte C — Wizard de bulk de bajas global.
 *
 * Paso 1: pegar lista de identificadores → POST /buscar
 * Paso 2: review agrupado por persona/aseguradora → confirmar selección
 * Paso 3: preview de los N correos en tabs → confirmar
 * Paso 4: envío secuencial + resumen final
 */
export const PolizaBulkBajasGlobalPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const navigate = useNavigate();
  const [paso, setPaso] = useState<Paso>(1);
  const [textoLista, setTextoLista] = useState('');
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [bulkId, setBulkId] = useState<number | null>(null);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [tabPreview, setTabPreview] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    const lineas = textoLista.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) {
      setError('Pegá al menos una línea con CUIL/DNI/patente.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bulk-bajas-global/buscar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = await resp.json();
      setBusqueda(data);
      // Pre-seleccionar TODOS los encontrados.
      const ids = new Set<number>();
      data.agrupacion_por_poliza.forEach((g: GrupoPoliza) =>
        g.asegurados.forEach((a) => ids.add(a.asegurado_id)));
      setSeleccionados(ids);
      setPaso(2);
    } catch (e) {
      setError(`Búsqueda falló: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, textoLista]);

  const toggleAsegurado = (id: number): void => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePoliza = (g: GrupoPoliza, marcar: boolean): void => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      g.asegurados.forEach((a) => {
        if (marcar) next.add(a.asegurado_id); else next.delete(a.asegurado_id);
      });
      return next;
    });
  };

  const seleccionPorPoliza = useMemo((): Record<number, number[]> => {
    const out: Record<number, number[]> = {};
    busqueda?.agrupacion_por_poliza.forEach((g) => {
      const ids = g.asegurados.filter((a) => seleccionados.has(a.asegurado_id)).map((a) => a.asegurado_id);
      if (ids.length > 0) out[g.poliza_id] = ids;
    });
    return out;
  }, [busqueda, seleccionados]);

  const totalSeleccionados = Object.values(seleccionPorPoliza).reduce((a, b) => a + b.length, 0);
  const polizasSeleccionadas = Object.keys(seleccionPorPoliza).length;

  const irAPaso3 = useCallback(async () => {
    if (!busqueda || totalSeleccionados === 0) return;
    setLoading(true);
    setError(null);
    try {
      const respCrear = await fetch(`${apiBaseUrl}/api/polizas/bulk-bajas-global/crear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_raw: textoLista,
          seleccion: seleccionPorPoliza,
          totales_busqueda: busqueda.totales,
        }),
      });
      if (!respCrear.ok) throw new Error(await respCrear.text());
      const { data: crearData } = await respCrear.json();
      setBulkId(crearData.bulk_id);

      const respPrev = await fetch(`${apiBaseUrl}/api/polizas/bulk-bajas-global/${crearData.bulk_id}/preview`, { cache: 'no-store' });
      if (!respPrev.ok) throw new Error(await respPrev.text());
      const { data: prevData } = await respPrev.json();
      setPreviews(prevData ?? []);
      if (prevData?.[0]) setTabPreview(prevData[0].solicitud_id);
      setPaso(3);
    } catch (e) {
      setError(`Preview falló: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, busqueda, seleccionPorPoliza, textoLista, totalSeleccionados]);

  const ejecutar = useCallback(async () => {
    if (!bulkId) return;
    if (!window.confirm(`¿Enviar ${previews.length} correos a las aseguradoras? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bulk-bajas-global/${bulkId}/ejecutar`, { method: 'POST' });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = await resp.json();
      setResultado(data);
      setPaso(4);
    } catch (e) {
      setError(`Envío falló: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, bulkId, previews.length]);

  return (
    <DashboardLayout title="Baja masiva global" subtitle="Solicitar bajas en múltiples pólizas en una sola operación">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/polizas" className="text-sm text-indigo-600 hover:underline">← Volver al dashboard</Link>
      </div>

      <Stepper paso={paso} />

      {error && (
        <div className="my-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 whitespace-pre-wrap">{error}</div>
      )}

      {paso === 1 && (
        <Paso1 textoLista={textoLista} setTextoLista={setTextoLista} buscar={buscar} loading={loading} />
      )}

      {paso === 2 && busqueda && (
        <Paso2
          busqueda={busqueda}
          seleccionados={seleccionados}
          toggleAsegurado={toggleAsegurado}
          togglePoliza={togglePoliza}
          totalSeleccionados={totalSeleccionados}
          polizasSeleccionadas={polizasSeleccionadas}
          onContinuar={irAPaso3}
          onVolver={() => setPaso(1)}
          loading={loading}
        />
      )}

      {paso === 3 && (
        <Paso3
          previews={previews}
          tabPreview={tabPreview}
          setTabPreview={setTabPreview}
          onVolver={() => setPaso(2)}
          onEjecutar={ejecutar}
          loading={loading}
        />
      )}

      {paso === 4 && resultado && (
        <Paso4
          resultado={resultado}
          busqueda={busqueda}
          onVerBulk={() => navigate(`/polizas/solicitudes?bulk_id=${resultado.bulk_id}`)}
          onNuevo={() => {
            setPaso(1); setTextoLista(''); setBusqueda(null); setSeleccionados(new Set());
            setBulkId(null); setPreviews([]); setResultado(null); setError(null);
          }}
        />
      )}
    </DashboardLayout>
  );
};

const Stepper: React.FC<{ paso: Paso }> = ({ paso }) => {
  const pasos: Array<{ n: Paso; label: string }> = [
    { n: 1, label: 'Pegar lista' },
    { n: 2, label: 'Revisar matches' },
    { n: 3, label: 'Preview correos' },
    { n: 4, label: 'Resultado' },
  ];
  return (
    <ol className="flex items-center gap-1 text-sm mb-2">
      {pasos.map((p, i) => (
        <React.Fragment key={p.n}>
          <li className={`flex items-center gap-1.5 px-2 py-1 rounded ${
            paso === p.n ? 'bg-indigo-600 text-white' :
            paso > p.n ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
            <span className="font-semibold">{paso > p.n ? '✓' : p.n}</span>
            <span>{p.label}</span>
          </li>
          {i < pasos.length - 1 && <li className="text-slate-300">→</li>}
        </React.Fragment>
      ))}
    </ol>
  );
};

const Paso1: React.FC<{
  textoLista: string;
  setTextoLista: (s: string) => void;
  buscar: () => void;
  loading: boolean;
}> = ({ textoLista, setTextoLista, buscar, loading }) => (
  <div className="rounded-md border border-slate-200 bg-white p-4">
    <div className="text-sm text-slate-700 mb-3">
      Pegá una lista de CUILs y/o patentes. El sistema va a:
      <ol className="list-decimal pl-5 mt-1 text-slate-600 space-y-0.5">
        <li>Buscar todas las pólizas activas donde figuran (AP + Vehículos)</li>
        <li>Agrupar las bajas por aseguradora</li>
        <li>Generar los correos correspondientes a cada aseguradora</li>
        <li>Enviar todo secuencialmente</li>
      </ol>
    </div>
    <label className="block text-xs text-slate-500 mb-1">Identificadores (uno por línea — CUIL/DNI/patente, mezcla aceptada)</label>
    <textarea
      value={textoLista}
      onChange={(e) => setTextoLista(e.target.value)}
      rows={10}
      placeholder={"20-31675826-7\n27-26787470-6\n18475503\nIWK373\nAA788ZU"}
      className="w-full font-mono text-sm rounded border-slate-300"
    />
    <div className="mt-3 flex justify-end">
      <button onClick={buscar} disabled={loading || !textoLista.trim()}
        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
        {loading ? 'Buscando…' : 'Buscar coincidencias ▶'}
      </button>
    </div>
  </div>
);

const Paso2: React.FC<{
  busqueda: Busqueda;
  seleccionados: Set<number>;
  toggleAsegurado: (id: number) => void;
  togglePoliza: (g: GrupoPoliza, marcar: boolean) => void;
  totalSeleccionados: number;
  polizasSeleccionadas: number;
  onContinuar: () => void;
  onVolver: () => void;
  loading: boolean;
}> = ({ busqueda, seleccionados, toggleAsegurado, togglePoliza, totalSeleccionados, polizasSeleccionadas, onContinuar, onVolver, loading }) => {
  const { totales, agrupacion_por_poliza, no_encontrados } = busqueda;
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-3 text-sm grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Identificadores" valor={totales.identificadores} />
        <Stat label="Encontrados" valor={totales.encontrados} tone="green" />
        <Stat label="No encontrados" valor={totales.no_encontrados} tone="red" />
        <Stat label="Pólizas afectadas" valor={totales.polizas_afectadas} />
        <Stat label="Aseguradoras" valor={totales.aseguradoras} />
      </div>

      {no_encontrados.length > 0 && (
        <details className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-amber-900">❌ No encontrados ({no_encontrados.length})</summary>
          <ul className="mt-2 list-disc pl-5 text-amber-900">
            {no_encontrados.map((n, i) => (
              <li key={i}><code>{n.linea_input}</code> — {n.razon}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="text-sm font-semibold">Agrupación por póliza/aseguradora ({agrupacion_por_poliza.length})</div>
      <div className="space-y-3">
        {agrupacion_por_poliza.map((g) => {
          const idsGrupo = g.asegurados.map((a) => a.asegurado_id);
          const todosSeleccionados = idsGrupo.every((id) => seleccionados.has(id));
          const algunoSel = idsGrupo.some((id) => seleccionados.has(id));
          return (
            <div key={g.poliza_id} className="rounded-md border border-slate-200 bg-white p-3">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  ref={(el) => { if (el) el.indeterminate = !todosSeleccionados && algunoSel; }}
                  onChange={(e) => togglePoliza(g, e.target.checked)}
                />
                <span className="font-semibold text-sm">📧 {g.aseguradora_nombre} — {g.poliza_nombre}</span>
                <span className="text-xs text-slate-500">({g.cantidad} {g.cantidad === 1 ? 'baja' : 'bajas'})</span>
              </label>
              <ul className="space-y-1 pl-7 text-sm">
                {g.asegurados.map((a) => (
                  <li key={a.asegurado_id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(a.asegurado_id)}
                      onChange={() => toggleAsegurado(a.asegurado_id)}
                    />
                    <span>{a.nombre}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{a.cuil ?? a.identificador}</span>
                    {a.sin_match_persona && (
                      <span className="text-xs bg-amber-100 text-amber-800 rounded px-1.5">⚠ sin match en personas</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <strong>{totalSeleccionados}</strong> bajas seleccionadas en <strong>{polizasSeleccionadas}</strong> pólizas
        </div>
        <div className="flex gap-2">
          <button onClick={onVolver}
            className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
            ← Volver
          </button>
          <button onClick={onContinuar} disabled={loading || totalSeleccionados === 0}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Generando preview…' : 'Ver preview de correos ▶'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Paso3: React.FC<{
  previews: PreviewItem[];
  tabPreview: number | null;
  setTabPreview: (id: number) => void;
  onVolver: () => void;
  onEjecutar: () => void;
  loading: boolean;
}> = ({ previews, tabPreview, setTabPreview, onVolver, onEjecutar, loading }) => {
  const activo = previews.find((p) => p.solicitud_id === tabPreview) ?? previews[0];
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Preview de los {previews.length} correos a enviar</div>
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-2 flex-wrap">
          {previews.map((p) => (
            <button
              key={p.solicitud_id}
              onClick={() => setTabPreview(p.solicitud_id)}
              className={`whitespace-nowrap py-2 px-3 border-b-2 text-sm transition ${
                activo?.solicitud_id === p.solicitud_id
                  ? 'border-indigo-600 text-indigo-600 font-medium'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.aseguradora_nombre ?? '—'} <span className="text-xs text-slate-400">· {p.poliza_nombre}</span>
              {p.preview_error && <span className="ml-1 text-red-600">⚠</span>}
            </button>
          ))}
        </nav>
      </div>

      {activo && (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm space-y-3">
          {activo.preview_error ? (
            <div className="text-red-700">Error: {activo.preview_error}</div>
          ) : activo.preview && (
            <>
              <div className="text-xs text-slate-500">
                <strong>Saldrá desde:</strong> {activo.preview.remitente.email}
                <div className="italic">{activo.preview.remitente.desc}</div>
              </div>
              <div><strong>Para:</strong> {activo.preview.destinatarios_to.join(', ') || '—'}</div>
              {activo.preview.destinatarios_cc.length > 0 && (
                <div><strong>CC:</strong> {activo.preview.destinatarios_cc.join(', ')}</div>
              )}
              <div><strong>Asunto:</strong> {activo.preview.asunto}</div>
              <div className="text-xs text-slate-500">Asegurados incluidos: {activo.preview.asegurados_count}</div>
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-500 mb-1">Cuerpo:</div>
                <pre className="bg-slate-50 rounded p-3 text-xs whitespace-pre-wrap font-mono">{activo.preview.body}</pre>
              </div>
            </>
          )}
        </div>
      )}

      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">⚠ Al continuar se envían los {previews.length} correos. No se puede deshacer.</div>
        <div className="flex gap-2">
          <button onClick={onVolver}
            className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
            ← Volver a selección
          </button>
          <button onClick={onEjecutar} disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Enviando…' : `▶ Enviar todo (${previews.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

const Paso4: React.FC<{
  resultado: ResultadoEnvio;
  busqueda: Busqueda | null;
  onVerBulk: () => void;
  onNuevo: () => void;
}> = ({ resultado, busqueda, onVerBulk, onNuevo }) => (
  <div className="space-y-4">
    <div className={`rounded-md border p-4 ${
      resultado.fallidos === 0 ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'
    }`}>
      <div className="text-base font-semibold mb-2">
        {resultado.fallidos === 0 ? '✅ Bulk completado' : '⚠ Bulk con errores'}
      </div>
      <div className="text-sm space-y-1">
        <div>✓ <strong>{resultado.enviados}</strong> correos enviados</div>
        {resultado.fallidos > 0 && <div>✗ <strong>{resultado.fallidos}</strong> correos fallidos</div>}
        {busqueda && <div className="text-slate-600">Grupo de bulk: <strong>#{resultado.bulk_id}</strong> · {busqueda.totales.no_encontrados} identificadores no encontrados</div>}
      </div>
    </div>

    <div className="rounded-md border border-slate-200 bg-white">
      <div className="px-3 py-2 text-xs font-semibold uppercase text-slate-600 border-b">Detalle por solicitud</div>
      <ul className="divide-y divide-slate-100">
        {resultado.resultados.map((r) => (
          <li key={r.solicitud_id} className="px-3 py-2 text-sm flex items-center gap-2">
            <span>{r.ok ? '✓' : '✗'}</span>
            <span className="flex-1">Solicitud #{r.solicitud_id} (póliza #{r.poliza_id})</span>
            {r.ok ? (
              <span className="text-xs text-slate-500">{r.enviado_en ? new Date(r.enviado_en).toLocaleTimeString('es-AR') : ''}</span>
            ) : (
              <span className="text-xs text-red-700 max-w-md truncate" title={r.error ?? ''}>{r.error}</span>
            )}
          </li>
        ))}
      </ul>
    </div>

    <div className="flex gap-2">
      <button onClick={onVerBulk}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
        Ver solicitudes generadas →
      </button>
      <button onClick={onNuevo}
        className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
        Nuevo bulk
      </button>
    </div>
  </div>
);

const Stat: React.FC<{ label: string; valor: number; tone?: 'green' | 'red' | 'slate' }> = ({ label, valor, tone = 'slate' }) => (
  <div>
    <div className="text-xs uppercase text-slate-500">{label}</div>
    <div className={`text-xl font-semibold tabular-nums ${
      tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-700' : 'text-slate-800'
    }`}>{valor}</div>
  </div>
);
