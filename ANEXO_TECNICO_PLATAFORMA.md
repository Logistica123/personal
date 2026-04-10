# ANEXO TÉCNICO - PLATAFORMA DISTRIAPP

## Arquitectura General del Sistema

La plataforma se compone de **3 sistemas principales** que se comunican entre sí:

| Sistema | Tecnología | Propósito |
|---------|-----------|-----------|
| **apppersonal** (Backend principal) | Laravel PHP + React TS | Gestión administrativa, liquidaciones, facturación, RRHH |
| **appdistriapp** (App móvil + API) | Angular/Ionic + Laravel PHP | App para conductores/repartidores en campo |
| **Frontend Web** | React TypeScript | Panel de administración web |

**URLs de producción:**
- API Personal: `https://apibasepersonal.distriapp.com.ar/api/`
- API DistriApp: `https://api.distriapp.com.ar/api/`
- Frontend: `https://personal.distriapp.com.ar` / `https://app.distriapp.com.ar`

---

## 1. AUTENTICACIÓN Y SEGURIDAD

### Flujo de Login
1. El usuario envía email + password a `POST /login`
2. El backend valida credenciales con hash SHA256
3. Si tiene **2FA (TOTP)** habilitado, se valida el código (ventana de 30 segundos ±1)
4. Se genera un **token de 80 caracteres aleatorios**, se hashea con SHA256 y se guarda en `users.remember_token`
5. Se devuelve: token, rol, permisos, estado 2FA
6. El token se envía en requests subsiguientes vía:
   - Header `Authorization: Bearer {token}`
   - Query param `?api_token={token}`
   - Header `X-Api-Token`
   - Cookie `api_token` (30 días, HttpOnly, Lax SameSite)

### Roles y Permisos
- **admin / admin2** — Acceso total
- **encargado** — Supervisor
- **operator** — Operador básico
- **asesor** — Asesor comercial
- Cada usuario tiene un array `permissions[]` con acceso granular por sección

### Middleware
1. **AddCorsHeaders** — Whitelist de orígenes permitidos
2. **ApiTokenAuth** — Extracción y validación del token
3. **throttle** — Rate limiting por ruta (ej: WebRTC 120 req/min, llamadas 20 req/min)

### Acceso Público (sin token)
- Descarga de documentos personales (verificación por email/CUIL)
- Consulta de liquidaciones (verificación por email/CUIL)
- Datos de combustible (verificación por email/CUIL)
- Notificaciones (verificación por email/CUIL)

---

## 2. MÓDULO DE PERSONAL (Proveedores/Transportistas)

### Tabla: `personas`
Campos principales: apellidos, nombres, legajo, cuil, telefono, email, pago, cbu_alias, combustible, combustible_estado, es_cobrador, cobrador_*, membresia_desde, unidad_id, cliente_id, sucursal_id, agente_id, estado_id, tipo, patente, tarifaespecial, observaciones, aprobado, fecha_alta, fecha_baja, es_solicitud

### Relaciones
- `belongsTo`: Cliente, Unidad, Sucursal, User (agente), Estado
- `hasMany`: Archivos (documentos), PersonaComment, PersonaHistory, PersonaPatente, Reclamos
- `hasOne`: Dueno (datos del dueño del vehículo), TaxProfile

### Endpoints principales
```
GET    /api/personal                          — Listar proveedores
POST   /api/personal                          — Crear proveedor
GET    /api/personal/{id}                     — Detalle
PUT    /api/personal/{id}                     — Actualizar
POST   /api/personal/{id}/aprobar             — Aprobar
POST   /api/personal/{id}/desaprobar          — Rechazar
GET    /api/personal/{id}/documentos          — Documentos del proveedor
POST   /api/personal/{id}/documentos          — Subir documento
GET    /api/personal/{id}/combustible         — Consumo de combustible
GET    /api/personal/{id}/combustible-reportes — Reportes de combustible
POST   /api/personal/{id}/comentarios         — Agregar comentario
GET    /api/personal/{id}/legajo-impositivo   — Perfil impositivo
POST   /api/personal/{id}/contact-reveal      — Revelar contacto
GET    /api/personal-meta                     — Metadata para filtros
GET    /api/personal/resumen-mensual          — Resumen mensual
```

### Workflow de Aprobación
1. Se crea con `es_solicitud=true`
2. Un admin/encargado revisa los datos
3. Se aprueba (`POST /aprobar`) o rechaza (`POST /desaprobar`)
4. Se registra quién aprobó y cuándo

### Historial de Cambios
- Cada cambio en una Persona genera un `PersonaHistory` con:
  - Campo modificado
  - Valor anterior y nuevo
  - Usuario que hizo el cambio
  - Timestamp

---

## 3. MÓDULO DE DOCUMENTOS

### Tabla: `archivos`
Campos: persona_id, tipo_archivo_id, carpeta, ruta, disk, nombre_original, mime, size, fecha_vencimiento, importe_facturar, enviada, recibido, pagado, liquidacion_destinatario_tipo, liquidacion_destinatario_emails

### Tipos de Documento (tabla `fyle_types`)
- DNI/Identificación
- Registro del vehículo
- Pólizas de seguro
- Contratos
- Facturas
- Liquidaciones
- Certificados médicos
- CV, recibos de sueldo, etc.
- Cada tipo define si `vence` (tiene fecha de vencimiento)

