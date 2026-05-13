# Liquidaciones — Documentación técnica end‑to‑end

**Fecha:** 2026-05-13
**Alcance:** módulo de liquidaciones (extractos, distribuidores, pagos, recibos, OCASA, peajes).
**Stack:** Laravel 10 (`back/`) + React 18 / TypeScript / Vite (`front/`).

> Este documento es el “mapa” técnico del módulo. Está pensado para que un dev pueda llegar nuevo y entender en una sentada cómo entra un extracto, cómo se transforma en liquidaciones de distribuidor y cómo termina en una orden de pago en ICBC.

---

## 1. Vista de 30 segundos

```
┌────────────────┐   upload    ┌─────────────────┐   generar    ┌──────────────────────┐
│  Extracto      │ ──────────▶ │  LiqOperacion   │ ───────────▶ │  Liq.Distribuidor    │
│  (Excel/PDF/   │             │  (líneas)       │              │  (subtotal, gastos,  │
│   OCASA TMS)   │             │                 │              │   total a pagar)     │
└────────────────┘             └─────────────────┘              └─────────┬────────────┘
                                                                          │ preparar
                                                                          ▼
                                                                ┌──────────────────────┐
                                                                │  LiqOrdenPago        │
                                                                │  (BORRADOR →         │
                                                                │   ENVIADA_BANCO →    │
                                                                │   CONFIRMADA)        │
                                                                └─────────┬────────────┘
                                                                          │ ejecutar-pago
                                                                          ▼
                                                                ┌──────────────────────┐
                                                                │  ICBC Multipay       │
                                                                └──────────────────────┘
```

Conceptos clave:

| Término               | Es                                                                  | Tabla                              |
|-----------------------|----------------------------------------------------------------------|------------------------------------|
| **Extracto**          | Archivo físico cargado (Excel banco, PDF OCASA, TMS, YCC).           | `liq_archivos_entrada`             |
| **Liquidación cliente** | Agrupador por *cliente + período*. Lo que ves en `/liquidaciones/extractos`. | `liq_liquidaciones_cliente`        |
| **Operación**         | Una línea del extracto ya parseada y tarifada.                       | `liq_operaciones`                  |
| **Liquidación distribuidor** | Suma de operaciones de un mismo distribuidor en esa liq. cliente.    | `liq_liquidaciones_distribuidor`   |
| **Orden de pago**     | Lo que se le va a pagar al distribuidor en el banco.                 | `liq_ordenes_pago`                 |
| **Recibo**            | Comprobante que tesorería emite al cobrar.                            | `liquidacion_recibos`              |

---

## 2. Pantallas frontend

Todas se montan desde [App.tsx](front/src/App.tsx). Las rutas reales conviven con la sidebar “Liquidaciones” del panel.

| Ruta URL                          | Archivo                                                                                       | Qué hace                                                                                              |
|-----------------------------------|-----------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `/liquidaciones/extractos`        | [LiquidacionesExtractosPage.tsx](front/src/pages/LiquidacionesExtractosPage.tsx)              | **Hub principal v2.** Listar / crear liquidaciones cliente, cargar extractos, auditar diferencias, mapear tarifas, autorizar peajes, cambiar estado. |
| `/liquidaciones`                  | [LiquidacionesPage.tsx](front/src/pages/LiquidacionesPage.tsx)                                | Listado por **distribuidor**: liquidaciones ya generadas, descarga PDF, marcar “preparada”, editar.    |
| `/liquidaciones/:personaId`       | [LiquidacionesPage.tsx](front/src/pages/LiquidacionesPage.tsx)                                | Variante admin con `persona_id` fijo en URL.                                                           |
| `/liquidaciones/cliente`          | [LiquidacionesClientePage.tsx](front/src/pages/LiquidacionesClientePage.tsx)                  | Configuración por cliente: esquemas tarifarios, mapeos sucursal↔distribuidor, gastos administrativos.  |
| `/liquidaciones/estado-cuenta`    | [LiquidacionesEstadoCuentaPage.tsx](front/src/pages/LiquidacionesEstadoCuentaPage.tsx)        | Estado de cuenta cliente (neto gravado / no gravado / IVA / cobrado).                                  |
| `/liquidaciones/peajes`           | [PeajesDashboardPage.tsx](front/src/pages/PeajesDashboardPage.tsx)                            | Dashboard de peajes con métricas, top distribuidores, motivos de rechazo, export.                      |
| `/liquidaciones/recibos`          | [RecibosPage.tsx](front/src/pages/RecibosPage.tsx)                                            | Emisión y anulación de recibos.                                                                        |
| `/pagos`                          | [PagosPage.tsx](front/src/pages/PagosPage.tsx)                                                | Armado de **órdenes de pago**, validación de beneficiarios, envío a ICBC.                              |

