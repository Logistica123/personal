export type WorkflowStatus = 'nueva' | 'proceso' | 'finalizado';

export type WorkflowTaskRecord = {
  id: number;
  titulo: string;
  descripcion: string | null;
  status: WorkflowStatus;
  creatorId: number | null;
  creatorNombre: string | null;
  responsableId: number | null;
  responsableNombre: string | null;
  responsables?: Array<{ id: number | null; nombre: string | null }>;
  createdAt: string | null;
};

export type WorkflowDeleteHistoryEntry = {
  taskId: number;
  title: string;
  status: WorkflowStatus | null;
  removedAt: string;
  removedBy: string | null;
};

