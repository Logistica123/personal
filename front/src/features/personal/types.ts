export type LiquidacionSummary = {
  id: number;
  fecha: string | null;
  monthKey: string | null;
  fortnightKey: string | null;
  enviada: boolean | null;
  recibido: boolean | null;
  pagado: boolean | null;
  importeFacturar: number | null;
  adjuntos?: Array<{ id: number; nombre: string; downloadUrl: string | null }>;
  combustibleDocId?: number | null;
};

export type PersonalRecord = {
  id: number;
  rowId?: string;
  nombre: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  legajo?: string | null;
  cuil: string | null;
  telefono: string | null;
  email: string | null;
  cliente: string | null;
  clienteId?: number | null;
  unidad: string | null;
  unidadDetalle: string | null;
  unidadId?: number | null;
  fechaAltaVinculacion?: string | null;
  fechaBaja?: string | null;
  sucursal: string | null;
  sucursalId?: number | null;
  fechaAlta: string | null;
  perfil: string | null;
  perfilValue: number | null;
  agente: string | null;
  agenteId?: number | null;
  agenteResponsable?: string | null;
  agenteResponsableId?: number | null;
  agentesResponsables?: string[] | null;
  agentesResponsablesIds?: number[] | null;
  estado: string | null;
  estadoId?: number | null;
  combustible: string | null;
  combustibleValue: boolean;
  combustibleEstado?: string | null;
  tarifaEspecial: string | null;
  tarifaEspecialValue: boolean;
  pago?: string | null;
  cbuAlias?: string | null;
  patente?: string | null;
  observacionTarifa?: string | null;
  observaciones?: string | null;
  esCobrador?: boolean;
  cobradorNombre?: string | null;
  cobradorEmail?: string | null;
  cobradorCuil?: string | null;
  cobradorCbuAlias?: string | null;
  membresiaDesde?: string | null;
  aprobado: boolean;
  aprobadoAt: string | null;
  aprobadoPor: string | null;
  aprobadoPorId?: number | null;
  aprobadoPorNombre?: string | null;
  createdAt?: string | null;
  createdAtLabel?: string | null;
  esSolicitud: boolean;
  solicitudTipo?:
    | 'alta'
    | 'combustible'
    | 'aumento_combustible'
    | 'adelanto'
    | 'poliza'
    | 'prestamo'
    | 'vacaciones'
    | 'cambio_asignacion';
  solicitudData?: unknown;
  transportistaQrCode?: string | null;
  transportistaQrRedirectUrl?: string | null;
  transportistaQrLandingUrl?: string | null;
  transportistaQrImageUrl?: string | null;
  transportistaQrScansCount?: number | null;
  transportistaQrLastScanAt?: string | null;
  transportistaQrLastScanAtLabel?: string | null;
  duenoNombre?: string | null;
  duenoFechaNacimiento?: string | null;
  duenoEmail?: string | null;
  duenoTelefono?: string | null;
  duenoCuil?: string | null;
  duenoCuilCobrador?: string | null;
  duenoCbuAlias?: string | null;
  duenoObservaciones?: string | null;
  liquidacionPeriods?: Array<{ monthKey: string; fortnightKey: string }>;
  liquidacionEnviada?: boolean | null;
  liquidacionRecibido?: boolean | null;
  liquidacionPagado?: boolean | null;
  liquidacionIdLatest?: number | null;
  liquidacionImporteFacturar?: number | null;
  liquidaciones?: LiquidacionSummary[] | null;
  combustibleResumen?: {
    reportId: number;
    status: string;
    totalAmount: number;
    adjustmentsTotal: number;
    totalToBill: number;
  } | null;
  documentacionStatus?: 'sin_documentos' | 'vigente' | 'por_vencer' | 'vencido' | null;
  documentacionVencidos?: number | null;
  documentacionPorVencer?: number | null;
  documentacionTotal?: number | null;
  // ADDENDUM 9 Parte C — pólizas activas en las que el distribuidor figura.
  polizasVigentes?: Array<{
    asegurado_id: number;
    poliza_id: number;
    nombre_descriptivo: string | null;
    numero_poliza: string | null;
    aseguradora_id: number | null;
    aseguradora: string | null;
    ramo: 'accidentes_personales' | 'vehiculos' | null;
  }>;
  // ADDENDUM 10 sub-fase 2 — flags titular/chofer.
  esTitularConChoferes?: boolean;
  esChoferDe?: Array<{
    relacion_id: number;
    titular_id: number;
    titular_nombre: string;
  }>;
  // ADDENDUM 13 Parte A — detalle histórico de choferes vinculados (para CSV).
  choferesDetalle?: Array<{
    persona_id: number;
    nombre_completo: string;
    cuil: string | null;
    fecha_vinculacion: string | null;
    fecha_desvinculacion: string | null;
    rol: string;
    activo: boolean;
  }>;
};
