# 3.3 Módulo de Liquidaciones (Power BI + ERP)

Documento complementario de infraestructura funcional:
- [`liquidaciones-modulo-infraestructura-2026-03-02.md`](/media/pancho/Datos/Code/apppersonal/docs/liquidaciones-modulo-infraestructura-2026-03-02.md)

## 1. Objetivo
Diseñar un flujo estándar, auditable y automatizable para:

1. Recepción del Excel del cliente.
2. Ingesta y normalización automática en Power BI.
3. Validación por reglas (tarifas, piezas, adicionales, totales, cliente, período, duplicados).
4. Tablero operativo para Administración.
5. Publicación al ERP solo de registros validados.
6. Generación de observaciones automáticas para resolver diferencias.
7. Trazabilidad punta a punta (archivo original -> validación -> liquidación publicada).

## 2. Principio de arquitectura (clave)
Power BI es excelente para ingesta, transformación, modelado y visualización, pero no es un motor transaccional de publicación ERP por sí solo.

Por eso el estándar recomendado es:

- Power BI / Dataflow: ingesta + normalización + validación + tablero.
- Power Automate: orquestación de eventos y publicación.
- API Backend (Laravel existente): sistema de registro operativo, persistencia de estado y trazabilidad oficial.
- ERP API: destino final de liquidaciones aprobadas.

## 3. Estado actual del sistema (base existente)
Ya existen componentes clave en backend:

- Tabla de movimientos de combustible: `fuel_movements`.
- Tabla de reportes/liquidaciones de combustible: `fuel_reports`.
- Ítems de reporte: `fuel_report_items`.
- Ajustes: `fuel_adjustments`.
- Endpoints de carga, validación y aplicación:
  - `POST /api/combustible/extractos/preview`
  - `POST /api/combustible/extractos/process`
  - `POST /api/combustible/reportes/draft`
  - `POST /api/combustible/reportes/{report}/aplicar`
  - `POST /api/combustible/reportes/seleccion`

Esto permite integrar el nuevo flujo sin reemplazar todo.

### 3.1 Implementación actual en plataforma: Extractos BI/ERP (LOGINTER / MercadoLibre)
Además del flujo de combustible, el backend ya soporta un modo de importación para archivos de liquidación del cliente **LOGINTER/Mercado Libre** dentro del módulo de **Liquidaciones > Extractos**.

**Cómo se usa**
- Subir el Excel (`.xlsx`) desde `POST /api/liquidaciones/runs/upload-preview` (vista previa) y `POST /api/liquidaciones/runs/upload` (creación del run).
- En frontend, basta con seleccionar/ingresar `client_code = LOGINTER` (o `MERCADOLIBRE`).
- Por defecto el sistema busca la hoja `Detalle` y, si existe, toma `Hoja1` como auxiliar.
- Exportar todos los PDFs en un ZIP: `GET /api/liquidaciones/runs/{run}/export-pdfs-zip`

**Hojas y columnas**
- Hoja principal: `Detalle` (obligatoria). Se detecta el encabezado por columnas como `IdViaje`, `FechaViaje`, `Conductor`, `Dominio`, `Concepto`, `Valor`, `Origen`.
- Hoja auxiliar: `Hoja1` (opcional). Si contiene `ORIGINAL` y `DISTRIBUIDOR`, se usa para obtener la tarifa de distribuidor por `IdViaje`.
- Hoja `Prefactura` (si existe): se usa para validar presencia de `IdLiquidacion` y detectar un total de referencia (heurístico).

**Reglas de cálculo (estado actual)**
- `tarifa_distribuidor`:
  - Preferencia 1: `Hoja1.DISTRIBUIDOR` por `IdViaje`.
  - Preferencia 2: si existe `ORIGINAL`/`DISTRIBUIDOR` en `Detalle`, se usan esos valores.
  - Fallback: se aplica un factor configurable (por defecto `0.87`) sobre la tarifa disponible.