### Endpoints
```
GET    /api/personal/documentos/tipos                    — Tipos disponibles
POST   /api/personal/{id}/documentos                     — Subir
DELETE /api/personal/{id}/documentos/{docId}              — Eliminar
GET    /api/personal/{id}/documentos/{docId}/descargar    — Descargar
GET    /api/personal/{id}/documentos/descargar-todos      — ZIP de todos
POST   /api/personal/{id}/documentos/publicar             — Publicar
POST   /api/personal/{id}/documentos/pagado               — Marcar pagado
POST   /api/personal/{id}/documentos/recibido             — Marcar recibido
```

---

## 4. MÓDULO DE LIQUIDACIONES (Sistema v2)

### Arquitectura del Sistema de Tarifas

**Esquemas Tarifarios** (`liq_esquemas_tarifarios`):
- Cada cliente tiene esquemas con **dimensiones** configurables (ej: zona, tipo_servicio, tipo_vehículo)
- Las dimensiones tienen valores posibles (ej: CENTRO, ZONA_NORTE, MOTO, CAMIÓN)

**Líneas de Tarifa** (`liq_lineas_tarifa`):
- Combinación de valores de dimensiones → precio
- `precio_original` — Precio del cliente
- `porcentaje_agencia` — Descuento de agencia %
- `precio_distribuidor` = precio_original × (1 - porcentaje_agencia/100)
- Vigencia temporal (desde/hasta)
- Requieren aprobación

**Tarifas por Patente** (`liq_tarifas_patente`):
- Override de tarifa específico para una patente/vehículo

### Flujo de Liquidación Completa

```
1. CARGA DE DATOS
   POST /api/liq/liquidaciones/upload
   → Se sube Excel del cliente con operaciones del período
   → Se crea LiqLiquidacionCliente + LiqArchivoEntrada

2. PROCESAMIENTO
   POST /api/liq/liquidaciones/{id}/generar
   → Cada fila del Excel se convierte en LiqOperacion
   → Se mapean conceptos (LiqMapeoConcepto) y sucursales (LiqMapeoSucursal)
   → Se busca la tarifa correspondiente por dimensiones
   → Se calcula diferencia entre valor_cliente y valor_tarifa
   → Estados posibles: ok, diferencia, sin_tarifa, sin_distribuidor, duplicado

3. ASIGNACIÓN DE DISTRIBUIDORES
   → Se vincula cada operación a un distribuidor (Persona) por dominio/patente
   → Se generan LiqLiquidacionDistribuidor por cada distribuidor

4. AUDITORÍA Y APROBACIÓN
   GET  /api/liq/liquidaciones/{id}/auditoria
   PATCH /api/liq/liquidaciones/{id}/estado → aprobada/rechazada

5. GENERACIÓN DE DOCUMENTOS
   POST /api/liq/liquidaciones-distribuidor/{id}/documento → PDF de liquidación

6. PAGO
   → Estado cambia a 'pagada'
   → Se registra en sistema de pagos
```

### Configuración de Gastos (`liq_configuracion_gastos`)
- Gastos adicionales por cliente (administrativos, logística)
- Tipo FIJO o VARIABLE
- Se aplican sobre el total de la liquidación

### Integración OCA
```
POST /api/liq/oca/upload            — Subir PDF de OCA
GET  /api/liq/oca/{id}/vinculaciones — Ver matches
GET  /api/liq/oca/{id}/resumen       — Resumen de vinculación
```
- Microservicio Python en `localhost:8100` para OCR/parsing de PDFs de OCA
- Match por `match_score` (confianza del matching)

### Mapeos
- **Mapeo de Conceptos**: Valor del Excel del cliente → dimensión de tarifa
- **Mapeo de Sucursales**: Nombre de sucursal del cliente → sucursal interna

### Recibos
```
GET  /api/liquidaciones/recibos              — Listar recibos
POST /api/liquidaciones/recibos              — Crear recibo
POST /api/liquidaciones/recibos/{id}/anular  — Anular recibo
```

---

## 5. MÓDULO DE FACTURACIÓN ELECTRÓNICA (ARCA/AFIP)

### Tabla: `factura_cabecera`
Campos principales: emisor_id, certificado_id, ambiente (TEST/PROD), pto_vta, cbte_tipo, cbte_numero, concepto, doc_tipo, doc_nro, cliente_id, fechas (cbte, servicio desde/hasta, vto pago), importes (total, neto, iva, tributos), CAE, estado, cobranza

### Estados de Factura
```
BORRADOR → VALIDANDO → ENVIANDO_ARCA → AUTORIZADA → PDF_GENERADO → COBRADA
                                      ↘ RECHAZADA
                                                                    ↘ ANULADA
```

### Estados de Cobranza
```
PENDIENTE → PARCIALMENTE_PAGADA → PAGADA
          ↘ VENCIDA
```

### Integración ARCA (AFIP)

**WSAA (Autenticación)**:
- Prod: `https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL`
- Homo: `https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL`
- Firma CMS con certificado digital
- Cache de tokens con expiración

**WSFE (Factura Electrónica)**:
- Prod: `https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL`
- Homo: `https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL`
- Resolución de número de comprobante
- Mecanismo de lock para emisión

