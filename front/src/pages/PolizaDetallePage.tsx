import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  ClausulaAplicada,
  Discrepancias,
  Poliza,
  PolizaAsegurado,
  PolizaAseguradoConChoferes,
  PolizaEmailConfig,
} from '../features/polizas/types';
import { SearchInput } from '../features/polizas/SearchInput';
import { EstadoDistribuidorBadge } from '../features/polizas/EstadoDistribuidorBadge';
import { ComentariosAseguradoModal } from '../features/polizas/ComentariosAseguradoModal';

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

type Tab = 'resumen' | 'asegurados' | 'discrepancias' | 'endosos' | 'email' | 'clausulas';

const FORMATTER_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  // Tolera 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ssZ' (Laravel cast date en prod).
  return FORMATTER_FECHA.format(new Date(s.slice(0, 10) + 'T00:00:00'));
}

function fmtMoney(s: string | null | undefined): string {
  if (s === null || s === undefined) return '—';
  const n = parseFloat(s);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export const PolizaDetallePage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [error, setError] = useState<string | null>(null);

  // En pólizas vehículos cargamos el endpoint enriquecido con choferes; en AP, el plano.
  // Tipamos como union — el render decide qué columnas mostrar.
  const [asegurados, setAsegurados] = useState<Array<PolizaAsegurado | PolizaAseguradoConChoferes> | null>(null);
  const [discrepancias, setDiscrepancias] = useState<Discrepancias | null>(null);
  const [clausulasVigentes, setClausulasVigentes] = useState<ClausulaAplicada[] | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterDudosos, setFilterDudosos] = useState(false);
  const [searchAsegurados, setSearchAsegurados] = useState('');

  // ---- fetch póliza ----
  useEffect(() => {
    if (!polizaId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, {
          signal: controller.signal, cache: 'no-store',
        });
        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const { data } = (await resp.json()) as { data: Poliza };
        setPoliza(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError((err as Error).message);
      }
    })();
    return () => controller.abort();
  }, [polizaId, apiBaseUrl]);

  // ---- fetch asegurados (lazy al activar tab; refetch al cambiar filtros) ----
  // En pólizas vehículos pegamos al endpoint enriquecido `/asegurados-con-choferes`
  // para que cada fila titular venga con los choferes vinculados + estado AP. Para
  // AP usamos el plano `/asegurados` (no aplica el concepto de chofer).
  const fetchAsegurados = useCallback(async () => {
    if (!polizaId) return;
    const params = new URLSearchParams();
    if (filterEstado) params.set('estado', filterEstado);
    if (filterDudosos) params.set('solo_dudosos', '1');
    if (searchAsegurados) params.set('search', searchAsegurados);
    const path = poliza?.tipo_asegurado === 'vehiculo'
      ? `/api/polizas/${polizaId}/asegurados-con-choferes`
      : `/api/polizas/${polizaId}/asegurados`;
    const url = `${apiBaseUrl}${path}${params.toString() ? '?' + params : ''}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: Array<PolizaAsegurado | PolizaAseguradoConChoferes> };
      setAsegurados(data ?? []);
    }
  }, [polizaId, apiBaseUrl, filterEstado, filterDudosos, searchAsegurados, poliza?.tipo_asegurado]);

  useEffect(() => {
    if (tab === 'asegurados') fetchAsegurados();
  }, [tab, fetchAsegurados]);

  // ---- fetch discrepancias ----
  useEffect(() => {
    if (tab !== 'discrepancias' || !polizaId || discrepancias) return;
    (async () => {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/discrepancias`, { cache: 'no-store' });
      if (resp.ok) {
        const { data } = (await resp.json()) as { data: Discrepancias };
        setDiscrepancias(data);
      }
    })();
  }, [tab, polizaId, apiBaseUrl, discrepancias]);

  // ---- fetch cláusulas vigentes ----
  useEffect(() => {
    if (tab !== 'clausulas' || !polizaId || clausulasVigentes) return;
    (async () => {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/clausulas-vigentes`, { cache: 'no-store' });
      if (resp.ok) {
        const { data } = (await resp.json()) as { data: ClausulaAplicada[] };
        setClausulasVigentes(data ?? []);
      }
    })();
  }, [tab, polizaId, apiBaseUrl, clausulasVigentes]);

  if (error) {
    return (
      <DashboardLayout title="Pólizas — error">
        <div style={{ padding: '1rem', background: '#fee', color: '#900', borderRadius: 12 }}>{error}</div>
      </DashboardLayout>
    );
  }

  if (!poliza) {
    return <DashboardLayout title="Pólizas"><div style={{ padding: '2rem' }}>Cargando…</div></DashboardLayout>;
  }

  return (
    <DashboardLayout
      title={poliza.nombre_descriptivo}
      subtitle={`${poliza.aseguradora?.nombre ?? '?'} · Póliza N° ${poliza.numero_poliza}`}
      headerContent={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/polizas" className="secondary-action secondary-action--ghost">← Volver</Link>
          <Link
            to={`/polizas/${poliza.id}/cargar-pdf`}
            className="secondary-action"
            style={{ background: '#1d74f5', color: '#fff', padding: '0.5rem 0.9rem', borderRadius: 10, textDecoration: 'none' }}
          >
            ⇪ Cargar PDF
          </Link>
          <Link
            to={`/polizas/${poliza.id}/solicitar?tipo=alta`}
            className="secondary-action"
            style={{ background: '#0a8c3a', color: '#fff', padding: '0.5rem 0.9rem', borderRadius: 10, textDecoration: 'none' }}
          >
            ＋ Solicitar alta
          </Link>
          <Link
            to={`/polizas/${poliza.id}/solicitar?tipo=baja`}
            className="secondary-action"
            style={{ background: '#c4392a', color: '#fff', padding: '0.5rem 0.9rem', borderRadius: 10, textDecoration: 'none' }}
          >
            − Solicitar baja
          </Link>
          {/* ADDENDUM 12 Parte G — baja masiva por bulk import. */}
          <Link
            to={`/polizas/${poliza.id}/baja-masiva`}
            className="secondary-action secondary-action--ghost"
            title="Pegar lista de CUILs/patentes para baja masiva"
          >
            ⊟ Baja masiva
          </Link>
          {/* ADDENDUM 12 Parte C — configuración de email-config. */}
          <Link
            to={`/polizas/${poliza.id}/configuracion`}
            className="secondary-action secondary-action--ghost"
            title="Editar destinatarios y templates de email"
          >
            ⚙ Configuración
          </Link>
        </div>
      }
    >
      <div className="liq-tabbar" style={{ marginBottom: '1rem' }}>
        {([
          ['resumen',       'Resumen'],
          ['asegurados',    `Asegurados (${poliza.asegurados_count ?? 0})`],
          ['discrepancias', 'Discrepancias'],
          ['clausulas',     'Cláusulas vigentes'],
          ['endosos',       `Endosos (${poliza.endosos?.length ?? 0})`],
          ['email',         'Email config'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="tab-btn"
            onClick={() => setTab(key)}
            style={tab === key ? {
              background: '#1d74f5', color: '#fff',
              boxShadow: '0 8px 16px rgba(29,116,245,0.25)',
            } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <TabResumen poliza={poliza} />}
      {tab === 'asegurados' && (
        <TabAsegurados
          asegurados={asegurados}
          tipoAsegurado={poliza.tipo_asegurado}
          filterEstado={filterEstado}
          setFilterEstado={setFilterEstado}
          filterDudosos={filterDudosos}
          setFilterDudosos={setFilterDudosos}
          search={searchAsegurados}
          setSearch={setSearchAsegurados}
          apiBaseUrl={apiBaseUrl}
          onComentariosChange={fetchAsegurados}
        />
      )}
      {tab === 'discrepancias' && <TabDiscrepancias discrepancias={discrepancias} />}
      {tab === 'clausulas' && <TabClausulas clausulas={clausulasVigentes} />}
      {tab === 'endosos' && <TabEndosos endosos={poliza.endosos ?? []} />}
      {tab === 'email' && <TabEmail configs={poliza.email_configs ?? []} />}
    </DashboardLayout>
  );
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TabResumen: React.FC<{ poliza: Poliza }> = ({ poliza }) => (
  <div className="dashboard-card">
    <div className="card-header"><h3 style={{ margin: 0 }}>Datos de la póliza</h3></div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <Row label="Aseguradora" value={poliza.aseguradora?.nombre} />
        <Row label="Ramo / Subramo" value={`${poliza.ramo}${poliza.subramo ? ' · ' + poliza.subramo : ''}`} />
        <Row label="Tipo asegurado" value={poliza.tipo_asegurado} />
        <Row label="N° póliza" value={poliza.numero_poliza} />
        <Row label="N° cuenta" value={poliza.numero_cuenta_cliente} />
        <Row label="Vigencia" value={`${fmtDate(poliza.vigencia_desde)} → ${fmtDate(poliza.vigencia_hasta)}`} />
        <Row label="Tomador" value={poliza.tomador_razon_social} />
        <Row label="CUIT tomador" value={poliza.tomador_cuit} />
        <Row label="Domicilio" value={poliza.tomador_domicilio} />
        <Row label="Suma asegurada total" value={fmtMoney(poliza.suma_asegurada_total)} />
        <Row label="Premio anual" value={fmtMoney(poliza.premio_anual)} />
        <Row label="Cláusulas especiales" value={poliza.clausulas_especiales} />
        <Row label="Alerta vencimiento" value={`${poliza.alerta_dias_antes_vencimiento} días antes`} />
      </tbody>
    </table>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <tr style={{ borderBottom: '1px solid #eef1f6' }}>
    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#666', width: 200 }}>{label}</td>
    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}>{value || '—'}</td>
  </tr>
);

type TabAseguradosProps = {
  asegurados: Array<PolizaAsegurado | PolizaAseguradoConChoferes> | null;
  /** Si es 'vehiculo' renderizamos columna expand ▼ con choferes vinculados. */
  tipoAsegurado: 'persona' | 'vehiculo';
  filterEstado: string;
  setFilterEstado: (v: string) => void;
  filterDudosos: boolean;
  setFilterDudosos: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  apiBaseUrl: string;
  onComentariosChange?: () => void | Promise<void>;
};

// ADDENDUM 10 Parte A — preset filter de fecha de alta. Cliente-side; cuando
// crezca >500 asegurados, migrar a query param backend (nota del usuario).
type FechaAltaPreset = '' | 'last30' | 'last60' | 'last90' | 'custom';

// Type-guard para distinguir el shape enriquecido del plano cuando la póliza es de vehículos.
function tieneChoferes(a: PolizaAsegurado | PolizaAseguradoConChoferes): a is PolizaAseguradoConChoferes {
  return 'choferes' in a && Array.isArray((a as PolizaAseguradoConChoferes).choferes);
}

const TabAsegurados: React.FC<TabAseguradosProps> = ({
  asegurados, tipoAsegurado, filterEstado, setFilterEstado, filterDudosos, setFilterDudosos, search, setSearch,
  apiBaseUrl, onComentariosChange,
}) => {
  const [fechaAltaPreset, setFechaAltaPreset] = useState<FechaAltaPreset>('');
  const [fechaAltaDesde, setFechaAltaDesde] = useState<string>('');
  const [fechaAltaHasta, setFechaAltaHasta] = useState<string>('');
  // ADDENDUM 10 Parte B — modal de comentarios.
  const [modalComentarios, setModalComentarios] = useState<{ id: number; identificador: string } | null>(null);
  // ADDENDUM 10 sub-fase 2 — expand ▼ por fila + filtro cobertura completa.
  const [filterCobertura, setFilterCobertura] = useState<'' | 'completa' | 'incompleta'>('');
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  // ADDENDUM 12 Parte E — selección múltiple para acción "Eliminar".
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [eliminarModal, setEliminarModal] = useState<{ ids: number[]; descripcion: string } | null>(null);

  const toggleSel = (id: number) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const esVehiculo = tipoAsegurado === 'vehiculo';

  const toggleExpand = (id: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const expandirTodos = () => {
    if (!asegurados) return;
    const conChoferes = asegurados
      .filter(tieneChoferes)
      .filter((a) => a.choferes_count > 0)
      .map((a) => a.id);
    setExpandidos(new Set(conChoferes));
  };
  const colapsarTodos = () => setExpandidos(new Set());

  const aseguradosFiltrados = useMemo(() => {
    if (!asegurados) return null;
    let result = asegurados;

    if (fechaAltaPreset) {
      const now = new Date();
      let desdeMs: number | null = null;
      let hastaMs: number | null = null;

      if (fechaAltaPreset === 'last30' || fechaAltaPreset === 'last60' || fechaAltaPreset === 'last90') {
        const dias = fechaAltaPreset === 'last30' ? 30 : fechaAltaPreset === 'last60' ? 60 : 90;
        desdeMs = now.getTime() - dias * 86400000;
      } else if (fechaAltaPreset === 'custom') {
        if (fechaAltaDesde) desdeMs = new Date(fechaAltaDesde + 'T00:00:00').getTime();
        if (fechaAltaHasta) hastaMs = new Date(fechaAltaHasta + 'T23:59:59').getTime();
      }

      result = result.filter((a) => {
        if (!a.fecha_alta_efectiva) return false;
        const t = new Date(a.fecha_alta_efectiva.slice(0, 10) + 'T00:00:00').getTime();
        if (desdeMs !== null && t < desdeMs) return false;
        if (hastaMs !== null && t > hastaMs) return false;
        return true;
      });
    }

    if (filterCobertura && esVehiculo) {
      result = result.filter((a) => {
        if (!tieneChoferes(a)) return true;  // sin info de choferes: no filtramos
        if (filterCobertura === 'completa') {
          // Cobertura completa = sin choferes vinculados, o todos con AP.
          return a.cobertura_completa === null || a.cobertura_completa === true;
        } else {
          // Incompleta = al menos un chofer sin AP.
          return a.cobertura_completa === false;
        }
      });
    }

    return result;
  }, [asegurados, fechaAltaPreset, fechaAltaDesde, fechaAltaHasta, filterCobertura, esVehiculo]);

  const handleExportCsv = () => {
    if (!aseguradosFiltrados || aseguradosFiltrados.length === 0) return;
    const headers = [
      'N° orden', 'Identificador', 'Tipo identificador', 'Nombre / Vehículo',
      'Distribuidor', 'CUIL distribuidor', 'Estado distribuidor',
      'Estado póliza', 'Fecha alta', 'Match método',
    ];
    const rows = aseguradosFiltrados.map((a) => [
      a.numero_orden_aseguradora ?? '',
      a.identificador,
      a.identificador_tipo,
      a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '',
      a.persona?.nombre_completo ?? '',
      a.persona?.cuil ?? '',
      a.persona?.estado_actual ?? '',
      a.estado,
      a.fecha_alta_efectiva ?? '',
      a.match_metodo ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asegurados_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-card">
      <div className="filters-bar" style={{ marginBottom: '1rem', alignItems: 'center', gap: '1rem' }}>
        <label className="filter-field">
          <span>Estado</span>
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="alta_solicitada">Alta solicitada</option>
            <option value="baja_solicitada">Baja solicitada</option>
            <option value="dado_de_baja">Dado de baja</option>
            <option value="no_matcheado">Sin match</option>
          </select>
        </label>
        <label className="filter-field" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={filterDudosos} onChange={(e) => setFilterDudosos(e.target.checked)} />
          <span>Sólo dudosos / sugerencia fuzzy</span>
        </label>
        <label className="filter-field">
          <span>Fecha alta</span>
          <select value={fechaAltaPreset} onChange={(e) => setFechaAltaPreset(e.target.value as FechaAltaPreset)}>
            <option value="">Cualquiera</option>
            <option value="last30">Últimos 30 días</option>
            <option value="last60">Últimos 60 días</option>
            <option value="last90">Últimos 90 días</option>
            <option value="custom">Personalizado…</option>
          </select>
        </label>
        {fechaAltaPreset === 'custom' && (
          <>
            <label className="filter-field">
              <span>Desde</span>
              <input type="date" value={fechaAltaDesde} onChange={(e) => setFechaAltaDesde(e.target.value)} />
            </label>
            <label className="filter-field">
              <span>Hasta</span>
              <input type="date" value={fechaAltaHasta} onChange={(e) => setFechaAltaHasta(e.target.value)} />
            </label>
          </>
        )}
        {esVehiculo && (
          <label className="filter-field">
            <span>Cobertura</span>
            <select
              value={filterCobertura}
              onChange={(e) => setFilterCobertura(e.target.value as '' | 'completa' | 'incompleta')}
              title="Filtrar titulares según si todos sus choferes tienen cobertura AP"
            >
              <option value="">Cualquiera</option>
              <option value="completa">Completa (titular + todos los choferes con AP)</option>
              <option value="incompleta">Incompleta (algún chofer sin AP)</option>
            </select>
          </label>
        )}
        <label className="filter-field" style={{ flex: '1 1 240px', minWidth: 200 }}>
          <span>Buscar</span>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="patente, CUIL, nombre, distribuidor…"
          />
        </label>
        {esVehiculo && (
          <div style={{ display: 'flex', gap: '0.4rem', alignSelf: 'flex-end' }}>
            <button
              type="button"
              onClick={expandirTodos}
              className="secondary-action secondary-action--ghost"
              title="Expandir todas las filas con choferes vinculados"
            >
              ▼ Expandir todos
            </button>
            <button
              type="button"
              onClick={colapsarTodos}
              className="secondary-action secondary-action--ghost"
              title="Colapsar todas las filas"
            >
              ▶ Colapsar
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!aseguradosFiltrados || aseguradosFiltrados.length === 0}
          className="secondary-action secondary-action--ghost"
          style={{ alignSelf: 'flex-end' }}
          title="Exportar lista filtrada como CSV (compatible con Excel)"
        >
          ⇪ Export CSV
        </button>
      </div>

      {/* ADDENDUM 12 Parte E — barra de acción cuando hay selección. */}
      {seleccionadas.size > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.6rem 0.9rem', background: '#fff5e6', border: '1px solid #c70',
          borderRadius: 8, marginBottom: '0.5rem', fontSize: '0.9rem',
        }}>
          <span><b>{seleccionadas.size}</b> asegurado{seleccionadas.size > 1 ? 's' : ''} seleccionado{seleccionadas.size > 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setEliminarModal({
                ids: Array.from(seleccionadas),
                descripcion: `${seleccionadas.size} asegurado${seleccionadas.size > 1 ? 's' : ''}`,
              })}
              style={{
                background: '#c4392a', color: '#fff', border: 0,
                padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              🗑 Eliminar seleccionados
            </button>
            <button type="button" onClick={() => setSeleccionadas(new Set())}
                    className="secondary-action secondary-action--ghost">
              Limpiar
            </button>
          </div>
        </div>
      )}

      {aseguradosFiltrados === null && <div style={{ padding: '1rem' }}>Cargando…</div>}
      {aseguradosFiltrados !== null && aseguradosFiltrados.length === 0 && (
        <div style={{ padding: '1rem', color: '#666' }}>
          {search
            ? `No se encontraron resultados para "${search}".`
            : fechaAltaPreset
              ? 'No hay asegurados con fecha de alta en el rango seleccionado.'
              : 'No hay asegurados cargados todavía. Cargá un PDF desde "Cargar PDF".'}
        </div>
      )}
      {aseguradosFiltrados !== null && aseguradosFiltrados.length > 0 && (
        <div className="table-wrapper">
          <table className="bdd-activos-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  {/* Select-all sobre las filas visibles. */}
                  <input
                    type="checkbox"
                    checked={aseguradosFiltrados.length > 0
                      && aseguradosFiltrados.every((a) => seleccionadas.has(a.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSeleccionadas(new Set(aseguradosFiltrados.map((a) => a.id)));
                      } else {
                        setSeleccionadas(new Set());
                      }
                    }}
                    aria-label="Seleccionar todos los visibles"
                  />
                </th>
                {esVehiculo && <th style={{ width: 28 }}></th>}
                <th>N° orden</th>
                <th>Identificador</th>
                <th>Nombre / Vehículo</th>
                <th>Distribuidor</th>
                <th>Estado dist.</th>
                <th>Estado póliza</th>
                <th>Fecha alta</th>
                <th>Comentarios</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {aseguradosFiltrados.map((a) => {
                const enr = tieneChoferes(a) ? a : null;
                const tieneChoferesVinculados = !!enr && enr.choferes_count > 0;
                const expandido = expandidos.has(a.id);
                const incompleta = enr?.cobertura_completa === false;
                const filaStyle: React.CSSProperties | undefined = a.revision_manual_pendiente
                  ? { background: '#fffbe6' }
                  : incompleta
                    ? { background: '#fff5e6' }  // ámbar suave si tiene choferes sin AP
                    : undefined;
                // +1 por checkbox, +1 por columna acción al final.
                const totalCols = (esVehiculo ? 9 : 8) + 2;

                return (
                  <React.Fragment key={a.id}>
                    <tr style={filaStyle}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(a.id)}
                          onChange={() => toggleSel(a.id)}
                          aria-label={`Seleccionar ${a.identificador}`}
                        />
                      </td>
                      {esVehiculo && (
                        <td style={{ textAlign: 'center' }}>
                          {tieneChoferesVinculados ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(a.id)}
                              aria-label={expandido ? 'Colapsar choferes' : 'Expandir choferes'}
                              title={`${enr!.choferes_count} chofer(es) vinculado(s)`}
                              style={{
                                background: 'transparent', border: 0, cursor: 'pointer',
                                fontSize: '0.9rem', padding: '0.1rem 0.3rem', color: incompleta ? '#c70' : '#1d74f5',
                              }}
                            >
                              {expandido ? '▼' : '▶'}
                            </button>
                          ) : (
                            <span style={{ color: '#ccc', fontSize: '0.75rem' }} title="Sin choferes vinculados">·</span>
                          )}
                        </td>
                      )}
                      <td>{a.numero_orden_aseguradora ?? '—'}</td>
                      <td>
                        <code>{a.identificador}</code>{' '}
                        <small style={{ color: '#888' }}>({a.identificador_tipo})</small>
                        {a.match_metodo && (
                          <small style={{ display: 'block', color: '#666' }}>
                            match {a.match_metodo}
                          </small>
                        )}
                      </td>
                      <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}</td>
                      <td>
                        {a.persona ? (
                          <Link to={`/personal/${a.persona.id}/editar`}>
                            {a.persona.nombre_completo}
                          </Link>
                        ) : a.sugerencia_fuzzy_persona ? (
                          <small style={{ color: '#666' }}>
                            sugerencia: {a.sugerencia_fuzzy_persona.nombre}
                            {a.sugerencia_fuzzy_score && ` (${parseFloat(a.sugerencia_fuzzy_score).toFixed(2)})`}
                          </small>
                        ) : (
                          <span style={{ color: '#c00' }}>sin match</span>
                        )}
                        {tieneChoferesVinculados && (
                          <small style={{ display: 'block', color: incompleta ? '#c70' : '#0a8c3a', marginTop: 2 }}>
                            {incompleta ? '⚠' : '✅'} {enr!.choferes_count} chofer{enr!.choferes_count > 1 ? 'es' : ''} vinculado{enr!.choferes_count > 1 ? 's' : ''}
                          </small>
                        )}
                      </td>
                      <td>
                        <EstadoDistribuidorBadge
                          estado={a.persona?.estado_actual ?? null}
                          alerta={a.persona_alerta_estado}
                        />
                      </td>
                      <td>
                        {/* ADDENDUM 12 Parte D — distingue "baja_solicitada" como
                            "Baja en proceso" (ámbar) del terminal "dado_de_baja". */}
                        {a.estado === 'baja_solicitada' ? (
                          <span
                            className="estado-badge estado-badge--pendiente"
                            title="Solicitud de baja enviada — esperando confirmación de la aseguradora"
                          >
                            ⏳ Baja en proceso
                          </span>
                        ) : (
                          <span className={`estado-badge estado-badge--${cssEstado(a.estado)}`}>{a.estado}</span>
                        )}
                      </td>
                      <td>
                        {a.fecha_alta_efectiva ? fmtDate(a.fecha_alta_efectiva) : '—'}
                        {a.fecha_baja_efectiva && (
                          <small style={{ display: 'block', color: '#c4392a', fontSize: '0.75rem' }}>
                            Baja: {fmtDate(a.fecha_baja_efectiva)}
                          </small>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setModalComentarios({ id: a.id, identificador: a.identificador })}
                          title={a.ultimo_comentario ?? 'Agregar comentario'}
                          style={{
                            background: 'transparent', border: '1px solid #d0d7e1',
                            padding: '0.2rem 0.5rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                          }}
                        >
                          {(a.comentarios_count ?? 0) > 0 ? `💬 ${a.comentarios_count}` : '+ Comentar'}
                        </button>
                        {a.ultimo_comentario && (
                          <small style={{ display: 'block', color: '#888', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.ultimo_comentario}
                          </small>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {/* ADDENDUM 12 Parte E — eliminar individual. */}
                        <button
                          type="button"
                          onClick={() => setEliminarModal({
                            ids: [a.id],
                            descripcion: `${a.identificador}${a.persona ? ` (${a.persona.nombre_completo})` : ''}`,
                          })}
                          aria-label={`Eliminar asegurado ${a.identificador}`}
                          title="Eliminar asegurado (soft delete con motivo obligatorio)"
                          style={{
                            background: 'transparent', border: 0, cursor: 'pointer',
                            color: '#c4392a', fontSize: '0.95rem', padding: '0.2rem 0.4rem',
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>

                    {expandido && tieneChoferesVinculados && (
                      <tr style={{ background: '#fafbfd' }}>
                        <td colSpan={totalCols} style={{ padding: '0.5rem 1rem 0.75rem 2.4rem' }}>
                          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.4rem' }}>
                            ↳ Backup choferes ({enr!.choferes.length}):
                          </div>
                          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                            <tbody>
                              {enr!.choferes.map((c) => {
                                const sinAp = c.polizas_ap_activas.length === 0;
                                return (
                                  <tr key={c.relacion_id} style={{ borderBottom: '1px solid #eef1f6' }}>
                                    <td style={{ padding: '0.35rem 0.5rem' }}>
                                      <Link to={`/personal/${c.persona_id}/editar`}>
                                        <b>{c.nombre_completo}</b>
                                      </Link>
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem', color: '#666' }}>
                                      <code style={{ fontSize: '0.75rem' }}>{c.cuil ?? '—'}</code>
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem' }}>
                                      <EstadoDistribuidorBadge estado={c.estado_persona} />
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem', color: '#888' }}>
                                      {c.rol} · vinc. {c.fecha_vinculacion ?? '—'}
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem' }}>
                                      {sinAp ? (
                                        <span
                                          style={{
                                            background: '#fff5e6', color: '#c70',
                                            padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.78rem',
                                          }}
                                        >
                                          ⚠ Sin AP
                                        </span>
                                      ) : (
                                        <span
                                          title={c.polizas_ap_activas.map((p) => p.nombre).join(' · ')}
                                          style={{
                                            background: '#e7f7ed', color: '#0a8c3a',
                                            padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.78rem',
                                          }}
                                        >
                                          ✅ AP en {c.polizas_ap_activas.length === 1
                                            ? c.polizas_ap_activas[0].aseguradora ?? 'aseguradora'
                                            : `${c.polizas_ap_activas.length} pólizas`}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                      {sinAp && (
                                        <Link
                                          to={`/polizas?solicitar_alta_persona=${c.persona_id}`}
                                          style={{
                                            background: '#1d74f5', color: '#fff', textDecoration: 'none',
                                            padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.78rem',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          Solicitar alta AP →
                                        </Link>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalComentarios && (
        <ComentariosAseguradoModal
          apiBaseUrl={apiBaseUrl}
          asegurado={modalComentarios}
          onClose={() => setModalComentarios(null)}
          onChange={() => { onComentariosChange?.(); }}
        />
      )}

      {/* ADDENDUM 12 Parte E — modal de motivo de eliminación. */}
      {eliminarModal && (
        <EliminarAseguradosModal
          apiBaseUrl={apiBaseUrl}
          ids={eliminarModal.ids}
          descripcion={eliminarModal.descripcion}
          onClose={() => setEliminarModal(null)}
          onConfirmed={() => {
            setEliminarModal(null);
            setSeleccionadas(new Set());
            onComentariosChange?.();  // refetch del listado
          }}
        />
      )}
    </div>
  );
};

// ─── ADDENDUM 12 Parte E — Modal eliminación con motivo obligatorio ──────────

const EliminarAseguradosModal: React.FC<{
  apiBaseUrl: string;
  ids: number[];
  descripcion: string;
  onClose: () => void;
  onConfirmed: () => void;
}> = ({ apiBaseUrl, ids, descripcion, onClose, onConfirmed }) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminar = async () => {
    if (motivo.trim().length < 3) {
      setError('Motivo obligatorio (mínimo 3 caracteres).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = ids.length === 1
        ? `${apiBaseUrl}/api/polizas/asegurados/${ids[0]}`
        : `${apiBaseUrl}/api/polizas/asegurados/eliminar-masivo`;
      const init: RequestInit = ids.length === 1
        ? {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: motivo.trim() }),
        }
        : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asegurado_ids: ids, motivo: motivo.trim() }),
        };
      const resp = await fetch(url, init);
      if (!resp.ok) {
        const t = await resp.text();
        let msg = t;
        try { msg = JSON.parse(t)?.message ?? t; } catch { /* noop */ }
        throw new Error(msg);
      }
      onConfirmed();
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
      <div className="dashboard-card" style={{ width: 'min(560px, 92vw)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: '#c4392a' }}>Eliminar {descripcion}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer' }}
          >×</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0' }}>
          Motivo de eliminación (obligatorio). Esta acción es <b>reversible solo desde el panel de auditoría</b>
          {' '}por un super admin (se preserva la fila en BD con flags soft-delete).
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ej: cargado por error en parser, duplicado, etc."
          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d0d7e1', resize: 'vertical' }}
        />
        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '0.5rem', borderRadius: 6, marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} className="secondary-action secondary-action--ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={saving || motivo.trim().length < 3}
            style={{
              background: saving || motivo.trim().length < 3 ? '#aaa' : '#c4392a',
              color: '#fff', padding: '0.5rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
            }}
          >
            {saving ? 'Eliminando…' : `Confirmar eliminación de ${ids.length}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const cssEstado = (e: string): string => ({
  activo:           'activo',
  alta_solicitada:  'pendiente',
  baja_solicitada:  'pendiente',
  dado_de_baja:     'baja',
  no_matcheado:     'default',
}[e] ?? 'default');

const TabDiscrepancias: React.FC<{ discrepancias: Discrepancias | null }> = ({ discrepancias }) => {
  if (!discrepancias) return <div style={{ padding: '1rem' }}>Cargando reportes…</div>;
  const { asegurados_sin_persona, personas_sin_poliza, match_dudoso, estado_inconsistente } = discrepancias;
  const totalEstadoIncons = (Object.values(estado_inconsistente ?? {}) as Array<unknown[]>)
    .reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Section
        title={`🔴 Asegurados sin match (${asegurados_sin_persona.length})`}
        emptyText="No hay asegurados sin match — la póliza está limpia."
        items={asegurados_sin_persona}
        renderRow={(a) => (
          <>
            <td><code>{a.identificador}</code></td>
            <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}</td>
            <td>{a.estado}</td>
          </>
        )}
        headers={['Identificador', 'Nombre / Vehículo', 'Estado']}
      />
      <Section
        title={`🟡 Personas sin cobertura (${personas_sin_poliza.length})`}
        emptyText="No hay personas activas sin cobertura."
        items={personas_sin_poliza}
        renderRow={(p) => (
          <>
            <td>
              <Link to={`/personal/${p.persona_id}/editar`}>{p.nombre}</Link>
            </td>
            <td><code>{p.cuil}</code></td>
            <td>{p.patente || '—'}</td>
            <td>{p.perfil || '—'}</td>
          </>
        )}
        headers={['Nombre', 'CUIL', 'Patente', 'Perfil']}
      />
      <Section
        title={`🟠 Sugerencia fuzzy pendiente (${match_dudoso.length})`}
        emptyText="No hay asegurados con sugerencia fuzzy esperando revisión."
        items={match_dudoso}
        renderRow={(d) => (
          <>
            <td>
              <code>{d.identificador}</code>{' '}
              <small style={{ color: '#888' }}>{d.nombre_apellido_pdf ?? '—'}</small>
            </td>
            <td>
              {d.persona_sugerida ? (
                <Link to={`/personal/${d.persona_sugerida.id}/editar`}>{d.persona_sugerida.nombre}</Link>
              ) : '—'}
            </td>
            <td>{d.persona_sugerida?.cuil ?? '—'}</td>
            <td>{d.sugerencia_fuzzy_score ? parseFloat(d.sugerencia_fuzzy_score).toFixed(3) : '—'}</td>
          </>
        )}
        headers={['PDF', 'Persona sugerida', 'CUIL sugerencia', 'Score']}
      />
      {totalEstadoIncons > 0 && (
        <div className="dashboard-card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>⚠️ Estado inconsistente ({totalEstadoIncons})</h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
            Asegurados activos en póliza pero la persona vinculada está en otro estado.
            Probablemente convenga pedir baja en la póliza.
          </p>
          {(([
            ['persona_baja_en_poliza_activa',                'persona en BAJA'],
            ['persona_suspendida_en_poliza_activa',          'persona SUSPENDIDA'],
            ['persona_solicitud_pendiente_en_poliza_activa', 'persona en SOLICITUD pendiente'],
            ['persona_sin_aprobar_en_poliza_activa',         'persona SIN APROBAR'],
          ] as const)).map(([key, label]) => {
            const items = estado_inconsistente?.[key] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={key} style={{ marginTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem' }}>
                  {label} ({items.length})
                </h4>
                <div className="table-wrapper">
                  <table className="bdd-activos-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Identificador</th>
                        <th>Persona</th>
                        <th>CUIL</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 50).map((it) => (
                        <tr key={it.asegurado_id} style={{ background: '#fffbe6' }}>
                          <td><code>{it.identificador}</code></td>
                          <td>
                            <Link to={`/personal/${it.persona_id}/editar`}>{it.persona_nombre}</Link>
                          </td>
                          <td><code style={{ fontSize: '0.75rem' }}>{it.persona_cuil ?? '—'}</code></td>
                          <td>{it.persona_estado_al_matchear}</td>
                          <td>
                            <Link to={`/polizas/${discrepancias.poliza_id}/solicitar?tipo=baja`}
                              style={{ background: '#c4392a', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.8rem' }}>
                              Pedir baja
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {items.length > 50 && (
                    <div style={{ padding: '0.5rem', textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>
                      Mostrando 50 de {items.length}.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

type SectionProps<T> = {
  title: string;
  emptyText: string;
  items: T[];
  headers: string[];
  renderRow: (item: T) => React.ReactNode;
};

function Section<T extends { id?: number; persona_id?: number }>({ title, emptyText, items, headers, renderRow }: SectionProps<T>) {
  return (
    <div className="dashboard-card">
      <div className="card-header"><h3 style={{ margin: 0 }}>{title}</h3></div>
      {items.length === 0 ? (
        <div style={{ padding: '0.5rem 0', color: '#666' }}>{emptyText}</div>
      ) : (
        <div className="table-wrapper">
          <table className="bdd-activos-table" style={{ width: '100%' }}>
            <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {items.slice(0, 100).map((it, i) => (
                <tr key={(it.id ?? it.persona_id ?? i)}>{renderRow(it)}</tr>
              ))}
            </tbody>
          </table>
          {items.length > 100 && (
            <div style={{ padding: '0.5rem', textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>
              Mostrando 100 de {items.length}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TabClausulas: React.FC<{ clausulas: ClausulaAplicada[] | null }> = ({ clausulas }) => (
  <div className="dashboard-card">
    <div className="card-header">
      <h3 style={{ margin: 0 }}>Cláusulas vigentes</h3>
      <Link to="/polizas/configuracion/clausulas" className="secondary-action secondary-action--ghost">
        Ir al catálogo
      </Link>
    </div>
    {clausulas === null && <div style={{ padding: '0.5rem' }}>Cargando…</div>}
    {clausulas !== null && clausulas.length === 0 && (
      <div style={{ padding: '0.5rem 0', color: '#666' }}>
        Esta póliza no tiene cláusulas aplicadas. Aplicá una desde el catálogo si corresponde.
      </div>
    )}
    {clausulas !== null && clausulas.length > 0 && (
      <div className="table-wrapper">
        <table className="bdd-activos-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Cláusula</th>
              <th>CUIT titular</th>
              <th>Tipo</th>
              <th>Aplicación</th>
              <th>Vigente desde</th>
            </tr>
          </thead>
          <tbody>
            {clausulas.map((ca) => (
              <tr key={ca.id}>
                <td>
                  <b>{ca.clausula?.nombre_corto ?? '—'}</b>
                  <small style={{ display: 'block', color: '#888' }}>
                    alias "{ca.clausula?.alias}"
                  </small>
                </td>
                <td><code>{ca.clausula?.cuit_titular}</code></td>
                <td>{ca.clausula?.tipo}</td>
                <td>{ca.tipo_aplicacion}</td>
                <td>{fmtDate(ca.aplicada_desde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const TabEndosos: React.FC<{ endosos: NonNullable<Poliza['endosos']> }> = ({ endosos }) => (
  <div className="dashboard-card">
    <div className="card-header"><h3 style={{ margin: 0 }}>Endosos cargados</h3></div>
    {endosos.length === 0 ? (
      <div style={{ padding: '0.5rem 0', color: '#666' }}>
        No hay endosos cargados. Subí un PDF desde "Cargar PDF" (próximamente).
      </div>
    ) : (
      <div className="table-wrapper">
        <table className="bdd-activos-table" style={{ width: '100%' }}>
          <thead><tr><th>N° endoso</th><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Premio</th></tr></thead>
          <tbody>
            {endosos.map((e) => (
              <tr key={e.id}>
                <td>{e.numero_endoso}</td>
                <td>{e.tipo}</td>
                <td>{fmtDate(e.fecha_emision)}</td>
                <td style={{ maxWidth: 400 }}>{e.descripcion ?? '—'}</td>
                <td>{fmtMoney(e.premio_endoso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const TabEmail: React.FC<{ configs: PolizaEmailConfig[] }> = ({ configs }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
    {configs.map((c) => (
      <div key={c.id} className="dashboard-card">
        <div className="card-header">
          <h3 style={{ margin: 0, textTransform: 'capitalize' }}>Email — {c.tipo}</h3>
          {c.contacto_nombre && <span className="chip chip--muted">a {c.contacto_nombre}</span>}
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          <div><b>To:</b> {c.destinatarios_to.join(', ') || '—'}</div>
          {c.destinatarios_cc && c.destinatarios_cc.length > 0 && (
            <div><b>CC:</b> {c.destinatarios_cc.join(', ')}</div>
          )}
          <div style={{ marginTop: '0.5rem' }}><b>Asunto:</b> <code>{c.asunto_template}</code></div>
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer' }}>Ver body template</summary>
            <pre style={{
              whiteSpace: 'pre-wrap', background: '#f7f9fc', padding: '0.5rem',
              borderRadius: 8, fontSize: '0.8rem', marginTop: '0.5rem',
            }}>{c.body_template}</pre>
          </details>
          {c.adjuntos_requeridos && c.adjuntos_requeridos.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <b>Adjuntos requeridos:</b>{' '}
              {c.adjuntos_requeridos.map((a) => <span key={a} className="chip" style={{ marginRight: 4 }}>{a}</span>)}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);
