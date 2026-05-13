import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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

type Sugerencia = {
  ramo: 'accidentes_personales' | 'vehiculos';
  poliza_id: number;
  poliza_nombre: string | null;
  aseguradora_id: number | null;
  aseguradora_nombre: string | null;
  tipo_vehiculo?: string | null;
  patente?: string | null;
  clausula_id: number | null;
  importe_negociado_mensual: number | null;
  recomendada: boolean;
};

type Preparacion = {
  persona: { id: number; nombre: string; cuil: string | null; patente: string | null; aprobado: boolean };
  sugerencias: Sugerencia[];
  solicitud_polizas: Record<string, unknown>;
  choferes: Array<{ nombres: string; apellidos?: string | null; cuil?: string | null }>;
};

/**
 * ADDENDUM 15 Bloque 3.G — Wizard de alta múltiple precargado desde la
 * solicitud aprobada del CRM.
 *
 * Path: /polizas/solicitar-alta-multiple?persona_id=N
 */
export const PolizaSolicitarAltaMultiplePage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const personaId = Number(searchParams.get('persona_id'));

  const [prep, setPrep] = useState<Preparacion | null>(null);
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ solicitudes_creadas: Array<{ solicitud_id?: number; poliza_id: number; poliza_nombre?: string | null; ok?: boolean; error?: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(personaId) || personaId <= 0) {
      setError('Falta `persona_id` en la URL.');
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitar-alta-multiple/preparacion/${personaId}`, { cache: 'no-store' });
        if (!resp.ok) throw new Error(await resp.text());
        const { data } = await resp.json();
        if (cancel) return;
        setPrep(data);
        // Pre-seleccionar todas las sugerencias `recomendada`.
        setSeleccionadas(new Set((data.sugerencias ?? []).filter((s: Sugerencia) => s.recomendada).map((s: Sugerencia) => s.poliza_id)));
      } catch (e) {
        if (!cancel) setError((e as Error).message);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [apiBaseUrl, personaId]);

  const togglePoliza = (id: number): void => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const aprobar = useCallback(async () => {
    if (!prep || seleccionadas.size === 0) return;
    if (!window.confirm(`¿Crear ${seleccionadas.size} solicitudes de alta en borrador? Después se envían desde la bandeja de Solicitudes.`)) return;
    setEnviando(true); setError(null);
    try {
      const polizas = prep.sugerencias
        .filter((s) => seleccionadas.has(s.poliza_id))
        .map((s) => ({
          poliza_id: s.poliza_id,
          clausula_id: s.clausula_id ?? undefined,
          importe_negociado_mensual: s.importe_negociado_mensual ?? undefined,
        }));
      const resp = await fetch(`${apiBaseUrl}/api/polizas/solicitar-alta-multiple/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: prep.persona.id, polizas }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = await resp.json();
      setResultado(data);
    } catch (e) {
      setError(`Fallo: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }, [apiBaseUrl, prep, seleccionadas]);

  if (loading) {
    return <DashboardLayout title="Solicitar altas precargado" subtitle="..."><div>Cargando…</div></DashboardLayout>;
  }

  if (error && !prep) {
    return (
      <DashboardLayout title="Solicitar altas precargado" subtitle="">
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        <Link to="/aprobaciones" className="text-sm text-indigo-600 hover:underline">← Volver a Aprobaciones</Link>
      </DashboardLayout>
    );
  }

  if (!prep) return null;

  return (
    <DashboardLayout
      title={`Solicitar altas — ${prep.persona.nombre}`}
      subtitle="Datos precargados desde la solicitud aprobada"
    >
      <div className="mb-4 flex items-center gap-3">
        <Link to="/aprobaciones" className="text-sm text-indigo-600 hover:underline">← Volver a Aprobaciones</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <strong>{prep.persona.nombre}</strong>
          <span className="text-slate-500">CUIL {prep.persona.cuil ?? '—'}</span>
          {prep.persona.patente && <span className="text-slate-500">· Patente {prep.persona.patente}</span>}
          {!prep.persona.aprobado && <span className="bg-amber-100 text-amber-800 text-xs rounded px-2">⚠ Solicitud no aprobada todavía</span>}
        </div>
        {prep.choferes.length > 0 && (
          <div className="mt-2 text-xs text-slate-600">
            <strong>Choferes vinculados:</strong>{' '}
            {prep.choferes.map((c, i) => (
              <span key={i}>{i > 0 ? ', ' : ''}{c.nombres} {c.apellidos ?? ''}</span>
            ))}
          </div>
        )}
      </div>

      {!resultado ? (
        <>
          {prep.sugerencias.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              ⚠ La solicitud aprobada no incluía datos de pólizas. Cargá las pólizas a solicitar
              desde Aprobaciones (editar) o usá el wizard tradicional de cada póliza.
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold mb-2">Pólizas sugeridas según la solicitud</div>
              <ul className="space-y-2 mb-4">
                {prep.sugerencias.map((s) => (
                  <li key={s.poliza_id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={seleccionadas.has(s.poliza_id)} onChange={() => togglePoliza(s.poliza_id)} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {s.aseguradora_nombre} — {s.poliza_nombre}
                          {s.recomendada && <span className="ml-2 text-xs bg-green-100 text-green-800 rounded px-1.5">sugerida</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {s.ramo === 'vehiculos' && s.patente && <span>Patente: <code>{s.patente}</code> · </span>}
                          {s.ramo === 'vehiculos' && s.tipo_vehiculo && <span>{s.tipo_vehiculo} · </span>}
                          {s.clausula_id && <span>Cláusula #{s.clausula_id} · </span>}
                          {s.importe_negociado_mensual && (
                            <span className="text-green-700 font-medium">
                              Importe negociado: ${Number(s.importe_negociado_mensual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}/mes
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  <strong>{seleccionadas.size}</strong> pólizas seleccionadas
                </div>
                <button onClick={aprobar} disabled={enviando || seleccionadas.size === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                  {enviando ? 'Creando…' : `▶ Crear ${seleccionadas.size} solicitudes en borrador`}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            ✓ {resultado.solicitudes_creadas.filter((r) => r.solicitud_id).length} solicitudes creadas en borrador.
          </div>
          <div className="rounded-md border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {resultado.solicitudes_creadas.map((r, i) => (
                <li key={i} className="px-3 py-2 text-sm flex items-center gap-2">
                  <span>{r.solicitud_id ? '✓' : '✗'}</span>
                  <span className="flex-1">
                    {r.solicitud_id ? (
                      <Link to={`/polizas/solicitudes/${r.solicitud_id}`} className="text-indigo-600 hover:underline">
                        Solicitud #{r.solicitud_id} — {r.poliza_nombre ?? `Póliza #${r.poliza_id}`}
                      </Link>
                    ) : (
                      <span>Póliza #{r.poliza_id}</span>
                    )}
                  </span>
                  {r.error && <span className="text-xs text-red-700 max-w-md truncate" title={r.error}>{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/polizas/solicitudes')}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
              Ver bandeja de solicitudes →
            </button>
            <button onClick={() => navigate('/aprobaciones')}
              className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
              Volver a Aprobaciones
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