### Componentes auxiliares (`front/src/features/liquidaciones/`)

- [PeriodoAccordion.tsx](front/src/features/liquidaciones/PeriodoAccordion.tsx) — acordeón por quincena/mes.
- [TarifasContratoPanel.tsx](front/src/features/liquidaciones/TarifasContratoPanel.tsx) — visor/editor de contrato tarifario por cliente.
- [PeajesPanel.tsx](front/src/features/liquidaciones/PeajesPanel.tsx) — panel para autorizar peajes uno a uno.
- [ReclamosOcasaPanel.tsx](front/src/features/liquidaciones/ReclamosOcasaPanel.tsx) — detección y exportación de subpagos OCASA.
- [types.ts](front/src/features/liquidaciones/types.ts) — tipos compartidos del feature.

---

## 3. Endpoints backend

Definidos en [back/routes/api.php](back/routes/api.php). Todos los endpoints v2 viven bajo el prefijo `/api/liq/*`. Los recibos legacy bajo `/api/liquidaciones/recibos`.

### 3.1 Liquidaciones cliente (extractos v2)

| Método | Path | Controller |
|--------|------|------------|
| GET    | `/liq/liquidaciones`                                              | `LiqExtractosController@index` |
| POST   | `/liq/liquidaciones`                                              | `LiqExtractosController@store` |
| GET    | `/liq/liquidaciones/{liquidacionCliente}`                         | `LiqExtractosController@show` |
| DELETE | `/liq/liquidaciones/{liquidacionCliente}`                         | `LiqExtractosController@destroy` |
| POST   | `/liq/liquidaciones/upload`                                       | `LiqExtractosController@upload` |
| POST   | `/liq/liquidaciones/upload-ocasa`                                 | `LiqExtractosController@uploadOcasa` |
| POST   | `/liq/liquidaciones/{id}/generar`                                 | `LiqExtractosController@generarLiquidaciones` |
| POST   | `/liq/liquidaciones/{id}/procesar-cadena`                         | `LiqExtractosController@procesarCadena` |
| GET    | `/liq/liquidaciones/{id}/operaciones`                             | `LiqExtractosController@operaciones` |
| DELETE | `/liq/liquidaciones/{id}/operaciones`                             | `LiqExtractosController@destroyOperaciones` |
| GET    | `/liq/liquidaciones/{id}/auditoria`                               | `LiqExtractosController@auditoria` |
| GET    | `/liq/liquidaciones/{id}/distribuidores`                          | `LiqExtractosController@distribuidores` |
| PATCH  | `/liq/liquidaciones/{id}/estado`                                  | `LiqExtractosController@cambiarEstado` |
| GET    | `/liq/liquidaciones/{id}/archivos`                                | `LiqArchivoEntradaController@index` |
| GET    | `/liq/liquidaciones/{id}/peajes`                                  | `LiqExtractosController@peajes` |
| POST   | `/liq/liquidaciones/{id}/peajes/autorizar`                        | `LiqExtractosController@autorizarPeajes` |
| GET    | `/liq/liquidaciones/{id}/duplicados`                              | `LiqExtractosController@duplicados` |
| POST   | `/liq/liquidaciones/{id}/resolver-duplicados`                     | `LiqExtractosController@resolverDuplicados` |
| POST   | `/liq/liquidaciones/{id}/mapear-tarifa`                           | `LiqExtractosController@mapearTarifa` |
| POST   | `/liq/liquidaciones/{id}/asignar-distribuidor-masivo`             | `LiqExtractosController@asignarDistribuidorMasivo` |
| POST   | `/liq/liquidaciones/{id}/asignar-distribuidor-individual`         | `LiqExtractosController@asignarDistribuidorIndividual` |
| POST   | `/liq/liquidaciones/{id}/recalcular-totales-sucursal`             | `LiqExtractosController@recalcularTotalesSucursal` |
| POST   | `/liq/liquidaciones/{id}/regenerar-estado-cuenta`                 | `LiqExtractosController@regenerarEstadoCuenta` |
| GET    | `/liq/liquidaciones/{id}/reclamos-ocasa`                          | `LiqReclamosOcasaController@index` |
| POST   | `/liq/liquidaciones/{id}/reclamos-ocasa/detectar`                 | `LiqReclamosOcasaController@detectar` |