- PDF:
  - `Categoria` del renglón se toma de `CategoriaViaje` (ej: `DISTRIBUCION`, `FALSO FLETE`).
  - `KM` se muestra con el `Concepto` (ej: `Rango 0-50kms`, `Valor Viaje`) cuando no hay kilómetros numéricos.
  - `Suc` se infiere desde `Origen/Clientes` con códigos (`NEU`, `TUC`, `BAH`, `RES`, `SFE`, `CDU`, `3AR`, `CDO`, `RSO`, `CTA`).

**Configuración**
- El factor por defecto y/o por zona se puede versionar en reglas de cliente (`/api/liquidaciones/reglas-cliente/{client_code}`) bajo la clave `loginter`:
  - `loginter.factor_default` (default `0.87`)
  - `loginter.factor_by_zone` (objeto `zona -> factor`)

**Archivos y código**
- Backend: `back/app/Http/Controllers/Api/LiquidacionRunController.php`
- PDF: `back/app/Services/Pdf/LiquidacionExtractoPdfService.php`

**Pendientes (para alinear 100% con el blueprint)**
- ABM de tarifas **ORIGINAL** por sucursal/concepto + vigencias (para no depender de `Hoja1`).
- Confirmación y parametrización de `Gastos Administrativos` y `Beneficio Seguro`.
- Naming de PDFs: el ZIP respeta `{COD_SUCURSAL}_{APELLIDONOMBRE}_{PERIODO}.pdf`, pero el documento guardado en “personal” mantiene `run_{id}_persona_{id}.pdf`.

## 4. Diseño objetivo (arquitectura lógica)

### 4.1 Flujo E2E
1. Cliente deja Excel en SharePoint/OneDrive (carpeta acordada por cliente/período).
2. Power Automate detecta archivo nuevo y registra metadatos (run_id, hash, cliente, período).
3. Power BI Dataflow ingiere y normaliza el Excel.
4. Motor de reglas calcula estado por fila: `OK`, `ERROR_CRITICO`, `ALERTA`, `DIFERENCIA`.
5. Dataset se refresca y tablero muestra resultados.
6. Administración revisa y aprueba lote (o subconjunto) desde tablero/panel de control.
7. Power Automate toma solo `OK` y llama API backend para publicar al ERP.
8. Backend publica al ERP (dos salidas):
   - Liquidación final del distribuidor.
   - Liquidación propia para facturación.
9. Backend guarda resultado de publicación + payload + respuesta ERP + auditoría.
10. Se generan observaciones automáticas para filas no validadas.

### 4.2 Componentes
- Repositorio archivos: SharePoint/OneDrive.
- Dataflow Power BI: `df_liquidaciones_ingesta`.
- Dataset Power BI: `ds_liquidaciones_control`.
- Dashboard: `pb_liquidaciones_admin`.
- Flujos Power Automate:
  - `fa_ingesta_liquidaciones`.
  - `fa_publicacion_erp`.
  - `fa_notificacion_observaciones`.
- Backend Laravel:
  - Nuevos endpoints de ingestión validada y publicación ERP.
  - Nuevas tablas de trazabilidad de import/run/reglas/publicación.

## 5. Modelo de datos implementable

## 5.1 Modelo operacional (Laravel)
Se recomienda agregar estas tablas:

### `liq_import_runs`
- `id` (bigint PK)
- `source_system` (varchar, default `powerbi`)
- `client_code` (varchar)
- `period_from` (date)
- `period_to` (date)
- `source_file_name` (varchar)
- `source_file_url` (text)
- `source_file_hash` (varchar)
- `status` (enum: `RECEIVED`,`NORMALIZED`,`VALIDATED`,`APPROVED`,`PUBLISHED`,`FAILED`)
- `rows_total` (int)
- `rows_ok` (int)
- `rows_error` (int)
- `rows_alert` (int)
- `rows_diff` (int)
- `created_by` (nullable bigint)
- `created_at` / `updated_at`

