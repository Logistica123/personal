import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  Discrepancias,
  Poliza,
  PolizaAsegurado,
  PolizaEmailConfig,
} from '../features/polizas/types';

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

type Tab = 'resumen' | 'asegurados' | 'discrepancias' | 'endosos' | 'email';

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

  const [asegurados, setAsegurados] = useState<PolizaAsegurado[] | null>(null);
  const [discrepancias, setDiscrepancias] = useState<Discrepancias | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterDudosos, setFilterDudosos] = useState(false);

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

  // ---- fetch asegurados (lazy al activar tab) ----
  const fetchAsegurados = useCallback(async () => {
    if (!polizaId) return;
    const params = new URLSearchParams();
    if (filterEstado) params.set('estado', filterEstado);
    if (filterDudosos) params.set('solo_dudosos', '1');
    const url = `${apiBaseUrl}/api/polizas/${polizaId}/asegurados${params.toString() ? '?' + params : ''}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: PolizaAsegurado[] };
      setAsegurados(data ?? []);
    }
  }, [polizaId, apiBaseUrl, filterEstado, filterDudosos]);

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
        </div>
      }
    >
      <div className="liq-tabbar" style={{ marginBottom: '1rem' }}>
        {([
          ['resumen',       'Resumen'],
          ['asegurados',    `Asegurados (${poliza.asegurados_count ?? 0})`],
          ['discrepancias', 'Discrepancias'],
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
          filterEstado={filterEstado}
          setFilterEstado={setFilterEstado}
          filterDudosos={filterDudosos}
          setFilterDudosos={setFilterDudosos}
        />
      )}
      {tab === 'discrepancias' && <TabDiscrepancias discrepancias={discrepancias} />}
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
  asegurados: PolizaAsegurado[] | null;
  filterEstado: string;
  setFilterEstado: (v: string) => void;
  filterDudosos: boolean;
  setFilterDudosos: (v: boolean) => void;
};

const TabAsegurados: React.FC<TabAseguradosProps> = ({
  asegurados, filterEstado, setFilterEstado, filterDudosos, setFilterDudosos,
}) => (
  <div className="dashboard-card">
    <div className="filters-bar" style={{ marginBottom: '1rem' }}>
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
        <span>Sólo dudosos</span>
      </label>
    </div>

    {asegurados === null && <div style={{ padding: '1rem' }}>Cargando…</div>}
    {asegurados !== null && asegurados.length === 0 && (
      <div style={{ padding: '1rem', color: '#666' }}>
        No hay asegurados cargados todavía. Cargá un PDF desde "Cargar PDF" (próximamente).
      </div>
    )}
    {asegurados !== null && asegurados.length > 0 && (
      <div className="table-wrapper">
        <table className="bdd-activos-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>N° orden</th>
              <th>Identificador</th>
              <th>Nombre / Vehículo</th>
              <th>Estado</th>
              <th>Match</th>
              <th>Persona</th>
            </tr>
          </thead>
          <tbody>
            {asegurados.map((a) => (
              <tr key={a.id} style={a.revision_manual_pendiente ? { background: '#fffbe6' } : undefined}>
                <td>{a.numero_orden_aseguradora ?? '—'}</td>
                <td><code>{a.identificador}</code> <small style={{ color: '#888' }}>({a.identificador_tipo})</small></td>
                <td>{a.nombre_apellido_pdf ?? a.marca_modelo_pdf ?? '—'}</td>
                <td><span className={`estado-badge estado-badge--${cssEstado(a.estado)}`}>{a.estado}</span></td>
                <td>
                  {a.match_metodo ? (
                    <small>
                      {a.match_metodo}
                      {a.match_score && ` (${parseFloat(a.match_score).toFixed(2)})`}
                    </small>
                  ) : '—'}
                </td>
                <td>
                  {a.persona ? (
                    <Link to={`/personal/${a.persona.id}/editar`}>
                      {a.persona.apellidos}, {a.persona.nombres}
                    </Link>
                  ) : <span style={{ color: '#c00' }}>sin match</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const cssEstado = (e: string): string => ({
  activo:           'activo',
  alta_solicitada:  'pendiente',
  baja_solicitada:  'pendiente',
  dado_de_baja:     'baja',
  no_matcheado:     'default',
}[e] ?? 'default');

const TabDiscrepancias: React.FC<{ discrepancias: Discrepancias | null }> = ({ discrepancias }) => {
  if (!discrepancias) return <div style={{ padding: '1rem' }}>Cargando reportes…</div>;
  const { asegurados_sin_persona, personas_sin_poliza, match_dudoso } = discrepancias;

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
        title={`🟠 Match dudoso (${match_dudoso.length})`}
        emptyText="No hay matches con revisión manual pendiente."
        items={match_dudoso}
        renderRow={(d) => (
          <>
            <td>{d.nombre_apellido_pdf ?? d.identificador}</td>
            <td>{d.persona_sugerida?.nombre ?? '—'}</td>
            <td>{d.match_score ? parseFloat(d.match_score).toFixed(3) : '—'}</td>
            <td>{d.motivo}</td>
          </>
        )}
        headers={['PDF', 'Persona sugerida', 'Score', 'Motivo']}
      />
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