### 3.2 Liquidaciones de distribuidor

| Método | Path | Controller |
|--------|------|------------|
| GET    | `/liq/distribuidores/{persona}/liquidaciones`                                  | `LiqDistribuidorLiquidacionesController@index` |
| PUT    | `/liq/liquidaciones-distribuidor/{id}/editar`                                  | `LiqDistribuidorLiquidacionesController@editar` |
| POST   | `/liq/liquidaciones-distribuidor/{id}/documento`                               | `LiqDistribuidorDocumentoController@store` |
| GET    | `/liq/liquidaciones-distribuidor/{id}/pdf`                                     | `LiqDistribuidorDocumentoController@descargarPdf` |
| POST   | `/liq/liquidaciones-distribuidor/{id}/recalcular-eficiencia`                   | `LiqExtractosController@recalcularEficiencia` |
| POST   | `/liq/liquidaciones-distribuidor/{id}/preparar`                                | `LiqLiquidacionDistribuidorCicloController@preparar` |
| PATCH  | `/liq/liquidaciones-distribuidor/{id}/anular`                                  | `LiqLiquidacionDistribuidorCicloController@anularDistribuidor` |
| DELETE | `/liq/liquidaciones-distribuidor/{id}/soft`                                    | `LiqLiquidacionDistribuidorCicloController@destroyDistribuidor` |
| GET    | `/liq/liquidaciones-distribuidor/{id}/historial`                               | `LiqDistribuidorLiquidacionesController@historial` |

### 3.3 Pagos / órdenes de pago

| Método | Path | Controller |
|--------|------|------------|
| GET    | `/liq/pagos/conceptos`                                | `LiqPagosController@conceptos` |
| POST   | `/liq/pagos/conceptos`                                | `LiqPagosController@storeConcepto` |
| GET    | `/liq/pagos/liquidaciones`                            | `LiqPagosController@liquidaciones` |
| GET    | `/liq/pagos/liquidaciones-unificado`                  | `LiqPagosController@liquidacionesUnificado` |
| POST   | `/liq/pagos/preview`                                  | `LiqPagosController@preview` |
| POST   | `/liq/pagos/validar-beneficiarios`                    | `LiqPagosController@validarBeneficiarios` |
| GET    | `/liq/pagos/ordenes`                                  | `LiqPagosController@ordenes` |
| POST   | `/liq/pagos/ordenes`                                  | `LiqPagosController@storeOrden` |
| GET    | `/liq/pagos/ordenes/{ordenPago}`                      | `LiqPagosController@showOrden` |
| PATCH  | `/liq/pagos/ordenes/{ordenPago}/estado`               | `LiqPagosController@cambiarEstado` |
| POST   | `/liq/pagos/ordenes/{ordenPago}/ejecutar-pago`        | `LiqPagosController@ejecutarPago` |
| POST   | `/liq/pagos/ordenes/{ordenPago}/reintentar`           | `LiqPagosController@reintentar` |
| DELETE | `/liq/pagos/ordenes/{ordenPago}`                      | `LiqPagosController@destroyOrden` |
| GET    | `/liq/pagos/ordenes/{ordenPago}/pdf`                  | `LiqPagosController@descargarPdf` |
| GET/PUT| `/liq/pagos/config-banco`                             | `LiqPagosController@configBanco` / `@updateConfigBanco` |

### 3.4 OCASA / OCA

| Método | Path | Controller |
|--------|------|------------|
| GET    | `/liq/oca/{id}/resumen`                  | `LiqOcaController@resumen` |
| GET    | `/liq/oca/{id}/tarifas-detectadas`       | `LiqOcaController@tarifasDetectadas` |
| GET    | `/liq/oca/{id}/vinculaciones`            | `LiqOcaController@vinculaciones` |
| POST   | `/liq/oca/{id}/mapear-tarifa`            | `LiqOcaController@mapearTarifa` |
| POST   | `/liq/oca/{id}/generar-operaciones`      | `LiqOcaController@generarOperaciones` |
| POST   | `/liq/oca/{id}/reprocesar`               | `LiqOcaController@reprocesar` |
| POST   | `/liq/oca/{id}/operaciones-manuales`     | `LiqOcaController@cargarOperacionesManuales` |

