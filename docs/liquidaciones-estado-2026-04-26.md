# Log de estado · Módulo Liquidaciones (al 2026-04-26)

## Working tree local
Limpio, sin cambios pendientes. Última commit: `3c850f7 arreglos ocasa`.

## Backend · `back/app/Services/Liq/`

| Servicio | Rol |
|---|---|
| `LiqCalculoOcasaService` | **Motor OCASA con 4 ramas** (A absoluto / B factor / C error / D productividad) |
| `LiqDeteccionSubpagoService` | **BUG B** detección subpagos contrato vs facturado |
| `LiqDistribuidorPdfService` | PDF liquidación con desglose productividad |
| `LiqEficienciaService` | Recálculo paradas exitosas/eficiencia % |
| `LiqEstadoCuentaGeneratorService` | Generación filas estado de cuenta |
| `LiqExcelV5ImportService` | Importador Excel (extractos OCASA, manuales) |
| `LiqImportadorTarifasService` | Importador tarifas OCA |
| `LiqIngestService` | Ingesta de operaciones desde archivos crudos |
| `LiqPlantillaImportBuilder` | Plantilla Excel para importación |
| `OcasaExcelProcessor` | Parser específico Excel OCASA |
| `OcasaPdfProcessor` | Parser PDFs OCASA |
| `OrdenPagoService` / `OrdenPagoPdfService` | Orden de pago + su PDF |
| `PagosUnificadoService` | Conciliación de pagos cliente |
| `Banco/` | Conciliación bancaria por extracto |
| `Eficiencia/` | Sub-servicios de cálculo de eficiencia |

## Backend · Comandos artisan disponibles

| Comando | Para qué |
|---|---|
| `liq:recalcular --cliente=X --periodo=YYYY-MM` | **Orquestador integral** (motor + eficiencia + estado cuenta) |
| `liq:recalcular-motor-ocasa` | Solo motor OCASA, sin tocar eficiencia |
| `liq:detectar-reclamos-ocasa --liq-cliente-id=X` | Detección subpago (Fase 3) |
| `liq:recalcular-eficiencia` | Solo paradas exitosas |
| `liq:importar-excel-v5` | Importación batch Excel |
| `liq:detectar-duplicados` | Limpieza de operaciones duplicadas |
| `liq:backfill-estado-cuenta` | Regeneración masiva estado cuenta |
| `liq:reconciliar-estado-cuenta` | Match cobros/pagos con extracto |
| `liq:reporte-comparativo` | Reporte vs período anterior |
| `liq:seed-ocasa-v5` | Seeders datos demo OCASA |

## Backend · Controllers Liq (15)

`LiqArchivoEntrada` · `LiqCliente` · `LiqDistribuidorDocumento` · `LiqDistribuidorLiquidaciones` · `LiqEstadoCuenta` · **`LiqExtractos`** (núcleo) · `LiqJurisdiccion` · `LiqLiquidacionDistribuidorCiclo` · `LiqMotivosExitosos` · `LiqOca` · `LiqOperacion` · `LiqPagos` · **`LiqReclamosOcasa`** (Fase 5) · `LiqTarifa` · `LiqTarifaImport`

## Backend · Rutas API destacadas (`/api/liq/`)

```
POST   /liquidaciones/upload-ocasa                       — subir Excel/PDF
POST   /liquidaciones/{liq}/reparsear-pdfs-ocasa         — re-procesar
POST   /liquidaciones/{liq}/recalcular-motor-ocasa       — recalcular un mes
GET    /liquidaciones/{liq}/reclamos-ocasa               — listar reclamos
POST   /liquidaciones/{liq}/reclamos-ocasa/detectar      — correr detección
PATCH  /reclamos-ocasa/{id}/estado                       — cambiar estado reclamo
+ rutas tarifas, esquemas, mapeos, contratos OCA, gastos, recibos, pagos
```

## Frontend · `front/src/features/liquidaciones/`

| Componente | Rol |
|---|---|
| `BadgeEficiencia` / `EficienciaBadge` | Badge % paradas exitosas |
| `PeajesPanel` | Gestión peajes |
| `PeriodoAccordion` | Acordeón mes-a-mes |
| **`ReclamosOcasaPanel`** | Panel Fase 5 (4 tiles + tabla) |
| `SplitFiscalPorSucursal` | Toggle facturación dividida |
| `TarifasImportPanel` | Importador UI |
| `api.ts` / `types.ts` | Cliente HTTP + tipos |

Pages: `LiquidacionesPage` · `LiquidacionesClientePage` · `LiquidacionesEstadoCuentaPage` · **`LiquidacionesExtractosPage`** (vista por liq con todos los paneles)

## Schema DB · Tablas principales

`liq_clientes` · `liq_esquemas_tarifarios` · `liq_lineas_tarifa` (con `factor_distrib`, `factor_km`) · `liq_tarifas_patente` · `liq_tarifas_contrato_cliente` · **`liq_tarifas_productividad_cliente`** · `liq_material_mapeo` · `liq_motivos_exitosos` · `liq_liquidaciones_cliente` · `liq_liquidaciones_distribuidor` · `liq_operaciones` (con `detalle_paradas` json, `estado_calculo`, `error_msg`, `modo_pago`) · `liq_operacion_detalles` · **`liq_reclamos_ocasa`** · `liq_estado_cuenta_cliente` · `liq_ordenes_pago` · `liq_mapeos_*` · `liq_historial_auditoria`

## Migraciones recientes (últimas 8)

```
2026-04-21 · bugfix31v2_schema_ocasa_extendido
2026-04-21 · add_factor_km_to_liq_lineas_tarifa
2026-04-21 · excel_v5_columns_liq_lineas_tarifa
2026-04-21 · fase_a_seed_motivos_ocasa_extra
2026-04-22 · importador_tarifas_unificado
2026-04-24 · ocasa_motor_v3_schema   ← Fase 0 SPEC v3 (la última)
```

## Estado funcional OCASA · período 2026-03 (liq #43)

| Item | Estado |
|---|---|
| Smoke regresión motor (671 ops, 0 sin tarifa) | OK |
| Walter PAL831 $2.230.970,02 ef 100% | OK |
| Ahuad AF594TR $2.883.502,44 ef 93,33% | OK |
| Benítez OMU364 $5.380.310,91 ef 100% | OK |
| ROS001 (4 distribuidores) suman $4.191.456,88 vía rama D | a validar después del deploy en prod |
| Detección subpago Tortuguitas — esperado 22 ops / $1.36M | actualmente da 5 ops / $327k — falta normalizar nombres sucursal |
| 244 ops "sin tarifa_contrato" (gap) | pendiente diagnóstico (probable case/acentos) |

## Único punto abierto pendiente

**Gap de detección subpago en sucursales**: 244 ops no encuentran su tarifa contrato cuando el motor compara `op.sucursal_tarifa` vs `liq_tarifas_contrato_cliente.sucursal`. La hipótesis es mismatch por mayúsculas/acentos que `normalizarSucursal()` no cubre. Para confirmar:

```bash
php database/scripts/diagnostico_subpago_gap.php 43
```

Eso lista qué nombres aparecen en ops y cuáles en el contrato — ahí se ve si es Posadas/POSADAS o algún acento que falta.

## Conclusión

Backend Fases 0-5 código pusheado y andando. Frontend Fases 0-5 OK. **Lo único que falta cerrar funcionalmente** es el ajuste de `normalizarSucursal()` para que detecte las 22 ops de Tortuguitas en lugar de 5. Todo lo demás del SPEC v3 está operativo.
