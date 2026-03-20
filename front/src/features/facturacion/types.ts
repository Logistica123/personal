export type FacturacionFormato = string;
export type FacturacionPeriodicidad = 'semanal' | 'quincenal' | 'mensual' | 'eventual';
export type FacturacionInvoiceStatus = 'emitida' | 'pendiente_cobro' | 'conciliada';

export type FacturacionClientConfig = {
  id: string;
  clienteId: number;
  clienteNombre: string;
  formato: FacturacionFormato;
  periodicidad: FacturacionPeriodicidad;
  condicionComercial: string;
  importeBase: number;
  updatedAt: string;
};

export type FacturacionInvoice = {
  id: string;
  numero: string;
  clienteId: number;
  clienteNombre: string;
  concepto: string;
  periodo: string;
  formato: FacturacionFormato;
  periodicidad: FacturacionPeriodicidad;
  condicionComercial: string;
  importe: number;
  emitidaAt: string;
  origen: 'individual' | 'masiva';
  arcaStatus: 'mock_emitida' | 'pendiente_envio' | 'enviada';
  estado: FacturacionInvoiceStatus;
  conciliadoMovimientoId: string | null;
  conciliadoAt: string | null;
  diferenciaMonto: number | null;
};

export type FacturacionBankMovement = {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  monto: number;
};

export type FacturacionConciliationMatch = {
  invoiceId: string;
  invoiceNumero: string;
  movimientoId: string;
  movimientoDescripcion: string;
  movimientoReferencia: string;
  montoFactura: number;
  montoMovimiento: number;
  diferenciaMonto: number;
  criterio: string;
};

export type ArcaCertificadoDto = {
  id: number;
  emisor_id: number;
  alias: string;
  ambiente: 'HOMO' | 'PROD';
  subject_dn?: string | null;
  serial_number_subject?: string | null;
  thumbprint_sha1?: string | null;
  thumbprint_sha256?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  activo: boolean;
  estado?: string | null;
  ultimo_login_wsaa_ok_at?: string | null;
  has_private_key?: boolean;
  has_p12?: boolean;
  has_csr?: boolean;
};

export type ArcaPuntoVentaDto = {
  id: number;
  emisor_id: number;
  ambiente: 'HOMO' | 'PROD';
  nro: number;
  sistema_arca?: string | null;
  emision_tipo?: string | null;
  bloqueado: boolean;
  fch_baja?: string | null;
  habilitado_para_erp: boolean;
  default_para_cbte_tipo?: number | null;
};

export type ArcaEmisorDto = {
  id: number;
  razon_social: string;
  cuit: string;
  condicion_iva: string;
  ambiente_default: 'HOMO' | 'PROD';
  activo: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  certificados?: ArcaCertificadoDto[];
  puntos_venta?: ArcaPuntoVentaDto[];
};

export type ClienteSelectOption = {
  id: number;
  codigo?: string | null;
  nombre?: string | null;
  documento_fiscal?: string | null;
};

export type SucursalSelectOption = {
  id: number;
  cliente_id?: number;
  nombre?: string | null;
  direccion?: string | null;
  encargado_deposito?: string | null;
};

export type FacturaIvaInput = {
  iva_id: number;
  base_imp: number;
  importe: number;
};

export type FacturaTributoInput = {
  tributo_id: number;
  descr?: string | null;
  base_imp?: number | null;
  alic?: number | null;
  importe: number;
};

export type FacturaDetallePdfInput = {
  orden: number;
  descripcion: string;
  cantidad: number;
  unidad_medida?: string | null;
  precio_unitario: number;
  bonificacion_pct?: number | null;
  subtotal: number;
  alicuota_iva_pct?: number | null;
  subtotal_con_iva: number;
};

export type FacturaCbteAsocInput = {
  cbte_tipo: number;
  pto_vta: number;
  cbte_numero: number;
  fecha_emision?: string | null;
};

