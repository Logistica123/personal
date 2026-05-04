-- =================================================================
-- MIGRATION — Módulo Pólizas
-- Generado: 2026-05-04
-- 7 tablas + datos seed (3 aseguradoras + 4 pólizas + email_config)
-- =================================================================

BEGIN;

-- =================================================================
-- 1. polizas_aseguradoras
-- =================================================================
CREATE TABLE polizas_aseguradoras (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    parser_perfil VARCHAR(50) NOT NULL UNIQUE,  -- mapfre|san_cristobal|la_segunda
    cuit VARCHAR(15) NULL,
    domicilio VARCHAR(255) NULL,
    web VARCHAR(255) NULL,
    email_general VARCHAR(150) NULL,
    notas TEXT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parser (parser_perfil),
    INDEX idx_activa (activa)
);

-- =================================================================
-- 2. polizas
-- =================================================================
CREATE TABLE polizas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    aseguradora_id BIGINT NOT NULL,
    nombre_descriptivo VARCHAR(150) NOT NULL,
    ramo ENUM('accidentes_personales','vehiculos') NOT NULL,
    subramo VARCHAR(100) NULL,
    tipo_asegurado ENUM('persona','vehiculo') NOT NULL,
    numero_poliza VARCHAR(50) NOT NULL,
    numero_cuenta_cliente VARCHAR(50) NULL,
    vigencia_desde DATE NOT NULL,
    vigencia_hasta DATE NOT NULL,
    tomador_cuit VARCHAR(15) NULL,
    tomador_razon_social VARCHAR(150) NULL,
    tomador_domicilio VARCHAR(255) NULL,
    suma_asegurada_total DECIMAL(18,2) NULL,
    premio_anual DECIMAL(14,2) NULL,
    cantidad_vidas_unidades INT NOT NULL DEFAULT 0,
    clausulas_especiales TEXT NULL,
    alerta_dias_antes_vencimiento INT NOT NULL DEFAULT 15,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (aseguradora_id) REFERENCES polizas_aseguradoras(id),
    INDEX idx_aseguradora (aseguradora_id),
    INDEX idx_vigencia (vigencia_desde, vigencia_hasta),
    INDEX idx_activa (activa),
    UNIQUE KEY uniq_poliza_numero (aseguradora_id, numero_poliza)
);

-- =================================================================
-- 3. polizas_email_config
-- =================================================================
CREATE TABLE polizas_email_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    tipo ENUM('alta','baja') NOT NULL,
    destinatarios_to JSON NOT NULL,
    destinatarios_cc JSON NULL,
    destinatarios_bcc JSON NULL,
    contacto_nombre VARCHAR(100) NULL,
    asunto_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    asegurado_template TEXT NOT NULL,
    adjuntos_requeridos JSON NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_poliza_tipo (poliza_id, tipo)
);

-- =================================================================
-- 4. polizas_endosos
-- =================================================================
CREATE TABLE polizas_endosos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    numero_endoso VARCHAR(50) NOT NULL,
    tipo ENUM('constancia','incorporacion','baja','modificacion') NOT NULL,
    fecha_emision DATE NOT NULL,
    archivo_id BIGINT NULL,           -- FK Archivo (sistema documentos)
    descripcion TEXT NULL,
    premio_endoso DECIMAL(14,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    INDEX idx_poliza (poliza_id),
    INDEX idx_fecha (fecha_emision)
);

-- =================================================================
-- 5. polizas_asegurados
-- =================================================================
CREATE TABLE polizas_asegurados (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    persona_id BIGINT NULL,
    tipo_asegurado ENUM('persona','vehiculo') NOT NULL,
    identificador VARCHAR(50) NOT NULL,
    identificador_tipo ENUM('dni','cuil','patente') NOT NULL,
    numero_orden_aseguradora VARCHAR(20) NULL,
    nombre_apellido_pdf VARCHAR(200) NULL,
    marca_modelo_pdf VARCHAR(150) NULL,
    tipo_vehiculo_pdf VARCHAR(50) NULL,
    localidad_pdf VARCHAR(100) NULL,
    suma_asegurada DECIMAL(14,2) NULL,
    premio_individual DECIMAL(14,2) NULL,
    alta_endoso_id BIGINT NULL,
    baja_endoso_id BIGINT NULL,
    fecha_alta_efectiva DATE NULL,
    fecha_baja_efectiva DATE NULL,
    estado ENUM('activo','alta_solicitada','baja_solicitada','dado_de_baja','no_matcheado')
        NOT NULL DEFAULT 'activo',
    match_score DECIMAL(4,3) NULL,
    match_metodo ENUM('cuil_exacto','dni_exacto','patente_exacto','fuzzy_nombre','manual') NULL,
    revision_manual_pendiente BOOLEAN NOT NULL DEFAULT FALSE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL,
    FOREIGN KEY (alta_endoso_id) REFERENCES polizas_endosos(id) ON DELETE SET NULL,
    FOREIGN KEY (baja_endoso_id) REFERENCES polizas_endosos(id) ON DELETE SET NULL,
    UNIQUE KEY uniq_poliza_identificador (poliza_id, identificador),
    INDEX idx_poliza_estado (poliza_id, estado),
    INDEX idx_persona (persona_id),
    INDEX idx_identificador (identificador)
);

