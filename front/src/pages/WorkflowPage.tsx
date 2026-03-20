import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkflowDeleteHistoryEntry, WorkflowStatus, WorkflowTaskRecord } from '../features/workflow/types';
import { persistWorkflowDeleteHistory, readWorkflowDeleteHistory } from '../features/workflow/storage';

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

export type WorkflowPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  getUserRole: (authUser: AuthUser | null | undefined) => string;
};

export const WorkflowPage: React.FC<WorkflowPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  getUserRole,
}) => {
  const authUser = useStoredAuthUser();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [tasks, setTasks] = useState<WorkflowTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Array<{ id: number; nombre: string | null; email: string | null }>>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [pendingResponsibleId, setPendingResponsibleId] = useState('');
  const [selectedResponsibles, setSelectedResponsibles] = useState<Array<{ id: number; label: string }>>([]);
  const [responsableQuery, setResponsableQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [filterAssignedToId, setFilterAssignedToId] = useState('');
  const [filterAssignedById, setFilterAssignedById] = useState('');
  const [filterPersonId, setFilterPersonId] = useState('');
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [filterAssignedByMe, setFilterAssignedByMe] = useState(false);
  const [deleteHistory, setDeleteHistory] = useState<WorkflowDeleteHistoryEntry[]>(() => readWorkflowDeleteHistory());

  useEffect(() => {
    const controller = new AbortController();

    const fetchAgents = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/users`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: Array<{ id: number; nombre: string | null; email: string | null }> };
        setAgents(payload.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        // eslint-disable-next-line no-console
        console.error('No se pudieron cargar los agentes', err);
      }
    };

    fetchAgents();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const currentActorId = useMemo(() => {
    if (authUser?.id != null) {
      return Number(authUser.id);
    }
    const normalizedName = authUser?.name?.trim().toLowerCase();
    const normalizedEmail = authUser?.email?.trim().toLowerCase();
    if (!normalizedName && !normalizedEmail) {
      return null;
    }
    const match = agents.find((agent) => {
      const agentName = (agent.nombre ?? '').trim().toLowerCase();
      const agentEmail = (agent.email ?? '').trim().toLowerCase();
      return (normalizedName && agentName === normalizedName) || (normalizedEmail && agentEmail === normalizedEmail);
    });
    return match?.id ?? null;
  }, [authUser?.id, authUser?.name, authUser?.email, agents]);
  const currentUserRole = useMemo(() => getUserRole(authUser), [authUser, getUserRole]);
  const canDeleteWorkflowTasks = currentUserRole !== 'operator';

  const fetchTasks = useCallback(async () => {
    if (currentActorId == null) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks?userId=${currentActorId}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as { data: WorkflowTaskRecord[] };
      setTasks(payload.data ?? []);
    } catch (err) {
      setError((err as Error).message ?? 'No se pudieron cargar las tareas.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, currentActorId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTick]);

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        id: agent.id,
        label: agent.nombre?.trim() && agent.nombre.trim().length > 0 ? agent.nombre.trim() : `Agente #${agent.id}`,
      })),
    [agents]
  );

  useEffect(() => {
    if (!responsableQuery) {
      setPendingResponsibleId('');
      return;
    }
    const match = agentOptions.find(
      (option) => option.label.toLowerCase() === responsableQuery.trim().toLowerCase()
    );
    setPendingResponsibleId(match ? String(match.id) : '');
  }, [agentOptions, responsableQuery]);

  const addResponsable = useCallback(
    (targetId: string | number) => {
      const numericId = Number(targetId);
      if (Number.isNaN(numericId)) {
        return false;
      }
      const match = agentOptions.find((option) => option.id === numericId);
      if (!match) {
        return false;
      }
      setSelectedResponsibles((prev) => {
        if (prev.some((item) => item.id === numericId)) {
          return prev;
        }
        return [...prev, { id: numericId, label: match.label }];
      });
      setResponsableQuery('');
      setPendingResponsibleId('');
      return true;
    },
    [agentOptions]
  );

  const removeResponsable = (id: number) => {
    setSelectedResponsibles((prev) => prev.filter((item) => item.id !== id));
  };

  const resolveTaskResponsables = useCallback((task: WorkflowTaskRecord) => {
    const fromArray =
      task.responsables
        ?.map((item) => ({
          id: item.id ?? null,
          nombre: item.nombre ?? null,
        }))
        .filter((item) => item.id !== null || item.nombre) ?? [];

    if (fromArray.length > 0) {
      return fromArray;
    }

    const fallbackName =
      task.responsableNombre ??
      (task.responsableId != null ? `Agente #${task.responsableId}` : null);

    if (fallbackName) {
      return [{ id: task.responsableId ?? null, nombre: fallbackName }];
    }

    return [] as Array<{ id: number | null; nombre: string | null }>;
  }, []);

  const resolveTaskResponsibleIds = useCallback(
    (task: WorkflowTaskRecord) => {
      const idsFromArray = resolveTaskResponsables(task)
        .map((item) => item.id)
        .filter((id): id is number => id != null);
      if (idsFromArray.length > 0) {
        return idsFromArray;
      }
      return task.responsableId != null ? [task.responsableId] : [];
    },
    [resolveTaskResponsables]
  );

  const filteredTasks = useMemo(() => {
    const assignedToId = filterAssignedToId ? Number(filterAssignedToId) : null;
    const assignedById = filterAssignedById ? Number(filterAssignedById) : null;
    const personId = filterPersonId ? Number(filterPersonId) : null;

    return tasks.filter((task) => {
      const responsibleIds = resolveTaskResponsibleIds(task);
      const creatorId = task.creatorId;
      const isAssignedToMe = currentActorId != null && responsibleIds.some((id) => id === currentActorId);
      const isAssignedByMe = currentActorId != null && creatorId === currentActorId;

      if (filterAssignedToMe && !isAssignedToMe) {
        return false;
      }

      if (filterAssignedByMe && !isAssignedByMe) {
        return false;
      }

      if (assignedToId != null && !Number.isNaN(assignedToId) && !responsibleIds.includes(assignedToId)) {
        return false;
      }

      if (assignedById != null && !Number.isNaN(assignedById) && creatorId !== assignedById) {
        return false;
      }

      if (
        personId != null &&
        !Number.isNaN(personId) &&
        creatorId !== personId &&
        !responsibleIds.includes(personId)
      ) {
        return false;
      }

      return true;
    });
  }, [
    tasks,
    filterAssignedToId,
    filterAssignedById,
    filterPersonId,
    filterAssignedToMe,
    filterAssignedByMe,
    currentActorId,
    resolveTaskResponsibleIds,
  ]);

  const columns = useMemo(
    () =>
      [
        { status: 'nueva' as WorkflowStatus, title: 'Nueva tarea' },
        { status: 'proceso' as WorkflowStatus, title: 'En proceso' },
        { status: 'finalizado' as WorkflowStatus, title: 'Finalizado' },
      ].map((column) => ({
        ...column,
        tasks: filteredTasks.filter((task) => task.status === column.status),
      })),
    [filteredTasks]
  );

  const clearWorkflowFilters = () => {
    setFilterAssignedToId('');
    setFilterAssignedById('');
    setFilterPersonId('');
    setFilterAssignedToMe(false);
    setFilterAssignedByMe(false);
  };

  const handleAddTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentActorId == null) {
      window.alert('Debes iniciar sesión para crear tareas.');
      return;
    }

    let taskResponsibles = selectedResponsibles;
    if (pendingResponsibleId && !taskResponsibles.some((item) => String(item.id) === String(pendingResponsibleId))) {
      const numericId = Number(pendingResponsibleId);
      const match = agentOptions.find((option) => option.id === numericId);
      if (!match) {
        window.alert('Selecciona un responsable válido para la tarea.');
        return;
      }
      addResponsable(pendingResponsibleId);
      taskResponsibles = [...taskResponsibles, { id: numericId, label: match.label }];
    }

    if (taskResponsibles.length === 0) {
      window.alert('Selecciona al menos un responsable para la tarea.');
      return;
    }

    const responsiblesIds = taskResponsibles.map((item) => item.id);

    try {
      setLoading(true);
      setError(null);

      const errors: string[] = [];

      for (const responsableId of responsiblesIds) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/workflow-tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              titulo: formTitle.trim(),
              descripcion: formDescription.trim() || null,
              creatorId: currentActorId,
              responsableId,
            }),
          });

          if (!response.ok) {
            let message = `Error ${response.status}: ${response.statusText}`;

            try {
              const payload = await response.json();
              if (typeof payload?.message === 'string') {
                message = payload.message;
              }
            } catch {
              // ignore
            }

            throw new Error(message);
          }
        } catch (err) {
          errors.push((err as Error).message ?? `No se pudo asignar al responsable ${responsableId}`);
        }
      }

      if (errors.length > 0) {
        setError(errors.join(' | '));
      } else {
        setFormTitle('');
        setFormDescription('');
        setSelectedResponsibles([]);
        setPendingResponsibleId('');
        setResponsableQuery('');
        setRefreshTick((value) => value + 1);
      }
    } catch (err) {
      setError((err as Error).message ?? 'No se pudo crear la tarea.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    persistWorkflowDeleteHistory(deleteHistory);
  }, [deleteHistory]);

  const handleExport = async () => {
    if (currentActorId == null) {
      window.alert('Debes iniciar sesión para exportar las tareas.');
      return;
    }

    try {
      setExporting(true);
      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/export?userId=${currentActorId}`, {
        headers: { Accept: 'text/csv' },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `workflow-tasks-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo exportar la lista de tareas.');
    } finally {
      setExporting(false);
    }
  };

  const handleDrop = async (status: WorkflowStatus, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (currentActorId == null) {
      return;
    }
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) {
      return;
    }
    const numericId = Number(taskId);
    if (Number.isNaN(numericId)) {
      return;
    }
    const targetTask = tasks.find((task) => task.id === numericId);
    if (!targetTask || targetTask.status === status) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/${numericId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status, actorId: currentActorId }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      setRefreshTick((value) => value + 1);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo actualizar la tarea.');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDelete = async (taskId: number) => {
    if (currentActorId == null) {
      return;
    }
    if (!canDeleteWorkflowTasks) {
      window.alert('Tu rol no tiene permisos para eliminar tareas.');
      return;
    }

    const targetTask = tasks.find((task) => task.id === taskId);

    if (!window.confirm('¿Eliminar esta tarea del flujo?')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/workflow-tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ actorId: currentActorId }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      setDeleteHistory((prev) => {
        const newEntry = {
          taskId,
          title: targetTask?.titulo ?? `Tarea #${taskId}`,
          status: targetTask?.status ?? null,
          removedAt: new Date().toISOString(),
          removedBy: authUser?.name || authUser?.email || (currentActorId != null ? `ID ${currentActorId}` : null),
        };
        const next = [newEntry, ...prev].slice(0, 50);
        return next;
      });

      setRefreshTick((value) => value + 1);
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar la tarea.');
    }
  };

  if (currentActorId == null) {
    return (
      <DashboardLayout title="Flujo de trabajo" subtitle="Organiza tus tareas visualmente">
        <p className="form-info form-info--error">Inicia sesión para gestionar tus tareas.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Flujo de trabajo" subtitle="Organiza tus tareas visualmente">
      <div className="workflow-actions">
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Descargando...' : 'Exportar tareas'}
        </button>
      </div>

      <section className="workflow-filters">
        <div className="workflow-filters__grid">
          <label>
            <span>Asignado al destinatario</span>
            <select value={filterAssignedToId} onChange={(event) => setFilterAssignedToId(event.target.value)}>
              <option value="">Todos</option>
              {agentOptions.map((option) => (
                <option key={`assigned-to-${option.id}`} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Asignado por / desde</span>
            <select value={filterAssignedById} onChange={(event) => setFilterAssignedById(event.target.value)}>
              <option value="">Todos</option>
              {agentOptions.map((option) => (
                <option key={`assigned-by-${option.id}`} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Persona</span>
            <select value={filterPersonId} onChange={(event) => setFilterPersonId(event.target.value)}>
              <option value="">Todas</option>
              {agentOptions.map((option) => (
                <option key={`person-${option.id}`} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="workflow-filters__toggles">
          <label className="workflow-filters__toggle">
            <input
              type="checkbox"
              checked={filterAssignedToMe}
              onChange={(event) => setFilterAssignedToMe(event.target.checked)}
            />
            Asignados a mí
          </label>
          <label className="workflow-filters__toggle">
            <input
              type="checkbox"
              checked={filterAssignedByMe}
              onChange={(event) => setFilterAssignedByMe(event.target.checked)}
            />
            Asignados por mí
          </label>
          <button type="button" className="secondary-action" onClick={clearWorkflowFilters}>
            Limpiar filtros
          </button>
        </div>
        <p className="workflow-filters__summary">
          Mostrando {filteredTasks.length} de {tasks.length} tareas.
        </p>
      </section>

      <section className="workflow-new-task">
        <form onSubmit={handleAddTask} className="workflow-form">
          <label>
            <span>Título de la tarea</span>
            <input
              type="text"
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
              placeholder="Ej: Contactar cliente"
              required
            />
          </label>
          <label>
            <span>Descripción (opcional)</span>
            <textarea
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
              rows={2}
              placeholder="Notas o contexto…"
            />
          </label>
          <label>
            <span>Responsable</span>
            <div className="workflow-responsable-input">
              <input
                type="text"
                list="workflow-responsables"
                value={responsableQuery}
                onChange={(event) => setResponsableQuery(event.target.value)}
                placeholder="Busca o selecciona al agente"
              />
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  if (pendingResponsibleId) {
                    const added = addResponsable(pendingResponsibleId);
                    if (!added) {
                      window.alert('Selecciona un responsable válido de la lista.');
                    }
                    return;
                  }
                  window.alert('Elegí un responsable de la lista para agregarlo.');
                }}
              >
                Agregar responsable
              </button>
            </div>
            <datalist id="workflow-responsables">
              {agentOptions.map((option) => (
                <option key={option.id} value={option.label} />
              ))}
            </datalist>
            <p className="workflow-responsables__helper">Podés asignar varios responsables a la misma tarea.</p>
            {selectedResponsibles.length > 0 ? (
              <div className="workflow-responsables__chips">
                {selectedResponsibles.map((responsable) => (
                  <span key={responsable.id} className="workflow-chip">
                    {responsable.label}
                    <button
                      type="button"
                      aria-label={`Quitar ${responsable.label}`}
                      onClick={() => removeResponsable(responsable.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </label>
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Guardando...' : 'Agregar tarea'}
          </button>
        </form>
        {error ? <p className="form-info form-info--error">{error}</p> : null}
      </section>

      <section className="workflow-board">
        {columns.map((column) => (
          <div
            key={column.status}
            className="workflow-column"
            onDragOver={handleDragOver}
            onDrop={(event) => handleDrop(column.status, event)}
          >
            <header className="workflow-column__header">
              <h3>{column.title}</h3>
              <span>{column.tasks.length}</span>
            </header>
            <div className="workflow-column__body">
              {loading ? (
                <p className="workflow-column__empty">Cargando tareas…</p>
              ) : column.tasks.length === 0 ? (
                <p className="workflow-column__empty">
                  {column.status === 'nueva'
                    ? 'Agrega una tarea para empezar.'
                    : 'Suelta tareas aquí'}
                </p>
              ) : (
                column.tasks.map((task) => (
                  <article
                    key={task.id}
                    className="workflow-card"
                  >
                    <div className="workflow-card__title">
                      <strong>{task.titulo}</strong>
                      <div className="workflow-card__actions">
                        <button
                          type="button"
                          className="workflow-card__drag-handle"
                          draggable
                          aria-label="Arrastrar tarea"
                          title="Arrastrar tarea"
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', String(task.id));
                          }}
                        >
                          ⋮⋮
                        </button>
                        {canDeleteWorkflowTasks ? (
                          <button
                            type="button"
                            className="workflow-card__delete"
                            onClick={() => handleDelete(task.id)}
                            aria-label="Eliminar tarea"
                          >
                            ×
                          </button>
                        ) : (
                          <span className="workflow-card__badge">Sin permisos</span>
                        )}
                      </div>
                    </div>
                    {task.descripcion ? (
                      <p className="workflow-card__description">{task.descripcion}</p>
                    ) : null}
                    <footer className="workflow-card__footer">
                      <span>
                        {task.createdAt
                          ? new Date(task.createdAt).toLocaleDateString('es-AR')
                          : '—'}
                      </span>
                      {(() => {
                        const responsibles = resolveTaskResponsables(task);
                        if (responsibles.length === 0) {
                          return null;
                        }
                        const label = responsibles
                          .map((item) => item.nombre ?? (item.id != null ? `Agente #${item.id}` : 'Responsable'))
                          .join(', ');
                        return <span className="workflow-card__responsables">👤 {label}</span>;
                      })()}
                    </footer>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="workflow-history">
        <h3>Historial de eliminación</h3>
        {deleteHistory.length === 0 ? (
          <p className="form-info">Todavía no hay eliminaciones registradas.</p>
        ) : (
          <ul className="workflow-history__list">
            {deleteHistory.map((entry, index) => {
              const when = new Date(entry.removedAt).toLocaleString('es-AR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              const statusLabel =
                entry.status === 'proceso'
                  ? 'En proceso'
                  : entry.status === 'finalizado'
                  ? 'Finalizado'
                  : 'Nueva tarea';
              return (
                <li key={`${entry.taskId}-${entry.removedAt}-${index}`}>
                  <div className="workflow-history__header">
                    <strong>{entry.title}</strong>
                    <span className="workflow-history__status">{statusLabel}</span>
                  </div>
                  <div className="workflow-history__meta">
                    <span>Eliminada por: {entry.removedBy ?? 'Usuario'}</span>
                    <span>{when}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </DashboardLayout>
  );
};