### Gestión de Certificados
```
POST /api/arca/emisores/{id}/certificados/importar        — Importar certificado
POST /api/arca/emisores/{id}/certificados/import-crt-key  — Importar CRT+KEY
POST /api/arca/emisores/{id}/certificados/import-p12      — Importar P12
POST /api/arca/certificados/generar-csr                   — Generar CSR
POST /api/arca/certificados/{id}/test-wsaa                — Probar conexión
POST /api/arca/emisores/{id}/puntos-venta/sincronizar     — Sync puntos de venta
```

### Endpoints de Facturación
```
POST /api/facturas                    — Crear factura (borrador)
POST /api/facturas/{id}/validar       — Validar datos
POST /api/facturas/{id}/emitir        — Emitir a ARCA (obtener CAE)
GET  /api/facturas/{id}/pdf           — Descargar PDF
PATCH /api/facturas/{id}/cobranza     — Actualizar estado de cobranza
POST /api/facturas/{id}/registrar-pago — Registrar pago
GET  /api/facturas/{id}/historial-cobranza — Historial
```

### Facturación por Cliente
```
GET /api/clientes-facturacion/resumen        — Resumen de facturación
GET /api/clientes-facturacion/detalle        — Detalle
GET /api/clientes-facturacion/estado-cuenta  — Estado de cuenta
```

---

## 6. MÓDULO DE COMBUSTIBLE

### Tabla: `fuel_movements`
Campos: occurred_at, station, domain_raw, domain_norm, product, invoice_number, conductor, liters, amount, price_per_liter, status, source_file, provider, format, distributor_id, fuel_report_id, discounted, late_charge, manual_adjustment_*

### Estados de Movimiento
- **IMPORTED** — Recién importado del Excel/CSV
- **MATCHED** — Vinculado a un distribuidor
- **DISCOUNTED** — Descontado en liquidación
- **EXCLUDED** — Excluido/invalidado

### Flujo Completo de Combustible

```
1. IMPORTACIÓN
   POST /api/combustible/extractos/preview  — Preview del archivo
   POST /api/combustible/extractos/process  — Procesar e importar movimientos

2. VINCULACIÓN A DISTRIBUIDORES
   → Se matchea domain_norm (patente normalizada) con DistributorDomain
   POST /api/combustible/pendientes/vincular       — Vincular uno
   POST /api/combustible/pendientes/vincular-masivo — Vincular masivamente
   POST /api/combustible/pendientes/invalidar       — Invalidar
   POST /api/combustible/pendientes/invalidar-masivo — Invalidar masivamente

3. REPORTES POR DISTRIBUIDOR
   POST /api/combustible/reportes/draft    — Crear borrador de reporte
   GET  /api/combustible/reportes/{id}     — Ver reporte
   POST /api/combustible/reportes/{id}/ajustes  — Agregar ajustes (DISCOUNT, SURCHARGE, CORRECTION)
   POST /api/combustible/reportes/{id}/guardar  — Guardar
   POST /api/combustible/reportes/{id}/listo    — Marcar como listo

4. APLICACIÓN
   POST /api/combustible/reportes/{id}/aplicar  — Aplicar descuento en liquidación

5. CIERRE
   POST /api/combustible/cierre  — Cierre de período
   GET  /api/combustible/reportes-globales — Reportes globales
```

### Ajustes de Combustible (`fuel_adjustments`)
- Tipos: DISCOUNT, SURCHARGE, CORRECTION
- Cada ajuste tiene monto, nota y usuario que lo creó

### Cargos Tardíos
```
GET  /api/combustible/tardias                    — Listar movimientos tardíos
POST /api/combustible/tardias/{id}/requiere-ajuste — Marcar para ajuste manual
```

---

## 7. MÓDULO DE RECLAMOS

### Tabla: `reclamos`
Campos: creator_id, persona_id, agente_id, reclamo_type_id, detalle, cliente_nombre, sucursal_nombre, distribuidor_nombre, emisor_factura, importe_solicitado, cuit_cobrador, medio_pago, concepto, fecha_compromiso_pago, aprobacion_estado, en_revision, status, pagado, importe_pagado, importe_facturado

### Ciclo de Vida
```
pendiente → abierto → en_proceso → resuelto
                                 ↘ rechazado
                     resuelto → pagado
```

### Endpoints
```
GET  /api/reclamos                         — Listar (con filtros)
POST /api/reclamos                         — Crear
GET  /api/reclamos/{id}                    — Detalle
PUT  /api/reclamos/{id}                    — Actualizar
GET  /api/reclamos/{id}/documentos         — Documentos adjuntos
POST /api/reclamos/{id}/documentos         — Subir documento
GET  /api/reclamos/{id}/comments           — Comentarios
POST /api/reclamos/{id}/comments           — Agregar comentario
POST /api/reclamos/{id}/revision           — Marcar en revisión
GET  /api/reclamos/{id}/adelanto-status    — Estado de adelanto
GET  /api/reclamos/meta                    — Metadata para filtros
```

---

## 8. MÓDULO DE CLIENTES

### Tabla: `clientes`
Campos: codigo, nombre, direccion, documento_fiscal, logo_url, liq_activo, liq_tolerancia_porcentaje, liq_configuracion_excel