-- =================================================================
-- 6. polizas_solicitudes
-- =================================================================
CREATE TABLE polizas_solicitudes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    tipo ENUM('alta','baja') NOT NULL,
    administrativo_user_id BIGINT NOT NULL,
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    destinatarios_to_resueltos JSON NOT NULL,
    destinatarios_cc_resueltos JSON NULL,
    asunto VARCHAR(255) NOT NULL,
    body LONGTEXT NOT NULL,
    adjuntos JSON NULL,
    estado ENUM('borrador','enviado','respondida_ok','respondida_rechazada','cancelada')
        NOT NULL DEFAULT 'borrador',
    enviado_en TIMESTAMP NULL,
    respuesta_recibida_en TIMESTAMP NULL,
    respuesta_resumen TEXT NULL,
    email_message_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id),
    FOREIGN KEY (administrativo_user_id) REFERENCES users(id),
    INDEX idx_poliza (poliza_id),
    INDEX idx_estado (estado),
    INDEX idx_admin (administrativo_user_id)
);

-- =================================================================
-- 7. polizas_solicitud_asegurados
-- =================================================================
CREATE TABLE polizas_solicitud_asegurados (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    solicitud_id BIGINT NOT NULL,
    asegurado_id BIGINT NOT NULL,
    observaciones TEXT NULL,
    FOREIGN KEY (solicitud_id) REFERENCES polizas_solicitudes(id) ON DELETE CASCADE,
    FOREIGN KEY (asegurado_id) REFERENCES polizas_asegurados(id),
    UNIQUE KEY uniq_solicitud_asegurado (solicitud_id, asegurado_id)
);

-- =================================================================
-- 8. polizas_admin_permisos
-- =================================================================
CREATE TABLE polizas_admin_permisos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    puede_cargar_pdf BOOLEAN NOT NULL DEFAULT FALSE,
    puede_solicitar_alta BOOLEAN NOT NULL DEFAULT FALSE,
    puede_solicitar_baja BOOLEAN NOT NULL DEFAULT FALSE,
    puede_confirmar_respuesta BOOLEAN NOT NULL DEFAULT FALSE,
    puede_editar_email_config BOOLEAN NOT NULL DEFAULT FALSE,
    recibe_alertas_vencimiento BOOLEAN NOT NULL DEFAULT FALSE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_user (user_id)
);

-- =================================================================
-- (Opcional Fase 2) — polizas_admin_email_accounts (OAuth)
-- Comentado. Descomentar si se migra a OAuth Gmail/Outlook.
-- =================================================================
-- CREATE TABLE polizas_admin_email_accounts (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     user_id BIGINT NOT NULL,
--     provider ENUM('gmail','outlook') NOT NULL,
--     email VARCHAR(150) NOT NULL,
--     oauth_access_token TEXT NULL,
--     oauth_refresh_token TEXT NULL,
--     scope TEXT NULL,
--     expires_at TIMESTAMP NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--     UNIQUE KEY uniq_user_email (user_id, email)
-- );

-- =================================================================
-- ALTER en tabla `archivos` (categorización de documentos)
-- =================================================================
-- Si el campo no existe, agregarlo:
ALTER TABLE archivos
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) NULL AFTER nombre,
  ADD INDEX IF NOT EXISTS idx_categoria (categoria);

-- Slugs reservados para categoría:
--   foto_frente, foto_lateral_der, foto_lateral_izq, foto_trasera,
--   cedula_frente, cedula_dorso, dni_frente, dni_dorso, generico

