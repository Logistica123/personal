import React from 'react';

type PersonalStats = {
  preActivo: number;
  activo: number;
  baja: number;
  suspendido: number;
  noCitado: number;
  otros: number;
  total: number;
};

type TeamGroup = {
  id: number;
  name: string;
  color: string | null;
  members: Array<{
    id: number;
    userId?: number | null;
    name: string;
    email: string | null;
  }>;
};

type UsuarioLite = {
  id: number;
  name: string | null;
  email: string | null;
};

type EditingTeamMember = { id?: number; userId?: number | null; name: string; email: string };

type TeamSection = {
  team: TeamGroup;
  groupStats: PersonalStats;
  clientGroups: Array<{ clienteNombre: string; stats: PersonalStats }>;
  memberStats: Array<{
    member: TeamGroup['members'][number];
    stats: PersonalStats;
    clients: Array<{ clienteNombre: string; stats: PersonalStats }>;
  }>;
};

export const PersonalTeamsPanel: React.FC<{
  monitorMode: boolean;
  statsLoading: boolean;
  personalStats: Pick<PersonalStats, 'baja' | 'suspendido'>;
  showRecentAltaPanel: boolean;
  setShowRecentAltaPanel: React.Dispatch<React.SetStateAction<boolean>>;
  recentAltaCounts: { day: number; week: number; month: number; year: number };
  reclamoStats: { total: number; resueltos: number; rechazados: number };
  reclamoStatsLoading: boolean;
  reclamoStatsError: string | null;

  teamLoading: boolean;
  teamError: string | null;
  teamInfo: string | null;
  teamGroups: TeamGroup[];

  usersOptions: UsuarioLite[];
  usersLoading: boolean;
  usersError: string | null;

  editingTeamId: number | null;
  editingTeamName: string;
  setEditingTeamName: (value: string) => void;
  editingTeamColor: string | null;
  setEditingTeamColor: (value: string | null) => void;
  editingMembers: EditingTeamMember[];

  resetTeamForm: () => void;
  populateTeamForm: (team: TeamGroup | null) => void;
  addEmptyMember: () => void;
  updateMemberField: (index: number, field: 'name' | 'email', value: string) => void;
  handleMemberSelect: (index: number, userId: string) => void;
  removeMember: (index: number) => void;
  handleSaveTeam: () => void;
  handleDeleteTeam: () => void;
  savingTeam: boolean;
  deletingTeam: boolean;

  teamSectionsCount: number;
  displayedTeamSections: TeamSection[];
  buildMonitorUrl: (teamId?: number | null) => string;
  handleOpenMonitorWindow: (url: string) => void;
}> = ({
  monitorMode,
  statsLoading,
  personalStats,
  showRecentAltaPanel,
  setShowRecentAltaPanel,
  recentAltaCounts,
  reclamoStats,
  reclamoStatsLoading,
  reclamoStatsError,
  teamLoading,
  teamError,
  teamInfo,
  teamGroups,
  usersOptions,
  usersLoading,
  usersError,
  editingTeamId,
  editingTeamName,
  setEditingTeamName,
  editingTeamColor,
  setEditingTeamColor,
  editingMembers,
  resetTeamForm,
  populateTeamForm,
  addEmptyMember,
  updateMemberField,
  handleMemberSelect,
  removeMember,
  handleSaveTeam,
  handleDeleteTeam,
  savingTeam,
  deletingTeam,
  teamSectionsCount,
  displayedTeamSections,
  buildMonitorUrl,
  handleOpenMonitorWindow,
}) => {
  return (
    <>
      {!monitorMode ? (
        <div className="summary-panel secondary-panels team-config-panel">
          <div className="secondary-panels__header">
            <h3>Equipos</h3>
            <p style={{ margin: 0 }}>Armá los bloques (nombre, color y miembros) que luego aparecen en el panel.</p>
            <div className="secondary-panels__actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowRecentAltaPanel((prev) => !prev)}
              >
                {showRecentAltaPanel ? 'Ocultar altas recientes' : 'Ver altas recientes'}
              </button>
            </div>
          </div>

          {showRecentAltaPanel ? (
            <>
              <div className="recent-altas-strip">
                <div style={{ marginBottom: '0.6rem' }}>
                  <h3 style={{ margin: 0 }}>Altas recientes</h3>
                  <p style={{ margin: 0, color: '#5a6a82' }}>Conteo de altas según filtros aplicados.</p>
                </div>
                <div className="recent-altas-strip__grid">
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Último día</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill">↗</span>
                      <div className="recent-altas-strip__value">{statsLoading ? '—' : recentAltaCounts.day}</div>
                    </div>
                  </div>
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Última semana</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill recent-altas-strip__pill--flat">→</span>
                      <div className="recent-altas-strip__value">{statsLoading ? '—' : recentAltaCounts.week}</div>
                    </div>
                  </div>
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Último mes</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill">↗</span>
                      <div className="recent-altas-strip__value">{statsLoading ? '—' : recentAltaCounts.month}</div>
                    </div>
                  </div>
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Último año</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill">↗</span>
                      <div className="recent-altas-strip__value">{statsLoading ? '—' : recentAltaCounts.year}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="recent-altas-strip status-strip">
                <div style={{ marginBottom: '0.6rem' }}>
                  <h3 style={{ margin: 0 }}>Bajas, suspendidos y reclamos</h3>
                  <p style={{ margin: 0, color: '#5a6a82' }}>Totales actuales y estado de reclamos.</p>
                </div>
                <div className="recent-altas-strip__grid">
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Bajas</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill recent-altas-strip__pill--down">↓</span>
                      <div className="recent-altas-strip__value">{statsLoading ? '—' : personalStats.baja}</div>
                    </div>
                  </div>
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Suspendidos</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill recent-altas-strip__pill--flat">→</span>
                      <div className="recent-altas-strip__value">{statsLoading ? '—' : personalStats.suspendido}</div>
                    </div>
                  </div>
                  <div className="recent-altas-strip__item">
                    <span className="recent-altas-strip__label">Reclamos</span>
                    <div className="recent-altas-strip__meta">
                      <span className="recent-altas-strip__pill">ℹ</span>
                      <div className="recent-altas-strip__value">{reclamoStatsLoading ? '—' : reclamoStats.total}</div>
                    </div>
                    <div className="status-strip__subgrid">
                      <div className="status-strip__subitem">
                        <small>Resueltos</small>
                        <strong>{reclamoStatsLoading ? '—' : reclamoStats.resueltos}</strong>
                      </div>
                      <div className="status-strip__subitem">
                        <small>Rechazados</small>
                        <strong>{reclamoStatsLoading ? '—' : reclamoStats.rechazados}</strong>
                      </div>
                    </div>
                    {reclamoStatsError ? (
                      <small className="form-info form-info--error" style={{ marginTop: '0.35rem' }}>
                        {reclamoStatsError}
                      </small>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="team-editor">
            <div className="team-editor__row">
              <label className="input-control">
                <span>Equipo</span>
                <select
                  value={editingTeamId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === '') {
                      resetTeamForm();
                      return;
                    }
                    const teamId = Number(value);
                    const found = teamGroups.find((team) => team.id === teamId) ?? null;
                    populateTeamForm(found);
                  }}
                >
                  <option value="">Nuevo equipo</option>
                  {teamGroups.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-control">
                <span>Nombre</span>
                <input
                  type="text"
                  value={editingTeamName}
                  onChange={(event) => setEditingTeamName(event.target.value)}
                  placeholder="Ej: Fidelización 1"
                />
              </label>
              <label className="input-control">
                <span>Color del bloque</span>
                <div className="input-with-action">
                  <input
                    type="text"
                    value={editingTeamColor ?? ''}
                    onChange={(event) => setEditingTeamColor(event.target.value || null)}
                    placeholder="#DDE9FF"
                  />
                  <input
                    type="color"
                    value={editingTeamColor ?? '#f4f6fb'}
                    onChange={(event) => setEditingTeamColor(event.target.value)}
                    title="Elegir color"
                    style={{ width: '52px', minWidth: '52px' }}
                  />
                </div>
              </label>
            </div>

            <div className="team-editor__members">
              <div className="team-editor__members-header">
                <h4>Miembros</h4>
                <button type="button" className="secondary-action" onClick={addEmptyMember}>
                  + Agregar miembro
                </button>
              </div>
              {editingMembers.length === 0 ? (
                <p className="form-info">Sumá nombres (y opcionalmente emails) para mapearlos con los agentes.</p>
              ) : null}
              <div className="team-editor__members-grid">
                {editingMembers.map((member, index) => (
                  <div key={`${member.id ?? index}-${index}`} className="team-editor__member-row">
                    <label className="input-control">
                      <span>Elegir usuario</span>
                      <select
                        value=""
                        onChange={(event) => handleMemberSelect(index, event.target.value)}
                        disabled={usersLoading}
                      >
                        <option value="">{usersLoading ? 'Cargando...' : 'Seleccionar'}</option>
                        {usersOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name ?? user.email ?? `Usuario #${user.id}`}
                          </option>
                        ))}
                      </select>
                      {usersError ? <small className="form-info form-info--error">{usersError}</small> : null}
                    </label>
                    <label className="input-control">
                      <span>Nombre</span>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(event) => updateMemberField(index, 'name', event.target.value)}
                        placeholder="Ej: Monica Fernandez"
                      />
                    </label>
                    <label className="input-control">
                      <span>Email (opcional)</span>
                      <input
                        type="email"
                        value={member.email}
                        onChange={(event) => updateMemberField(index, 'email', event.target.value)}
                        placeholder="usuario@dominio.com"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-action"
                      aria-label="Quitar miembro"
                      onClick={() => removeMember(index)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {teamError ? <p className="form-info form-info--error">{teamError}</p> : null}
            {teamInfo ? <p className="form-info form-info--success">{teamInfo}</p> : null}

            <div className="form-actions" style={{ marginTop: '0.5rem' }}>
              <button type="button" className="primary-action" onClick={handleSaveTeam} disabled={savingTeam}>
                {savingTeam ? 'Guardando...' : 'Guardar equipo'}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={resetTeamForm}
                disabled={savingTeam || deletingTeam}
              >
                Limpiar
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={handleDeleteTeam}
                disabled={editingTeamId === null || deletingTeam || savingTeam}
              >
                {deletingTeam ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="team-sections">
        {teamLoading ? <p className="form-info">Cargando equipos...</p> : null}
        {teamError && !teamLoading ? <p className="form-info form-info--error">{teamError}</p> : null}
        {!teamLoading && !teamError && teamSectionsCount === 0 ? (
          <p className="form-info">Todavía no hay equipos configurados. Creá uno arriba.</p>
        ) : null}

        {displayedTeamSections.map(({ team, groupStats, memberStats, clientGroups }) => {
          const background = team.color ? `${team.color}1a` : '#f4f6fb';
          const borderColor = team.color ?? '#dce3f0';
          const teamMonitorUrl = buildMonitorUrl(team.id);

          return (
            <div
              key={team.id}
              className="summary-panel secondary-panels fidelizacion-panel"
              style={{ background, borderColor }}
            >
              <div className="secondary-panels__header">
                <div>
                  <h3 className="team-title">
                    {team.name}
                    <span className="team-title__total">· {groupStats.total} en total</span>
                  </h3>
                </div>
                <div className="team-actions">
                  {!monitorMode ? (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => handleOpenMonitorWindow(teamMonitorUrl)}
                    >
                      Mostrar en monitor
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="client-cards fidelizacion-cards">
                {memberStats.map(({ member, stats }) => (
                  <div key={`${team.id}-${member.id ?? member.name}`} className="client-card client-card--personal">
                    <header>
                      <h4 title={member.name}>{member.name}</h4>
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
                        <small>Suspendido</small>
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

              <div className="client-cards fidelizacion-cards fidelizacion-clients-block">
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
                        <small>Suspendido</small>
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
        })}
      </div>
    </>
  );
};

