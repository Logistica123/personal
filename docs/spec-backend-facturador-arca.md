SPEC BACKEND - FACTURADOR ARCA + CLIENTES DE FACTURACION

1. Arquitectura recomendada
Separar en modulos:
- arca_config
- wsaa_auth
- wsfe_service
- facturacion
- clientes_facturacion
- cobranzas
- auditoria

2. Entidades principales
2.1 arca_emisor
- id
- razon_social
- cuit
- condicion_iva
- ambiente_default
- activo
- created_at
- updated_at

2.2 arca_certificado
- id
- emisor_id
- alias
- ambiente
- subject_dn
- serial_number_subject
- thumbprint_sha1
- thumbprint_sha256
- certificado_pem_path
- private_key_path_encrypted
- p12_path_encrypted
- password_ref
- valid_from
- valid_to
- activo
- ultimo_login_wsaa_ok_at
- created_at
- updated_at

2.3 arca_ta_cache
- id
- certificado_id
- ambiente
- service_name
- token
- sign
- generation_time
- expiration_time
- created_at
- updated_at
- unique(certificado_id, ambiente, service_name)

2.4 arca_punto_venta
- id
- emisor_id
- ambiente
- nro
- sistema_arca
- emision_tipo
- bloqueado
- fch_baja
- habilitado_para_erp
- default_para_cbte_tipo
- created_at
- updated_at

2.5 factura_cabecera
- id
- emisor_id
- certificado_id
- ambiente
- pto_vta
- cbte_tipo
- cbte_numero
- concepto
- doc_tipo
- doc_nro
- cliente_id
- sucursal_id
- cliente_nombre
- cliente_domicilio
- fecha_cbte
- fecha_serv_desde
- fecha_serv_hasta
- fecha_vto_pago
- moneda_id
- moneda_cotiz
- imp_total
- imp_tot_conc
- imp_neto
- imp_op_ex
- imp_iva
- imp_trib
- resultado_arca
- reproceso
- cae
- cae_vto
- observaciones_arca_json
- errores_arca_json
- request_xml_path
- response_xml_path
- pdf_path
- estado
- hash_idempotencia
- mes_facturado
- periodo_facturado
- anio_facturado
- fecha_aprox_cobro
- fecha_pago_manual
- estado_cobranza
- observaciones_cobranza
- created_at
- updated_at

2.6 factura_iva
- id
- factura_id
- iva_id
- base_imp
- importe

2.7 factura_tributo
- id
- factura_id
- tributo_id
- descr
- base_imp
- alic
- importe

2.8 factura_detalle_pdf
- id
- factura_id
- orden
- descripcion
- cantidad
- unidad_medida
- precio_unitario
- bonificacion_pct
- subtotal
- alicuota_iva_pct
- subtotal_con_iva

2.9 historial_cobranza_factura
- id
- factura_id
- fecha_evento
- estado_anterior
- estado_nuevo
- fecha_aprox_cobro_anterior
- fecha_aprox_cobro_nueva
- fecha_pago_anterior
- fecha_pago_nueva
- observaciones
- usuario_id
- created_at

2.10 auditoria_facturacion
- id
- entidad
- entidad_id
- evento
- payload_before_json
- payload_after_json
- usuario_id
- ip
- created_at

3. Estados
3.1 factura.estado
- BORRADOR
- VALIDADA_LOCAL
- LISTA_PARA_ENVIO
- ENVIANDO_ARCA
- AUTORIZADA
- RECHAZADA_ARCA
- ERROR_TECNICO
- PDF_GENERADO

3.2 factura.estado_cobranza
- PENDIENTE
- A_VENCER
- VENCIDA
- COBRADA
- PARCIAL

4. Reglas de negocio
4.1 Guardado de borrador
No permitir guardar si falta alguno de:
- emisor_id
- ambiente
- pto_vta
- cbte_tipo
- concepto
- doc_tipo
- doc_nro
- cliente_id
- sucursal_id
- mes_facturado
- periodo_facturado
- anio_facturado
- moneda_id
- moneda_cotiz
- importes totales

4.2 Reglas por concepto
- concepto=1 productos: no exigir fechas de servicio
- concepto=2 servicios: exigir fecha_serv_desde, fecha_serv_hasta, fecha_vto_pago
- concepto=3 productos_y_servicios: exigir fecha_serv_desde, fecha_serv_hasta, fecha_vto_pago

4.3 Reglas de importes
imp_total debe ser igual a:
imp_tot_conc + imp_neto + imp_op_ex + imp_iva + imp_trib

Sumatoria de factura_iva.importe debe coincidir con imp_iva.

4.4 Numeracion
Antes de emitir siempre consultar FECompUltimoAutorizado y calcular proximo = ultimo + 1.
Nunca confiar en contador local sin contraste con ARCA.

4.5 Concurrencia
Usar lock pesimista o mutex distribuido por clave:
(emisor_id, ambiente, pto_vta, cbte_tipo)

