BEGIN;

CREATE TABLE IF NOT EXISTS arca_emisor (
  id BIGSERIAL PRIMARY KEY,
  razon_social VARCHAR(255) NOT NULL,
  cuit BIGINT NOT NULL UNIQUE,
  condicion_iva VARCHAR(50) NOT NULL,
  ambiente_default VARCHAR(10) NOT NULL CHECK (ambiente_default IN ('HOMO','PROD')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arca_certificado (
  id BIGSERIAL PRIMARY KEY,
  emisor_id BIGINT NOT NULL REFERENCES arca_emisor(id),
  alias VARCHAR(120) NOT NULL,
  ambiente VARCHAR(10) NOT NULL CHECK (ambiente IN ('HOMO','PROD')),
  subject_dn TEXT,
  serial_number_subject VARCHAR(80),
  thumbprint_sha1 VARCHAR(80),
  thumbprint_sha256 VARCHAR(128),
  certificado_pem_path TEXT,
  private_key_path_encrypted TEXT,
  p12_path_encrypted TEXT,
  password_ref TEXT,
  valid_from TIMESTAMP,
  valid_to TIMESTAMP,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_wsaa_ok_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (emisor_id, alias, ambiente)
);

CREATE TABLE IF NOT EXISTS arca_ta_cache (
  id BIGSERIAL PRIMARY KEY,
  certificado_id BIGINT NOT NULL REFERENCES arca_certificado(id) ON DELETE CASCADE,
  ambiente VARCHAR(10) NOT NULL CHECK (ambiente IN ('HOMO','PROD')),
  service_name VARCHAR(50) NOT NULL,
  token TEXT NOT NULL,
  sign TEXT NOT NULL,
  generation_time TIMESTAMP NOT NULL,
  expiration_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (certificado_id, ambiente, service_name)
);

CREATE TABLE IF NOT EXISTS arca_punto_venta (
  id BIGSERIAL PRIMARY KEY,
  emisor_id BIGINT NOT NULL REFERENCES arca_emisor(id),
  ambiente VARCHAR(10) NOT NULL CHECK (ambiente IN ('HOMO','PROD')),
  nro INTEGER NOT NULL,
  sistema_arca VARCHAR(120),
  emision_tipo VARCHAR(50),
  bloqueado BOOLEAN,
  fch_baja DATE,
  habilitado_para_erp BOOLEAN NOT NULL DEFAULT TRUE,
  default_para_cbte_tipo INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (emisor_id, ambiente, nro)
);

CREATE TABLE IF NOT EXISTS factura_cabecera (
  id BIGSERIAL PRIMARY KEY,
  emisor_id BIGINT NOT NULL REFERENCES arca_emisor(id),
  certificado_id BIGINT REFERENCES arca_certificado(id),
  ambiente VARCHAR(10) NOT NULL CHECK (ambiente IN ('HOMO','PROD')),
  pto_vta INTEGER NOT NULL,
  cbte_tipo INTEGER NOT NULL,
  cbte_numero BIGINT,
  concepto INTEGER NOT NULL,
  doc_tipo INTEGER NOT NULL,
  doc_nro BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  cliente_nombre VARCHAR(255) NOT NULL,
  cliente_domicilio TEXT,
  fecha_cbte DATE NOT NULL,
  fecha_serv_desde DATE,
  fecha_serv_hasta DATE,
  fecha_vto_pago DATE,
  moneda_id VARCHAR(10) NOT NULL,
  moneda_cotiz NUMERIC(18,6) NOT NULL,
  imp_total NUMERIC(18,2) NOT NULL,
  imp_tot_conc NUMERIC(18,2) NOT NULL DEFAULT 0,
  imp_neto NUMERIC(18,2) NOT NULL DEFAULT 0,
  imp_op_ex NUMERIC(18,2) NOT NULL DEFAULT 0,
  imp_iva NUMERIC(18,2) NOT NULL DEFAULT 0,
  imp_trib NUMERIC(18,2) NOT NULL DEFAULT 0,
  resultado_arca VARCHAR(5),
  reproceso VARCHAR(5),
  cae VARCHAR(32),
  cae_vto DATE,
  observaciones_arca_json JSONB,
  errores_arca_json JSONB,
  request_xml_path TEXT,
  response_xml_path TEXT,
  pdf_path TEXT,
  estado VARCHAR(40) NOT NULL,
  hash_idempotencia VARCHAR(128) NOT NULL,
  anio_facturado SMALLINT NOT NULL,
  mes_facturado SMALLINT NOT NULL CHECK (mes_facturado BETWEEN 1 AND 12),
  periodo_facturado VARCHAR(30) NOT NULL CHECK (periodo_facturado IN ('PRIMERA_QUINCENA','SEGUNDA_QUINCENA','MES_COMPLETO')),
  fecha_aprox_cobro DATE,
  fecha_pago_manual DATE,
  estado_cobranza VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_cobranza IN ('PENDIENTE','A_VENCER','VENCIDA','COBRADA','PARCIAL')),
  observaciones_cobranza TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (emisor_id, ambiente, pto_vta, cbte_tipo, cbte_numero),
  UNIQUE (hash_idempotencia)
);

CREATE TABLE IF NOT EXISTS factura_iva (
  id BIGSERIAL PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES factura_cabecera(id) ON DELETE CASCADE,
  iva_id INTEGER NOT NULL,
  base_imp NUMERIC(18,2) NOT NULL,
  importe NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS factura_tributo (
  id BIGSERIAL PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES factura_cabecera(id) ON DELETE CASCADE,
  tributo_id INTEGER NOT NULL,
  descr VARCHAR(255),
  base_imp NUMERIC(18,2),
  alic NUMERIC(8,4),
  importe NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS factura_detalle_pdf (
  id BIGSERIAL PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES factura_cabecera(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(18,4) NOT NULL,
  unidad_medida VARCHAR(50),
  precio_unitario NUMERIC(18,2) NOT NULL,
  bonificacion_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
  subtotal NUMERIC(18,2) NOT NULL,
  alicuota_iva_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
  subtotal_con_iva NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS historial_cobranza_factura (
  id BIGSERIAL PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES factura_cabecera(id) ON DELETE CASCADE,
  fecha_evento TIMESTAMP NOT NULL DEFAULT NOW(),
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20),
  fecha_aprox_cobro_anterior DATE,
  fecha_aprox_cobro_nueva DATE,
  fecha_pago_anterior DATE,
  fecha_pago_nueva DATE,
  observaciones TEXT,
  usuario_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria_facturacion (
  id BIGSERIAL PRIMARY KEY,
  entidad VARCHAR(80) NOT NULL,
  entidad_id BIGINT NOT NULL,
  evento VARCHAR(80) NOT NULL,
  payload_before_json JSONB,
  payload_after_json JSONB,
  usuario_id BIGINT,
  ip VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arca_pv_emisor_ambiente_nro ON arca_punto_venta (emisor_id, ambiente, nro);
CREATE INDEX IF NOT EXISTS idx_factura_estado_fecha ON factura_cabecera (estado, fecha_cbte);
CREATE INDEX IF NOT EXISTS idx_factura_cliente_periodo ON factura_cabecera (cliente_id, sucursal_id, anio_facturado, mes_facturado, periodo_facturado);
CREATE INDEX IF NOT EXISTS idx_factura_cobranza ON factura_cabecera (estado_cobranza, fecha_aprox_cobro, fecha_pago_manual);

CREATE OR REPLACE VIEW vw_clientes_facturacion_consolidado AS
SELECT
  fc.cliente_id,
  fc.sucursal_id,
  fc.anio_facturado,
  fc.mes_facturado,
  fc.periodo_facturado,
  COUNT(*) AS cantidad_facturas,
  SUM(COALESCE(fc.imp_neto,0)) AS total_neto_gravado,
  SUM(COALESCE(fc.imp_tot_conc,0) + COALESCE(fc.imp_op_ex,0)) AS total_no_gravado,
  SUM(COALESCE(fc.imp_iva,0)) AS total_iva,
  SUM(COALESCE(fc.imp_total,0)) AS total_final,
  MIN(fc.fecha_aprox_cobro) AS primera_fecha_aprox_cobro,
  MAX(fc.fecha_aprox_cobro) AS ultima_fecha_aprox_cobro,
  MAX(fc.fecha_pago_manual) AS ultima_fecha_pago,
  SUM(CASE WHEN fc.estado_cobranza = 'COBRADA' THEN 1 ELSE 0 END) AS facturas_cobradas,
  SUM(CASE WHEN fc.estado_cobranza = 'VENCIDA' THEN 1 ELSE 0 END) AS facturas_vencidas,
  SUM(CASE WHEN fc.estado_cobranza IN ('PENDIENTE','A_VENCER','PARCIAL') THEN 1 ELSE 0 END) AS facturas_pendientes
FROM factura_cabecera fc
GROUP BY fc.cliente_id, fc.sucursal_id, fc.anio_facturado, fc.mes_facturado, fc.periodo_facturado;

COMMIT;
