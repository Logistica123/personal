import React, { useEffect, useMemo, useState } from 'react';
import type {
  AuditLogRecord,
  NosisAuditDetailRecord,
  NosisAuditPayload,
  NosisAuditSummaryRecord,
} from '../features/auditoria/types';
import { downloadCsv } from '../lib/csv';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

export type AuditPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
  formatCurrency: (value: string | number | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
};

export const AuditPage: React.FC<AuditPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  getUserRole,
  formatCurrency,
  formatDateTime,
}) => {
  const authUser = useStoredAuthUser();
  const userRole = useMemo(() => getUserRole(authUser), [authUser]);
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [actorQuery, setActorQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const toDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayDate = useMemo(() => toDateInput(new Date()), []);
  const monthStartDate = useMemo(() => {
    const now = new Date();
    return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);
  const [nosisAgentQuery, setNosisAgentQuery] = useState('');
  const [nosisTipoQuery, setNosisTipoQuery] = useState<'CUIL' | 'CBU' | ''>('');
  const [nosisFromQuery, setNosisFromQuery] = useState(monthStartDate);
  const [nosisToQuery, setNosisToQuery] = useState(todayDate);
  const [nosisAgentFilter, setNosisAgentFilter] = useState('');
  const [nosisTipoFilter, setNosisTipoFilter] = useState<'CUIL' | 'CBU' | ''>('');
  const [nosisFromFilter, setNosisFromFilter] = useState(monthStartDate);
  const [nosisToFilter, setNosisToFilter] = useState(todayDate);
  const [nosisSummary, setNosisSummary] = useState<NosisAuditSummaryRecord[]>([]);
  const [nosisDetails, setNosisDetails] = useState<NosisAuditDetailRecord[]>([]);
  const [nosisPeriod, setNosisPeriod] = useState<{ from: string; to: string } | null>(null);
  const [nosisLoading, setNosisLoading] = useState(false);
  const [nosisError, setNosisError] = useState<string | null>(null);
  const [nosisRefreshTick, setNosisRefreshTick] = useState(0);

  useEffect(() => {
    if (userRole !== 'admin') {
      return;
    }
    const controller = new AbortController();
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = new URL(`${apiBaseUrl}/api/auditoria`);
        url.searchParams.set('limit', '200');
        if (actorFilter.trim().length > 0) {
          url.searchParams.set('agentName', actorFilter.trim());
        }
        if (emailFilter.trim().length > 0) {
          url.searchParams.set('actorEmail', emailFilter.trim());
        }
        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const payload = (await response.json()) as { data: AuditLogRecord[] };
        setLogs(Array.isArray(payload.data) ? payload.data : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudo cargar la auditoría.');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
    return () => controller.abort();
  }, [actorFilter, apiBaseUrl, emailFilter, refreshTick, userRole]);

  useEffect(() => {
    if (userRole !== 'admin') {
      return;
    }

    const controller = new AbortController();
    const fetchNosisAudit = async () => {
      try {
        setNosisLoading(true);
        setNosisError(null);
        const url = new URL(`${apiBaseUrl}/api/nosis/auditoria`);
        url.searchParams.set('limit', '2000');
        url.searchParams.set('from', nosisFromFilter);
        url.searchParams.set('to', nosisToFilter);
        if (nosisAgentFilter.trim().length > 0) {
          url.searchParams.set('agent', nosisAgentFilter.trim());
        }
        if (nosisTipoFilter) {
          url.searchParams.set('tipo', nosisTipoFilter);
        }

        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as NosisAuditPayload;
        setNosisSummary(Array.isArray(payload.summary) ? payload.summary : []);
        setNosisDetails(Array.isArray(payload.details) ? payload.details : []);
        setNosisPeriod(payload.period ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setNosisError((err as Error).message ?? 'No se pudo cargar la auditoría de Nosis.');
      } finally {
        setNosisLoading(false);
      }
    };

    fetchNosisAudit();
    return () => controller.abort();
  }, [apiBaseUrl, nosisAgentFilter, nosisFromFilter, nosisRefreshTick, nosisTipoFilter, nosisToFilter, userRole]);

  const applyFilters = () => {
    setActorFilter(actorQuery.trim());
    setEmailFilter(emailQuery.trim());
    setRefreshTick((prev) => prev + 1);
  };

  const clearFilters = () => {
    setActorQuery('');
    setEmailQuery('');
    setActorFilter('');
    setEmailFilter('');
    setRefreshTick((prev) => prev + 1);
  };

  const hasAnyFilter =
    actorFilter.trim().length > 0 ||
    emailFilter.trim().length > 0 ||
    actorQuery.trim().length > 0 ||
    emailQuery.trim().length > 0;
  const applyNosisFilters = () => {
    setNosisAgentFilter(nosisAgentQuery.trim());
    setNosisTipoFilter(nosisTipoQuery);
    setNosisFromFilter(nosisFromQuery || monthStartDate);
    setNosisToFilter(nosisToQuery || todayDate);
    setNosisRefreshTick((prev) => prev + 1);
  };

  const clearNosisFilters = () => {
    setNosisAgentQuery('');
    setNosisTipoQuery('');
    setNosisFromQuery(monthStartDate);
    setNosisToQuery(todayDate);
    setNosisAgentFilter('');
    setNosisTipoFilter('');
    setNosisFromFilter(monthStartDate);
    setNosisToFilter(todayDate);
    setNosisRefreshTick((prev) => prev + 1);
  };

  const hasAnyNosisFilter =
    nosisAgentQuery.trim().length > 0 ||
    nosisTipoQuery !== '' ||
    nosisFromQuery !== monthStartDate ||
    nosisToQuery !== todayDate;

  const exportNosisSummaryCsv = () => {
    const generatedAt = new Date().toISOString().slice(0, 10);
    const from = nosisFromFilter || monthStartDate;
    const to = nosisToFilter || todayDate;
    const rows: Array<Array<string | number | null | undefined>> = [
      ['Agente', 'Email', 'Total', 'CUIL', 'CBU', 'Validadas', 'Rechazadas', 'Errores', 'Costo estimado'],
      ...nosisSummary.map((row) => [
        row.agentName ?? '—',
        row.actorEmail ?? '—',
        row.totalConsultas ?? 0,
        row.porTipo?.CUIL ?? 0,
        row.porTipo?.CBU ?? 0,
        row.porResultado?.validado ?? 0,
        row.porResultado?.rechazado ?? 0,
        row.porResultado?.error ?? 0,
        row.costoEstimado ?? 0,
      ]),
    ];
    downloadCsv(`nosis-resumen-${from}_a_${to}-${generatedAt}.csv`, rows);
  };

  const exportNosisDetailsCsv = () => {
    const generatedAt = new Date().toISOString().slice(0, 10);
    const from = nosisFromFilter || monthStartDate;
    const to = nosisToFilter || todayDate;
    const rows: Array<Array<string | number | null | undefined>> = [
      ['ID', 'Fecha', 'Agente', 'Email', 'Tipo', 'Identificador', 'Resultado', 'Estado', 'Mensaje', 'Costo estimado'],
      ...nosisDetails.map((row) => [
        row.id,
        formatDateTime(row.fechaHora ?? null),
        row.agentName ?? '—',
        row.actorEmail ?? '—',
        row.tipoConsulta ?? '—',
        row.identificador ?? '—',
        row.resultado ?? '—',
        row.estadoRespuesta ?? '—',
        row.message ?? '—',
        row.costoEstimado ?? 0,
      ]),
    ];
    downloadCsv(`nosis-detalle-${from}_a_${to}-${generatedAt}.csv`, rows);
  };

  const nosisTotals = useMemo(() => {
    return nosisSummary.reduce(
      (acc, row) => {
        acc.total += row.totalConsultas || 0;
        acc.cuil += row.porTipo?.CUIL || 0;
        acc.cbu += row.porTipo?.CBU || 0;
        acc.validado += row.porResultado?.validado || 0;
        acc.rechazado += row.porResultado?.rechazado || 0;
        acc.error += row.porResultado?.error || 0;
        acc.costo += row.costoEstimado || 0;
        return acc;
      },
      { total: 0, cuil: 0, cbu: 0, validado: 0, rechazado: 0, error: 0, costo: 0 }
    );
  }, [nosisSummary]);

  const renderNosisResultBadge = (result: string | null | undefined) => {
    const normalized = (result ?? '').toLowerCase();
    if (normalized === 'validado') {
      return <span className="badge badge--success">Validado</span>;
    }
    if (normalized === 'rechazado') {
      return <span className="badge badge--warning">Rechazado</span>;
    }
    if (normalized === 'error') {
      return <span className="badge badge--danger">Error</span>;
    }
    return <span className="badge">{result ?? '—'}</span>;
  };

  if (userRole !== 'admin') {
    return (
      <DashboardLayout title="Auditoría" subtitle="Acceso restringido">
        <p className="form-info form-info--error">Solo los administradores pueden acceder a Auditoría.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Auditoría" subtitle="Revisá los eventos registrados">
      <div className="card card--padded" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.35rem' }}>Auditoría Nosis</h3>
        <p className="form-info" style={{ marginTop: 0 }}>
          Control de consultas por agente (CUIL/CBU), para seguimiento de consumo y resultados.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <label className="input-control">
            <span>Desde</span>
            <input type="date" value={nosisFromQuery} onChange={(event) => setNosisFromQuery(event.target.value)} />
          </label>
          <label className="input-control">
            <span>Hasta</span>
            <input type="date" value={nosisToQuery} onChange={(event) => setNosisToQuery(event.target.value)} />
          </label>
          <label className="input-control">
            <span>Tipo</span>
            <select value={nosisTipoQuery} onChange={(event) => setNosisTipoQuery(event.target.value as 'CUIL' | 'CBU' | '')}>
              <option value="">Todos</option>
              <option value="CUIL">CUIL</option>
              <option value="CBU">CBU</option>
            </select>
          </label>
          <label className="input-control">
            <span>Agente</span>
            <input
              type="text"
              value={nosisAgentQuery}
              onChange={(event) => setNosisAgentQuery(event.target.value)}
              placeholder="Nombre o email"
            />
          </label>
        </div>
        <div className="form-actions" style={{ marginTop: '0.75rem', gap: '0.5rem', justifyContent: 'flex-start' }}>
          <button type="button" className="primary-action" onClick={applyNosisFilters} disabled={nosisLoading}>
            Filtrar Nosis
          </button>
          <button type="button" className="secondary-action" onClick={clearNosisFilters} disabled={nosisLoading || !hasAnyNosisFilter}>
            Limpiar
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setNosisRefreshTick((prev) => prev + 1)}
            disabled={nosisLoading}
          >
            {nosisLoading ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={exportNosisSummaryCsv}
            disabled={nosisLoading || nosisSummary.length === 0}
          >
            Exportar resumen CSV
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={exportNosisDetailsCsv}
            disabled={nosisLoading || nosisDetails.length === 0}
          >
            Exportar detalle CSV
          </button>
        </div>
        <div className="summary-cards" style={{ marginTop: '0.85rem' }}>
          <div className="summary-card">
            <span className="summary-card__label">Consultas</span>
            <strong className="summary-card__value">{nosisTotals.total}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-card__label">CUIL</span>
            <strong className="summary-card__value">{nosisTotals.cuil}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-card__label">CBU</span>
            <strong className="summary-card__value">{nosisTotals.cbu}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-card__label">Validadas</span>
            <strong className="summary-card__value">{nosisTotals.validado}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-card__label">Rechazadas</span>
            <strong className="summary-card__value">{nosisTotals.rechazado}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-card__label">Errores</span>
            <strong className="summary-card__value">{nosisTotals.error}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-card__label">Costo estimado</span>
            <strong className="summary-card__value">{formatCurrency(nosisTotals.costo)}</strong>
          </div>
        </div>
        {nosisPeriod ? (
          <p className="form-info" style={{ marginTop: 0 }}>
            Período consultado: {nosisPeriod.from} a {nosisPeriod.to}
          </p>
        ) : null}
      </div>

      {nosisLoading ? <p className="form-info">Cargando auditoría de Nosis...</p> : null}
      {nosisError ? <p className="form-info form-info--error">{nosisError}</p> : null}
      {!nosisLoading && !nosisError ? (
        <>
          <div className="card card--padded" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ marginTop: 0 }}>Resumen por agente</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th>Email</th>
                    <th>Total</th>
                    <th>CUIL</th>
                    <th>CBU</th>
                    <th>Validadas</th>
                    <th>Rechazadas</th>
                    <th>Errores</th>
                    <th>Costo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {nosisSummary.length === 0 ? (
                    <tr>
                      <td colSpan={9}>No hay consultas Nosis en el período.</td>
                    </tr>
                  ) : (
                    nosisSummary.map((row) => (
                      <tr key={`${row.actorEmail ?? 'sin-email'}-${row.agentName}`}>
                        <td>{row.agentName}</td>
                        <td>{row.actorEmail ?? '—'}</td>
                        <td>{row.totalConsultas}</td>
                        <td>{row.porTipo?.CUIL ?? 0}</td>
                        <td>{row.porTipo?.CBU ?? 0}</td>
                        <td>{row.porResultado?.validado ?? 0}</td>
                        <td>{row.porResultado?.rechazado ?? 0}</td>
                        <td>{row.porResultado?.error ?? 0}</td>
                        <td>{formatCurrency(row.costoEstimado ?? 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card--padded" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ marginTop: 0 }}>Detalle de consultas Nosis</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Agente</th>
                    <th>Tipo</th>
                    <th>Identificador</th>
                    <th>Resultado</th>
                    <th>Estado</th>
                    <th>Mensaje</th>
                    <th>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {nosisDetails.length === 0 ? (
                    <tr>
                      <td colSpan={9}>No hay detalle de consultas Nosis.</td>
                    </tr>
                  ) : (
                    nosisDetails.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{formatDateTime(row.fechaHora ?? null)}</td>
                        <td>
                          {row.agentName}
                          <br />
                          <small>{row.actorEmail ?? '—'}</small>
                        </td>
                        <td>{row.tipoConsulta ?? '—'}</td>
                        <td>{row.identificador ?? '—'}</td>
                        <td>{renderNosisResultBadge(row.resultado)}</td>
                        <td>{row.estadoRespuesta ?? '—'}</td>
                        <td>{row.message ?? '—'}</td>
                        <td>{formatCurrency(row.costoEstimado ?? 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <div className="card card--padded" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.35rem' }}>Auditoría general</h3>
        <p className="form-info" style={{ marginTop: 0 }}>
          Eventos globales del sistema.
        </p>
      </div>
      <div className="card card--padded" style={{ marginBottom: '0.75rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <label className="input-control">
            <span>Agente</span>
            <input
              type="text"
              value={actorQuery}
              onChange={(event) => setActorQuery(event.target.value)}
              placeholder="Nombre del agente"
            />
          </label>
          <label className="input-control">
            <span>Email</span>
            <input
              type="email"
              value={emailQuery}
              onChange={(event) => setEmailQuery(event.target.value)}
              placeholder="Ej: usuario@dominio.com"
            />
          </label>
          <div className="form-actions" style={{ margin: 0, gap: '0.5rem', justifyContent: 'flex-start' }}>
            <button type="button" className="primary-action" onClick={applyFilters} disabled={loading}>
              Filtrar
            </button>
            <button type="button" className="secondary-action" onClick={clearFilters} disabled={loading || !hasAnyFilter}>
              Limpiar
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setRefreshTick((prev) => prev + 1)}
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>
      {loading ? <p className="form-info">Cargando auditoría...</p> : null}
      {error ? <p className="form-info form-info--error">{error}</p> : null}
      {!loading && !error ? (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Agente</th>
                <th>Actor</th>
                <th>IP</th>
                <th>Fecha</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8}>No hay eventos de auditoría.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.entityType ?? '—'}
                      {log.entityId ? ` #${log.entityId}` : ''}
                    </td>
                    <td>{log.agentName ?? '—'}</td>
                    <td>
                      {log.actorName ?? '—'}
                      <br />
                      <small>{log.actorEmail ?? '—'}</small>
                    </td>
                    <td>{log.ipAddress ?? '—'}</td>
                    <td>{log.createdAt ?? '—'}</td>
                    <td>
                      <pre className="json-cell">{JSON.stringify(log.metadata ?? {}, null, 2)}</pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </DashboardLayout>
  );
};