### 3.5 Recibos (legacy)

| Método | Path | Controller |
|--------|------|------------|
| GET    | `/api/liquidaciones/recibos`                       | `LiquidacionReciboController@index` |
| POST   | `/api/liquidaciones/recibos`                       | `LiquidacionReciboController@store` |
| POST   | `/api/liquidaciones/recibos/{recibo}/anular`       | `LiquidacionReciboController@anular` |

### 3.6 Peajes (dashboard)

| Método | Path | Controller |
|--------|------|------------|
| GET    | `/liq/peajes/dashboard`         | `LiqExtractosController@dashboardPeajes` |
| GET    | `/liq/peajes/dashboard/export`  | `LiqExtractosController@exportDashboardPeajes` |

### 3.7 Configuración cliente / mapeos

| Método | Path | Controller |
|--------|------|------------|
| GET/POST | `/liq/clientes` y `/liq/clientes/{cliente}` | `LiqClienteController` |
| GET/POST/DELETE | `/liq/mapeos-sucursal-distribuidor` | `LiqExtractosController@*MapeoSucursalDistribuidor` |

---

## 4. Controllers y servicios

Todos en [back/app/Http/Controllers/Api/Liq/](back/app/Http/Controllers/Api/Liq/).

### 4.1 Controllers

- **`LiqExtractosController`** — orquestador. Carga de archivos, generación, auditoría, peajes, dashboards.
- **`LiqDistribuidorLiquidacionesController`** — vista por distribuidor (lo que se ve en `/liquidaciones`).
- **`LiqLiquidacionDistribuidorCicloController`** — ciclo de vida de una liq. distribuidor (preparar / anular / soft delete).
- **`LiqDistribuidorDocumentoController`** — adjuntar factura, descargar PDF.
- **`LiqPagosController`** — órdenes de pago + integración banco.
- **`LiqOcaController`** — pipeline OCASA (TMS/YCC/PDF).
- **`LiqReclamosOcasaController`** — detección y export de subpagos.
- **`LiqClienteController`** — configuración por cliente (tarifarios, dimensiones, gastos).
- **`LiqArchivoEntradaController`** — listado de archivos cargados.
- **`LiquidacionReciboController`** (fuera del namespace Liq) — recibos.

### 4.2 Servicios (`back/app/Services/Liq/`)

| Servicio                          | Para qué                                                                                              |
|-----------------------------------|--------------------------------------------------------------------------------------------------------|
| `LiqIngestService`                | Parsea Excel/PDF/OCASA → crea `LiqOperacion` con las columnas mapeadas según `liq_clientes.configuracion_excel`. |
| `OcasaPdfProcessor`               | Extrae texto de PDFs OCASA y parsea tablas con regex.                                                  |
| `OcasaExcelProcessor`             | Procesa el triple TMS / YCC / Excel cliente de OCASA.                                                  |
| `LiqCalculoOcasaService`          | Motor tarifario OCASA: costo_fijo, costo_km, costo_prod, costo_cant, eficiencia, paradas.              |
| `LiqDeteccionSubpagoService`      | Detecta operaciones donde `valor_cliente < valor_tarifa_distribuidor` → reclamos OCASA.                |
| `LiqEficienciaService`            | % eficiencia (paradas exitosas / paradas totales) por distribuidor.                                    |
| `LiqEstadoCuentaGeneratorService` | Construye filas de `liq_estado_cuenta_cliente` agrupando operaciones por sucursal/jurisdicción/quincena. |
| `LiqImportadorTarifasService`     | Importa Excel de tarifas (v5) → crea/actualiza `liq_lineas_tarifa`.                                    |
| `LiqDistribuidorPdfService`       | PDF de liquidación distribuidor.                                                                       |
| `OrdenPagoService`                | Crea órdenes de pago, valida beneficiarios, calcula descuentos.                                        |
| `OrdenPagoPdfService`             | PDF de la orden de pago.                                                                               |
| `BeneficiarioResolver`            | Resuelve CBU/CUIL del beneficiario real (distribuidor vs cobrador) para una liq. distribuidor.         |
| `Banco/BancoTransferenciaService` | Capa única de transferencias. Internamente despacha al adapter.                                        |
| `Banco/ICBCMultipayAdapter`       | Adapter ICBC Multipay (XML/CSV, login, envío, polling).                                                |
| `Banco/BancoStubAdapter`          | Stub para testing.                                                                                     |
| `LiqReclamosOcasaExportService`   | Excel de reclamos OCASA para enviar al cliente.                                                        |