### `liq_staging_rows`
- `id` (bigint PK)
- `run_id` (FK -> liq_import_runs)
- `row_number` (int)
- `external_row_id` (varchar)
- `domain_norm` (varchar)
- `occurred_at` (datetime)
- `station` (varchar)
- `product` (varchar)
- `invoice_number` (varchar)
- `conductor` (varchar)
- `liters` (decimal 12,3)
- `amount` (decimal 12,2)
- `price_per_liter` (decimal 12,3)
- `tariff_expected` (decimal 12,3 nullable)
- `amount_expected` (decimal 12,2 nullable)
- `validation_status` (enum: `OK`,`ERROR_CRITICO`,`ALERTA`,`DIFERENCIA`)
- `validation_score` (decimal 5,2 nullable)
- `is_duplicate` (bool)
- `duplicate_group_key` (varchar nullable)
- `observations_auto` (text nullable)
- `raw_payload_json` (json)
- `created_at` / `updated_at`

### `liq_validation_results`
- `id`
- `run_id` (FK)
- `staging_row_id` (FK)
- `rule_code` (varchar)
- `severity` (enum: `CRITICAL`,`WARNING`,`INFO`)
- `result` (enum: `PASS`,`FAIL`)
- `expected_value` (varchar nullable)
- `actual_value` (varchar nullable)
- `message` (text)
- `created_at`

### `liq_publish_jobs`
- `id`
- `run_id` (FK)
- `status` (enum: `PENDING`,`SENT`,`PARTIAL`,`FAILED`,`CONFIRMED`)
- `erp_request_id` (varchar nullable)
- `erp_batch_id` (varchar nullable)
- `sent_at` (datetime nullable)
- `confirmed_at` (datetime nullable)
- `request_payload` (longtext/json)
- `response_payload` (longtext/json)
- `error_message` (text nullable)
- `created_at` / `updated_at`

### `liq_observations`
- `id`
- `run_id` (FK)
- `staging_row_id` (FK)
- `type` (enum: `ERROR`,`ALERTA`,`DIFERENCIA`)
- `message` (text)
- `assigned_to` (nullable bigint)
- `status` (enum: `OPEN`,`IN_PROGRESS`,`RESOLVED`,`DISMISSED`)
- `resolved_note` (text nullable)
- `resolved_at` (datetime nullable)
- `created_at` / `updated_at`

## 5.2 Modelo analítico (Power BI)
Dimensiones sugeridas:
- `DimCliente`
- `DimDistribuidor`
- `DimProducto`
- `DimPeriodo`
- `DimRegla`
- `DimEstadoValidacion`

Hechos sugeridos:
- `FactLiquidacionRows` (nivel fila)
- `FactValidationFindings` (nivel regla/falla)
- `FactPublish` (nivel publicación ERP)

## 6. Catálogo de reglas (MVP + extensible)

## 6.1 Reglas críticas
- `R001_DOMINIO_REQUERIDO`: dominio no vacío y normalizable.
- `R002_FECHA_VALIDA`: fecha parseable y dentro de período.
- `R003_LITROS_POSITIVOS`: litros > 0.
- `R004_IMPORTE_VALIDO`: importe >= 0.
- `R005_PRECIO_CONSISTENTE`: `abs((importe/litros)-precio) <= tolerancia`.
- `R006_TARIFA_CLIENTE`: precio/litro dentro de tarifa acordada por cliente + producto + período.
- `R007_DUPLICADO`: hash canónico no repetido intra-lote ni histórico.

## 6.2 Reglas de alerta/diferencia
- `R101_ESTACION_NO_HABITUAL`: estación fuera de patrón histórico.
- `R102_CONDUCTOR_NO_ASIGNADO`: conductor sin vinculación.
- `R103_DESVIO_CONSUMO`: desvío vs promedio histórico por dominio.
- `R104_FACTURA_FALTANTE`: faltan datos de comprobante.
- `R105_DIF_TOTALES_CLIENTE`: diferencia contra total esperado del cliente.

## 6.3 Matriz de severidad
- `CRITICAL` -> bloquea publicación.
- `WARNING` -> permite publicar según política.
- `INFO` -> solo trazabilidad.

## 7. Power BI: implementación práctica

