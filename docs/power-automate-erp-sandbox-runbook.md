# Runbook Operativo: Power Automate + ERP Sandbox

## 1. Variables de entorno backend
En [`back/.env`](/media/pancho/Datos/Code/apppersonal/back/.env) dejar configurado:

```env
ERP_INTEGRATION_ENABLED=true
ERP_MOCK_MODE=false
ERP_MOCK_LATENCY_MS=0
ERP_API_BASE_URL=https://erp-sandbox.tu-dominio.com
ERP_API_TOKEN=token-sandbox
ERP_API_TIMEOUT=15
ERP_DISTRIBUTOR_ENDPOINT=/liquidaciones/distribuidor
ERP_BILLING_ENDPOINT=/liquidaciones/facturacion
ERP_PUBLISH_QUEUE_ENABLED=true
ERP_PUBLISH_QUEUE=erp-publish
ERP_PUBLISH_TRIES=3
ERP_PUBLISH_BACKOFF=10,30,90
```

## 2. Endpoints operativos del circuito
- `GET /api/liquidaciones/runs` (listado con filtros y paginación)
- `POST /api/liquidaciones/runs` (alta de run)
- `POST /api/liquidaciones/runs/{run}/upsert` (carga incremental por lotes)
- `POST /api/liquidaciones/runs/{run}/approve` (aprobación formal)
- `POST /api/liquidaciones/runs/{run}/publicar-erp` (publicación a ERP)

Todos requieren `Authorization: Bearer <token_api_backend>`.

## 2.1 Modo de ejecución de publicación ERP
- Sin cola (sincrónico): enviar `queue=false` en `/publicar-erp`.
- Con cola (recomendado productivo): enviar `queue=true` o usar default por config.

Si usás cola (`QUEUE_CONNECTION=database`):
1. Verificar tablas de jobs:
```bash
php artisan migrate
```
2. Levantar worker:
```bash
php artisan queue:work --queue=erp-publish,default --tries=3
```

## 3. Secuencia recomendada en Power Automate
1. `Trigger`: archivo nuevo en SharePoint/OneDrive.
2. `Compose`: metadatos (cliente, período, hash, nombre archivo).
3. `HTTP POST /runs`: crear run (`status=RECEIVED`).
4. `Dataflow Power BI`: normalizar extracto.
5. `Apply to each batch`: `HTTP POST /runs/{id}/upsert` con `staging_rows` + `validation_results`.
6. `HTTP POST /runs/{id}/approve`:
   - `force=false` en operación normal.
   - `force=true` solo por excepción validada.
7. `HTTP POST /runs/{id}/publicar-erp`:
   - primero `dry_run=true`.
   - si ok, ejecutar real (`dry_run=false`).
8. Guardar `run_id`, `publish_job_id`, `erpRequestId`, `erpBatchId` en bitácora.

## 3.1 Plantilla concreta de acciones HTTP (Power Automate)
Asumimos variable `baseApi = https://tu-backend.com/api` y `bearerToken` (token API backend).

1. `HTTP - Crear run`
- Method: `POST`
- URI: `@{variables('baseApi')}/liquidaciones/runs`
- Headers:
  - `Authorization: Bearer @{variables('bearerToken')}`
  - `Content-Type: application/json`
  - `Accept: application/json`
- Body:
```json
{
  "source_system": "powerbi",
  "client_code": "@{variables('clientCode')}",
  "period_from": "@{variables('periodFrom')}",
  "period_to": "@{variables('periodTo')}",
  "source_file_name": "@{variables('sourceFileName')}",
  "status": "RECEIVED"
}
```

2. `Parse JSON - Run creado`
- Content: `@{body('HTTP_-_Crear_run')}`
- Guardar `runId = body('HTTP_-_Crear_run')?['data']?['id']`

3. `Apply to each - Lotes normalizados`
- Origen: colección de lotes de filas transformadas por Power BI/Dataflow.
- Dentro del loop: `HTTP - Upsert`
  - Method: `POST`
  - URI: `@{variables('baseApi')}/liquidaciones/runs/@{variables('runId')}/upsert`
  - Headers igual al paso 1.
  - Body:
```json
{
  "replace_validation_results": false,
  "staging_rows": "@{items('Apply_to_each_-_Lotes_normalizados')?['staging_rows']}",
  "validation_results": "@{items('Apply_to_each_-_Lotes_normalizados')?['validation_results']}"
}
```

4. `HTTP - Aprobar run`
- Method: `POST`
- URI: `@{variables('baseApi')}/liquidaciones/runs/@{variables('runId')}/approve`
- Body:
```json
{
  "force": false,
  "note": "Aprobación automática Power Automate"
}
```

