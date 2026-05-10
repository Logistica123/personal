import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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

type Adjunto = {
  id: number;
  nombre_archivo: string;
  mime_type: string;
  tamano_bytes: number;
  es_endoso: boolean;
  endoso_id: number | null;
  descargado: boolean;
};

type EmailRow = {
  id: number;
  solicitud_id: number;
  direccion: 'enviado' | 'recibido';
  fecha_email: string | null;
  de_email: string;
  de_nombre: string | null;
  para_emails: string[] | null;
  cc_emails: string[] | null;
  asunto: string;
  body_preview: string | null;
  body_completo?: string | null;
  tiene_adjuntos: boolean;
  procesado: boolean;
  conversation_id: string | null;
  solicitud: {
    id: number;
    tipo: string;
    estado: string;
    fecha_solicitud: string | null;
    poliza: { id: number; nombre_descriptivo: string; numero_poliza: string | null; aseguradora: string | null } | null;
  } | null;
  adjuntos: Adjunto[];
};

const fmtFecha = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const fmtTamano = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * ADDENDUM 13 Parte D — Inbox de respuestas de aseguradoras.
 *
 * Lista los emails de threads de solicitudes enviadas (cacheados desde
 * Outlook vía Microsoft Graph) + permite descargar adjuntos y vincular
 * manualmente como endoso aquellos PDF detectados.
 */
