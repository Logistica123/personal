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

## Migraciones recientes

```
2026-04-21 · bugfix31v2_schema_ocasa_extendido
2026-04-22 · importador_tarifas_unificado
2026-04-24 · ocasa_motor_v3_schema             ← SPEC v3 schema ops
2026-04-26 · create_liq_tarifas_distribuidor   ← SPEC v4 LA→Distribuidor
2026-04-26 · create_liq_tarifas_ocasa_la       ← SPEC v4.2 OCASA→LA + ALTER liq_reclamos_ocasa
```

## Estado funcional OCASA · período 2026-03 (liq #43) — CERRADO ✅

| Item | Resultado |
|---|---|
| Motor v4 ROS001 4 distribuidores | **$ 4.191.456,88** al centavo (con `monto_parada` agrupado) |
| Walter PAL831 ef 100% | $ 2.234.990,02 (sin regresión) |
| Ahuad AF594TR ef 95,20% | $ 2.887.522,44 (sin regresión) |
| Benítez OMU364 ef 100% | $ 5.384.330,91 (sin regresión) |
| Hurt ROHS07 (id 327, factor 0.90) | 13 ops, vía override existente en `liq_lineas_tarifa` |
| Detección subpago jornada (excluye productividad) | 17 reclamos / $ 894.979,97 |
| Detección subpago productividad | 0 reclamos (OCASA pagó dentro de tolerancia 5%) |
| PDF distribuidor sin Costo OCASA + paradas reales `entregadas/totales` + Nivel 3/4 | OK |
| 180 tarifas OCASA→LA cargadas | OK (listas para detectar futuros subpagos) |
| 180 tarifas LA→Distrib monto_parada | OK |
| 1 regla Default factor 0.85 | OK (fallback para ramas A/B legacy) |

## Tortuguitas — gap residual (no bloqueante, cosa de datos)

Detección Tortuguitas: 5 ops / $327k (esperado 22 ops / $1.36M).

Causa: faltan tarifas Tortuguitas cap=2500 en `liq_tarifas_contrato_cliente`. Las 17 ops faltantes son cap=2500 sin tarifa cargada. Cuando OCASA confirme la tarifa contractual Tortuguitas cap=2500, se cargan vía SQL y el detector cubre.

## Pendientes opcionales (no bloqueantes)

1. **UI CRUD reglas tarifa distribuidor** (SPEC v4 Fase 6) — sistema funciona con SQL directo
2. **PDF tabla contractual del distribuidor** (SPEC v4 Fase 8) — entregable separado al firmar
3. **Refactor motor para que ramas A/B también consulten `liq_tarifas_distribuidor`** — hoy `factor_ocasa` solo aplica en rama D. Walter/AUCAR/HURT/Benítez/Ojeda sus overrides siguen funcionando vía `liq_lineas_tarifa` legacy.
4. **Cargar tarifa Tortuguitas cap=2500** cuando OCASA la confirme.
5. **OJEDA Resistencia 2500** — agregar a `personas` y crear regla con su `distribuidor_id` cuando aparezca.
6. **UI extender ReclamosOcasaPanel** para mostrar reclamos productividad por parada (SPEC v4.2 Fase 11).
7. **Eloquent observer en `LiqLineaTarifa::saving`** para registrar cambios al campo `activo` en `liq_auditoria_tarifa` (mejora auditoría tras incident con #313).

## Conclusión

OCASA mar-26 cerrado con motor v4 + detector v4.2 + PDF v4. Todos los criterios de aceptación del SPEC pasan al centavo. El sistema está listo para procesar abr-26 cuando OCASA cierre el período.