5. `HTTP - Publicar dry-run`
- Method: `POST`
- URI: `@{variables('baseApi')}/liquidaciones/runs/@{variables('runId')}/publicar-erp`
- Body:
```json
{
  "dry_run": true,
  "force": false
}
```

6. `Condition - dry-run OK`
- Condición sugerida: `@equals(body('HTTP_-_Publicar_dry-run')?['data']?['status'], 'DRY_RUN')`
- Si `true`, ejecutar publicación real.
- Si `false`, terminar flujo con error y notificación.

7. `HTTP - Publicar real`
- Method: `POST`
- URI: `@{variables('baseApi')}/liquidaciones/runs/@{variables('runId')}/publicar-erp`
- Body:
```json
{
  "dry_run": false,
  "force": false
}
```

8. `Condition - Publicación confirmada`
- Condición sugerida:
  - `@and(equals(body('HTTP_-_Publicar_real')?['data']?['status'], 'CONFIRMED'), equals(body('HTTP_-_Publicar_real')?['run']?['status'], 'PUBLISHED'))`
- Si `false`: registrar incidente.
- Si `true`: guardar trazabilidad (`runId`, `publishJobId`, `erpRequestId`, `erpBatchId`).

## 4. Contratos mínimos (payload)
### 4.1 Crear run
```json
{
  "source_system": "powerbi",
  "client_code": "CLI-ACME",
  "period_from": "2026-03-01",
  "period_to": "2026-03-15",
  "source_file_name": "extracto-acme-20260315.xlsx",
  "status": "RECEIVED"
}
```

### 4.2 Upsert incremental
```json
{
  "replace_validation_results": false,
  "staging_rows": [
    {
      "external_row_id": "ROW-0001",
      "row_number": 1,
      "domain_norm": "AA123BB",
      "distributor_code": "D-001",
      "distributor_name": "Distribuidor Norte",
      "liters": 45.1,
      "amount": 5988.2,
      "validation_status": "OK"
    }
  ],
  "validation_results": [
    {
      "external_row_id": "ROW-0001",
      "rule_code": "TARIFA_MATCH",
      "severity": "INFO",
      "result": "PASS"
    }
  ]
}
```

### 4.3 Aprobar run
```json
{
  "force": false,
  "note": "Aprobación operativa"
}
```

### 4.4 Publicar ERP
```json
{
  "dry_run": false,
  "force": false,
  "queue": true
}
```

## 5. Monitoreo y rollback operativo
- Si `approve` responde `422`, el flujo debe frenar y notificar observaciones.
- Si `publicar-erp` devuelve `PARTIAL` o `FAILED`, registrar evento y crear ticket automático.
- Reintento recomendado en Power Automate:
  - `408/429/5xx`: retry exponencial (3 intentos).
  - `422`: no reintentar automáticamente.

## 6. Validación de punta a punta en sandbox
1. Crear un run de prueba desde la UI (`/combustible/runs`) o API.
2. Cargar 10-20 filas por `upsert`.
3. Ejecutar `approve` y luego `publicar-erp` con `dry_run=true`.
4. Activar publicación real (`dry_run=false`).
5. Verificar:
   - `liq_publish_jobs.status = CONFIRMED`
   - `liq_import_runs.status = PUBLISHED`
   - IDs externos ERP guardados (`erp_request_id`, `erp_batch_id`).

## 7. Smoke test automatizado por script (terminal)
Script incluido:
- [`back/scripts/liquidaciones_sandbox_smoke.sh`](/media/pancho/Datos/Code/apppersonal/back/scripts/liquidaciones_sandbox_smoke.sh)

Uso:
```bash
cd /media/pancho/Datos/Code/apppersonal/back
API_BASE_URL="http://localhost:8000" \
API_TOKEN="TU_BEARER_TOKEN_BACKEND" \
CLIENT_CODE="CLI-SMOKE" \
PUBLISH_REAL=true \
./scripts/liquidaciones_sandbox_smoke.sh
```

Notas:
- Si querés validar solo hasta dry-run: `PUBLISH_REAL=false`.
- Para forzar publicación sin cola desde script: `PUBLISH_QUEUE=false`.
- Para probar modo cola desde script: `PUBLISH_QUEUE=true` (requiere worker activo).
- El script falla con código `1` si no obtiene `CONFIRMED/PUBLISHED` en publicación real.
- Alternativa sin token manual (login automático):
```bash
cd /media/pancho/Datos/Code/apppersonal/back
API_BASE_URL="http://localhost:8000" \
LOGIN_EMAIL="tu.usuario@dominio.com" \
LOGIN_PASSWORD="tu-password" \
PUBLISH_REAL=true \
./scripts/liquidaciones_sandbox_smoke.sh
```