---

## 5. Modelos y tablas

Todos en `back/app/Models/Liq/` (los nuevos) y `back/app/Models/` (los legacy como `LiquidacionRecibo`).

| Modelo                          | Tabla                                  | Relaciones principales                                                                 |
|---------------------------------|----------------------------------------|----------------------------------------------------------------------------------------|
| `LiqCliente`                    | `liq_clientes`                          | hasMany esquemas, mapeos, liquidaciones                                                |
| `LiqEsquemaTarifario`           | `liq_esquemas_tarifarios`               | belongsTo cliente; hasMany dimensiones, lineas                                          |
| `LiqDimensionValor`             | `liq_dimension_valores`                 | belongsTo esquema                                                                       |
| `LiqLineaTarifa`                | `liq_lineas_tarifa`                     | belongsTo esquema                                                                       |
| `LiqLiquidacionCliente`         | `liq_liquidaciones_cliente`             | belongsTo cliente, usuarioCarga; hasMany archivos, operaciones, liquidacionesDistribuidor |
| `LiqArchivoEntrada`             | `liq_archivos_entrada`                  | belongsTo liquidacionCliente; hasMany operaciones                                       |
| `LiqOperacion`                  | `liq_operaciones`                       | belongsTo liquidacionCliente, archivoEntrada, distribuidor (Persona), lineaTarifa       |
| `LiqOperacionDetalle`           | `liq_operaciones_detalle`               | belongsTo operacion                                                                     |
| `LiqLiquidacionDistribuidor`    | `liq_liquidaciones_distribuidor`        | belongsTo liquidacionCliente, distribuidor (Persona); hasOne ordenPagoDetalle           |
| `LiqLiquidacionSucursalTotales` | `liq_liquidacion_sucursal_totales`      | belongsTo liquidacionCliente (cache de totales por sucursal)                            |
| `LiqVinculacionOca`             | `liq_vinculaciones_oca`                 | belongsTo liquidacionCliente, persona                                                   |
| `LiqContratoOca`                | `liq_contratos_oca`                     | belongsTo cliente                                                                       |
| `LiqEstadoCuentaCliente`        | `liq_estado_cuenta_cliente`             | belongsTo cliente, liquidacionCliente                                                   |
| `LiqOrdenPago`                  | `liq_ordenes_pago`                      | belongsTo concepto; hasMany detalles, transferencias                                    |
| `LiqOrdenPagoDetalle`           | `liq_ordenes_pago_detalle`              | belongsTo ordenPago, liquidacionDistribuidor                                            |
| `LiqTransferenciaBanco`         | `liq_transferencias_banco`              | belongsTo ordenPago                                                                     |
| `LiqHistorialAuditoria`         | `liq_historial_auditoria`               | belongsTo liquidacionCliente, usuario                                                   |
| `LiqHistorialMovimiento`        | `liq_historial_movimientos`             | belongsTo liquidacionDistribuidor                                                       |
| `LiqTarifaPatente`              | `liq_tarifas_patente`                   | belongsTo cliente, distribuidor, proveedor                                              |
| `LiquidacionRecibo`             | `liquidacion_recibos`                   | belongsTo emisor, anulador (User)                                                       |

### Estados oficiales

```
LiqLiquidacionCliente.estado:
    pendiente → en_proceso → auditada → aprobada
                                       ↘ rechazada

LiqLiquidacionDistribuidor.estado:
    generada → preparada → aprobada → pagada
            ↘ anulada

LiqOrdenPago.estado:
    BORRADOR → PENDIENTE_PAGO → ENVIADA_BANCO → CONFIRMADA
                                              ↘ RECHAZADA
            → ANULADA (en cualquier momento)

LiquidacionRecibo.estado:
    emitido → anulado
```

