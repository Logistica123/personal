-- ============================================================
-- OCASA - Tarifas Contrato Cliente (BUG B)
-- Popular liq_tarifas_contrato_cliente
-- Fuente: Actualizador de Tarifas 26.xlsx / hoja OCASA_Mar26
-- ============================================================

-- Limpiar tarifas contrato OCASA existentes (opcional, solo si querés rehacer)
-- DELETE FROM liq_tarifas_contrato_cliente
--  WHERE cliente_id = (SELECT id FROM liq_clientes WHERE codigo_corto='OCASA');

SET @ocasa_id := (SELECT id FROM liq_clientes WHERE codigo_corto = 'OCASA' OR nombre_corto = 'OCASA' OR razon_social LIKE '%OCASA%' ORDER BY id LIMIT 1);

INSERT INTO liq_tarifas_contrato_cliente
  (cliente_id, sucursal, capacidad_vehiculo, concepto, importe_contrato, vigencia_desde)
VALUES
  (@ocasa_id, 'AZUL', 700, 'hasta_120', 77206.47, '2026-03-01'),
  (@ocasa_id, 'AZUL', 700, '121_240', 115809.7, '2026-03-01'),
  (@ocasa_id, 'AZUL', 700, 'mas_240', 154412.94, '2026-03-01'),
  (@ocasa_id, 'AZUL', 700, 'valor_km_240', 279.75, '2026-03-01'),
  (@ocasa_id, 'AZUL', 700, '2da_3ra_vuelta', 38603.23, '2026-03-01'),
  (@ocasa_id, 'BAHIA BLANCA', 700, 'hasta_120', 77206.47, '2026-03-01'),
  (@ocasa_id, 'BAHIA BLANCA', 700, '121_240', 115809.7, '2026-03-01'),
  (@ocasa_id, 'BAHIA BLANCA', 700, 'mas_240', 154412.94, '2026-03-01'),
  (@ocasa_id, 'BAHIA BLANCA', 700, 'valor_km_240', 311.98, '2026-03-01'),
  (@ocasa_id, 'BAHIA BLANCA', 700, '2da_3ra_vuelta', 38603.23, '2026-03-01'),
  (@ocasa_id, 'SOLDATI', 700, 'hasta_120', 85200.45, '2026-03-01'),
  (@ocasa_id, 'SOLDATI', 700, '121_240', 127800.67, '2026-03-01'),
  (@ocasa_id, 'SOLDATI', 700, 'mas_240', 170400.89, '2026-03-01'),
  (@ocasa_id, 'SOLDATI', 700, '2da_3ra_vuelta', 42600.21, '2026-03-01'),
  (@ocasa_id, 'SANTA ROSA', 700, 'hasta_120', 77206.47, '2026-03-01'),
  (@ocasa_id, 'SANTA ROSA', 700, '121_240', 115809.7, '2026-03-01'),
  (@ocasa_id, 'SANTA ROSA', 700, 'mas_240', 154412.94, '2026-03-01'),
  (@ocasa_id, 'SANTA ROSA', 700, 'valor_km_240', 267.9, '2026-03-01'),
  (@ocasa_id, 'SANTA ROSA', 700, '2da_3ra_vuelta', 38603.23, '2026-03-01'),
  (@ocasa_id, 'CORDOBA', 700, 'hasta_120', 77206.5, '2026-03-01'),
  (@ocasa_id, 'CORDOBA', 700, '121_240', 115809.71, '2026-03-01'),
  (@ocasa_id, 'CORDOBA', 700, 'mas_240', 154412.95, '2026-03-01'),
  (@ocasa_id, 'CORDOBA', 700, '2da_3ra_vuelta', 38603, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, 'hasta_120', 77206.5, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, '121_240', 115809.71, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, 'mas_240', 154412.95, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, '2da_3ra_vuelta', 38603, '2026-03-01'),
  (@ocasa_id, 'FORMOSA', 700, 'hasta_120', 83855.67, '2026-03-01'),
  (@ocasa_id, 'FORMOSA', 700, '121_240', 125783.54, '2026-03-01'),
  (@ocasa_id, 'FORMOSA', 700, 'mas_240', 167711.38, '2026-03-01'),
  (@ocasa_id, 'FORMOSA', 700, 'valor_km_240', 263.83, '2026-03-01'),
  (@ocasa_id, 'FORMOSA', 700, '2da_3ra_vuelta', 41927.85, '2026-03-01'),
  (@ocasa_id, 'PARANA', 700, 'hasta_120', 83855.67, '2026-03-01'),
  (@ocasa_id, 'PARANA', 700, '121_240', 125783.54, '2026-03-01'),
  (@ocasa_id, 'PARANA', 700, 'mas_240', 167711.38, '2026-03-01'),
  (@ocasa_id, 'PARANA', 700, 'valor_km_240', 265.09, '2026-03-01'),
  (@ocasa_id, 'PARANA', 700, '2da_3ra_vuelta', 41927.85, '2026-03-01'),
  (@ocasa_id, 'PARANA', 100, 'motos', 58570.3, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 700, 'hasta_120', 83855.67, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 700, '121_240', 125783.54, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 700, 'mas_240', 167711.38, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 700, 'valor_km_240', 286.39, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 700, '2da_3ra_vuelta', 41927.85, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 100, 'motos', 58570.33, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 700, 'hasta_120', 83855.67, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 700, '121_240', 125783.54, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 700, 'mas_240', 167711.38, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 700, 'valor_km_240', 262.86, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 700, '2da_3ra_vuelta', 41927.85, '2026-03-01'),
  (@ocasa_id, 'SANTA FE', 700, 'hasta_120', 83855.67, '2026-03-01'),
  (@ocasa_id, 'SANTA FE', 700, '121_240', 125783.54, '2026-03-01'),
  (@ocasa_id, 'SANTA FE', 700, 'mas_240', 167711.38, '2026-03-01'),
  (@ocasa_id, 'SANTA FE', 700, '2da_3ra_vuelta', 41927.85, '2026-03-01'),
  (@ocasa_id, 'LUQ MDZ', 700, 'hasta_120', 67878.68, '2026-03-01'),
  (@ocasa_id, 'LUQ MDZ', 700, '121_240', 101818.01, '2026-03-01'),
  (@ocasa_id, 'LUQ MDZ', 700, 'mas_240', 135757.34, '2026-03-01'),
  (@ocasa_id, 'LUQ MDZ', 700, 'valor_km_240', 33939.33, '2026-03-01'),
  (@ocasa_id, 'CBN', 700, 'hasta_120', 89460.47, '2026-03-01'),
  (@ocasa_id, 'CBN', 700, '121_240', 134190.7, '2026-03-01'),
  (@ocasa_id, 'CBN', 700, 'mas_240', 178920.92, '2026-03-01'),
  (@ocasa_id, 'CBN', 700, '2da_3ra_vuelta', 44730.22, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, 'hasta_120', 77206.5, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, '121_240', 115809.71, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, 'mas_240', 154412.95, '2026-03-01'),
  (@ocasa_id, 'RIO CUARTO', 700, '2da_3ra_vuelta', 38603, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 1500, 'jornada_1500', 91051.75, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 1500, 'km_1500', 365.96, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 2500, 'jornada_2500', 106432.07, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 2500, 'km_2500', 409.98, '2026-03-01'),
  (@ocasa_id, 'SARANDI SOLDATI', 700, 'hasta_120', 153744.5, '2026-03-01'),
  (@ocasa_id, 'SARANDI SOLDATI', 700, '121_240', 184493.38, '2026-03-01'),
  (@ocasa_id, 'SARANDI SOLDATI', 700, '2da_vuelta_120', 76872.24, '2026-03-01'),
  (@ocasa_id, 'SARANDI SOLDATI', 700, '3ra_vuelta_120', 92246.69, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 1500, 'jornada_1500', 159321.38, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 1500, 'km_1500', 312.76, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 2500, 'jornada_2500', 159321.38, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 2500, 'km_2500', 312.76, '2026-03-01'),
  (@ocasa_id, 'TORTUGUITAS', 700, 'hasta_120', 161431.72, '2026-03-01'),
  (@ocasa_id, 'TORTUGUITAS', 700, '121_240', 193718.05, '2026-03-01'),
  (@ocasa_id, 'TORTUGUITAS', 700, '2da_vuelta_120', 80715.85, '2026-03-01'),
  (@ocasa_id, 'TORTUGUITAS', 700, '3ra_vuelta_120', 96859.02, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 5000, 'jornada_5000', 134364, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 5000, 'km_5000', 645.7, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 7500, 'jornada_7500', 212579.64, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 7500, 'km_7500', 785.55, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 10000, 'jornada_10000', 212579.64, '2026-03-01'),
  (@ocasa_id, 'RESISTENCIA', 10000, 'km_10000', 785.55, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 5000, 'jornada_5000', 212579.64, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 5000, 'km_5000', 785.55, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 7500, 'jornada_7500', 212579.64, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 7500, 'km_7500', 785.55, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 10000, 'jornada_10000', 212579.64, '2026-03-01'),
  (@ocasa_id, 'POSADAS', 10000, 'km_10000', 785.55, '2026-03-01')
ON DUPLICATE KEY UPDATE importe_contrato = VALUES(importe_contrato), vigencia_hasta = VALUES(vigencia_hasta);

-- Verificación
SELECT COUNT(*) AS total_tarifas_contrato
  FROM liq_tarifas_contrato_cliente
  WHERE cliente_id = @ocasa_id;
-- Esperado: 93 filas

-- Sucursales cargadas:
SELECT sucursal, COUNT(*) AS conceptos
  FROM liq_tarifas_contrato_cliente
  WHERE cliente_id = @ocasa_id
  GROUP BY sucursal
  ORDER BY sucursal;