export type NotificationMetadata = {
  celebration?: boolean;
  celebration_title?: string | null;
  celebration_message?: string | null;
  celebration_detail?: string | null;
  persona_full_name?: string | null;
  agente_nombre?: string | null;
  [key: string]: unknown;
};

export type NotificationRecord = {
  id: number;
  message: string | null;
  reclamoId: number | null;
  reclamoCodigo: string | null;
  reclamoEstado: string | null;
  personaId: number | null;
  personaNombre: string | null;
  workflowTaskId?: number | null;
  workflowTaskLabel?: string | null;
  solicitudPersonalId?: number | null;
  solicitudPersonalTipo?: string | null;
  readAt: string | null;
  createdAt: string | null;
  createdAtLabel?: string | null;
  metadata?: NotificationMetadata | null;
};

export type NotificationDeletionRecord = {
  id: number;
  notificationId: number | null;
  message: string | null;
  deletedById: number | null;
  deletedByName: string | null;
  deletedAt: string | null;
  deletedAtLabel?: string | null;
};