### Relaciones
- `hasMany`: Sucursales, TaxProfile, ClientTaxDocument, Requerimientos, EsquemasTarifarios, MapeoConcepto, MapeoSucursal, ConfiguracionGastos, LiquidacionesCliente

### Sucursales (`sucursals`)
Campos: cliente_id, nombre, codigo_corto, direccion, encargado_deposito

### Endpoints
```
GET    /api/clientes                              — Listar
POST   /api/clientes                              — Crear
GET    /api/clientes/{id}                         — Detalle
PUT    /api/clientes/{id}                         — Actualizar
DELETE /api/clientes/{id}                         — Eliminar
GET    /api/clientes/{id}/sucursales              — Sucursales
GET    /api/clientes/{id}/legajo-impositivo       — Perfil impositivo
POST   /api/clientes/nosis-refresh                — Refresh desde NOSIS
GET    /api/clientes/requerimientos               — Requerimientos
```

---

## 9. MÓDULO DE PAGOS Y TRANSACCIONES

### En DistriApp (app móvil)
**Tabla: `transactions`**
- Tipos: 1=control_operativo, 2=adelanto, 3=retiro, 4=gasto_combustible, 5=recarga, 6=premio
- Balance = Suma(ingresos aprobados) - Suma(egresos aprobados)
- Ingresos: control_operativo, recarga, premio
- Egresos: adelanto, retiro, gasto_combustible

### Solicitudes de Retiro (`withdrawal_requests`)
```
GET  /api/v1/withdrawal-requests              — Listar
POST /api/v1/withdrawal-requests              — Solicitar retiro/adelanto
```

### En Sistema Personal
Los pagos se manejan a través de:
- Liquidaciones aprobadas → monto a pagar por distribuidor
- Facturación a clientes → cobranza
- Recibos de liquidación

---

## 10. MÓDULO DE CONTROL OPERATIVO (DistriApp)

### Tabla: `operation_controls`
Campos: date, city, zone, transport_model, transport_make, tonnage, company, assigned, delivered, hours, km, per (%), description, approved, amount, driver_id, company_id, branch_id

### Flujo
1. Conductor crea control operativo desde la app
2. Admin revisa y aprueba
3. Al aprobar se crea una Transaction asociada
4. El monto se suma al balance del conductor

```
GET  /api/v2/operation-controls/month/{m}/year/{y}  — Listar por mes
POST /api/v2/operation-controls                      — Crear
PUT  /api/v2/operation-controls/{id}                 — Actualizar
PUT  /api/v2/operation-controls/{id}/approve          — Aprobar (admin)
```

---

## 11. MÓDULO DE PEDIDOS/ENTREGAS (DistriApp)

### Tabla: `orders`
Campos: date, type, status (pending/delivered/skipped/not-delivered), receiver, phone, description, delivery_order, address components, lat, lng, delivery_images

### Flujo de Entrega
```
1. Conductor obtiene pedidos del día
   GET /api/v1/orders/type/{type}/day/{day}/month/{month}/year/{year}

2. Optimiza ruta
   POST /api/v1/orders/optimize (usa Here Maps / Google Maps)

3. Inicia journey
   POST /api/v1/journeys

4. Por cada entrega:
   PUT /api/v1/orders/{id}/delivered      — Entregado
   PUT /api/v1/orders/{id}/not-delivered  — No entregado
   POST /api/v1/delivery-images           — Foto de prueba

5. Cierra ruta
   PUT /api/v1/journeys/finish
```

### OCR de Hojas de Ruta
```
POST /api/v1/orders/extract-from-image  — Extrae pedidos de una foto
```

---

## 12. MÓDULO DE GEOLOCALIZACIÓN (DistriApp)

### Tabla: `driver_geopositions`
Campos: driver_id, lat, lng, accuracy, created_at

### Tracking en Tiempo Real
```
POST /api/v1/driver-geopositions       — Registrar posición GPS
GET  /api/v1/driver-geopositions/live  — Stream de ubicación en vivo
```

### Vista Admin
```
GET /api/v1/admin/driver-locations/drivers/{driver}/{date}  — Ubicaciones por fecha
GET /api/v1/admin/driver-locations/audit/drivers/{driver}/date/{date}  — Auditoría
```

---

## 13. MÓDULO DE USUARIOS Y RRHH

### Usuarios (`users`)
Campos: name, email, password, role, permissions[], totp_secret, totp_enabled_at

### Endpoints de Usuarios
```
GET    /api/usuarios                              — Listar
POST   /api/usuarios                              — Crear
GET    /api/usuarios/{id}                         — Detalle
PUT    /api/usuarios/{id}                         — Actualizar
DELETE /api/usuarios/{id}                         — Eliminar
GET    /api/usuarios/{id}/documentos              — Documentos del usuario
POST   /api/usuarios/{id}/documentos              — Subir documento
```

### Control Horario
```
GET  /api/attendance?limit=500           — Registros de asistencia
POST /api/attendance                     — Registrar entrada/salida
POST /api/attendance/import              — Importar masivo CSV/Excel
DELETE /api/attendance/{id}              — Eliminar registro
```

