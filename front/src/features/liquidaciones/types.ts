// ── Entities ──────────────────────────────────────────────────────────────────

export type LiqCliente = {
  id: number;
  distriapp_cliente_id: number | null;
  razon_social: string;
  nombre_corto: string;
  codigo_corto: string | null;
  cuit: string | null;
  activo: boolean;
  configuracion_excel: Record<string, unknown> | null;
  esquemas_count?: number;
};

export type LiqEsquemaTarifario = {
  id: number;
  cliente_id: number;
  nombre: string;
  descripcion: string | null;
  dimensiones: string[];
  activo: boolean;
  created_at: string;
  dimension_valores_count?: number;
  lineas_tarifa_count?: number;
};

export type LiqDimensionValor = {
  id: number;
  esquema_id: number;
  nombre_dimension: string;
  valor: string;
  orden_display: number;
  activo: boolean;
};

export type LiqLineaTarifa = {
  id: number;
  esquema_id: number;
  dimensiones_valores: Record<string, string>;
  precio_original: string;
  porcentaje_agencia: string;
  precio_distribuidor: string;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  creado_por: number | null;
  aprobado_por: number | null;
  fecha_aprobacion: string | null;
  activo: boolean;
  created_at: string;
  creado_por_user?: { id: number; name: string; email: string };
  aprobado_por_user?: { id: number; name: string; email: string };
};

export type LiqTarifaPatente = {
  id: number;
  esquema_id: number;
  patente_norm: string;
  dimensiones_valores: Record<string, string>;
  linea_tarifa_id: number;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  creado_por: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  linea_tarifa?: Pick<LiqLineaTarifa, 'id' | 'dimensiones_valores' | 'precio_original' | 'porcentaje_agencia' | 'precio_distribuidor' | 'vigencia_desde' | 'vigencia_hasta' | 'activo' | 'aprobado_por'>;
};

export type LiqMapeoConcepto = {
  id: number;
  cliente_id: number;
  valor_excel: string;
  dimension_destino: string;
  valor_tarifa: string;
  activo: boolean;
};

export type LiqMapeoSucursal = {
  id: number;
  cliente_id: number;
  patron_archivo: string;
  sucursal_tarifa: string;
  tipo_operacion: string | null;
  activo: boolean;
};

export type LiqConfiguracionGastos = {
  id: number;
  cliente_id: number;
  concepto_gasto: string;
  monto: string;
  tipo: 'fijo' | 'porcentual';
  vigencia_desde: string;
  vigencia_hasta: string | null;
  activo: boolean;
};

export type LiqLiquidacionCliente = {
  id: number;
  cliente_id: number;
  archivo_origen?: string | null;
  sucursal_tarifa?: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_carga: string | null;
  estado: 'pendiente' | 'en_proceso' | 'auditada' | 'aprobada' | 'rechazada';
  total_operaciones: number;
  total_importe_cliente: string;
  total_importe_correcto: string;
  total_diferencia: string;
  created_at: string;
  cliente?: { id: number; nombre_corto: string; razon_social: string };
  archivos_entrada_count?: number;
};

export type LiqArchivoEntrada = {
  id: number;
  liquidacion_cliente_id: number;
  tipo_archivo: 'DATA_CLIENTE' | 'DETALLE_SUCURSAL' | 'TARIFARIO' | 'BASE_DISTRIB' | 'VARIABLES';
  nombre_original: string;
  nombre_interno: string;
  disk: string;
  ruta_storage: string;
  tamano: number;
  cant_registros: number | null;
  sucursal: string | null;
  created_at: string;
  operaciones_count?: number;
};

