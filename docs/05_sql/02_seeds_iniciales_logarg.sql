INSERT INTO arca_emisor (razon_social, cuit, condicion_iva, ambiente_default)
VALUES ('LOGISTICA ARGENTINA S.R.L.', 30717060985, 'IVA Responsable Inscripto', 'PROD')
ON CONFLICT (cuit) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  condicion_iva = EXCLUDED.condicion_iva,
  ambiente_default = EXCLUDED.ambiente_default,
  updated_at = NOW();

INSERT INTO arca_punto_venta (emisor_id, ambiente, nro, sistema_arca, emision_tipo, bloqueado, habilitado_para_erp)
SELECT id, 'PROD', 11, 'RECE para aplicativo y web services', 'RECE', FALSE, TRUE
FROM arca_emisor
WHERE cuit = 30717060985
ON CONFLICT (emisor_id, ambiente, nro) DO UPDATE SET
  sistema_arca = EXCLUDED.sistema_arca,
  emision_tipo = EXCLUDED.emision_tipo,
  bloqueado = EXCLUDED.bloqueado,
  habilitado_para_erp = EXCLUDED.habilitado_para_erp,
  updated_at = NOW();