-- =================================================================
-- SEED — 3 aseguradoras
-- =================================================================
INSERT INTO polizas_aseguradoras (nombre, parser_perfil, cuit, domicilio, web, email_general, activa)
VALUES
  ('MAPFRE',
   'mapfre',
   '33-70089372-9',
   'Alférez H. Bouchard 4191 (B1605BNA) - Munro - Prov. Buenos Aires',
   'www.mapfre.com.ar',
   NULL,    -- TODO: completar email Carlos contacto MAPFRE
   TRUE),
  ('San Cristóbal',
   'san_cristobal',
   '34-50004533-9',
   'Av. 9 de Julio 451, Resistencia, Chaco',
   'www.sancristobal.com.ar',
   'resistencia@sancristobal.com.ar',
   TRUE),
  ('La Segunda',
   'la_segunda',
   '30-50001770-4',
   'Brig. Gral. Juan Manuel de Rosas 957, Rosario, Sta. Fe',
   'www.lasegunda.com.ar',
   NULL,    -- TODO: completar email Ramón Morel contacto La Segunda
   TRUE);

-- Capturar IDs
SET @mapfre_id     = (SELECT id FROM polizas_aseguradoras WHERE parser_perfil='mapfre');
SET @sc_id         = (SELECT id FROM polizas_aseguradoras WHERE parser_perfil='san_cristobal');
SET @lasegunda_id  = (SELECT id FROM polizas_aseguradoras WHERE parser_perfil='la_segunda');

-- =================================================================
-- SEED — 4 pólizas
-- =================================================================
INSERT INTO polizas (
    aseguradora_id, nombre_descriptivo, ramo, subramo, tipo_asegurado,
    numero_poliza, numero_cuenta_cliente, vigencia_desde, vigencia_hasta,
    tomador_cuit, tomador_razon_social, tomador_domicilio,
    clausulas_especiales, alerta_dias_antes_vencimiento, activa
)
VALUES
  (@mapfre_id,
   'MAPFRE - AP Distribuidores',
   'accidentes_personales', 'AP Ámbito Laboral + In Itinere', 'persona',
   '2297608',
   NULL,
   '2025-04-08', '2026-04-08',
   '30-71706098-5', 'LOGISTICA ARGENTINA S.R.L.', 'Patagonia 1475, Corrientes',
   'Cláusulas OCASA',
   15, TRUE),

  (@sc_id,
   'San Cristóbal - AP Colectivo',
   'accidentes_personales', 'AP Colectivo', 'persona',
   '01-06-06-30035710',
   '01-02297625',
   '2026-03-30', '2026-12-05',
   '30-71706098-5', 'LOGISTICA ARGENTINA SRL', 'Av. Tte. Ibáñez 735, Corrientes',
   NULL,
   15, TRUE),

  (@lasegunda_id,
   'La Segunda - Vehículos Autos',
   'vehiculos', 'Autos', 'vehiculo',
   '67.743.063',
   NULL,
   '2026-01-23', '2027-01-23',
   '30-71706098-5', 'LOGISTICA ARGENTINA S.R.L', 'Av. Tte. Ibáñez 735, Corrientes',
   'Cláusulas OCA',
   15, TRUE),

  (@lasegunda_id,
   'La Segunda - Vehículos Motos',
   'vehiculos', 'Motos', 'vehiculo',
   '45.597.407',
   NULL,
   '2026-02-28', '2026-05-31',
   '30-71706098-5', 'LOGISTICA ARGENTINA S.R.L', 'Av. Tte. Ibáñez 735, Corrientes',
   'Cláusulas OCA',
   15, TRUE);

-- Capturar IDs de pólizas
SET @poliza_mapfre   = (SELECT id FROM polizas WHERE numero_poliza='2297608');
SET @poliza_sc       = (SELECT id FROM polizas WHERE numero_poliza='01-06-06-30035710');
SET @poliza_autos    = (SELECT id FROM polizas WHERE numero_poliza='67.743.063');
SET @poliza_motos    = (SELECT id FROM polizas WHERE numero_poliza='45.597.407');

-- =================================================================
-- SEED — Email config por póliza × tipo
-- =================================================================

-- MAPFRE - Alta
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_mapfre, 'alta',
    JSON_ARRAY('TODO_email_carlos_mapfre@mapfre.com.ar'),
    JSON_ARRAY(),
    'Carlos',
    'Solicitud de Alta - Póliza {numero_poliza}',
    'Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nEn este número de póliza se encuentran las cláusulas correspondientes a OCASA, por lo que solicitamos incluirlas, por favor.\n\nALTAS\n\n{asegurados_block}',
    'Apellido y Nombre: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n',
    JSON_ARRAY()
);

-- MAPFRE - Baja
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_mapfre, 'baja',
    JSON_ARRAY('TODO_email_carlos_mapfre@mapfre.com.ar'),
    JSON_ARRAY(),
    'Carlos',
    'Solicitud de Baja - Póliza {numero_poliza}',
    'Buenas {contacto_nombre}\n\nMe comunico para solicitar la baja de los siguientes distribuidores de la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nBAJAS\n\n{asegurados_block}',
    'Apellido y Nombre: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n',
    JSON_ARRAY()
);

