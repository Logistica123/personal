# Liquidaciones MVP - Estado de Implementacion (2026-03-03)

## Implementado en este paso
- Endpoints alias del contrato:
  - `POST /api/liquidaciones/importaciones`
  - `GET /api/liquidaciones/importaciones/{run}/preview`
  - `POST /api/liquidaciones/importaciones/{run}/approve`
  - `POST /api/liquidaciones/importaciones/{run}/publish`
- Estado operativo agregado al flujo:
  - `CARGADA -> PRELIQUIDACION -> APROBADA -> PUBLICADA`
- Lock de edicion en upsert:
  - Solo permite edicion en `PRELIQUIDACION` (y `CARGADA` para carga incremental inicial).
- `createImportacion` valida campos del spec (`cliente_id`, `anio`, `mes`, `tipo_periodo`, `quincena`, `sucursal_id`, `file`) y calcula version por clave funcional.
- `previewImportacion` entrega estructura de respuesta de preview (importacion/resumen/distribuidores) compatible con el contrato.

## Ya venia implementado y se mantiene
- Upload + parseo + normalizacion de Excel.
- Reglas por cliente (template + upsert por cliente).
- Aprobacion y publicacion ERP (dry-run/queue/sync).
- Observaciones automaticas y auditoria por `AuditLogger`.

## Pendiente para cerrar 100% del spec
- Endpoints de detalle y edicion granular del contrato:
  - `GET /api/liquidaciones/distribuidores/{liquidacion_distribuidor_id}`
  - `PATCH /api/liquidaciones/lineas/{linea_id}`
  - `PATCH /api/liquidaciones/distribuidores/{id}`
- Tabla dedicada de auditoria de cambios (`auditoria_cambios`) con old/new por campo.
- Entidades dedicadas:
  - `liquidacion_distribuidor`
  - `liquidacion_distribuidor_linea`
- Overrides nativos por linea (`importe_override`) y gastos administrativos por distribuidor persistidos como columnas (hoy se modela sobre staging + metadata).
- Export publish no-ERP (PDF/Excel por distribuidor) como alternativa local al paso de publicacion.

## Decision tecnica actual
- Se priorizo compatibilidad con lo ya construido (`runs`) para no romper el circuito operativo existente.
- El contrato nuevo de importaciones se expone como capa API compatible sobre el backend actual.
