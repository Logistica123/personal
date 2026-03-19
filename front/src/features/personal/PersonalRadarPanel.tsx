import React, { useMemo } from 'react';
import type { PersonalRecord } from './types';

type PersonalStats = {
  preActivo: number;
  activo: number;
  baja: number;
  suspendido: number;
  noCitado: number;
  otros: number;
  total: number;
};

export const PersonalRadarPanel: React.FC<{
  monitorMode: boolean;
  monitorSummaryActive: boolean;
  statsLoading: boolean;
  statsError: string | null;
  personalStats: PersonalStats;
  statsClienteFilter: string;
  statsEstadoFilter: string;
  statsAgenteFilter: string;
  setStatsClienteFilter: (value: string) => void;
  setStatsEstadoFilter: (value: string) => void;
  setStatsAgenteFilter: (value: string) => void;
  clienteStatsOptions: string[];
  estadoStatsOptions: string[];
  agenteStatsOptions: string[];
  baseFilteredPersonal: PersonalRecord[];
  computePersonalStats: (data: PersonalRecord[]) => PersonalStats;
}> = ({
  monitorMode,
  monitorSummaryActive,
  statsLoading,
  statsError,
  personalStats,
  statsClienteFilter,
  statsEstadoFilter,
  statsAgenteFilter,
  setStatsClienteFilter,
  setStatsEstadoFilter,
  setStatsAgenteFilter,
  clienteStatsOptions,
  estadoStatsOptions,
  agenteStatsOptions,
  baseFilteredPersonal,
  computePersonalStats,
}) => {
  const clientGroups = useMemo(() => {
    const grouped = baseFilteredPersonal.reduce<Record<string, PersonalRecord[]>>((acc, registro) => {
      const key = registro.cliente ?? 'Sin cliente';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(registro);
      return acc;
    }, {});

    return Object.entries(grouped).map(([clienteNombre, registros]) => ({
      clienteNombre,
      stats: computePersonalStats(registros),
    }));
  }, [baseFilteredPersonal, computePersonalStats]);

  if (monitorMode && !monitorSummaryActive) {
    return null;
  }

  return (
    <div className={`summary-panel${monitorMode ? ' monitor-summary' : ''}`}>
      <div className="summary-panel__header summary-panel__header--radar">
        <div>
          <h3>Radar de personal</h3>
          <p>Filtrá por cliente, estado o agente para ver los totales y cortes por cliente.</p>
        </div>
        <div className="summary-filters">
          <label className="filter-field">
            <span>Cliente</span>
            <select value={statsClienteFilter} onChange={(event) => setStatsClienteFilter(event.target.value)}>
              <option value="">Todos</option>
              {clienteStatsOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Estado</span>
            <select value={statsEstadoFilter} onChange={(event) => setStatsEstadoFilter(event.target.value)}>
              <option value="">Todos</option>
              {estadoStatsOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Agente</span>
            <select value={statsAgenteFilter} onChange={(event) => setStatsAgenteFilter(event.target.value)}>
              <option value="">Todos</option>
              {agenteStatsOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card summary-card--accent">
          <span className="summary-card__label">Activos</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.activo}</strong>
        </div>
        <div className="summary-card summary-card--info">
          <span className="summary-card__label">Pre activo</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.preActivo}</strong>
        </div>
        <div className="summary-card summary-card--warning">
          <span className="summary-card__label">Baja</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.baja}</strong>
        </div>
        <div className="summary-card summary-card--danger">
          <span className="summary-card__label">Suspendido</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.suspendido}</strong>
        </div>
        <div className="summary-card summary-card--neutral">
          <span className="summary-card__label">No citado</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.noCitado}</strong>
        </div>
        <div className="summary-card summary-card--muted">
          <span className="summary-card__label">Sin estado</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.otros}</strong>
        </div>
        <div className="summary-card summary-card--muted">
          <span className="summary-card__label">Total personal</span>
          <strong className="summary-card__value">{statsLoading ? '—' : personalStats.total}</strong>
        </div>
        {statsError ? (
          <p className="form-info form-info--error" style={{ gridColumn: '1 / -1' }}>
            {statsError}
          </p>
        ) : null}
      </div>

      <div className="client-cards">
        {clientGroups.map(({ clienteNombre, stats }) => (
          <div key={clienteNombre} className="client-card client-card--personal">
            <header>
              <h4 title={clienteNombre}>{clienteNombre}</h4>
              <span>
                {stats.activo} activos · {stats.preActivo} pre activo · {stats.noCitado} no citado
                {stats.otros > 0 ? ` · ${stats.otros} sin estado` : ''}
              </span>
            </header>
            <div className="client-card__stats">
              <div>
                <small>Activos</small>
                <strong>{stats.activo}</strong>
              </div>
              <div>
                <small>Baja</small>
                <strong>{stats.baja}</strong>
              </div>
              <div>
                <small>Pre activo</small>
                <strong>{stats.preActivo}</strong>
              </div>
              <div>
                <small title="Suspendido">Susp.</small>
                <strong>{stats.suspendido}</strong>
              </div>
              <div>
                <small>No citado</small>
                <strong>{stats.noCitado}</strong>
              </div>
              <div>
                <small>Sin estado</small>
                <strong>{stats.otros}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