---

## 6. Migraciones relevantes

Ordenadas por fecha (todas en [back/database/migrations/](back/database/migrations/)):

| Archivo | Cambio |
|---|---|
| `2026_03_13_120000_create_liquidacion_recibos_table.php` | Tabla de recibos legacy. |
| `2026_04_04_000000_create_liq_clientes_table.php` | Tabla maestra de clientes con `configuracion_excel` JSON. |
| `2026_04_04_000001_add_liq_config_to_clientes_table.php` | Flags OCASA en clientes. |
| `2026_04_04_000002_create_liq_esquemas_tarifarios_table.php` | Esquemas tarifarios por cliente. |
| `2026_04_04_000003_create_liq_dimension_valores_table.php` | Valores posibles de cada dimensión del esquema. |
| `2026_04_04_000004_create_liq_lineas_tarifa_table.php` | `precio_original`, `precio_distribuidor`. |
| `2026_04_04_000005_create_liq_auditoria_tarifa_table.php` | Audit log de cambios en tarifas. |
| `2026_04_04_000006_create_liq_mapeos_concepto_table.php` | Mapeo concepto cliente ↔ interno. |
| `2026_04_04_000007_create_liq_mapeos_sucursal_table.php` | Mapeo sucursales. |
| `2026_04_04_000008_create_liq_configuracion_gastos_table.php` | % gastos administrativos por cliente. |
| `2026_04_04_000009_create_liq_liquidaciones_cliente_table.php` | **Tabla central** de liquidaciones cliente. |
| `2026_04_04_000010_create_liq_archivos_entrada_table.php` | Archivos cargados, tipos: `DATA_CLIENTE`, `DETALLE_SUCURSAL`, `TARIFARIO`, `BASE_DISTRIB`, `VARIABLES`. |
| `2026_04_04_000011_create_liq_operaciones_table.php` | **Tabla más pesada.** Líneas + columnas OCASA (`costo_fijo`, `costo_km`, etc.). |
| `2026_04_04_000012_create_liq_liquidaciones_distribuidor_table.php` | Liquidación agrupada por distribuidor + eficiencia. |
| `2026_04_04_000013_add_dimensiones_to_liq_operaciones_table.php` | `dimensiones_valores` JSON en operaciones. |
| `2026_04_09_000001_create_liq_vinculaciones_oca_table.php` | Detección automática de distribuidor por patente / CUIL. |
| `2026_04_10_000002_create_liq_mapeos_distribuidor_table.php` | Mapeo distribuidor cliente → interno. |
| `2026_04_10_000003_create_liq_historial_movimientos_table.php` | Auditoría a nivel operación. |
| `2026_04_10_100002_create_liq_estado_cuenta_cliente_table.php` | Estado de cuenta cliente (gravado / no gravado / IVA). |
| `2026_04_12_000003_create_liq_ordenes_pago_table.php` | Órdenes de pago + columnas ICBC (`icbc_list_id`, `icbc_estado`). |
| `2026_04_12_000004_create_liq_ordenes_pago_detalle_table.php` | Detalle OP ↔ liquidación distribuidor. |
| `2026_04_12_000005_create_liq_transferencias_banco_table.php` | Eventos de transferencia banco. |
| `2026_04_12_000006_create_liq_config_banco_table.php` | Credenciales banco encriptadas + modo (test/prod). |
| `2026_04_17_000001_create_liq_contratos_oca_table.php` | Contratos OCASA por cliente. |
| `2026_04_18_000003_create_liq_liquidacion_sucursal_totales_table.php` | Cache de totales por sucursal (performance). |
| `2026_04_20_000003_add_preparada_and_soft_delete_to_liq_liquidaciones.php` | `preparada_at`, `preparada_por`, soft delete con motivo. |

---

## 7. Flujo end‑to‑end con `curl`-equivalentes

### 7.1 Crear liquidación cliente

```
POST /api/liq/liquidaciones
{
  "cliente_id": 12,
  "periodo_desde": "2026-04-01",
  "periodo_hasta": "2026-04-30",
  "ignorar_duplicados": false
}
```

- Rechaza con 409 si ya hay una liquidación vigente del mismo cliente/período (a menos que `ignorar_duplicados=true`).
- Devuelve `id` y estado `pendiente`.

### 7.2 Cargar extracto

