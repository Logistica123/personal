-- ============================================================
-- OCASA · Migración v7 (supersede v6)
-- Generado: 2026-04-24
--
-- Ejecutar EN TRANSACCIÓN. Idempotente (se puede correr varias veces).
--
-- Contenido:
--   0. CREATE TABLE liq_tarifas_productividad_cliente (si no existe)
--   1. UPSERT liq_material_mapeo (fix mapping SO/BO/BI para OCASA)
--   2. DELETE + INSERT liq_tarifas_productividad_cliente (98 filas
--      ROS001 Rosario + SUR001 Sarandí)
--
-- Prerequisitos:
--   - Cliente OCASA existe en liq_clientes con codigo='OCASA'.
--   - Tabla liq_material_mapeo existente (la que popula el importador v6).
--   - Confirmar con el equipo back que el UNIQUE KEY de liq_material_mapeo
--     sea (cliente_id, codigo_ycc). Si no, ajustar el ON DUPLICATE KEY.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) CREATE TABLE liq_tarifas_productividad_cliente (si falta)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS liq_tarifas_productividad_cliente (
  id                    bigint UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id            bigint UNSIGNED NOT NULL,
  ruta                  varchar(20)  NOT NULL,
  sucursal              varchar(60)  NOT NULL,
  material_la           varchar(60)  NOT NULL,  -- Paquetería/Postal/Clearing/Salud/Courier/...
  zona                  varchar(10)  NOT NULL,  -- UB1/UB2/UB3/ITU/ZN/ZO/LP
  tipo                  varchar(10)  NOT NULL,  -- 'exitoso' | 'fallido'
  precio_original       decimal(14,4) NOT NULL,
  porcentaje_agencia    decimal(5,4)  NOT NULL DEFAULT 0.15,
  precio_distribuidor   decimal(14,4) NOT NULL,
  vigencia_desde        date          NOT NULL,
  vigencia_hasta        date          NULL,
  notas                 varchar(255)  NULL,
  created_at            timestamp     NULL DEFAULT current_timestamp,
  updated_at            timestamp     NULL DEFAULT current_timestamp ON UPDATE current_timestamp,
  CONSTRAINT fk_tpc_cliente FOREIGN KEY (cliente_id) REFERENCES liq_clientes(id),
  UNIQUE KEY uniq_tpc (cliente_id, ruta, material_la, zona, tipo, vigencia_desde),
  KEY idx_tpc_busqueda (cliente_id, ruta, material_la, zona, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 1) Mapping materiales (fix v6 → v7)
-- Usa liq_material_mapeo (la tabla que ya popula el importador v6).
-- ------------------------------------------------------------

SET @ocasa_id := (SELECT id FROM liq_clientes WHERE codigo_corto = 'OCASA' OR nombre_corto = 'OCASA' OR razon_social LIKE '%OCASA%' ORDER BY id LIMIT 1);

INSERT INTO liq_material_mapeo (cliente_id, codigo_ycc, material_tarifario, descripcion)
VALUES
  (@ocasa_id, 'PA', 'Paquetería', 'Paquete estándar (YCC col Gr.Material)'),
  (@ocasa_id, 'SO', 'Postal', 'Postal (solo entregados)'),
  (@ocasa_id, 'BO', 'Clearing', 'Clearing / Bolsín bancario'),
  (@ocasa_id, 'BI', 'Salud', 'Salud (muestras / medicamentos)')
ON DUPLICATE KEY UPDATE
  material_tarifario = VALUES(material_tarifario),
  descripcion        = VALUES(descripcion);

-- NOTA: si en prod la tabla se llama diferente o los nombres de columnas varían,
-- reemplazar 'liq_material_mapeo' y las columnas acá. El contenido es el mismo.

-- Equivalente Postgres:
-- INSERT ... ON CONFLICT (cliente_id, codigo_ycc) DO UPDATE SET
--   material_tarifario = EXCLUDED.material_tarifario,
--   descripcion        = EXCLUDED.descripcion;

-- ------------------------------------------------------------
-- 2) Tarifas productividad OCASA (ROS001 Rosario + SUR001 Sarandí)
--    98 filas = 48 ROS001 + 50 SUR001
-- ------------------------------------------------------------

