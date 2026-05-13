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

type Estado = 'pendiente' | 'procesada' | 'rechazada' | 'cancelada' | 'todos';

type PolizaActiva = {
  poliza_id: number;
  poliza_nombre: string | null;
  numero_poliza: string | null;
  aseguradora: string | null;
  ramo: string | null;
  tipo_asegurado: string | null;
  asegurados_count: number;
  sugerida: boolean;
};

type PendienteRow = {
  id: number;
  fecha_solicitud: string | null;
  motivo_baja: string;
  comentarios_adicionales: string | null;
  polizas_sugeridas: number[];
  estado: Estado;
  procesada_en: string | null;
  polizas_dadas_de_baja: number[];
  motivo_rechazo: string | null;
  persona: {
    id: number; nombre: string; cuil: string | null; patente: string | null;
    fecha_alta: string | null; cliente: string | null; sucursal: string | null;
    estado_id: number | null;
  } | null;
  solicitada_por: { id: number; name: string | null; email: string | null } | null;
  procesada_por: { id: number; name: string | null; email: string | null } | null;
  polizas_activas?: PolizaActiva[];
};

const fmt = (iso: string | null): string => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

const ESTADO_TONE: Record<Estado, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  procesada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
  cancelada: 'bg-slate-200 text-slate-600',
  todos:     '',
};

/**
 * ADDENDUM 15 Bloque 1 — Bandeja de solicitudes de baja pendientes de procesar.
 *
 * Lista las solicitudes generadas desde el flow de Proveedores ("Solicitar baja").
 * Click en una fila → drawer/modal con detalle, checkboxes de pólizas a procesar
 * y botones Procesar/Rechazar/Cancelar.
 */
export const PolizaBandejaBajasPendientesPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [estado, setEstado] = useState<Estado>('pendiente');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PendienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<PendienteRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      p.set('estado', estado);
      if (search) p.set('search', search);
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes?${p.toString()}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = await resp.json();
      setRows(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, estado, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const abrirDetalle = useCallback(async (id: number) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes/${id}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = await resp.json();
      setSeleccionado(data);
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('id', String(id)); return next; }, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apiBaseUrl, setSearchParams]);

  // Si llegó con ?id=X en la URL, abrir directo.
  useEffect(() => {
    const id = Number(searchParams.get('id'));
    if (Number.isFinite(id) && id > 0 && !seleccionado) {
      abrirDetalle(id);
    }
  }, [searchParams, seleccionado, abrirDetalle]);

  const cerrarDetalle = (): void => {
    setSeleccionado(null);
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('id'); return next; }, { replace: true });
  };

  return (
    <DashboardLayout
      title="Bandeja de bajas pendientes"
      subtitle="Solicitudes de baja para procesar caso a caso"
    >
      <div className="mb-4 flex items-center gap-3">
        <Link to="/polizas" className="text-sm text-indigo-600 hover:underline">← Volver a Pólizas</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value as Estado)} className="rounded border-slate-300 text-sm">
            <option value="pendiente">Pendientes</option>
            <option value="procesada">Procesadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="cancelada">Canceladas</option>
            <option value="todos">Todas</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 mb-0.5">Buscar (nombre/CUIL/patente)</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full rounded border-slate-300 text-sm" />
        </div>
        <button onClick={fetchData} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          Aplicar
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✓ Sin solicitudes en estado <strong>{estado}</strong>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Distribuidor</th>
                <th className="px-3 py-2 text-left">CUIL / Patente</th>
                <th className="px-3 py-2 text-left">Cliente · Sucursal</th>
                <th className="px-3 py-2 text-left">Fecha solicitud</th>
                <th className="px-3 py-2 text-left">Solicitada por</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.persona?.nombre ?? '—'}</div>
                    <div className="text-xs text-slate-500 truncate max-w-md" title={r.motivo_baja}>{r.motivo_baja}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs">
                    {r.persona?.cuil ?? '—'}
                    {r.persona?.patente && <div className="text-slate-500">{r.persona.patente}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.persona?.cliente ?? '—'}
                    {r.persona?.sucursal && <div className="text-slate-500">· {r.persona.sucursal}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{fmt(r.fecha_solicitud)}</td>
                  <td className="px-3 py-2 text-xs">{r.solicitada_por?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${ESTADO_TONE[r.estado]}`}>{r.estado}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => abrirDetalle(r.id)} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                      {r.estado === 'pendiente' ? 'Revisar y procesar →' : 'Ver detalle →'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionado && (
        <DetalleModal
          pendiente={seleccionado}
          apiBaseUrl={apiBaseUrl}
          onClose={cerrarDetalle}
          onActualizado={() => { fetchData(); cerrarDetalle(); }}
        />
      )}
    </DashboardLayout>
  );
};

const DetalleModal: React.FC<{
  pendiente: PendienteRow;
  apiBaseUrl: string;
  onClose: () => void;
  onActualizado: () => void;
}> = ({ pendiente, apiBaseUrl, onClose, onActualizado }) => {
  const polizasActivas = pendiente.polizas_activas ?? [];
  const idsSugeridas = new Set(pendiente.polizas_sugeridas);
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(
    new Set(polizasActivas.filter((p) => p.sugerida || idsSugeridas.has(p.poliza_id)).map((p) => p.poliza_id))
  );
  const [comentarios, setComentarios] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number): void => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const procesar = useCallback(async () => {
    if (seleccionadas.size === 0) {
      setError('Seleccioná al menos una póliza.');
      return;
    }
    if (!window.confirm(`¿Procesar la baja en ${seleccionadas.size} pólizas? Se enviarán los correos a las aseguradoras.`)) return;
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes/${pendiente.id}/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polizas_ids: Array.from(seleccionadas),
          comentarios: comentarios || undefined,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      onActualizado();
    } catch (e) { setError(`Procesamiento falló: ${(e as Error).message}`); }
    finally { setLoading(false); }
  }, [apiBaseUrl, pendiente.id, seleccionadas, comentarios, onActualizado]);

  const rechazar = useCallback(async () => {
    if (motivoRechazo.trim().length < 3) {
      setError('El motivo de rechazo es obligatorio (mínimo 3 caracteres).');
      return;
    }
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes/${pendiente.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo_rechazo: motivoRechazo }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      onActualizado();
    } catch (e) { setError(`Rechazo falló: ${(e as Error).message}`); }
    finally { setLoading(false); }
  }, [apiBaseUrl, pendiente.id, motivoRechazo, onActualizado]);

  const cancelar = useCallback(async () => {
    if (!window.confirm('¿Cancelar esta solicitud de baja?')) return;
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/bandeja-bajas-pendientes/${pendiente.id}/cancelar`, { method: 'POST' });
      if (!resp.ok) throw new Error(await resp.text());
      onActualizado();
    } catch (e) { setError(`Cancelación falló: ${(e as Error).message}`); }
    finally { setLoading(false); }
  }, [apiBaseUrl, pendiente.id, onActualizado]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-md shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold">Solicitud #{pendiente.id} — {pendiente.persona?.nombre}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          {error && <div className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{error}</div>}

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div><strong>CUIL:</strong> {pendiente.persona?.cuil ?? '—'} · <strong>Patente:</strong> {pendiente.persona?.patente ?? '—'}</div>
            <div><strong>Cliente:</strong> {pendiente.persona?.cliente ?? '—'} · <strong>Sucursal:</strong> {pendiente.persona?.sucursal ?? '—'}</div>
            <div><strong>Alta como proveedor:</strong> {pendiente.persona?.fecha_alta ?? '—'}</div>
            <div><strong>Solicitada por:</strong> {pendiente.solicitada_por?.name ?? '—'} · {fmt(pendiente.fecha_solicitud)}</div>
          </div>

          <div>
            <div className="text-xs uppercase font-semibold text-slate-600 mb-1">Motivo de baja</div>
            <div className="rounded border border-slate-200 bg-white p-2 whitespace-pre-wrap">{pendiente.motivo_baja}</div>
            {pendiente.comentarios_adicionales && (
              <div className="mt-1 rounded border border-slate-200 bg-white p-2 whitespace-pre-wrap text-slate-700">
                <strong>Comentarios:</strong> {pendiente.comentarios_adicionales}
              </div>
            )}
          </div>

          {pendiente.estado === 'pendiente' ? (
            <>
              <div>
                <div className="text-xs uppercase font-semibold text-slate-600 mb-1">Pólizas activas — elegí cuáles dar de baja</div>
                {polizasActivas.length === 0 ? (
                  <div className="text-slate-500 italic">El distribuidor no tiene pólizas activas.</div>
                ) : (
                  <ul className="space-y-1">
                    {polizasActivas.map((p) => (
                      <li key={p.poliza_id} className="flex items-center gap-2">
                        <input type="checkbox" checked={seleccionadas.has(p.poliza_id)} onChange={() => toggle(p.poliza_id)} />
                        <span className="flex-1">
                          <strong>{p.aseguradora}</strong> — {p.poliza_nombre}
                          {p.sugerida && <span className="ml-1 text-xs bg-amber-100 text-amber-800 rounded px-1.5">sugerida</span>}
                        </span>
                        <span className="text-xs text-slate-500">{p.ramo} · {p.asegurados_count} aseg.</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Comentarios adicionales (opcional)</label>
                <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2}
                  className="w-full rounded border-slate-300 text-sm" />
              </div>

              {mostrarRechazo && (
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Motivo de rechazo</label>
                  <textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} rows={2}
                    className="w-full rounded border-slate-300 text-sm" />
                </div>
              )}
            </>
          ) : (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div><strong>Estado:</strong> <span className={`inline-block px-2 py-0.5 rounded ${ESTADO_TONE[pendiente.estado]}`}>{pendiente.estado}</span></div>
              <div><strong>Procesada en:</strong> {fmt(pendiente.procesada_en)}</div>
              <div><strong>Procesada por:</strong> {pendiente.procesada_por?.name ?? '—'}</div>
              {pendiente.estado === 'procesada' && pendiente.polizas_dadas_de_baja.length > 0 && (
                <div><strong>Pólizas dadas de baja:</strong> {pendiente.polizas_dadas_de_baja.join(', ')}</div>
              )}
              {pendiente.motivo_rechazo && (
                <div><strong>Motivo de rechazo:</strong> {pendiente.motivo_rechazo}</div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
            Cerrar
          </button>
          {pendiente.estado === 'pendiente' && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={cancelar} disabled={loading}
                className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
                Cancelar solicitud
              </button>
              {!mostrarRechazo ? (
                <button onClick={() => setMostrarRechazo(true)}
                  className="px-3 py-1.5 border border-red-300 bg-white text-red-700 rounded text-sm hover:bg-red-50">
                  Rechazar baja
                </button>
              ) : (
                <button onClick={rechazar} disabled={loading || motivoRechazo.length < 3}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                  Confirmar rechazo
                </button>
              )}
              <button onClick={procesar} disabled={loading || seleccionadas.size === 0}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Procesando…' : `▶ Procesar ${seleccionadas.size} ${seleccionadas.size === 1 ? 'baja' : 'bajas'}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
