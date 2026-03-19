export type ReclamoTransportistaSummary = {
  id: number | null;
  nombre: string | null;
  cliente?: string | null;
  patente?: string | null;
  unidad?: string | null;
};

export type ReclamoRecord = {
  id: number;
  codigo: string | null;
  detalle: string | null;
  fechaReclamo: string | null;
  fechaReclamoIso: string | null;
  status: string | null;
  statusLabel: string | null;
  pagado: boolean;
  pagadoLabel: string | null;
  importePagado: string | null;
  importePagadoLabel: string | null;
  importeFacturado: string | null;
  importeFacturadoLabel: string | null;
  creator: string | null;
  creatorId: number | null;
  agente: string | null;
  agenteId: number | null;
  transportista: string | null;
  transportistaId: number | null;
  patente?: string | null;
  transportistas?: ReclamoTransportistaSummary[];
  cliente: string | null;
  clienteNombre?: string | null;
  sucursalNombre?: string | null;
  distribuidorNombre?: string | null;
  emisorFactura?: string | null;
  importeSolicitado?: string | null;
  importeSolicitadoLabel?: string | null;
  cuitCobrador?: string | null;
  medioPago?: string | null;
  concepto?: string | null;
  fechaCompromisoPago?: string | null;
  aprobacionEstado?: 'aprobado' | 'no_aprobado' | null;
  aprobacionEstadoLabel?: string | null;
  aprobacionMotivo?: string | null;
  bloqueadoEn?: string | null;
  enRevision?: boolean;
  tipo: string | null;
  tipoSlug?: string | null;
  tipoId: number | null;
  isReclamoAdelanto?: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ReclamoMeta = {
  agentes: Array<{ id: number; nombre: string | null }>;
  creadores: Array<{ id: number; nombre: string | null }>;
  transportistas: Array<{ id: number; nombre: string | null }>;
  clientes?: Array<{ id: number; nombre: string | null }>;
  tipos: Array<{ id: number; nombre: string | null; slug?: string | null }>;
  estados: Array<{ value: string; label: string }>;
};

export type TransportistaDetail = {
  id: number;
  nombres: string | null;
  apellidos: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  sucursal: string | null;
  unidad: string | null;
  unidadDetalle: string | null;
  patente: string | null;
  agente: string | null;
  agenteId: number | null;
  fechaAlta: string | null;
};

export type ReclamoTransportistaDetail = {
  id: number;
  nombreCompleto: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  sucursal: string | null;
  unidad: string | null;
  unidadDetalle: string | null;
  patente: string | null;
  agente: string | null;
  agenteId: number | null;
  fechaAlta: string | null;
};

export type ReclamoHistoryItem = {
  id: string;
  type: 'status_change' | 'comment';
  message: string | null;
  oldStatus?: string | null;
  oldStatusLabel?: string | null;
  newStatus?: string | null;
  newStatusLabel?: string | null;
  actor?: string | null;
  actorId?: number | null;
  author?: string | null;
  authorId?: number | null;
  meta?: unknown;
  timestamp?: string | null;
  timestampLabel?: string | null;
};

export type ReclamoDocumentItem = {
  id: number;
  nombre: string | null;
  downloadUrl: string | null;
  mime: string | null;
  size: number | null;
  uploadedAt: string | null;
  uploadedAtLabel: string | null;
};

export type ReclamoDetail = ReclamoRecord & {
  history: ReclamoHistoryItem[];
  transportistaDetail: ReclamoTransportistaDetail | null;
  documents: ReclamoDocumentItem[];
};