export type LiqOperacion = {
  id: number;
  liquidacion_cliente_id: number;
  archivo_entrada_id: number | null;
  campos_originales: Record<string, unknown>;
  dominio: string | null;
  concepto: string | null;
  sucursal_tarifa: string | null;
  dimensiones_valores?: Record<string, string> | null;
  dimension_fallida?: string | null;
  valor_cliente: string;
  linea_tarifa_id: number | null;
  valor_tarifa_original: string | null;
  valor_tarifa_distribuidor: string | null;
  porcentaje_agencia: string | null;
  diferencia_cliente: string | null;
  estado: 'pendiente' | 'ok' | 'diferencia' | 'sin_tarifa' | 'sin_distribuidor' | 'duplicado' | 'observado' | 'excluida';
  distribuidor_id: number | null;
  excluida: boolean;
  observaciones: string | null;
  distribuidor?: { id: number; apellidos: string; nombres: string; patente: string; fecha_alta: string | null; fecha_baja: string | null };
  linea_tarifa?: Pick<LiqLineaTarifa, 'id' | 'dimensiones_valores' | 'precio_original' | 'precio_distribuidor' | 'porcentaje_agencia'>;
};

export type LiqLiquidacionDistribuidor = {
  id: number;
  liquidacion_cliente_id: number;
  distribuidor_id: number;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_generacion: string | null;
  cantidad_operaciones: number;
  subtotal: string;
  gastos_administrativos: string;
  total_a_pagar: string;
  estado: 'generada' | 'aprobada' | 'pagada' | 'anulada';
  pdf_path: string | null;
  distribuidor?: { id: number; apellidos: string; nombres: string; patente: string; cbu_alias: string | null; fecha_alta: string | null; fecha_baja: string | null };
};

// ── OCA types ────────────────────────────────────────────────────────────────

export type LiqVinculacionOca = {
  id: number;
  liquidacion_cliente_id: number;
  fecha: string;
  nro_planilla: string;
  cod_contrato: string;
  descripcion: string | null;
  precio_original: string;
  cantidad: string;
  importe_original: string;
  distribuidor_id: number | null;
  distribuidor_nombre: string | null;
  precio_distribuidor: string | null;
  importe_distribuidor: string | null;
  match_score: string;
  estado: 'EXACTO' | 'APROXIMADO' | 'SIN_ASIGNAR';
  formato_origen: string | null;
  sucursal: string | null;
  distribuidor?: { id: number; apellidos: string; nombres: string; patente: string };
};

export type OcaResumen = {
  por_estado: Array<{ estado: string; cantidad: number; total_importe: string }>;
  por_distribuidor: Array<{ distribuidor_nombre: string; planillas: number; total_qty: string; total_importe: string }>;
  por_dia: Record<string, Array<{ fecha: string; estado: string; planillas: number; total_importe: string }>>;
};

export const ESTADO_OCA_LABELS: Record<LiqVinculacionOca['estado'], string> = {
  EXACTO: 'Exacto',
  APROXIMADO: 'Aproximado',
  SIN_ASIGNAR: 'Sin asignar',
};

export const ESTADO_OCA_COLOR: Record<LiqVinculacionOca['estado'], string> = {
  EXACTO: '#16a34a',
  APROXIMADO: '#d97706',
  SIN_ASIGNAR: '#dc2626',
};

// ── UI helpers ────────────────────────────────────────────────────────────────

export const ESTADO_OPERACION_LABELS: Record<LiqOperacion['estado'], string> = {
  pendiente: 'Pendiente',
  ok: 'OK',
  diferencia: 'Diferencia',
  sin_tarifa: 'Sin tarifa',
  sin_distribuidor: 'Sin distribuidor',
  duplicado: 'Duplicado',
  observado: 'Observado',
  excluida: 'Excluida',
};

export const ESTADO_OPERACION_COLOR: Record<LiqOperacion['estado'], string> = {
  pendiente: '#6b7280',
  ok: '#16a34a',
  diferencia: '#d97706',
  sin_tarifa: '#dc2626',
  sin_distribuidor: '#7c3aed',
  duplicado: '#db2777',
  observado: '#0891b2',
  excluida: '#9ca3af',
};

export const ESTADO_LIQ_LABELS: Record<LiqLiquidacionCliente['estado'], string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  auditada: 'Auditada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};