-- Limpieza previa: borra sólo las filas OCASA en rutas productividad.
-- Si hay otras rutas productividad en la BD que queres preservar, ajustar el WHERE.
DELETE FROM liq_tarifas_productividad_cliente
 WHERE cliente_id = @ocasa_id
   AND ruta IN ('ROS001','SUR001');

INSERT INTO liq_tarifas_productividad_cliente
  (cliente_id, ruta, sucursal, material_la, zona, tipo,
   precio_original, porcentaje_agencia, precio_distribuidor, vigencia_desde, notas)
VALUES
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'UB1', 'exitoso', 2004.3800, 0.15, 1703.7230, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'UB1', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'UB2', 'exitoso', 2738.6200, 0.15, 2327.8270, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'UB2', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'UB3', 'exitoso', 3325.6200, 0.15, 2826.7770, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'UB3', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'ITU', 'exitoso', 978.1700, 0.15, 831.4445, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Paquetería', 'ITU', 'fallido', 489.0600, 0.15, 415.7010, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'UB1', 'exitoso', 1690.4500, 0.15, 1436.8825, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'UB1', 'fallido', 824.9800, 0.15, 701.2330, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'UB2', 'exitoso', 2309.7000, 0.15, 1963.2450, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'UB2', 'fallido', 824.9800, 0.15, 701.2330, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'UB3', 'exitoso', 2804.7600, 0.15, 2384.0460, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'UB3', 'fallido', 824.9800, 0.15, 701.2330, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'ITU', 'exitoso', 824.9800, 0.15, 701.2330, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Courier', 'ITU', 'fallido', 412.5100, 0.15, 350.6335, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'UB1', 'exitoso', 2055.7300, 0.15, 1747.3705, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'UB1', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'UB2', 'exitoso', 3012.4400, 0.15, 2560.5740, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'UB2', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'UB3', 'exitoso', 3658.0700, 0.15, 3109.3595, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'UB3', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'ITU', 'exitoso', 1075.8900, 0.15, 914.5065, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Postal', 'ITU', 'fallido', 489.0600, 0.15, 415.7010, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'UB1', 'exitoso', 1781.2700, 0.15, 1514.0795, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'UB1', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'UB2', 'exitoso', 2610.2300, 0.15, 2218.6955, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'UB2', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'UB3', 'exitoso', 3169.6800, 0.15, 2694.2280, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'UB3', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'ITU', 'exitoso', 932.2400, 0.15, 792.4040, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Documentación Renaper', 'ITU', 'fallido', 489.0600, 0.15, 415.7010, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'UB1', 'exitoso', 2347.4500, 0.15, 1995.3325, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'UB1', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'UB2', 'exitoso', 3286.3600, 0.15, 2793.4060, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'UB2', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'UB3', 'exitoso', 3990.6500, 0.15, 3392.0525, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'UB3', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'ITU', 'exitoso', 1173.7400, 0.15, 997.6790, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Clearing', 'ITU', 'fallido', 489.0600, 0.15, 415.7010, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'UB1', 'exitoso', 2934.2400, 0.15, 2494.1040, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'UB1', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'UB2', 'exitoso', 4107.9900, 0.15, 3491.7915, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'UB2', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'UB3', 'exitoso', 4988.3000, 0.15, 4240.0550, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'UB3', 'fallido', 978.1700, 0.15, 831.4445, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'ITU', 'exitoso', 1467.1500, 0.15, 1247.0775, '2026-03-01', 'Base OCASA_Mar26 · ROSARIO'),
  (@ocasa_id, 'ROS001', 'ROSARIO', 'Salud', 'ITU', 'fallido', 489.0600, 0.15, 415.7010, '2026-03-01', 'Visitado NE · ROSARIO'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'ZN', 'exitoso', 2357.1100, 0.15, 2003.5435, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'ZN', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'ZO', 'exitoso', 2357.1100, 0.15, 2003.5435, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'ZO', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'LP', 'exitoso', 2469.0900, 0.15, 2098.7265, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'LP', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'UB2', 'exitoso', 2469.0900, 0.15, 2098.7265, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'UB2', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'UB3', 'exitoso', 2716.1200, 0.15, 2308.7020, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Paquetería', 'UB3', 'fallido', 1358.1400, 0.15, 1154.4190, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'ZN', 'exitoso', 1772.2800, 0.15, 1506.4380, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'ZN', 'fallido', 886.1400, 0.15, 753.2190, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'ZO', 'exitoso', 1772.2800, 0.15, 1506.4380, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'ZO', 'fallido', 886.1400, 0.15, 753.2190, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'LP', 'exitoso', 1856.4600, 0.15, 1577.9910, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'LP', 'fallido', 928.2300, 0.15, 788.9955, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'UB2', 'exitoso', 1856.4600, 0.15, 1577.9910, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'UB2', 'fallido', 928.2300, 0.15, 788.9955, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'UB3', 'exitoso', 2042.2000, 0.15, 1735.8700, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Courier', 'UB3', 'fallido', 1021.0900, 0.15, 867.9265, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'ZN', 'exitoso', 2007.5300, 0.15, 1706.4005, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'ZN', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'ZO', 'exitoso', 2007.5300, 0.15, 1706.4005, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'ZO', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'LP', 'exitoso', 2103.1800, 0.15, 1787.7030, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'LP', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'UB2', 'exitoso', 2103.1800, 0.15, 1787.7030, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'UB2', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'UB3', 'exitoso', 2313.3700, 0.15, 1966.3645, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Postal', 'UB3', 'fallido', 1358.1400, 0.15, 1154.4190, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'ZN', 'exitoso', 2903.8700, 0.15, 2468.2895, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'ZN', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'ZO', 'exitoso', 2903.8700, 0.15, 2468.2895, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'ZO', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'LP', 'exitoso', 3042.4800, 0.15, 2586.1080, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'LP', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'UB2', 'exitoso', 3042.4800, 0.15, 2586.1080, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'UB2', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'UB3', 'exitoso', 3346.7700, 0.15, 2844.7545, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Clearing', 'UB3', 'fallido', 1358.1400, 0.15, 1154.4190, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'ZN', 'exitoso', 3372.0000, 0.15, 2866.2000, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'ZN', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'ZO', 'exitoso', 3372.0000, 0.15, 2866.2000, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'ZO', 'fallido', 1178.2200, 0.15, 1001.4870, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'LP', 'exitoso', 3532.6500, 0.15, 3002.7525, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'LP', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'UB2', 'exitoso', 3532.6500, 0.15, 3002.7525, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'UB2', 'fallido', 1234.6800, 0.15, 1049.4780, '2026-03-01', 'Visitado NE · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'UB3', 'exitoso', 3885.8700, 0.15, 3302.9895, '2026-03-01', 'Base OCASA_Mar26 · SARANDI'),
  (@ocasa_id, 'SUR001', 'SARANDI', 'Salud', 'UB3', 'fallido', 1358.1400, 0.15, 1154.4190, '2026-03-01', 'Visitado NE · SARANDI');

-- ------------------------------------------------------------
-- 3) Verificación
-- ------------------------------------------------------------

-- Materiales: deben ser 4 filas con mapping correcto
SELECT codigo_ycc, material_tarifario
  FROM liq_material_mapeo
 WHERE cliente_id = @ocasa_id
 ORDER BY codigo_ycc;
-- Esperado:
--   BI | Salud
--   BO | Clearing
--   PA | Paquetería
--   SO | Postal

-- Productividad: 98 filas, 2 rutas
SELECT ruta, tipo, COUNT(*) AS filas
  FROM liq_tarifas_productividad_cliente
 WHERE cliente_id = @ocasa_id
 GROUP BY ruta, tipo
 ORDER BY ruta, tipo;
-- Esperado:
--   ROS001 | exitoso | 24
--   ROS001 | fallido | 24
--   SUR001 | exitoso | 25
--   SUR001 | fallido | 25

-- Paquetería UB1 exitoso Rosario = $2.004,38 original / $1.703,72 distribuidor
SELECT precio_original, precio_distribuidor
  FROM liq_tarifas_productividad_cliente
 WHERE cliente_id = @ocasa_id AND ruta='ROS001' AND material_la='Paquetería'
   AND zona='UB1' AND tipo='exitoso';

COMMIT;

-- Total filas productividad insertadas: 98