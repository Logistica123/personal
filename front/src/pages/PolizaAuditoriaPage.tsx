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

type Tab = 'solicitudes' | 'eliminaciones' | 'choferes' | 'clausulas';

type SolicitudRow = {
  id: number;
  fecha_solicitud: string | null;
  tipo: string;
  estado: string;
  admin: { id: number; name: string | null; email: string | null } | null;
  poliza: { id: number; nombre_descriptivo: string; numero_poliza: string | null; aseguradora: string | null } | null;
  enviado_en: string | null;
  respuesta_recibida_en: string | null;
  dias_enviado: number | null;
  sin_respuesta_alerta: boolean;
  asegurados_count: number;
  asegurados: Array<{ identificador: string; nombre: string; cuil: string | null }>;
};

type EliminacionRow = {
  id: number;
  eliminado_en: string | null;
  motivo: string | null;
  admin: { id: number; name: string | null; email: string | null } | null;
  identificador: string;
  identificador_tipo: string;
  nombre: string;
  cuil: string | null;
  poliza: { id: number; nombre_descriptivo: string; numero_poliza: string | null; aseguradora: string | null } | null;
};

type ChoferRow = {
  id: number;
  created_at: string | null;
  fecha_vinculacion: string | null;
  fecha_desvinculacion: string | null;
  activo: boolean;
  rol: string | null;
  creado_por: { id: number; name: string | null; email: string | null } | null;
  titular: { id: number; nombre: string; cuil: string | null } | null;
  chofer: { id: number; nombre: string; cuil: string | null } | null;
};

type ClausulaRow = {
  id: number;
  aplicada_desde: string | null;
  aplicada_hasta: string | null;
  tipo_aplicacion: string | null;
  poliza: { id: number; nombre_descriptivo: string; numero_poliza: string | null; aseguradora: string | null } | null;
  clausula: { id: number; nombre_corto: string; alias: string | null; cuit_titular: string | null; razon_social_titular: string | null } | null;
};

const fmtFecha = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const fmtFechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR');
  } catch {
    return iso;
  }
};