### Solicitudes de Personal
```
GET    /api/solicitud-personal           — Listar solicitudes
POST   /api/solicitud-personal           — Crear solicitud
POST   /api/solicitud-personal/{id}/aprobar   — Aprobar
POST   /api/solicitud-personal/{id}/rechazar  — Rechazar
```

### Vacaciones
```
GET /api/vacaciones-dias   — Días de vacaciones
PUT /api/vacaciones-dias   — Actualizar
```

---

## 14. MÓDULO DE UNIDADES (Flota)

### Tabla: `unidades`
Campos: matricula, marca, modelo, anio, observacion

```
GET    /api/unidades           — Listar vehículos
POST   /api/unidades           — Crear
PUT    /api/unidades/{id}      — Actualizar
DELETE /api/unidades/{id}      — Eliminar
```

---

## 15. MÓDULO DE COMUNICACIONES

### Chat (`chat_messages`)
```
GET  /api/chat/messages    — Obtener mensajes
POST /api/chat/messages    — Enviar mensaje
```
Soporta texto e imágenes (base64).

### Llamadas (WebRTC + Twilio + Anura)
```
POST /api/calls/token                              — Token de llamada
POST /api/calls/anura/click2dial                   — Click-to-dial (Anura)
POST /api/calls/whatsapp/start                     — Iniciar WhatsApp
GET  /api/calls/webrtc/config                      — Config ICE servers
POST /api/calls/sessions                           — Crear sesión
POST /api/calls/sessions/{id}/webrtc/offer         — WebRTC offer
POST /api/calls/sessions/{id}/webrtc/answer        — WebRTC answer
POST /api/calls/sessions/{id}/webrtc/candidate     — ICE candidate
POST /api/calls/sessions/{id}/hangup               — Colgar
```

### Webhooks de Voz
```
POST /voice/twilio/status           — Callback de estado Twilio
POST /voice/anura/status            — Callback de estado Anura
GET|POST /voice/twilio/twiml/outbound — TwiML para llamada saliente
```

### Notificaciones
```
GET  /api/notificaciones?userId=X                  — Obtener
GET  /api/notificaciones?userId=X&onlyUnread=1     — Solo no leídas
POST /api/notificaciones/{id}/leer                 — Marcar como leída
DELETE /api/notificaciones/{id}                    — Eliminar
```

### Push Notifications (DistriApp)
- Firebase Cloud Messaging (FCM)
- Registro de device token: `POST /api/v1/devices`
- Actualización: `PUT /api/v1/devices/fcm-token`

---

## 16. MÓDULO DE WORKFLOW / TAREAS

### Tabla: `workflow_tasks`
Estados: nueva → proceso → finalizado

```
GET    /api/workflow-tasks                        — Listar tareas
POST   /api/workflow-tasks                        — Crear tarea
PUT    /api/workflow-tasks/{id}                   — Actualizar
PATCH  /api/workflow-tasks/{id}/status            — Cambiar estado
DELETE /api/workflow-tasks/{id}                   — Eliminar
GET    /api/workflow-tasks/export                 — Exportar
```

---

## 17. MÓDULO DE TICKETERA

### Estados: pendiente_responsable → pendiente_rrhh → pendiente_compra → aprobado/rechazado
### Categorías: Tecnología, Muebles, Librería, Limpieza, Insumos varios

```
GET  /api/tickets           — Listar
POST /api/tickets           — Crear
GET  /api/tickets/{id}      — Detalle
PUT  /api/tickets/{id}      — Actualizar
```

---

## 18. MÓDULO DE TARIFAS (Imágenes)

```
GET    /api/tarifas/imagen           — Listar imágenes de tarifas
POST   /api/tarifas/imagen           — Subir imagen
PUT    /api/tarifas/imagen/{id}      — Actualizar
DELETE /api/tarifas/imagen/{id}      — Eliminar
```

---

## 19. MÓDULO DE CIERRES DIARIOS (CRM/Ventas)

```
GET    /api/cierres-diarios/fechas              — Fechas disponibles
GET    /api/cierres-diarios/fecha/{fecha}       — Datos de una fecha
POST   /api/cierres-diarios/import              — Importar desde Kommo CRM
DELETE /api/cierres-diarios/fecha/{fecha}       — Eliminar fecha
GET    /api/cierres-diarios/informes/no-citados — Reporte de no citados
```

---

## 20. MÓDULO FISCAL / IMPOSITIVO

### Perfiles Impositivos (`tax_profiles`)
Campos: entity_type (cliente/persona), cuit, razon_social, arca_status, dgr_status, dirección fiscal, actividades, estado clave AFIP, IVA, Ganancias, Monotributo, empleador/empleado/jubilado, datos bancarios

### Integración NOSIS
```
GET /api/nosis/validar-cbu             — Validar CBU
GET /api/nosis/consultar-documento     — Consultar documento
GET /api/nosis/auditoria               — Log de auditoría
POST /api/clientes/{id}/legajo-impositivo/nosis-refresh — Refresh desde NOSIS
```
- Base URL: `https://ws02.nosis.com/api/validacion`
- Fallback: `https://ws01.nosis.com/api`

---

## 21. MÓDULO DE BENEFICIOS Y MEMBRESÍAS (DistriApp)

### Beneficios (`benefits`)
```
GET /api/v1/benefits          — Beneficios activos
GET /api/v1/benefits/public   — Beneficios públicos
```