-- San Cristóbal - Alta
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_sc, 'alta',
    JSON_ARRAY('TODO_altas@sancristobal.com.ar'),
    JSON_ARRAY(),
    NULL,
    'Altas - Póliza {numero_poliza}',
    'Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma Altas\n\n{asegurados_block}',
    '{nombre_apellido} CUIL: {cuil_sin_guiones} FECHA DE NACIMIENTO: {fecha_nac}',
    JSON_ARRAY()
);

-- San Cristóbal - Baja
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_sc, 'baja',
    JSON_ARRAY('TODO_bajas@sancristobal.com.ar'),
    JSON_ARRAY(),
    NULL,
    'Bajas - Póliza {numero_poliza}',
    'Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma BAJAS\n\n{asegurados_block}',
    '{nombre_apellido} CUIL: {cuil_sin_guiones} FECHA DE NACIMIENTO: {fecha_nac}',
    JSON_ARRAY()
);

-- La Segunda Autos - Alta
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_autos, 'alta',
    JSON_ARRAY('TODO_ramon.morel@lasegunda.com.ar'),
    JSON_ARRAY(
      'TODO_comercial.corrientes@lasegunda.com.ar',
      'TODO_admin1@logisticaargentina.com.ar',
      'TODO_admin2@logisticaargentina.com.ar'
    ),
    'Ramón',
    'NUEVA ALTA - {patente}',
    'Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.\n\nSolicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.\n\nEstoy atenta a cualquier novedad.\n\nSaludos!',
    '{patente}',
    JSON_ARRAY('foto_frente','foto_lateral_der','foto_lateral_izq','foto_trasera','cedula_frente')
);

-- La Segunda Autos - Baja
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_autos, 'baja',
    JSON_ARRAY('TODO_comercial.corrientes@lasegunda.com.ar'),
    JSON_ARRAY('TODO_ramon.morel@lasegunda.com.ar', 'TODO_admin@logisticaargentina.com.ar'),
    'Ramón',
    'BAJA',
    'Buenos días {contacto_nombre}\n\nSolicito bajas de las siguientes unidades que se encuentran dentro de la flota de Logística Argentina.\n\n{asegurados_block}\n\nAguardo confirmación\n\nSaludos',
    '{patente}',
    JSON_ARRAY()
);

-- La Segunda Motos - Alta (mismo template que Autos)
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_motos, 'alta',
    JSON_ARRAY('TODO_ramon.morel@lasegunda.com.ar'),
    JSON_ARRAY(
      'TODO_comercial.corrientes@lasegunda.com.ar',
      'TODO_admin1@logisticaargentina.com.ar'
    ),
    'Ramón',
    'NUEVA ALTA MOTO - {patente}',
    'Buenas {contacto_nombre}, solicito el alta de esta moto dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.\n\nSolicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.\n\nEstoy atenta a cualquier novedad.\n\nSaludos!',
    '{patente}',
    JSON_ARRAY('foto_frente','foto_lateral_der','foto_lateral_izq','foto_trasera','cedula_frente')
);

-- La Segunda Motos - Baja
INSERT INTO polizas_email_config (
    poliza_id, tipo, destinatarios_to, destinatarios_cc, contacto_nombre,
    asunto_template, body_template, asegurado_template, adjuntos_requeridos
)
VALUES (
    @poliza_motos, 'baja',
    JSON_ARRAY('TODO_comercial.corrientes@lasegunda.com.ar'),
    JSON_ARRAY('TODO_ramon.morel@lasegunda.com.ar'),
    'Ramón',
    'BAJA MOTO',
    'Buenos días {contacto_nombre}\n\nSolicito bajas de las siguientes unidades (motos) que se encuentran dentro de la flota de Logística Argentina.\n\n{asegurados_block}\n\nAguardo confirmación\n\nSaludos',
    '{patente}',
    JSON_ARRAY()
);

COMMIT;

-- =================================================================
-- VERIFICACIÓN
-- =================================================================
SELECT 'Aseguradoras' as tipo, COUNT(*) as total FROM polizas_aseguradoras
UNION ALL
SELECT 'Pólizas', COUNT(*) FROM polizas
UNION ALL
SELECT 'Email configs', COUNT(*) FROM polizas_email_config;

-- Esperado:
--   Aseguradoras: 3
--   Pólizas: 4
--   Email configs: 8 (4 pólizas × 2 tipos)