const csvCelda = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[,"\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const descargarCSV = (filename: string, headers: string[], rows: string[][]): void => {
  const csv = [headers, ...rows].map((r) => r.map(csvCelda).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * ADDENDUM 13 Parte B — Pantalla de Auditoría unificada del módulo Pólizas.
 *
 * 4 pestañas con filtros (rango fechas, search, etc.) y export CSV en cada una.
 * Permiso: `puede_ver_auditoria` (default true para todos los admins del módulo).
 */
export const PolizaAuditoriaPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [tab, setTab] = useState<Tab>('solicitudes');
  const [error, setError] = useState<string | null>(null);

  // Filtros comunes
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [search, setSearch] = useState('');
  // Filtros específicos solicitudes
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [estadoChofer, setEstadoChofer] = useState('');

  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [eliminaciones, setEliminaciones] = useState<EliminacionRow[]>([]);
  const [choferes, setChoferes] = useState<ChoferRow[]>([]);
  const [clausulas, setClausulas] = useState<ClausulaRow[]>([]);
  const [loading, setLoading] = useState(false);

  const buildQuery = useCallback((extra: Record<string, string> = {}): string => {
    const p = new URLSearchParams();
    if (fechaDesde) p.set('fecha_desde', fechaDesde);
    if (fechaHasta) p.set('fecha_hasta', fechaHasta);
    if (search) p.set('search', search);
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  }, [fechaDesde, fechaHasta, search]);

  const fetchTab = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${apiBaseUrl}/api/polizas/auditoria/`;
      if (t === 'solicitudes') {
        url += `solicitudes${buildQuery({ tipo: tipoFiltro, estado: estadoFiltro })}`;
      } else if (t === 'eliminaciones') {
        url += `eliminaciones${buildQuery()}`;
      } else if (t === 'choferes') {
        url += `choferes${buildQuery({ estado: estadoChofer })}`;
      } else {
        url += `clausulas${buildQuery()}`;
      }
      const resp = await fetch(url, { cache: 'no-store' });
      if (resp.status === 403) {
        setError('No tenés permiso para ver auditoría. Pedí al admin que te asigne `puede_ver_auditoria`.');
        return;
      }
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = await resp.json();
      if (t === 'solicitudes') setSolicitudes(data ?? []);
      else if (t === 'eliminaciones') setEliminaciones(data ?? []);
      else if (t === 'choferes') setChoferes(data ?? []);
      else setClausulas(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, buildQuery, tipoFiltro, estadoFiltro, estadoChofer]);

  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  const exportar = (): void => {
    if (tab === 'solicitudes') {
      descargarCSV('auditoria-solicitudes.csv',
        ['Fecha', 'Tipo', 'Estado', 'Póliza', 'Aseguradora', 'Admin', 'Enviado', 'Respuesta', 'Días', 'Asegurados'],
        solicitudes.map((r) => [
          fmtFecha(r.fecha_solicitud), r.tipo, r.estado,
          r.poliza?.nombre_descriptivo ?? '—',
          r.poliza?.aseguradora ?? '—',
          r.admin?.name ?? '—',
          fmtFecha(r.enviado_en),
          fmtFecha(r.respuesta_recibida_en),
          r.dias_enviado !== null ? String(r.dias_enviado) : '—',
          String(r.asegurados_count),
        ]));
    } else if (tab === 'eliminaciones') {
      descargarCSV('auditoria-eliminaciones.csv',
        ['Eliminado', 'Admin', 'Identificador', 'Tipo', 'Nombre', 'CUIL', 'Póliza', 'Aseguradora', 'Motivo'],
        eliminaciones.map((r) => [
          fmtFecha(r.eliminado_en),
          r.admin?.name ?? '—',
          r.identificador, r.identificador_tipo,
          r.nombre, r.cuil ?? '—',
          r.poliza?.nombre_descriptivo ?? '—',
          r.poliza?.aseguradora ?? '—',
          r.motivo ?? '—',
        ]));
    } else if (tab === 'choferes') {
      descargarCSV('auditoria-choferes.csv',
        ['Fecha vinculación', 'Estado', 'Titular', 'CUIL titular', 'Chofer', 'CUIL chofer', 'Rol', 'Desvinculación', 'Creado por'],
        choferes.map((r) => [
          fmtFechaCorta(r.fecha_vinculacion),
          r.activo ? 'Activo' : 'Inactivo',
          r.titular?.nombre ?? '—',
          r.titular?.cuil ?? '—',
          r.chofer?.nombre ?? '—',
          r.chofer?.cuil ?? '—',
          r.rol ?? '—',
          fmtFechaCorta(r.fecha_desvinculacion),
          r.creado_por?.name ?? '—',
        ]));
    } else {
      descargarCSV('auditoria-clausulas.csv',
        ['Aplicada desde', 'Hasta', 'Tipo', 'Póliza', 'Aseguradora', 'Cláusula', 'CUIT titular', 'Razón social'],
        clausulas.map((r) => [
          fmtFechaCorta(r.aplicada_desde),
          fmtFechaCorta(r.aplicada_hasta),
          r.tipo_aplicacion ?? '—',
          r.poliza?.nombre_descriptivo ?? '—',
          r.poliza?.aseguradora ?? '—',
          r.clausula?.nombre_corto ?? '—',
          r.clausula?.cuit_titular ?? '—',
          r.clausula?.razon_social_titular ?? '—',
        ]));
    }
  };

  const tabsCfg: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'solicitudes', label: 'Solicitudes', count: solicitudes.length },
    { key: 'eliminaciones', label: 'Eliminaciones', count: eliminaciones.length },
    { key: 'choferes', label: 'Choferes', count: choferes.length },
    { key: 'clausulas', label: 'Cláusulas', count: clausulas.length },
  ];

  return (
    <DashboardLayout title="Auditoría Pólizas" subtitle="Log unificado de movimientos del módulo">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/polizas" className="text-sm text-indigo-600 hover:underline">← Volver a Pólizas</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="border-b border-slate-200 mb-4">
        <nav className="-mb-px flex gap-4">
          {tabsCfg.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap py-2 px-3 border-b-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {t.label} <span className="text-xs text-slate-400">({t.count})</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Fecha desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            className="rounded border-slate-300 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Fecha hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            className="rounded border-slate-300 text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 mb-0.5">Buscar</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, identificador, etc." className="w-full rounded border-slate-300 text-sm" />
        </div>
        {tab === 'solicitudes' && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Tipo</label>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="rounded border-slate-300 text-sm">
                <option value="">Todos</option>
                <option value="alta">Alta</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Estado</label>
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="rounded border-slate-300 text-sm">
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="enviado">Enviado</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </>
        )}
        {tab === 'choferes' && (
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">Estado</label>
            <select value={estadoChofer} onChange={(e) => setEstadoChofer(e.target.value)} className="rounded border-slate-300 text-sm">
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        )}
        <button onClick={() => fetchTab(tab)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          Aplicar filtros
        </button>
        <button onClick={exportar}
          title="Descarga el listado actual filtrado en CSV"
          className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
          ⤓ Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando…</div>
      ) : (
        <>
          {tab === 'solicitudes' && <TablaSolicitudes rows={solicitudes} />}
          {tab === 'eliminaciones' && <TablaEliminaciones rows={eliminaciones} />}
          {tab === 'choferes' && <TablaChoferes rows={choferes} />}
          {tab === 'clausulas' && <TablaClausulas rows={clausulas} />}
        </>
      )}
    </DashboardLayout>
  );
};

const TablaSolicitudes: React.FC<{ rows: SolicitudRow[] }> = ({ rows }) => {
  if (rows.length === 0) return <div className="text-sm text-slate-500">Sin resultados.</div>;
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Póliza</th>
            <th className="px-3 py-2 text-left">Aseguradora</th>
            <th className="px-3 py-2 text-left">Admin</th>
            <th className="px-3 py-2 text-right">Asegurados</th>
            <th className="px-3 py-2 text-right">Días</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className={r.sin_respuesta_alerta ? 'bg-amber-50' : ''}>
              <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(r.fecha_solicitud)}</td>
              <td className="px-3 py-2 capitalize">{r.tipo}</td>
              <td className="px-3 py-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                  r.estado === 'confirmado' ? 'bg-green-100 text-green-800' :
                  r.estado === 'cancelado' ? 'bg-slate-200 text-slate-700' :
                  r.estado === 'enviado' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>{r.estado}</span>
              </td>
              <td className="px-3 py-2">{r.poliza?.nombre_descriptivo ?? '—'}</td>
              <td className="px-3 py-2">{r.poliza?.aseguradora ?? '—'}</td>
              <td className="px-3 py-2">{r.admin?.name ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.asegurados_count}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.dias_enviado !== null ? `${r.dias_enviado}d` : '—'}
                {r.sin_respuesta_alerta && <span className="ml-1 text-amber-600">⚠</span>}
              </td>
              <td className="px-3 py-2 text-right">
                <Link to={`/polizas/solicitudes/${r.id}`} className="text-xs text-indigo-600 hover:underline">Ver</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TablaEliminaciones: React.FC<{ rows: EliminacionRow[] }> = ({ rows }) => {
  if (rows.length === 0) return <div className="text-sm text-slate-500">Sin eliminaciones registradas.</div>;
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Eliminado</th>
            <th className="px-3 py-2 text-left">Admin</th>
            <th className="px-3 py-2 text-left">Identificador</th>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">CUIL</th>
            <th className="px-3 py-2 text-left">Póliza</th>
            <th className="px-3 py-2 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(r.eliminado_en)}</td>
              <td className="px-3 py-2">{r.admin?.name ?? '—'}</td>
              <td className="px-3 py-2">{r.identificador}</td>
              <td className="px-3 py-2">{r.nombre}</td>
              <td className="px-3 py-2 tabular-nums">{r.cuil ?? '—'}</td>
              <td className="px-3 py-2">{r.poliza?.nombre_descriptivo ?? '—'}</td>
              <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={r.motivo ?? ''}>{r.motivo ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TablaChoferes: React.FC<{ rows: ChoferRow[] }> = ({ rows }) => {
  if (rows.length === 0) return <div className="text-sm text-slate-500">Sin vinculaciones registradas.</div>;
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Vinculación</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Titular</th>
            <th className="px-3 py-2 text-left">Chofer</th>
            <th className="px-3 py-2 text-left">Rol</th>
            <th className="px-3 py-2 text-left">Desvinculación</th>
            <th className="px-3 py-2 text-left">Creado por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 whitespace-nowrap">{fmtFechaCorta(r.fecha_vinculacion)}</td>
              <td className="px-3 py-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                  r.activo ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'
                }`}>{r.activo ? 'Activo' : 'Inactivo'}</span>
              </td>
              <td className="px-3 py-2">
                {r.titular?.nombre ?? '—'}
                {r.titular?.cuil && <div className="text-xs text-slate-500 tabular-nums">{r.titular.cuil}</div>}
              </td>
              <td className="px-3 py-2">
                {r.chofer?.nombre ?? '—'}
                {r.chofer?.cuil && <div className="text-xs text-slate-500 tabular-nums">{r.chofer.cuil}</div>}
              </td>
              <td className="px-3 py-2">{r.rol ?? '—'}</td>
              <td className="px-3 py-2">{fmtFechaCorta(r.fecha_desvinculacion)}</td>
              <td className="px-3 py-2">{r.creado_por?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TablaClausulas: React.FC<{ rows: ClausulaRow[] }> = ({ rows }) => {
  if (rows.length === 0) return <div className="text-sm text-slate-500">Sin cláusulas aplicadas.</div>;
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Desde</th>
            <th className="px-3 py-2 text-left">Hasta</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Póliza</th>
            <th className="px-3 py-2 text-left">Aseguradora</th>
            <th className="px-3 py-2 text-left">Cláusula</th>
            <th className="px-3 py-2 text-left">Razón social</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 whitespace-nowrap">{fmtFechaCorta(r.aplicada_desde)}</td>
              <td className="px-3 py-2">{fmtFechaCorta(r.aplicada_hasta)}</td>
              <td className="px-3 py-2 capitalize">{r.tipo_aplicacion ?? '—'}</td>
              <td className="px-3 py-2">{r.poliza?.nombre_descriptivo ?? '—'}</td>
              <td className="px-3 py-2">{r.poliza?.aseguradora ?? '—'}</td>
              <td className="px-3 py-2">{r.clausula?.nombre_corto ?? '—'}</td>
              <td className="px-3 py-2 text-slate-600">{r.clausula?.razon_social_titular ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
