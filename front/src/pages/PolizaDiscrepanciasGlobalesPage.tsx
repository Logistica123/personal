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

type Tab = 'sin_persona' | 'sin_poliza' | 'sugerencias_fuzzy' | 'estado_inconsistente';

type SinPersona = {
  asegurado_id: number;
  identificador: string;
  identificador_tipo: string;
  nombre_apellido_pdf: string | null;
  marca_modelo_pdf: string | null;
  estado: string;
  antiguedad_dias: number | null;
  poliza: { id: number; nombre_descriptivo: string | null; aseguradora: string | null };
};

type SinPoliza = {
  persona_id: number;
  nombre: string;
  cuil: string | null;
  patente: string | null;
  perfil: string | null;
};

type SugerenciaFuzzy = {
  asegurado_id: number;
  identificador: string;
  nombre_apellido_pdf: string | null;
  sugerencia: { id: number; nombre: string; cuil: string | null; score: number } | null;
  poliza: { id: number; nombre_descriptivo: string | null; aseguradora: string | null };
};

type EstadoInconsistente = {
  asegurado_id: number;
  identificador: string;
  persona_id: number;
  persona_nombre: string;
  persona_cuil: string | null;
  persona_estado_al_matchear: string | null;
  alerta_estado: string | null;
  persona_fecha_baja: string | null;
  poliza: { id: number; nombre_descriptivo: string | null; aseguradora: string | null };
};

type Payload = {
  sin_persona: SinPersona[];
  sin_poliza: SinPoliza[];
  sugerencias_fuzzy: SugerenciaFuzzy[];
  estado_inconsistente: EstadoInconsistente[];
  totales?: { sin_persona: number; sin_poliza: number; sugerencias_fuzzy: number; estado_inconsistente: number };
  errores?: Array<{ categoria: string; mensaje: string }>;
};

// BUGFIX 03 #2 — título descriptivo cuando se llega desde un KPI específico.
// Sin `?tab=` queda el título genérico (vista desde tab "Discrepancias" del header).
const TITULOS: Record<Tab, { titulo: string; subtitulo: string }> = {
  sin_persona: {
    titulo: 'Asegurados sin persona en sistema',
    subtitulo: '"Fantasmas" — pagamos seguro de personas o vehículos no registrados en el maestro',
  },
  sin_poliza: {
    titulo: 'Personas activas sin póliza',
    subtitulo: 'Distribuidores activos sin alta en una póliza vigente',
  },
  sugerencias_fuzzy: {
    titulo: 'Match dudoso',
    subtitulo: 'Sugerencias fuzzy pendientes de revisión humana',
  },
  estado_inconsistente: {
    titulo: 'Estados inconsistentes',
    subtitulo: 'Persona en baja/suspendida con cobertura activa',
  },
};

/**
 * ADDENDUM 13 Parte C — Discrepancias consolidadas (todas las pólizas activas).
 *
 * Pantalla de drilldown desde el dashboard de KPIs. 4 pestañas:
 *  - sin_persona      → asegurados "fantasma" (sin match en maestro de personas)
 *  - sin_poliza       → personas activas sin cobertura vigente
 *  - sugerencias_fuzzy → matches >0.85 pendientes de confirmación humana
 *  - estado_inconsistente → personas en baja/suspendida con cobertura activa
 */
export const PolizaDiscrepanciasGlobalesPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  // BUGFIX 03 #2 — distinguir "vino de un KPI" (con query param) vs "vino del header" (sin query).
  const llegoDesdeKpi = !!tabFromUrl && tabFromUrl in TITULOS;
  const initialTab: Tab = llegoDesdeKpi ? (tabFromUrl as Tab) : 'sin_persona';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/discrepancias-globales`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data: payload } = await resp.json();
      setData(payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cambiarTab = (t: Tab): void => {
    setTab(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  const tabsCfg: Array<{ key: Tab; label: string; count: number; tone: string }> = [
    { key: 'sin_persona',           label: 'Sin persona',          count: data?.sin_persona.length ?? 0,           tone: 'red' },
    { key: 'sin_poliza',            label: 'Sin póliza',           count: data?.sin_poliza.length ?? 0,            tone: 'amber' },
    { key: 'sugerencias_fuzzy',     label: 'Sugerencias fuzzy',    count: data?.sugerencias_fuzzy.length ?? 0,     tone: 'amber' },
    { key: 'estado_inconsistente',  label: 'Estado inconsistente', count: data?.estado_inconsistente.length ?? 0,  tone: 'red' },
  ];

  // Título dinámico: si llegó desde un KPI (con `?tab=`) usa el específico,
  // sino mantiene el genérico (vista desde tab "Discrepancias" del header).
  const titulo = llegoDesdeKpi ? TITULOS[tab].titulo : 'Discrepancias globales';
  const subtitulo = llegoDesdeKpi
    ? TITULOS[tab].subtitulo
    : 'Auditoría consolidada de todas las pólizas activas';

  return (
    <DashboardLayout title={titulo} subtitle={subtitulo}>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/polizas" className="text-sm text-indigo-600 hover:underline">← Volver al dashboard</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* BUGFIX 03 — el endpoint devuelve `errores[]` con detalle si alguna categoría falló (ej. migración no aplicada). */}
      {data?.errores && data.errores.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold mb-1">Resultado parcial — algunas categorías fallaron:</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {data.errores.map((e, i) => (
              <li key={i}><strong>{e.categoria}:</strong> {e.mensaje}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-b border-slate-200 mb-4">
        <nav className="-mb-px flex gap-4 flex-wrap">
          {tabsCfg.map((t) => (
            <button
              key={t.key}
              onClick={() => cambiarTab(t.key)}
              className={`whitespace-nowrap py-2 px-3 border-b-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {t.label}{' '}
              <span className={`ml-1 inline-block min-w-[1.5rem] text-center px-1.5 py-0.5 rounded text-xs tabular-nums ${
                t.count === 0 ? 'bg-slate-100 text-slate-500' :
                t.tone === 'red' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-800'
              }`}>{t.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando…</div>
      ) : !data ? null : (
        <>
          {tab === 'sin_persona' && <TablaSinPersona rows={data.sin_persona} />}
          {tab === 'sin_poliza' && <TablaSinPoliza rows={data.sin_poliza} />}
          {tab === 'sugerencias_fuzzy' && <TablaSugerenciasFuzzy rows={data.sugerencias_fuzzy} />}
          {tab === 'estado_inconsistente' && <TablaEstadoInconsistente rows={data.estado_inconsistente} />}
        </>
      )}
    </DashboardLayout>
  );
};

const TablaSinPersona: React.FC<{ rows: SinPersona[] }> = ({ rows }) => {
  if (rows.length === 0) return <Vacio msg="No hay asegurados sin persona." />;
  return (
    <Tabla
      headers={['Identificador', 'Tipo', 'Nombre/Modelo', 'Estado', 'Antigüedad', 'Póliza', 'Aseguradora', '']}
      body={rows.map((r) => (
        <tr key={r.asegurado_id}>
          <td className="px-3 py-2 tabular-nums">{r.identificador}</td>
          <td className="px-3 py-2 capitalize">{r.identificador_tipo}</td>
          <td className="px-3 py-2">{r.nombre_apellido_pdf ?? r.marca_modelo_pdf ?? '—'}</td>
          <td className="px-3 py-2"><Badge>{r.estado}</Badge></td>
          <td className="px-3 py-2 tabular-nums text-right">{r.antiguedad_dias !== null ? `${r.antiguedad_dias}d` : '—'}</td>
          <td className="px-3 py-2">{r.poliza.nombre_descriptivo ?? '—'}</td>
          <td className="px-3 py-2">{r.poliza.aseguradora ?? '—'}</td>
          <td className="px-3 py-2 text-right">
            <Link to={`/polizas/${r.poliza.id}`} className="text-xs text-indigo-600 hover:underline">Abrir</Link>
          </td>
        </tr>
      ))}
    />
  );
};

const TablaSinPoliza: React.FC<{ rows: SinPoliza[] }> = ({ rows }) => {
  if (rows.length === 0) return <Vacio msg="No hay personas activas sin cobertura." />;
  return (
    <Tabla
      headers={['Nombre', 'CUIL', 'Patente', 'Perfil', '']}
      body={rows.map((r) => (
        <tr key={r.persona_id}>
          <td className="px-3 py-2">{r.nombre}</td>
          <td className="px-3 py-2 tabular-nums">{r.cuil ?? '—'}</td>
          <td className="px-3 py-2 tabular-nums">{r.patente ?? '—'}</td>
          <td className="px-3 py-2 capitalize">{r.perfil ?? '—'}</td>
          <td className="px-3 py-2 text-right">
            <Link to={`/personal/${r.persona_id}`} className="text-xs text-indigo-600 hover:underline">Ver persona</Link>
          </td>
        </tr>
      ))}
    />
  );
};