## 7.1 Dataflow (Power Query)
Pasos estándar:
1. Conector SharePoint folder.
2. Filtrar por naming convention (`cliente_periodo_version.xlsx`).
3. Extraer metadatos (cliente, período, versión, hash si está disponible).
4. Expandir hojas relevantes.
5. Normalizar columnas al estándar operativo:
   - `Fecha`, `Estación`, `Dominio`, `Producto`, `Nro Factura`, `Conductor`, `Litros`, `Importe`, `Precio/Litro`.
6. Normalizar tipos y formato decimal/fecha.
7. Generar claves técnicas (`run_id`, `row_number`, `duplicate_key`).
8. Calcular columnas de validación base.

## 7.2 Dataset + DAX
Medidas mínimas:
- `Rows Total`
- `Rows OK`
- `Rows Error Critico`
- `Rows Alerta`
- `Rows Diferencia`
- `% Calidad` = `Rows OK / Rows Total`
- `Monto OK`
- `Monto Observado`

## 7.3 Tablero Administración
Visuales:
- Tarjetas KPI (OK, críticos, alertas, diferencias, monto).
- Matriz por cliente / período / distribuidor.
- Tabla detalle con drill-through a fila.
- Página de "Publicables" (`validation_status = OK`).
- Página "Observaciones" con motivo y responsable.

## 8. Flujo Power Automate

## 8.1 Flujo `fa_ingesta_liquidaciones`
Trigger:
- When a file is created in SharePoint folder.

Acciones:
1. Leer metadata archivo.
2. Crear `run` en backend (`/api/liquidaciones/runs`).
3. Lanzar refresh Dataflow/Dataset.
4. Esperar refresh success.
5. Consultar resumen de validación.
6. Actualizar `run` a `VALIDATED`.
7. Notificar canal Teams/Email con resumen.

## 8.2 Flujo `fa_publicacion_erp`
Trigger:
- Manual (botón aprobar) o programado con condición.

Acciones:
1. Obtener filas `OK` del run aprobado.
2. Llamar endpoint backend publicación.
3. Backend publica al ERP.
4. Guardar respuesta ERP y estado.
5. Si éxito: actualizar run `PUBLISHED`.
6. Si parcial/error: generar observaciones y notificar.

## 8.3 Flujo `fa_notificacion_observaciones`
Trigger:
- Run validado con observaciones > 0.

Acciones:
1. Agrupar por tipo de observación y responsable.
2. Enviar resumen accionable.
3. Registrar notificación enviada.

## 9. Contrato API ERP (recomendado)

## 9.1 Publicar liquidación distribuidor
`POST /erp/liquidaciones/distribuidor`

Request (ejemplo):
```json
{
  "runId": 1287,
  "periodo": { "desde": "2026-03-01", "hasta": "2026-03-15" },
  "distribuidor": { "codigo": "DIST-009", "nombre": "Juan Perez" },
  "totales": { "litros": 1540.52, "importe": 201548.77, "ajustes": -3500.00, "totalLiquidar": 198048.77 },
  "items": [
    {
      "rowId": 9912,
      "fecha": "2026-03-03T10:25:00",
      "dominio": "AA123BB",
      "producto": "Diesel",
      "litros": 45.1,
      "importe": 5988.20,
      "precioLitro": 132.78,
      "comprobante": "FAC-123456"
    }
  ]
}
```

Response (ejemplo):
```json
{
  "status": "accepted",
  "erpRequestId": "ERP-REQ-20260302-00091",
  "erpBatchId": "ERP-BATCH-77812",
  "receivedAt": "2026-03-02T14:32:10Z"
}
```

## 9.2 Publicar liquidación propia para facturar
`POST /erp/liquidaciones/facturacion`

Request:
```json
{
  "runId": 1287,
  "cliente": { "codigo": "CLI-ACME" },
  "periodo": { "desde": "2026-03-01", "hasta": "2026-03-15" },
  "baseFacturar": 201548.77,
  "descuentosCombustible": 198048.77,
  "netoFacturar": 3500.00,
  "referencias": {
    "fuelReportId": 445,
    "liquidacionDocumentoId": 8891
  }
}
```