### Membresía
```
GET    /api/personal/{id}/membresia              — Datos de membresía
GET    /api/personal/{id}/membresia/beneficios   — Beneficios disponibles
POST   /api/personal/{id}/membresia/beneficios/{usoId} — Usar beneficio
GET    /api/personal/{id}/membresia/cuotas       — Cuotas
```

### Puntos de Recompensa
- 100 puntos por cierre de hoja de ruta
- Balance acumulativo
```
GET  /api/v1/rewards/balance    — Balance de puntos
POST /api/v1/route-closures     — Cerrar ruta (otorga puntos)
```

---

## 22. INTEGRACIONES EXTERNAS

| Servicio | Propósito | URL |
|----------|-----------|-----|
| **ARCA/AFIP** | Facturación electrónica, CAE | wsaa.afip.gov.ar / servicios1.afip.gov.ar |
| **NOSIS** | Validación de CBU, documentos, perfil fiscal | ws02.nosis.com/api/validacion |
| **Kommo CRM** | Gestión de leads, pipeline comercial | {subdomain}.kommo.com |
| **Twilio** | Llamadas de voz, TwiML | API Twilio |
| **Anura** | Llamadas click-to-dial | api.anura.com.ar |
| **Here Maps** | Optimización de rutas, geocoding | API Here |
| **Google Maps** | Geocoding alternativo | API Google |
| **Firebase (FCM)** | Push notifications a móviles | FCM |
| **OpenAI** | Parsing de facturas con IA (GPT-4o-mini) | api.openai.com |
| **OCA** | Procesamiento de documentos logísticos | localhost:8100 (microservicio Python) |
| **QR Server** | Generación de códigos QR | api.qrserver.com |
| **WhatsApp** | Inicio de conversaciones | wa.me |

---

## 23. SISTEMA DE COLAS Y PROCESAMIENTO ASÍNCRONO

- **Driver**: Database
- **Tabla**: `jobs`
- **Retry after**: 90 segundos
- **Cola ERP**: `erp-publish` (3 reintentos, backoff: 10s, 30s, 90s)
- **Usos**:
  - Envío de emails
  - Publicación a ERP externo
  - Generación de documentos
  - Procesamiento de archivos pesados

---

## 24. ALMACENAMIENTO DE ARCHIVOS

- **Discos**: local, public, s3 (configurable)
- **Discos especializados**: fuel_controls, toll_controls, operation_controls, route-closures
- **Documentos**: storage/app/documents
- **Certificados ARCA**: storage/app/private/tmp
- **PDFs**: Generados on-demand

---

## 25. AUDITORÍA

```
GET /api/auditoria    — Log de auditoría del sistema
```

Eventos auditados:
- Habilitación de 2FA
- Creación/modificación de documentos
- Aprobaciones/rechazos
- Cambios de datos bancarios
- Consultas NOSIS
- Emisión de facturas
- Cambios de estado en liquidaciones

---

## 26. DIAGRAMA DE COMUNICACIÓN ENTRE SISTEMAS

```
┌──────────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│  Frontend React  │────>│  API Personal (Laravel)│<────│  App Ionic/Angular│
│  (Panel Admin)   │     │  :8001 / apibase...    │     │  (Conductores)   │
└──────────────────┘     └───────────┬───────────┘     └────────┬─────────┘
                                     │                           │
                          ┌──────────┼──────────┐     ┌─────────v─────────┐
                          │          │          │     │  API DistriApp    │
                          v          v          v     │  :8000 / api...   │
                    ┌──────────┐ ┌────────┐ ┌──────┐  └─────────┬─────────┘
                    │  ARCA    │ │ NOSIS  │ │Kommo │            │
                    │  (AFIP)  │ │(Valid.)│ │(CRM) │            v
                    └──────────┘ └────────┘ └──────┘     ┌──────────────┐
                                                         │  Firebase    │
                    ┌──────────┐ ┌────────┐ ┌──────┐     │  (FCM/Auth)  │
                    │ Twilio   │ │ Anura  │ │OpenAI│     └──────────────┘
                    │ (Voz)    │ │ (Voz)  │ │ (IA) │
                    └──────────┘ └────────┘ └──────┘     ┌──────────────┐
                                                         │  OCA Python  │
                    ┌──────────┐ ┌────────┐              │  :8100       │
                    │ Here Maps│ │WhatsApp│              └──────────────┘
                    │ (Rutas)  │ │        │
                    └──────────┘ └────────┘
```

---

## 27. BASE DE DATOS - RESUMEN DE TABLAS

**Total**: 130+ migraciones, 87+ modelos Eloquent

### Tablas principales por módulo:

