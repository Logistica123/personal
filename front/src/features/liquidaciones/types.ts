// ============================================================
// Módulo de Control de Liquidaciones v2.0
// Tipos TypeScript — spec técnico 28/03/2026
// ============================================================

// ------------------------------------------------------------
// Configuración de clientes
// ------------------------------------------------------------

export type LiqClienteLiq = {
  id: number;
  razon_social: string;
  nombre_corto: string;
  cuit: string | null;
  activo: boolean;
};

// ------------------------------------------------------------
// Módulo de Tarifas
// ------------------------------------------------------------

/**
 * Define las dimensiones que componen la tarifa de un cliente.
 * Ejemplo: dimensiones = ['sucursal', 'concepto']
 */
export type EsquemaTarifario = {
  id: number;
  cliente_id: number;
  cliente_nombre?: string | null;
  nombre: string;
  descripcion: string | null;
  dimensiones: string[]; // ['sucursal', 'concepto']
  activo: boolean;
  fecha_creacion: string;
};

/**
 * Un valor posible para una dimensión de un esquema tarifario.
 * Ejemplo: nombre_dimension='sucursal', valor='AMBA'
 */
export type DimensionTarifaValor = {
  id: number;
  esquema_id: number;
  nombre_dimension: string;
  valor: string;
  orden_display: number;
  activo: boolean;
};

/**
 * Línea de tarifa: combinación de dimensiones con su precio.
 * precio_distribuidor = precio_original * (1 - porcentaje_agencia / 100)
 */
export type LineaTarifa = {
  id: number;
  esquema_id: number;
  dimensiones_valores: Record<string, string>; // {sucursal: 'AMBA', concepto: 'Ut. Corto AM'}
  precio_original: number;
  porcentaje_agencia: number;
  precio_distribuidor: number; // calculado por el sistema
  vigencia_desde: string;
  vigencia_hasta: string | null;
  creado_por: number | null;
  aprobado_por: number | null;
  creado_por_nombre?: string | null;
  aprobado_por_nombre?: string | null;
  fecha_creacion: string;
  fecha_aprobacion: string | null;
  activo: boolean;
};

// Formulario de nueva línea de tarifa (antes de enviar al backend)
export type LineaTarifaForm = {
  dimensiones_valores: Record<string, string>;
  precio_original: string; // string para el input
  porcentaje_agencia: string;
  vigencia_desde: string;
  vigencia_hasta: string;
};

export const lineaTarifaFormVacia = (): LineaTarifaForm => ({
  dimensiones_valores: {},
  precio_original: '',
  porcentaje_agencia: '',
  vigencia_desde: '',
  vigencia_hasta: '',
});

// ------------------------------------------------------------
// Mapeos y configuración
// ------------------------------------------------------------

/**
 * Traduce un concepto del Excel del cliente al valor de la dimensión en la tarifa.
 * Ejemplo: 'Rango 0-50 Km' → dimension='concepto' → 'Ut. Corto AM'
 */
export type MapeoConcepto = {
  id: number;
  cliente_id: number;
  valor_excel: string;
  dimension_destino: string;
  valor_tarifa: string;
  activo: boolean;
};

/**
 * Vincula un patrón de nombre de archivo con la sucursal tarifa correspondiente.
 * Ejemplo: 'AMBA COLECTA' → sucursal_tarifa='AMBA', tipo_operacion='Colecta'
 */
export type MapeoSucursal = {
  id: number;
  cliente_id: number;
  patron_archivo: string;
  sucursal_tarifa: string;
  tipo_operacion: string;
  activo: boolean;
};

/**
 * Gasto administrativo descontado al distribuidor por período.
 * Loginter: $2.010 fijos por período por distribuidor.
 */
export type ConfiguracionGastos = {
  id: number;
  cliente_id: number;
  concepto_gasto: string;
  monto: number;
  tipo: 'fijo' | 'porcentual';
  vigencia_desde: string;
  vigencia_hasta: string | null;
  activo: boolean;
};

// ------------------------------------------------------------
// Proceso de liquidación
// ------------------------------------------------------------

export type LiquidacionClienteEstado =
  | 'pendiente'
  | 'en_proceso'
  | 'auditada'
  | 'aprobada'
  | 'rechazada';

/**
 * Representa una carga de archivo Excel del cliente (un batch de operaciones).
 */
export type LiquidacionCliente = {
  id: number;
  cliente_id: number;
  cliente_nombre?: string | null;
  archivo_origen: string | null;
  sucursal_tarifa: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_carga: string;
  usuario_carga: number;
  usuario_nombre?: string | null;
  estado: LiquidacionClienteEstado;
  total_operaciones: number;
  total_importe_cliente: number;
  total_importe_correcto: number;
  total_diferencia: number;
};

export type OperacionEstado =
  | 'ok'
  | 'diferencia'
  | 'sin_tarifa'
  | 'sin_distribuidor'
  | 'duplicado'
  | 'observado';

/**
 * Una operación (fila del Excel) procesada y cruzada con la tarifa.
 */
export type Operacion = {
  id: number;
  liquidacion_cliente_id: number;
  campos_originales: Record<string, unknown>;
  dominio: string | null;
  concepto: string | null;
  valor_cliente: number;
  linea_tarifa_id: number | null;
  valor_tarifa_original: number | null;
  valor_tarifa_distribuidor: number | null;
  porcentaje_agencia: number | null;
  diferencia_cliente: number | null;
  estado: OperacionEstado;
  distribuidor_id: number | null;
  distribuidor_nombre?: string | null;
  observacion?: string | null;
  excluida?: boolean;
  motivo_exclusion?: string | null;
};

// ------------------------------------------------------------
// Liquidaciones por distribuidor
// ------------------------------------------------------------

export type LiquidacionDistribuidorEstado =
  | 'generada'
  | 'aprobada'
  | 'pagada'
  | 'anulada';

/**
 * Liquidación individual calculada para un distribuidor en un período.
 */
export type LiquidacionDistribuidor = {
  id: number;
  liquidacion_cliente_id: number;
  liquidacion_cliente?: LiquidacionCliente | null;
  distribuidor_id: number;
  distribuidor_nombre?: string | null;
  distribuidor_patente?: string | null;
  distribuidor_cuit?: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_generacion: string;
  cantidad_operaciones: number;
  subtotal: number;
  gastos_administrativos: number;
  total_a_pagar: number;
  estado: LiquidacionDistribuidorEstado;
  pdf_url: string | null;
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export const OPERACION_ESTADO_LABEL: Record<OperacionEstado, string> = {
  ok: 'OK',
  diferencia: 'Diferencia',
  sin_tarifa: 'Sin tarifa',
  sin_distribuidor: 'Sin distribuidor',
  duplicado: 'Duplicado',
  observado: 'Observado',
};

export const OPERACION_ESTADO_COLOR: Record<OperacionEstado, string> = {
  ok: '#2d9348',
  diferencia: '#d97706',
  sin_tarifa: '#dc2626',
  sin_distribuidor: '#7c3aed',
  duplicado: '#0284c7',
  observado: '#6b7280',
};

export const LIQ_DISTRIBUIDOR_ESTADO_LABEL: Record<LiquidacionDistribuidorEstado, string> = {
  generada: 'Generada',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

export const LIQ_CLIENTE_ESTADO_LABEL: Record<LiquidacionClienteEstado, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  auditada: 'Auditada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

export const formatPeso = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export const formatFecha = (iso: string): string => {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
