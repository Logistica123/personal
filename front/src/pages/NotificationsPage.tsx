import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hasCelebrationBeenDismissed,
  markCelebrationAsDismissed,
} from '../features/notificaciones/celebrations';
import type {
  NotificationDeletionRecord,
  NotificationRecord,
} from '../features/notificaciones/types';

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

type NotificationsPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
}) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [deletedNotifications, setDeletedNotifications] = useState<NotificationDeletionRecord[]>([]);
  const [deletedPage, setDeletedPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const celebrationTriggeredRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false);
      setError('No se pudo identificar al usuario autenticado.');
      setHistoryLoading(false);
      setHistoryError('No se pudo identificar al usuario autenticado.');
      return;
    }

    const controller = new AbortController();

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/notificaciones?userId=${authUser.id}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data: NotificationRecord[] };
        setNotifications(payload.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'No se pudieron cargar las notificaciones.');
      } finally {
        setLoading(false);
      }
    };

    const fetchDeletedNotifications = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);

        const response = await fetch(`${apiBaseUrl}/api/notificaciones/eliminadas?userId=${authUser.id}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as { data?: NotificationDeletionRecord[] };
        setDeletedNotifications(payload.data ?? []);
        setDeletedPage(1);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setHistoryError((err as Error).message ?? 'No se pudo cargar el historial de eliminaciones.');
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchNotifications();
    fetchDeletedNotifications();

    return () => controller.abort();
  }, [apiBaseUrl, authUser?.id, refreshTick]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    const celebratory = notifications.find((notification) => {
      if (celebrationTriggeredRef.current.has(notification.id)) {
        return false;
      }

      if (notification.readAt) {
        return false;
      }

      if (hasCelebrationBeenDismissed(notification.id)) {
        return false;
      }

      if (notification.metadata?.celebration === true) {
        return true;
      }

      if (notification.message && /¡felicitaciones/i.test(notification.message)) {
        return true;
      }

      return false;
    });

    if (!celebratory) {
      return;
    }

    celebrationTriggeredRef.current.add(celebratory.id);

    const metadata = celebratory.metadata ?? {};
    const metadataTitle =
      typeof metadata.celebration_title === 'string' && metadata.celebration_title.trim().length > 0
        ? metadata.celebration_title.trim()
        : '¡Felicitaciones!';
    const metadataMessage =
      typeof metadata.celebration_message === 'string' && metadata.celebration_message.trim().length > 0
        ? metadata.celebration_message.trim()
        : null;
    const metadataDetail =
      typeof metadata.celebration_detail === 'string' && metadata.celebration_detail.trim().length > 0
        ? metadata.celebration_detail.trim()
        : null;

    const personaLabelFromMetadata = metadata.persona_full_name;
    const personaLabel =
      (typeof personaLabelFromMetadata === 'string' && personaLabelFromMetadata.trim().length > 0
        ? personaLabelFromMetadata.trim()
        : celebratory.personaNombre?.trim()) || null;
    const agenteLabelFromMetadata = metadata.agente_nombre;
    const agenteLabel =
      (typeof agenteLabelFromMetadata === 'string' && agenteLabelFromMetadata.trim().length > 0
        ? agenteLabelFromMetadata.trim()
        : null) || null;

    const fallbackDetail = (() => {
      const fragments: string[] = [];
      if (personaLabel) {
        fragments.push(personaLabel);
      }
      if (agenteLabel) {
        fragments.push(`Responsable: ${agenteLabel}`);
      }
      return fragments.length > 0 ? fragments.join(' · ') : null;
    })();

    window.dispatchEvent(
      new CustomEvent('celebration:trigger', {
        detail: {
          title: metadataTitle,
          message: metadataMessage ?? celebratory.message ?? '¡Felicitaciones!',
          detail: metadataDetail ?? fallbackDetail,
          notificationId: celebratory.id,
        },
      })
    );
  }, [error, loading, notifications]);

  const handleMarkAsRead = async (notification: NotificationRecord) => {
    if (!authUser?.id || notification.readAt) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/notificaciones/${notification.id}/leer`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      markCelebrationAsDismissed(notification.id);
      setRefreshTick((value) => value + 1);
      window.dispatchEvent(new CustomEvent('notifications:updated'));
      window.dispatchEvent(new CustomEvent('personal:updated'));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo marcar la notificación.');
    }
  };

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => setRefreshTick((value) => value + 1)}>
        Actualizar
      </button>
    </div>
  );

  const deletedPageSize = 10;
  const totalDeletedPages = Math.max(1, Math.ceil(deletedNotifications.length / deletedPageSize));
  const safeDeletedPage = Math.min(deletedPage, totalDeletedPages);
  const deletedStartIndex = (safeDeletedPage - 1) * deletedPageSize;
  const deletedPageItems = deletedNotifications.slice(deletedStartIndex, deletedStartIndex + deletedPageSize);

  const renderStatusBadge = (notification: NotificationRecord) => {
    const isRead = Boolean(notification.readAt);
    return <span className={`status-badge${isRead ? ' is-inactive' : ''}`}>{isRead ? 'Leída' : 'Sin leer'}</span>;
  };

  const handleDeleteNotification = async (notification: NotificationRecord) => {
    if (!authUser?.id) {
      window.alert('No se pudo validar el usuario actual.');
      return;
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta notificación? Se registrará quién la elimina.');
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/notificaciones/${notification.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: authUser.id }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      setRefreshTick((value) => value + 1);
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      window.alert((err as Error).message ?? 'No se pudo eliminar la notificación.');
    }
  };

  return (
    <DashboardLayout title="Notificaciones" subtitle="Alertas asignadas" headerContent={headerContent}>
      {!authUser?.id ? (
        <p className="form-info form-info--error">Debes iniciar sesión para ver tus notificaciones.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Mensaje</th>
                <th>Relacionado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5}>Cargando notificaciones...</td>
                </tr>
              )}

              {error && !loading && (
                <tr>
                  <td colSpan={5} className="error-cell">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && notifications.length === 0 && (
                <tr>
                  <td colSpan={5}>No tienes notificaciones por el momento.</td>
                </tr>
              )}

              {!loading &&
                !error &&
                notifications.map((notification) => {
                  const solicitudPersonalIdFromMetadataRaw = notification.metadata?.solicitud_personal_id;
                  const solicitudPersonalIdFromMetadata =
                    typeof solicitudPersonalIdFromMetadataRaw === 'number'
                      ? solicitudPersonalIdFromMetadataRaw
                      : typeof solicitudPersonalIdFromMetadataRaw === 'string' &&
                        solicitudPersonalIdFromMetadataRaw.trim().length > 0
                      ? Number(solicitudPersonalIdFromMetadataRaw)
                      : null;
                  const solicitudPersonalId =
                    notification.solicitudPersonalId ??
                    (solicitudPersonalIdFromMetadata !== null && Number.isFinite(solicitudPersonalIdFromMetadata)
                      ? Number(solicitudPersonalIdFromMetadata)
                      : null);
                  const solicitudTipoFromMetadata = notification.metadata?.tipo;
                  const solicitudPersonalTipo =
                    notification.solicitudPersonalTipo ??
                    (typeof solicitudTipoFromMetadata === 'string' ? solicitudTipoFromMetadata : null);
                  const solicitudPersonalTipoLabel =
                    solicitudPersonalTipo === 'cambio_asignacion'
                      ? 'Cambio de asignación'
                      : solicitudPersonalTipo === 'prestamo'
                      ? 'Préstamo'
                      : solicitudPersonalTipo === 'adelanto'
                      ? 'Adelanto'
                      : solicitudPersonalTipo === 'vacaciones'
                      ? 'Vacaciones'
                      : solicitudPersonalTipo
                      ? 'Solicitud personal'
                      : null;
                  const isSolicitudPersonalNotification =
                    solicitudPersonalId !== null ||
                    Boolean(solicitudPersonalTipo) ||
                    /solicitud personal/i.test(notification.message ?? '');

                  return (
                    <tr key={notification.id}>
                      <td>{notification.createdAtLabel ?? notification.createdAt ?? '—'}</td>
                      <td>{notification.message ?? '—'}</td>
                      <td>
                        {notification.reclamoId ? (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => navigate(`/reclamos/${notification.reclamoId}`)}
                          >
                            {notification.reclamoCodigo ?? `Reclamo #${notification.reclamoId}`}
                          </button>
                        ) : notification.workflowTaskId ? (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => navigate('/flujo-trabajo')}
                          >
                            {notification.workflowTaskLabel ?? 'Tarea asignada'}
                          </button>
                        ) : notification.personaId ? (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => navigate(`/aprobaciones?personaId=${notification.personaId}`)}
                          >
                            {notification.personaNombre?.trim().length
                              ? notification.personaNombre
                              : `Personal #${notification.personaId}`}
                          </button>
                        ) : isSolicitudPersonalNotification ? (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => navigate('/aprobaciones')}
                          >
                            {solicitudPersonalTipoLabel ??
                              (solicitudPersonalId ? `Solicitud #${solicitudPersonalId}` : 'Ir a aprobaciones')}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{renderStatusBadge(notification)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(notification)}
                            disabled={Boolean(notification.readAt)}
                            aria-label="Marcar como leída"
                          >
                            ✅
                          </button>
                          <button
                            type="button"
                            className="secondary-action secondary-action--danger"
                            onClick={() => handleDeleteNotification(notification)}
                            aria-label="Eliminar notificación"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <section className="notifications-history">
            <h3>Historial de eliminaciones</h3>
            {historyLoading ? <p className="form-info">Cargando historial...</p> : null}
            {historyError ? <p className="form-info form-info--error">{historyError}</p> : null}
            {!historyLoading && !historyError && deletedNotifications.length === 0 ? (
              <p className="form-info">No hay eliminaciones registradas.</p>
            ) : null}
            {!historyLoading && !historyError && deletedNotifications.length > 0 ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Mensaje</th>
                      <th>Eliminado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedPageItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.deletedAtLabel ?? item.deletedAt ?? '—'}</td>
                        <td>{item.message ?? '—'}</td>
                        <td>{item.deletedByName ?? `Usuario #${item.deletedById ?? '—'}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="table-footer" style={{ justifyContent: 'flex-end' }}>
                  <span>
                    Mostrando {deletedPageItems.length} de {deletedNotifications.length}
                  </span>
                  <div className="pagination">
                    <button
                      type="button"
                      aria-label="Página anterior"
                      disabled={safeDeletedPage <= 1}
                      onClick={() => setDeletedPage((page) => Math.max(1, page - 1))}
                    >
                      ‹
                    </button>
                    <span style={{ padding: '0 0.5rem' }}>
                      Página {safeDeletedPage} / {totalDeletedPages}
                    </span>
                    <button
                      type="button"
                      aria-label="Página siguiente"
                      disabled={safeDeletedPage >= totalDeletedPages}
                      onClick={() => setDeletedPage((page) => Math.min(totalDeletedPages, page + 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
};