export type FacturaSummaryDto = {
  id: number;
  cliente_id: number;
  sucursal_id: number;
  cliente_nombre: string;
  sucursal_nombre?: string | null;
  pto_vta: number;
  cbte_tipo: number;
  cbte_numero?: number | null;
  fecha_cbte?: string | null;
  imp_neto?: number | null;
  imp_iva?: number | null;
  imp_tot_conc?: number | null;
  imp_op_ex?: number | null;
  imp_total?: number | null;
  fecha_aprox_cobro?: string | null;
  fecha_pago_manual?: string | null;
  estado_cobranza?: string | null;
  estado?: string | null;
  cae?: string | null;
  anio_facturado?: number | null;
  mes_facturado?: number | null;
  periodo_facturado?: string | null;
  pdf_url?: string | null;
};

export type FacturaHistorialCobranzaItem = {
  id: number;
  fecha_evento?: string | null;
  estado_anterior?: string | null;
  estado_nuevo?: string | null;
  fecha_aprox_cobro_anterior?: string | null;
  fecha_aprox_cobro_nueva?: string | null;
  fecha_pago_anterior?: string | null;
  fecha_pago_nueva?: string | null;
  monto_pagado_anterior?: number | null;
  monto_pagado_nuevo?: number | null;
  observaciones?: string | null;
  usuario?: { id: number; name?: string | null; email?: string | null } | null;
};

export type FacturaAuditoriaItem = {
  id: number;
  evento: string;
  created_at?: string | null;
  ip?: string | null;
  usuario?: { id: number; name?: string | null; email?: string | null } | null;
  payload_before?: Record<string, unknown> | null;
  payload_after?: Record<string, unknown> | null;
};

export type FacturaDetalleDto = {
  id: number;
  emisor_id: number;
  certificado_id?: number | null;
  ambiente: 'HOMO' | 'PROD';
  pto_vta: number;
  cbte_tipo: number;
  cbte_numero?: number | null;
  concepto: number;
  doc_tipo: number;
  doc_nro: number;
  cliente_id: number;
  sucursal_id: number;
  cliente_nombre: string;
  cliente_domicilio?: string | null;
  fecha_cbte: string;
  fecha_serv_desde?: string | null;
  fecha_serv_hasta?: string | null;
  fecha_vto_pago?: string | null;
  condiciones_venta?: string[] | null;
  moneda_id: string;
  moneda_cotiz: number;
  imp_total: number;
  imp_tot_conc: number;
  imp_neto: number;
  imp_op_ex: number;
  imp_iva: number;
  imp_trib: number;
  resultado_arca?: string | null;
  reproceso?: string | null;
  cae?: string | null;
  cae_vto?: string | null;
  observaciones_arca?: unknown;
  errores_arca?: unknown;
  estado: string;
  hash_idempotencia?: string | null;
  anio_facturado: number;
  mes_facturado: number;
  periodo_facturado: string;
  fecha_aprox_cobro?: string | null;
  fecha_pago_manual?: string | null;
  monto_pagado_manual?: number | null;
  estado_cobranza?: string | null;
  observaciones_cobranza?: string | null;
  pdf_url?: string | null;
  xml_request_url?: string | null;
  xml_response_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  iva?: FacturaIvaInput[];
  tributos?: FacturaTributoInput[];
  detalle_pdf?: FacturaDetallePdfInput[];
  cbtes_asoc?: FacturaCbteAsocInput[];
  historial_cobranza?: FacturaHistorialCobranzaItem[];
};

export type ClientesFacturacionResumenDto = {
  group_id: string;
  cliente_id: number;
  cliente_nombre: string;
  sucursal_id: number;
  sucursal_nombre: string;
  anio_facturado: number;
  mes_facturado: number;
  periodo_facturado: string;
  cantidad_facturas: number;
  total_neto_gravado: number;
  total_no_gravado: number;
  total_iva: number;
  total_final: number;
  facturas_cobradas: number;
  facturas_pendientes: number;
  facturas_vencidas: number;
  primera_fecha_aprox_cobro?: string | null;
  ultima_fecha_aprox_cobro?: string | null;
  ultima_fecha_pago?: string | null;
};

