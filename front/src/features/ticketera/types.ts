export type TicketStatus =
  | 'pendiente_responsable'
  | 'pendiente_rrhh'
  | 'pendiente_compra'
  | 'aprobado'
  | 'rechazado';

export const TICKET_CATEGORIES = ['Tecnología', 'Muebles', 'Librería', 'Limpieza', 'Insumos varios'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const HR_EMAIL = 'dgimenez@logisticaargentinasrl.com.ar';
export const HR_USER_ID =
  (Number.isFinite(Number(process.env.REACT_APP_HR_USER_ID)) && Number(process.env.REACT_APP_HR_USER_ID)) || 22;

export type FacturaAttachment = {
  id: string;
  name: string;
  size: number;
  type: string | null;
  dataUrl: string;
};

export type TicketRequest = {
  id: number;
  titulo: string;
  categoria: TicketCategory;
  insumos: string;
  cantidad: string;
  notas: string;
  monto: string;
  facturaMonto: string;
  facturaArchivos: FacturaAttachment[];
  destinatarioId: number | null;
  destinatarioNombre: string | null;
  responsableId: number | null;
  responsableNombre: string | null;
  finalApproverId: number | null;
  finalApproverNombre: string | null;
  destinoLabel: string;
  estado: TicketStatus;
  solicitanteId: number | null;
  solicitanteNombre: string | null;
  createdAt: string;
  updatedAt: string;
  historial: Array<{ id: string; mensaje: string; fecha: string; actor: string | null }>;
};

export type FacturaApiAttachment = {
  name?: string | null;
  path?: string | null;
  size?: number | null;
  type?: string | null;
  dataUrl?: string | null;
};

export type TicketRequestApi = {
  id: number;
  titulo: string | null;
  categoria: string | null;
  insumos: string | null;
  cantidad: string | null;
  notas: string | null;
  monto: number | string | null;
  factura_monto: number | string | null;
  factura_archivos?: FacturaApiAttachment[] | null;
  destinatario_id?: number | null;
  responsable_id?: number | null;
  solicitante_id?: number | null;
  estado: TicketStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

