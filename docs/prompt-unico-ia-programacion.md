PROMPT UNICO PARA IA DE PROGRAMACION

Construi dentro del ERP existente de LOGISTICA ARGENTINA S.R.L. un modulo completo de Facturacion Electronica ARCA y un modulo complementario de Clientes de Facturacion / seguimiento de cobranza.

Contexto fijo del proyecto
- Empresa emisora: LOGISTICA ARGENTINA S.R.L.
- CUIT emisor: 30717060985
- Punto de venta ERP: 00011
- Sistema ARCA del punto de venta: RECE para aplicativo y web services
- Alias de certificado recomendado: logarg-erp-wsfe-pv00011
- Ambiente objetivo: PRODUCCION
- Web service de negocio: wsfev1
- Service WSAA a solicitar en el TRA: wsfe

Objetivo funcional
El modulo debe permitir:
1. generar borradores de factura
2. vincular cada factura a un cliente existente del ERP
3. vincular la factura a una sucursal del cliente
4. guardar metadatos comerciales: mes, periodo, ano, fecha aproximada de cobro
5. emitir la factura real en ARCA por WSAA + WSFEv1
6. obtener CAE y fecha de vencimiento de CAE
7. generar PDF descargable con estilo integrado al ERP
8. guardar request y response SOAP para auditoria
9. mostrar las facturas agrupadas por cliente/sucursal/periodo
10. registrar luego la fecha real de pago para seguimiento de cobranza
11. alertar facturas vencidas o impagas

Restricciones clave
- No inventar la emision del certificado. Debe implementarse el flujo real: private key + CSR -> upload del CSR en ARCA -> descarga del CRT -> asociacion al WSN.
- El modulo debe ser interno al ERP existente; no una aplicacion aparte.
- El layout debe respetar el estilo del ERP: sidebar izquierda, cabecera superior, barra de filtros, tarjetas KPI y tabla principal con acciones por fila.
- La emision fiscal autorizada no puede editarse luego. Solo se permiten cambios no fiscales y cobranza.
- El PDF lo genera el ERP, no ARCA.

Entregables tecnicos obligatorios
- migraciones SQL
- modelos / entidades
- servicios WSAA y WSFEv1
- endpoints REST completos
- validaciones de negocio
- control de concurrencia para numeracion
- idempotencia para evitar doble emision
- auditoria de eventos
- pantallas: Listado Facturas, Nueva Factura, Detalle Factura, Configuracion ARCA, Clientes de Facturacion, Detalle cliente/sucursal
- tests unitarios e integracion para emision

Flujo operativo obligatorio
Configuracion inicial
- ABM de emisor ARCA
- importacion de certificado CRT + KEY o P12
- test de WSAA
- sincronizacion de puntos de venta por FEParamGetPtosVenta
- marcar como valido el punto 00011

Emision
1. usuario crea borrador
2. usuario selecciona cliente existente, sucursal, mes, periodo y ano
3. usuario carga datos fiscales e importes
4. sistema valida localmente
5. sistema obtiene o reutiliza TA del WSAA
6. sistema consulta ultimo autorizado por pto_vta + cbte_tipo
7. sistema arma FECAESolicitar
8. sistema envia a ARCA
9. sistema persiste numero, CAE, vencimiento CAE, observaciones, XMLs
10. sistema genera PDF
11. sistema muestra factura autorizada

Cobranza
- usuario carga fecha aproximada de cobro al crear el borrador o luego
- usuario de cobranzas carga fecha_pago_manual cuando se cobra
- estado_cobranza se recalcula automaticamente

Modulo Clientes de Facturacion
Debe existir una vista consolidada por:
- cliente
- sucursal
- ano
- mes
- periodo

Y por cada grupo mostrar:
- cantidad de facturas
- neto gravado total
- no gravado total
- IVA total
- importe total final
- cantidad cobradas
- cantidad vencidas
- cantidad pendientes
- primera y ultima fecha aproximada de cobro
- ultima fecha de pago

Periodos admitidos
- PRIMERA_QUINCENA
- SEGUNDA_QUINCENA
- MES_COMPLETO

Estados minimos de factura
- BORRADOR
- VALIDADA_LOCAL
- LISTA_PARA_ENVIO
- ENVIANDO_ARCA
- AUTORIZADA
- RECHAZADA_ARCA
- ERROR_TECNICO
- PDF_GENERADO

Estados de cobranza
- PENDIENTE
- A_VENCER
- VENCIDA
- COBRADA
- PARCIAL

Reglas de negocio clave
- no guardar factura sin cliente_id
- no guardar factura sin sucursal_id
- no guardar factura sin anio/mes/periodo
- si Concepto = servicios o productos+servicios, exigir fechas de servicio y vto pago
- siempre consultar FECompUltimoAutorizado antes de emitir
- bloquear concurrencia por emisor + ambiente + punto de venta + tipo comprobante
- guardar hash de idempotencia
- si hay timeout, no reenviar a ciegas
- persistir request SOAP y response SOAP
- si fecha_pago_manual existe => COBRADA
- si no hay fecha_pago_manual y fecha_aprox_cobro es futura => A_VENCER
- si no hay fecha_pago_manual y fecha_aprox_cobro es hoy o pasada => VENCIDA
- si no hay fecha_aprox_cobro => PENDIENTE

Vistas obligatorias del front-end
- Facturacion / Listado
- Facturacion / Nueva Factura
- Facturacion / Detalle
- Facturacion / Configuracion ARCA
- Facturacion / Clientes
- Facturacion / Clientes / Detalle grupo

Archivos del pack a respetar
- 01_operativo/PASO_A_PASO_CERTIFICADO_Y_ALTA_ARCA.md
- 02_backend/SPEC_BACKEND_FACTURADOR_ARCA.md
- 03_frontend/SPEC_FRONTEND_FACTURADOR_Y_CLIENTES.md
- 04_api/openapi_facturacion_arca_logarg.yaml
- 05_sql/01_migracion_completa_facturacion_arca.sql
- 05_sql/02_seeds_iniciales_logarg.sql
- 08_qa/CASOS_DE_PRUEBA_Y_ACEPTACION.md

Resultado esperado
Un modulo listo para operar dentro del ERP actual, con emision real en ARCA, PDF descargable, historico por cliente/sucursal/periodo y seguimiento de cobranza, usando el punto de venta 00011 y certificado del alias logarg-erp-wsfe-pv00011.