```
POST /api/liq/liquidaciones/upload
multipart/form-data:
  liquidacion_cliente_id: 56
  tipo_archivo: DATA_CLIENTE      // o DETALLE_SUCURSAL, TARIFARIO, BASE_DISTRIB, VARIABLES
  archivo: <Excel|PDF>
```

- Para OCASA: `POST /api/liq/liquidaciones/upload-ocasa` (acepta TMS, YCC, PDF cliente).
- Crea fila en `liq_archivos_entrada`, guarda el binario en `storage/app/liq/{cliente_id}/archivos`.

### 7.3 Procesar la cadena

```
POST /api/liq/liquidaciones/56/procesar-cadena
```

Internamente:

1. `LiqIngestService::procesarArchivo()` para cada archivo cargado:
   - Lee el Excel/PDF.
   - Aplica el mapping definido en `liq_clientes.configuracion_excel`.
   - Resuelve la línea tarifaria contra el esquema activo.
   - Inserta filas en `liq_operaciones` con `valor_cliente`, `valor_tarifa_original`, `valor_tarifa_distribuidor`, `diferencia_cliente`.
2. Si el cliente es OCASA, `LiqCalculoOcasaService` recalcula el `valor_tarifa_distribuidor` con el motor de costos (fijo, km, prod, cant, eficiencia).
3. Agrupa operaciones por `distribuidor_id` y crea/actualiza `LiqLiquidacionDistribuidor` con `subtotal`, `gastos_administrativos` (% de `liq_configuracion_gastos`) y `total_a_pagar`.
4. La cabecera cliente queda en `estado='en_proceso'`.

### 7.4 Auditar

```
GET /api/liq/liquidaciones/56/auditoria
```

Devuelve:

```json
{
  "resumen": {
    "total_operaciones": 718,
    "estados": {...},
    "total_importe_cliente": 97558642.24,
    "total_importe_correcto": 97558642.24,
    "total_diferencia": 0.00
  },
  "diferencias": [ /* operaciones con valor_cliente != valor_tarifa */ ]
}
```

Pantalla relacionada: [LiquidacionesExtractosPage.tsx](front/src/pages/LiquidacionesExtractosPage.tsx) — permite mapear tarifa manualmente, reasignar distribuidor, autorizar peajes, resolver duplicados.

### 7.5 Cambiar estado

```
PATCH /api/liq/liquidaciones/56/estado
{ "estado": "auditada" }   // luego "aprobada" o "rechazada"
```

### 7.6 Preparar liquidación distribuidor + factura

```
POST /api/liq/liquidaciones-distribuidor/{id}/preparar
POST /api/liq/liquidaciones-distribuidor/{id}/documento   (sube factura)
```

### 7.7 Armar orden de pago

```
POST /api/liq/pagos/preview
{
  "liquidaciones_distribuidor_ids": [101, 102, 103],
  "concepto_id": 4
}
→ valida CBU/CUIL, calcula totales, devuelve previsualización

POST /api/liq/pagos/ordenes
{ ...mismos params + observaciones... }
→ crea LiqOrdenPago en estado BORRADOR
```

### 7.8 Ejecutar pago

```
PATCH /api/liq/pagos/ordenes/{id}/estado  { "estado": "PENDIENTE_PAGO" }
POST  /api/liq/pagos/ordenes/{id}/ejecutar-pago
```

`LiqPagosController::ejecutarPago` → `BancoTransferenciaService::enviarABanco($ordenPago)` → `ICBCMultipayAdapter`:

- Genera el archivo Multipay (CSV/XML según contrato).
- Loguea credenciales encriptadas desde `liq_config_banco`.
- Llama a la API de ICBC; persiste `icbc_list_id`, `icbc_estado`, `icbc_enviado_at`.
- Crea fila en `liq_transferencias_banco`.

### 7.9 Confirmación y cierre

- Polling/webhook actualiza `LiqTransferenciaBanco.estado=CONFIRMADA`.
- `LiqOrdenPago.estado=CONFIRMADA` → la liquidación distribuidor pasa a `pagada`.

---

## 8. Cómo se calculan los totales que ves en la grilla

(Columna “Total cliente / Operaciones / Diferencia” en `/liquidaciones/extractos`.)