const TablaSugerenciasFuzzy: React.FC<{ rows: SugerenciaFuzzy[] }> = ({ rows }) => {
  if (rows.length === 0) return <Vacio msg="No hay sugerencias fuzzy pendientes." />;
  return (
    <Tabla
      headers={['Identificador', 'Nombre PDF', 'Sugerencia', 'Score', 'Póliza', '']}
      body={rows.map((r) => (
        <tr key={r.asegurado_id}>
          <td className="px-3 py-2 tabular-nums">{r.identificador}</td>
          <td className="px-3 py-2">{r.nombre_apellido_pdf ?? '—'}</td>
          <td className="px-3 py-2">
            {r.sugerencia ? (
              <>
                <div>{r.sugerencia.nombre}</div>
                {r.sugerencia.cuil && <div className="text-xs text-slate-500 tabular-nums">{r.sugerencia.cuil}</div>}
              </>
            ) : '—'}
          </td>
          <td className="px-3 py-2 tabular-nums text-right">
            {r.sugerencia ? <Score v={r.sugerencia.score} /> : '—'}
          </td>
          <td className="px-3 py-2">
            {r.poliza.nombre_descriptivo ?? '—'}
            {r.poliza.aseguradora && <div className="text-xs text-slate-500">{r.poliza.aseguradora}</div>}
          </td>
          <td className="px-3 py-2 text-right">
            <Link to={`/polizas/${r.poliza.id}`} className="text-xs text-indigo-600 hover:underline">Resolver</Link>
          </td>
        </tr>
      ))}
    />
  );
};

const TablaEstadoInconsistente: React.FC<{ rows: EstadoInconsistente[] }> = ({ rows }) => {
  if (rows.length === 0) return <Vacio msg="No hay estados inconsistentes." />;
  return (
    <Tabla
      headers={['Persona', 'CUIL', 'Estado en alerta', 'Fecha baja', 'Póliza', 'Aseguradora', '']}
      body={rows.map((r) => (
        <tr key={r.asegurado_id}>
          <td className="px-3 py-2">
            <Link to={`/personal/${r.persona_id}`} className="text-indigo-600 hover:underline">{r.persona_nombre}</Link>
          </td>
          <td className="px-3 py-2 tabular-nums">{r.persona_cuil ?? '—'}</td>
          <td className="px-3 py-2"><Badge tone="red">{r.alerta_estado ?? '—'}</Badge></td>
          <td className="px-3 py-2">{r.persona_fecha_baja ?? '—'}</td>
          <td className="px-3 py-2">{r.poliza.nombre_descriptivo ?? '—'}</td>
          <td className="px-3 py-2">{r.poliza.aseguradora ?? '—'}</td>
          <td className="px-3 py-2 text-right">
            <Link to={`/polizas/${r.poliza.id}`} className="text-xs text-indigo-600 hover:underline">Abrir</Link>
          </td>
        </tr>
      ))}
    />
  );
};

const Tabla: React.FC<{ headers: string[]; body: React.ReactNode }> = ({ headers, body }) => (
  <div className="overflow-x-auto rounded-md border border-slate-200">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-600">
        <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{body}</tbody>
    </table>
  </div>
);

const Vacio: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">✓ {msg}</div>
);

const Badge: React.FC<{ tone?: 'red' | 'amber' | 'slate'; children: React.ReactNode }> = ({ tone = 'slate', children }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs ${
    tone === 'red' ? 'bg-red-100 text-red-700' :
    tone === 'amber' ? 'bg-amber-100 text-amber-800' :
    'bg-slate-100 text-slate-700'
  }`}>{children}</span>
);

const Score: React.FC<{ v: number }> = ({ v }) => {
  const pct = Math.round(v * 100);
  const tone = v >= 0.95 ? 'text-green-700' : v >= 0.9 ? 'text-amber-700' : 'text-slate-600';
  return <span className={tone}>{pct}%</span>;
};