| Módulo | Tablas |
|--------|--------|
| **Usuarios** | users, personal_access_tokens |
| **Personal** | personas, persona_patentes, duenos, estados, persona_comments, persona_histories |
| **Clientes** | clientes, sucursals, cliente_requerimientos |
| **Unidades** | unidades |
| **Documentos** | archivos, fyle_types |
| **Reclamos** | reclamos, reclamo_types, reclamo_comments, reclamo_documents, reclamo_logs |
| **Liquidaciones** | liq_clientes, liq_esquemas_tarifarios, liq_dimension_valores, liq_lineas_tarifa, liq_tarifas_patente, liq_auditoria_tarifa, liq_mapeos_concepto, liq_mapeos_sucursal, liq_configuracion_gastos, liq_liquidaciones_cliente, liq_archivos_entrada, liq_operaciones, liq_liquidaciones_distribuidor, liq_vinculaciones_oca, liquidacion_recibos |
| **Facturación** | factura_cabecera, factura_iva, factura_tributo, factura_detalle_pdf, factura_cbte_asociado, historial_cobranza_factura, arca_emisor, arca_certificado, arca_punto_venta, arca_ta_cache, facturas (legacy), factura_validaciones, factura_ocr |
| **Combustible** | fuel_movements, fuel_reports, fuel_report_items, fuel_adjustments, distributors, distributor_domains |
| **Impositivo** | tax_profiles, nosis_snapshots, client_tax_documents |
| **DistriApp** | drivers, orders, locations, journeys, operation_controls, fuel_controls, toll_controls, transactions, withdrawal_requests, devices, driver_geopositions, route_closures, benefits, companies, branches, materials, reminders, complaints |
| **Comunicaciones** | chat_messages, call_sessions, notifications, notification_deletions, team_groups, team_group_members |
| **RRHH** | attendance_records, workflow_tasks, solicitud_personal, vacaciones_dias, ticket_requests, user_documents |
| **Otros** | cierres_diarios, activos_asesores_comerciales, tarifa_imagenes, contact_reveals, transportista_qr_access_logs, audit_log, general_info_posts |

---

## 28. ENDPOINTS COMPLETOS - API DISTRIAPP (APP MÓVIL)

### Driver (Conductor)
```
GET    /api/v1/drivers/profile                  — Perfil del conductor
POST   /api/v1/drivers/profile/image            — Subir foto de perfil
DELETE /api/v1/drivers/profile/image            — Eliminar foto
PUT    /api/v1/drivers/profile                  — Actualizar perfil (vehículo, banco, ubicación)
PUT    /api/v1/drivers/phone-number             — Actualizar teléfono
PUT    /api/v1/drivers/password                 — Cambiar contraseña
PUT    /api/v1/drivers/fcm-token                — Actualizar token FCM
PUT    /api/v1/drivers/contractor               — Actualizar estado contratista
PUT    /api/v1/drivers/payment-methods          — Actualizar métodos de pago
GET    /api/v1/drivers/payment-methods          — Listar métodos de pago
GET    /api/v1/drivers/ranking                  — Ranking de rendimiento
```

### Orders (Pedidos)
```
GET    /api/v1/orders/type/{type}/day/{day}/month/{month}/year/{year}  — Pedidos por fecha
POST   /api/v1/orders                           — Crear pedido
POST   /api/v1/orders/extract-from-image        — OCR extraer pedidos de foto
POST   /api/v1/orders/optimize                  — Optimizar ruta (Here/Google Maps)
PUT    /api/v1/orders/delivery-order            — Establecer secuencia
PUT    /api/v1/orders/{order}                   — Actualizar pedido
PUT    /api/v1/orders/{order}/status            — Actualizar estado
PUT    /api/v1/orders/{order}/delivered         — Marcar entregado
PUT    /api/v1/orders/{order}/delivered-offline  — Marcar entregado (offline)
PUT    /api/v1/orders/{order}/not-delivered     — Marcar no entregado
DELETE /api/v1/orders/{order}                   — Eliminar pedido pendiente
```

### Operation Controls (Controles Operativos)
```
GET    /api/v1/operation-controls/month/{m}/year/{y}  — Listar por mes
POST   /api/v1/operation-controls                      — Crear
PUT    /api/v1/operation-controls/{id}                 — Actualizar
DELETE /api/v1/operation-controls/{id}                 — Eliminar
```

### Fuel Controls (Combustible)
```
GET    /api/v1/fuel-controls/month/{m}/year/{y}  — Listar por mes
POST   /api/v1/fuel-controls                      — Registrar carga
PUT    /api/v1/fuel-controls/{id}                 — Editar
DELETE /api/v1/fuel-controls/{id}                 — Eliminar
POST   /api/v1/fuel-control-images                — Subir foto de ticket
```

### Toll Controls (Peajes)
```
GET    /api/v1/toll-controls/month/{m}/year/{y}  — Listar por mes
POST   /api/v1/toll-controls                      — Registrar peaje
PUT    /api/v1/toll-controls/{id}                 — Editar
DELETE /api/v1/toll-controls/{id}                 — Eliminar
POST   /api/v1/toll-control-images                — Subir foto de ticket
```

### Journeys (Viajes/Rutas)
```
GET    /api/v1/journeys                          — Viaje actual
POST   /api/v1/journeys                          — Iniciar viaje
POST   /api/v1/journeys-sequences                — Secuencia óptima
PUT    /api/v1/journeys/finish                   — Finalizar viaje
```

### Transactions (Transacciones)
```
GET    /api/v1/transactions                      — Historial
POST   /api/v1/transactions/withdrawal-request   — Solicitar retiro
```

### Locations (Ubicaciones de entrega)
```
GET    /api/v1/locations                         — Todas las ubicaciones
GET    /api/v1/locations/keyword/{keyword}       — Buscar
POST   /api/v1/locations                         — Crear
POST   /api/v1/locations/geocode-address         — Geocodificar
PUT    /api/v1/locations/{id}/coords             — Actualizar coordenadas
```

