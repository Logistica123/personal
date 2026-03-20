export type AuditLogRecord = {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  agentId?: number | null;
  agentName?: string | null;
  actorEmail: string | null;
  actorName: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
};

export type NosisAuditSummaryRecord = {
  agentName: string;
  actorEmail: string | null;
  totalConsultas: number;
  porTipo: {
    CUIL: number;
    CBU: number;
  };
  porResultado: {
    validado: number;
    rechazado: number;
    error: number;
  };
  costoEstimado?: number;
};

export type NosisAuditDetailRecord = {
  id: number;
  fechaHora: string | null;
  agentName: string;
  actorEmail: string | null;
  tipoConsulta: 'CUIL' | 'CBU' | null;
  identificador: string | null;
  resultado: 'validado' | 'rechazado' | 'error' | string | null;
  estadoRespuesta: string | null;
  message: string | null;
  costoEstimado?: number;
};

export type NosisAuditPayload = {
  period: {
    from: string;
    to: string;
  };
  summary: NosisAuditSummaryRecord[];
  details: NosisAuditDetailRecord[];
};