Response:
```json
{
  "status": "confirmed",
  "documentNumber": "FC-0008-00012345",
  "erpRequestId": "ERP-REQ-20260302-00092"
}
```

## 9.3 Endpoint backend de publicación (interno)
`POST /api/liquidaciones/runs/{run}/publicar-erp`

Comportamiento:
- Solo procesa filas `OK`.
- Rechaza si existen `CRITICAL` abiertos.
- Publica 2 documentos (distribuidor + facturación propia).
- Guarda payload request/response en `liq_publish_jobs`.

## 10. Trazabilidad absoluta (auditoría)
Por cada `run_id` debe quedar trazable:

1. Archivo original: nombre, hash, URL, timestamp, usuario/sistema.
2. Transformación: versión Dataflow, timestamp refresh.
3. Validación: reglas evaluadas por fila + resultado.
4. Aprobación: quién aprobó, cuándo y bajo qué criterio.
5. Publicación ERP: payload, respuesta, ids externos, estado final.
6. Observaciones: abiertas/resueltas y evidencia.

## 11. Seguridad y gobierno
- Identidad corporativa (Azure AD / SSO).
- RLS en Power BI por cliente/región/rol.
- Secretos en Key Vault o conexión segura (no en PBIX).
- Registro de auditoría en backend (`audit_events`) y flujos.
- Política de retención de archivos y versionado (mínimo 12-24 meses).

## 12. Roadmap de implementación (4 fases)

### Fase 1 (1-2 semanas) - Base operativa
- Crear tablas nuevas (`liq_import_runs`, `liq_staging_rows`, `liq_validation_results`, `liq_publish_jobs`, `liq_observations`).
- Endpoint create/update run.
- Dataflow de ingesta normalizada.

### Fase 2 (1-2 semanas) - Validación y tablero
- Implementar catálogo de reglas MVP.
- Persistencia de resultados de reglas.
- Dashboard Administración con KPIs y detalle.

### Fase 3 (1 semana) - Publicación ERP
- Endpoint backend `/publicar-erp`.
- Flujo Power Automate de publicación.
- Manejo de estados `SENT/PARTIAL/FAILED/CONFIRMED`.

### Fase 4 (1 semana) - Observaciones y hardening
- Observaciones automáticas + workflow de resolución.
- Alertas Teams/Email.
- Pruebas UAT y monitoreo.

## 13. Criterios de aceptación
- Ingesta automática sin intervención manual para nuevos archivos.
- 100% de filas con estado de validación y motivo.
- Publicación ERP bloqueada para `CRITICAL`.
- Trazabilidad completa por `run_id`.
- Dashboard con SLA: actualización < 15 minutos tras carga.

## 14. Recomendación de implementación en este repo
Para no romper flujo actual:

1. Mantener endpoints actuales de combustible.
2. Agregar una capa de `run` y staging para el nuevo estándar.
3. Reusar `fuel_movements`/`fuel_reports` como modelo operativo final.
4. Integrar Power BI como puerta de validación y control.
5. Centralizar publicación ERP y auditoría en Laravel (fuente de verdad transaccional).

---

Si querés, siguiente paso te lo dejo ya en código con:
- migraciones SQL reales,
- endpoints Laravel (`runs`, `validaciones`, `publicar-erp`),
- y plantilla JSON de reglas para que Power BI/Automate la consuman.

## 15. Runbook de ejecución
Checklist operativo detallado (Power Automate + ERP sandbox):
- [`docs/power-automate-erp-sandbox-runbook.md`](/media/pancho/Datos/Code/apppersonal/docs/power-automate-erp-sandbox-runbook.md)

## 16. Implementación técnica actual en backend
- `ErpClient` desacoplado (`real` + `mock`): `App\Services\Erp\ErpClient`.
- Publicación ERP procesada por servicio: `App\Services\Liquidaciones\LiquidacionPublishProcessor`.
- Cola con reintentos: `App\Jobs\ProcessLiquidacionPublishJob`.
- Endpoint `/publicar-erp` soporta:
  - `queue=true` (asíncrono, recomendado productivo),
  - `queue=false` (sincrónico, útil para smoke/local).