### Documents (Documentos)
```
GET    /api/v1/documents                         — Tipos de documento
GET    /api/v1/document-types                    — Listar tipos
POST   /api/v1/document-files                    — Subir archivo
GET    /api/v1/document-files/{id}/download      — Descargar
GET    /api/v1/uploaded-documents                — Documentos subidos
POST   /api/v1/uploaded-documents                — Subir documento
DELETE /api/v1/uploaded-documents/{id}           — Eliminar
POST   /api/v1/invoices/validate                 — Validar factura AFIP
```

### Otros endpoints móviles
```
POST   /api/v1/delivery-images                   — Foto de entrega
POST   /api/v1/driver-geopositions               — Registrar GPS
GET    /api/v1/driver-geopositions/live          — Ubicación en vivo
POST   /api/v1/devices                           — Registrar dispositivo
GET    /api/v1/reminders                         — Recordatorios
POST   /api/v1/reminders                         — Crear recordatorio
GET    /api/v1/complaints                        — Reclamos
POST   /api/v1/complaints                        — Crear reclamo
POST   /api/v1/suggestions                       — Enviar sugerencia
GET    /api/v1/benefits                          — Beneficios
GET    /api/v1/rewards/balance                   — Saldo de puntos
POST   /api/v1/route-closures                    — Cierre de ruta
GET    /api/v1/companies                         — Info de empresa
POST   /api/v1/update-location-requests          — Solicitar actualización
```

### Admin endpoints (DistriApp)
```
GET    /api/v1/admin/drivers                     — Listar conductores
POST   /api/v1/admin/drivers                     — Crear conductor
PUT    /api/v1/admin/drivers/{id}                — Actualizar
PUT    /api/v1/admin/drivers/{id}/status         — Cambiar estado
DELETE /api/v1/admin/drivers/{id}                — Eliminar
GET    /api/v1/admin/orders/type/{type}          — Pedidos por tipo
GET    /api/v1/admin/operation-controls/month/{m}/year/{y} — Controles
POST   /api/v1/admin/operation-controls/download/{time}    — Exportar Excel
PUT    /api/v1/admin/operation-controls/{id}/approve       — Aprobar
GET    /api/v1/admin/fuel-controls/month/{m}/year/{y}      — Combustible
GET    /api/v1/admin/fuel-controls/download/{m}/{y}/{time} — Exportar
GET    /api/v1/admin/toll-controls/month/{m}/year/{y}      — Peajes
GET    /api/v1/admin/transactions/month/{m}/year/{y}       — Transacciones
GET    /api/v1/admin/withdrawal-requests/month/{m}/year/{y} — Retiros
GET    /api/v1/admin/driver-locations                       — Ubicaciones
GET    /api/v1/admin/companies                              — Empresas
POST   /api/v1/admin/notifications                         — Enviar notificación
```

---

## 29. MODELO DE DATOS DISTRIAPP (APP MÓVIL)

### Drivers (Conductores)
Campos: name, last_name, email, phone_number, cuil, city, status, car_make, car_model, car_year, license_plate, tonnage, bank_cbu, bank_cvu, bank_alias, bank_owner_is_driver, bank_holder_*, bank_cbu_status, profile_img_path, score, contractor, cost_per_hour, cost_per_km, start_lat, start_lng, start_address, app_session_active, app_session_last_seen_at, reward_points

### Companies (Empresas)
Relaciones: hasMany Drivers, OperationControls, Branches

### Branches (Sucursales)
Campos: type (1=Cabecera, otro=Interior), status

### Materials & MaterialUbis
Materiales/productos y sus ubicaciones en sucursales

### Devices
Registro de dispositivos móviles con tokens FCM

### Route Closures (Hojas de Ruta)
Campos: date, deliveries, notes, evidence_path, points_awarded (100), status

### Reminders (Recordatorios)
Campos: description, type (once/monthly/semi_annually/yearly), date
Genera ReminderNotifications programadas

### Complaints (Reclamos DistriApp)
Campos: type, subject, message, status, resolved_at, admin_notes

### Benefits (Beneficios)
Campos: title, subtitle, description, type, position, is_active, slug, image_path, meta

### Insurance Requests (Solicitudes de Seguro)
Solicitudes de pólizas de seguro

### Driver Bank Changes
Log de auditoría de cambios de datos bancarios

---

## 30. VALIDACIÓN BANCARIA (Flujo NOSIS)

```
1. Conductor actualiza datos bancarios en perfil
   PUT /api/v1/drivers/profile (bank_cbu, bank_holder_*, bank_owner_is_driver)

2. Se valida CBU contra CUIL vía NOSIS
   NosisClient::validateCbuForDocuments()
   → Intenta validar contra múltiples documentos

3. Se registra intento en auditoría
   NosisAuditService → nosis_query_logs

4. Se actualiza estado
   Driver.bank_cbu_status = validated/rejected

5. Se sincroniza con sistema Personal
   DriverService::syncBankDataWithPersonal()

Restricciones:
- Máximo 5 intentos/día
- Período de bloqueo en caso de fallo
```

---

*Documento generado el 2026-04-09*
*Plataforma DistriApp - Documentación técnica completa*