```
total_operaciones      = COUNT(liq_operaciones WHERE liquidacion_cliente_id = X AND excluida = 0)
total_importe_cliente  = SUM(liq_operaciones.valor_cliente)
total_importe_correcto = SUM(liq_operaciones.valor_tarifa_distribuidor) + Σ gastos_administrativos
total_diferencia       = total_importe_cliente − total_importe_correcto
```

Por distribuidor (`liq_liquidaciones_distribuidor`):

```
subtotal               = SUM(operaciones.valor_tarifa_distribuidor)
gastos_administrativos = subtotal * pct          // pct viene de liq_configuracion_gastos
total_a_pagar          = subtotal + gastos_administrativos
eficiencia_pct         = paradas_exitosas / paradas_totales   // OCASA
```

---

## 9. Integraciones externas

| Integración | Para qué | Archivos |
|---|---|---|
| **ICBC Multipay** | Pagar OPs a distribuidores. | `Services/Liq/Banco/ICBCMultipayAdapter.php`, `BancoTransferenciaService.php` |
| **OCASA PDF / Excel** | Parsear extractos cliente OCASA. | `Services/Liq/OcasaPdfProcessor.php`, `OcasaExcelProcessor.php`, `LiqCalculoOcasaService.php` |
| **AFIP / facturación** | El sistema de facturación cargado fuera del módulo emite la factura; la liquidación distribuidor referencia ese comprobante para pasar a `aprobada`. | Ver doc `spec-backend-facturador-arca.md` |
| **Subpagos OCASA** | Detección y export Excel para reclamar al cliente. | `LiqDeteccionSubpagoService.php`, `LiqReclamosOcasaExportService.php` |

---

## 10. Tests

| Archivo | Cubre |
|---|---|
| [back/tests/Unit/LiqPlantillaImportBuilderTest.php](back/tests/Unit/LiqPlantillaImportBuilderTest.php) | Construcción de plantilla de importación. |
| [back/tests/Unit/LiqImportadorTarifasServiceTest.php](back/tests/Unit/LiqImportadorTarifasServiceTest.php) | Importación de tarifas. |
| [back/tests/Unit/LiqParseDecimalTest.php](back/tests/Unit/LiqParseDecimalTest.php) | Parsing seguro de decimales (coma vs punto, miles). |
| [back/tests/Feature/PersonalLiquidacionesEndpointTest.php](back/tests/Feature/PersonalLiquidacionesEndpointTest.php) | Endpoints legacy de personal (carga de documentos liquidaciones por persona). |
| [front/src/pages/LiquidacionesPage.test.tsx](front/src/pages/LiquidacionesPage.test.tsx) | Pantalla por distribuidor. |

**Gap conocido:** no hay tests E2E del pipeline `upload → generar → auditar → preparar → OP → ICBC`. Toda la lógica de `LiqExtractosController`, `LiqPagosController` y `ICBCMultipayAdapter` está sin cobertura automática.

---

## 11. Referencias cruzadas

Otros docs relacionados ya existentes en [docs/](docs/):

- [manual-liquidaciones-v2-extractos-y-tarifas.md](docs/manual-liquidaciones-v2-extractos-y-tarifas.md) — manual funcional v2.
- [manual-usuario-liquidaciones-v2.md](docs/manual-usuario-liquidaciones-v2.md) — guía de usuario final.
- [liquidaciones-modulo-infraestructura-2026-03-02.md](docs/liquidaciones-modulo-infraestructura-2026-03-02.md) — infra original (storage, jobs).
- [liquidacion-ocasa-2026-03-cierre-operativo.md](docs/liquidacion-ocasa-2026-03-cierre-operativo.md) — cierre OCASA marzo.
- [liquidaciones-estado-2026-04-26.md](docs/liquidaciones-estado-2026-04-26.md) — snapshot estado abril.
- [liquidaciones-mvp-gap.md](docs/liquidaciones-mvp-gap.md) — gaps respecto al MVP original.
- [ocasa-v3-fase-0-1-ejecucion.md](docs/ocasa-v3-fase-0-1-ejecucion.md), [ocasa-v3-fase-2-5-entrega.md](docs/ocasa-v3-fase-2-5-entrega.md) — fases OCASA v3.
- [powerbi-erp-liquidaciones-blueprint.md](docs/powerbi-erp-liquidaciones-blueprint.md) — modelo Power BI sobre estas tablas.