4.6 Idempotencia
Generar hash con estos campos canonicos:
- emisor_id
- ambiente
- pto_vta
- cbte_tipo
- doc_tipo
- doc_nro
- fecha_cbte
- imp_total
- imp_neto
- imp_iva
- cliente_id
- sucursal_id
- anio_facturado
- mes_facturado
- periodo_facturado

Si ya existe hash_idempotencia autorizado, no reenviar.

4.7 Estado de cobranza
- fecha_pago_manual != null => COBRADA
- fecha_pago_manual = null y fecha_aprox_cobro = null => PENDIENTE
- fecha_pago_manual = null y fecha_aprox_cobro > current_date => A_VENCER
- fecha_pago_manual = null y fecha_aprox_cobro <= current_date => VENCIDA

5. Flujos backend
5.1 Test de WSAA
Entrada:
- emisor_id
- certificado_id
- ambiente

Proceso:
- cargar CRT/KEY o P12
- generar TRA service=wsfe
- firmar CMS
- llamar loginCms
- parsear token y sign
- guardar TA en cache
- registrar ultimo_login_wsaa_ok_at

Salida:
- ok
- generation_time
- expiration_time
- service=wsfe

5.2 Sincronizacion de puntos de venta
Entrada:
- emisor_id
- ambiente

Proceso:
- obtener TA
- invocar FEParamGetPtosVenta
- upsert de arca_punto_venta
- marcar si existe 00011

Salida:
- lista de puntos
- punto 00011 encontrado o no

5.3 Emision completa
Proceso:
1. validar borrador local
2. obtener TA valido o renovarlo
3. consultar puntos de venta si no hay sync reciente
4. validar pto_vta habilitado
5. consultar FECompUltimoAutorizado
6. bloquear concurrencia
7. armar request FECAESolicitar
8. persistir estado ENVIANDO_ARCA
9. enviar SOAP
10. guardar XML request/response
11. si resultado A: guardar numero, CAE, CAE_vto, estado AUTORIZADA
12. generar PDF y actualizar pdf_path + estado PDF_GENERADO
13. si resultado R: guardar errores/obs y estado RECHAZADA_ARCA
14. si timeout / error tecnico: estado ERROR_TECNICO

6. Servicios internos sugeridos
6.1 CertificateService
- importCertificate()
- importP12()
- parseCertificateMetadata()
- validateCertificateForCuit()
- isCertificateExpired()

6.2 WsaaService
- buildTraXml(serviceName)
- signCms(traXml)
- loginCms(cmsBase64)
- getOrRefreshTa(certificadoId, ambiente, serviceName)

6.3 WsfeService
- getPuntosVenta(auth)
- getUltimoAutorizado(auth, ptoVta, cbteTipo)
- solicitarCae(auth, payload)
- consultarComprobante(auth, ptoVta, cbteTipo, cbteNumero)

6.4 FacturaService
- createDraft()
- updateDraft()
- validateDraft()
- emitFactura()
- regeneratePdf()
- attachClienteMetadata()
- patchCobranza()

6.5 PdfFacturaService
- renderFacturaPdf()
- renderBarcodeIfNeeded()
- storePdf()

7. Seguridad
- cifrar rutas o blobs de private key / p12
- no exponer archivos por URL publica directa
- no mostrar token/sign en UI
- no loguear private key ni password de p12
- registrar auditoria de importacion, reemplazo y prueba de certificado

8. Logs y auditoria
Registrar en auditoria_facturacion eventos:
- CERTIFICADO_IMPORTADO
- CERTIFICADO_TEST_OK
- CERTIFICADO_TEST_ERROR
- PUNTOS_VENTA_SYNC
- FACTURA_BORRADOR_CREADA
- FACTURA_BORRADOR_EDITADA
- FACTURA_VALIDADA_LOCAL
- FACTURA_EMISION_INICIADA
- FACTURA_AUTORIZADA
- FACTURA_RECHAZADA_ARCA
- FACTURA_ERROR_TECNICO
- FACTURA_PDF_GENERADO
- FACTURA_COBRANZA_EDITADA

9. Verificacion post-emision
Opcionalmente exponer endpoint de reconsulta:
- FECompConsultar por pto_vta + cbte_tipo + cbte_numero
Para soporte y contraste de timeout.

10. Seeds minimos
- arca_emisor con CUIT 30717060985
- arca_punto_venta 00011 en produccion, habilitado_para_erp=true
- alias recomendado informativo

11. Criterios de aceptacion backend
- obtiene TA WSAA valido
- sincroniza puntos de venta y detecta 00011
- calcula siguiente numero por ARCA
- emite FECAESolicitar real
- guarda CAE y CAE_vto
- genera PDF
- vincula factura a cliente/sucursal/periodo
- permite cargar fecha_pago_manual sin tocar datos fiscales