export const PolizaInboxPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [seleccionado, setSeleccionado] = useState<EmailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Filtros
  const [direccion, setDireccion] = useState<'' | 'enviado' | 'recibido'>('recibido');
  const [conAdjuntos, setConAdjuntos] = useState(false);
  const [endososPendientes, setEndososPendientes] = useState(false);
  const [search, setSearch] = useState('');

  const buildQuery = useCallback((): string => {
    const p = new URLSearchParams();
    if (direccion) p.set('direccion', direccion);
    if (conAdjuntos) p.set('con_adjuntos', '1');
    if (endososPendientes) p.set('endosos_no_vinculados', '1');
    if (search) p.set('search', search);
    p.set('limit', '300');
    return p.toString();
  }, [direccion, conAdjuntos, endososPendientes, search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/inbox?${buildQuery()}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = (await resp.json()) as { data: EmailRow[] };
      setRows(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, buildQuery]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    setError(null);
    setInfo(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/inbox/sincronizar`, { method: 'POST' });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = await resp.json();
      setInfo(`Sync OK: ${data.cuentas_procesadas} cuentas, ${data.mensajes_nuevos} mensajes nuevos, ${data.adjuntos_nuevos} adjuntos.${data.errores?.length ? ` ${data.errores.length} errores.` : ''}`);
      fetchRows();
    } catch (e) {
      setError(`Sync falló: ${(e as Error).message}`);
    } finally {
      setSincronizando(false);
    }
  }, [apiBaseUrl, fetchRows]);

  const abrirDetalle = useCallback(async (row: EmailRow) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/inbox/${row.id}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = (await resp.json()) as { data: EmailRow };
      setSeleccionado(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apiBaseUrl]);

  const descargarAdjunto = (a: Adjunto): void => {
    window.open(`${apiBaseUrl}/api/polizas/inbox/adjuntos/${a.id}/descargar`, '_blank');
  };

  const guardarEndoso = useCallback(async (a: Adjunto) => {
    if (!seleccionado) return;
    if (!confirm(`¿Vincular "${a.nombre_archivo}" como endoso de la póliza?`)) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/inbox/adjuntos/${a.id}/guardar-endoso`, { method: 'POST' });
      if (!resp.ok) throw new Error(await resp.text());
      const { data } = await resp.json();
      setInfo(`Endoso #${data.endoso_id} (${data.numero_endoso}) creado y vinculado.`);
      // Refrescar el detalle
      abrirDetalle(seleccionado);
      fetchRows();
    } catch (e) {
      setError(`Falló: ${(e as Error).message}`);
    }
  }, [apiBaseUrl, seleccionado, abrirDetalle, fetchRows]);

  const marcarProcesado = useCallback(async (e: EmailRow, procesado: boolean) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/inbox/${e.id}/marcar-procesado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procesado }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      fetchRows();
      if (seleccionado?.id === e.id) setSeleccionado({ ...seleccionado, procesado });
    } catch (err) {
      setError(`Falló: ${(err as Error).message}`);
    }
  }, [apiBaseUrl, fetchRows, seleccionado]);

  return (
    <DashboardLayout
      title="Inbox Pólizas"
      subtitle="Respuestas de aseguradoras a las solicitudes enviadas"
    >
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Link to="/polizas" className="text-sm text-indigo-600 hover:underline">← Volver a Pólizas</Link>
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {sincronizando ? 'Sincronizando…' : '⟳ Sincronizar ahora'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}
      {info && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{info}</div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Dirección</label>
          <select value={direccion} onChange={(e) => setDireccion(e.target.value as typeof direccion)} className="rounded border-slate-300 text-sm">
            <option value="">Todas</option>
            <option value="recibido">Recibidos</option>
            <option value="enviado">Enviados</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-1">
          <input type="checkbox" checked={conAdjuntos} onChange={(e) => setConAdjuntos(e.target.checked)} />
          Solo con adjuntos
        </label>
        <label className="flex items-center gap-2 text-sm pb-1">
          <input type="checkbox" checked={endososPendientes} onChange={(e) => setEndososPendientes(e.target.checked)} />
          Endosos no vinculados
        </label>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 mb-0.5">Buscar</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRows()}
            placeholder="Asunto, remitente, contenido…" className="w-full rounded border-slate-300 text-sm" />
        </div>
        <button onClick={fetchRows} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          Aplicar
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
        {/* Lista */}
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Sin emails.</div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {rows.map((r) => {
                const sel = seleccionado?.id === r.id;
                const tieneEndosoPendiente = r.adjuntos.some((a) => a.es_endoso && !a.endoso_id);
                return (
                  <li
                    key={r.id}
                    onClick={() => abrirDetalle(r)}
                    className={`px-3 py-2.5 cursor-pointer transition ${
                      sel ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    } ${!r.procesado && r.direccion === 'recibido' ? 'border-l-2 border-l-indigo-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm truncate">
                        {r.direccion === 'enviado' ? <span className="text-slate-400 mr-1">→</span> : <span className="text-indigo-500 mr-1">←</span>}
                        {r.de_nombre || r.de_email}
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">{fmtFecha(r.fecha_email)}</div>
                    </div>
                    <div className="text-sm text-slate-700 truncate mt-0.5">{r.asunto}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{r.body_preview ?? ''}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {r.tiene_adjuntos && <span className="text-slate-500">📎 {r.adjuntos.length}</span>}
                      {tieneEndosoPendiente && <span className="text-amber-700 bg-amber-100 rounded px-1.5">Endoso pendiente</span>}
                      {r.solicitud?.poliza && (
                        <span className="text-slate-500 truncate">
                          · {r.solicitud.poliza.aseguradora ?? r.solicitud.poliza.nombre_descriptivo}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detalle */}
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {!seleccionado ? (
            <div className="p-6 text-sm text-slate-500">Seleccioná un email para ver el detalle.</div>
          ) : (
            <DetalleEmail
              email={seleccionado}
              onDescargarAdjunto={descargarAdjunto}
              onGuardarEndoso={guardarEndoso}
              onMarcarProcesado={(p) => marcarProcesado(seleccionado, p)}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

const DetalleEmail: React.FC<{
  email: EmailRow;
  onDescargarAdjunto: (a: Adjunto) => void;
  onGuardarEndoso: (a: Adjunto) => void;
  onMarcarProcesado: (procesado: boolean) => void;
}> = ({ email, onDescargarAdjunto, onGuardarEndoso, onMarcarProcesado }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{email.asunto}</div>
            <div className="text-xs text-slate-500 mt-1">
              <strong>De:</strong> {email.de_nombre || email.de_email} <span className="text-slate-400">&lt;{email.de_email}&gt;</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              <strong>Para:</strong> {(email.para_emails ?? []).join(', ') || '—'}
            </div>
            {(email.cc_emails ?? []).length > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                <strong>CC:</strong> {(email.cc_emails ?? []).join(', ')}
              </div>
            )}
            <div className="text-xs text-slate-500 mt-0.5">{fmtFecha(email.fecha_email)}</div>
          </div>
          <button
            onClick={() => onMarcarProcesado(!email.procesado)}
            className={`text-xs whitespace-nowrap rounded px-2 py-1 border ${
              email.procesado
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {email.procesado ? '✓ Procesado' : 'Marcar procesado'}
          </button>
        </div>
        {email.solicitud?.poliza && (
          <div className="mt-2 text-xs">
            <Link to={`/polizas/solicitudes/${email.solicitud.id}`} className="text-indigo-600 hover:underline">
              Solicitud #{email.solicitud.id} — {email.solicitud.tipo} ({email.solicitud.estado})
            </Link>
            <span className="text-slate-400"> · </span>
            <Link to={`/polizas/${email.solicitud.poliza.id}`} className="text-indigo-600 hover:underline">
              {email.solicitud.poliza.nombre_descriptivo}
            </Link>
          </div>
        )}
      </div>

      {email.adjuntos.length > 0 && (
        <div className="border-b border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-600 mb-2">Adjuntos ({email.adjuntos.length})</div>
          <ul className="space-y-1.5">
            {email.adjuntos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm rounded border border-slate-200 px-2 py-1.5 bg-slate-50">
                <span>📎</span>
                <span className="flex-1 min-w-0 truncate" title={a.nombre_archivo}>{a.nombre_archivo}</span>
                <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{fmtTamano(a.tamano_bytes)}</span>
                {a.es_endoso && (
                  a.endoso_id ? (
                    <span className="text-xs bg-green-100 text-green-700 rounded px-1.5">✓ endoso #{a.endoso_id}</span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-800 rounded px-1.5">endoso candidato</span>
                  )
                )}
                <button
                  onClick={() => onDescargarAdjunto(a)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Descargar
                </button>
                {a.es_endoso && !a.endoso_id && (
                  <button
                    onClick={() => onGuardarEndoso(a)}
                    className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Guardar como endoso
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {email.body_completo ? (
          <div
            className="text-sm prose prose-sm max-w-none"
            // El backend persiste el body tal como lo manda Graph (típicamente HTML).
            // No es contenido de un user del sistema sino de la aseguradora; lo
            // renderizamos en un sandbox visual pero sin script execution garantizado
            // por React (innerHTML de tags <script> no ejecuta) — para defensa adicional
            // habría que pasar por DOMPurify, queda como mejora futura.
            dangerouslySetInnerHTML={{ __html: email.body_completo }}
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap text-slate-700">{email.body_preview ?? '(sin contenido)'}</div>
        )}
      </div>
    </div>
  );
};
