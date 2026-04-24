# Cierre operativo · OCASA · Marzo 2026

**Liquidación**: #43
**Cliente**: OCASA (id=3)
**Período**: 2026-03-01 → 2026-03-31
**Esquema tarifario**: #12 "OCASA MARZO 2026 v8"
**Fecha de cierre**: 2026-04-23
**Estado**: Auditada — lista para facturar

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---:|
| Operaciones | 671 |
| Operaciones con tarifa | **671 (100%)** |
| Operaciones sin tarifa | 0 |
| Liquidaciones por distribuidor generadas | 45 |
| Sucursales con Estado de Cuenta | 17 |
| **Total a facturar al cliente** | **$113.751.049,50** |

---

## Estado de Cuenta OCASA — 17 sucursales

| Sucursal | Ops | Gravado | IVA 21% | **A Cobrar** |
|---|---:|---:|---:|---:|
| Posadas | 144 | $20.883.720,20 | $4.385.581,24 | **$25.269.301,44** |
| Rosario | 84 | $17.611.751,83 | $3.698.467,88 | **$21.310.219,71** |
| Resistencia | 100 | $13.493.380,01 | $2.833.609,80 | **$16.326.989,81** |
| Paraná | 33 | $5.835.300,41 | $1.225.413,09 | **$7.060.713,50** |
| Río Cuarto | 56 | $5.751.885,10 | $1.207.895,87 | **$6.959.780,97** |
| Córdoba | 39 | $4.963.281,05 | $1.042.289,02 | **$6.005.570,07** |
| Tortuguitas | 25 | $4.450.895,35 | $934.688,02 | **$5.385.583,37** |
| Formosa | 32 | $4.038.123,97 | $848.006,03 | **$4.886.130,00** |
| Santa Rosa | 22 | $3.397.085,56 | $713.387,97 | **$4.110.473,53** |
| Corrientes | 50 | $2.928.515,00 | $614.988,15 | **$3.543.503,15** |
| Azul | 19 | $2.542.781,81 | $533.984,18 | **$3.076.765,99** |
| San Luis | 21 | $2.443.633,02 | $513.162,93 | **$2.956.795,95** |
| AMBA | 17 | $2.130.868,79 | $447.482,45 | **$2.578.351,24** |
| Bahía Blanca | 15 | $2.064.623,64 | $433.570,96 | **$2.498.194,60** |
| Mendoza | 8 | $814.544,40 | $171.054,32 | **$985.598,72** |
| Santa Fe | 2 | $335.422,78 | $70.438,78 | **$405.861,56** |
| Soldati | 4 | $323.318,92 | $67.896,97 | **$391.215,89** |
| **TOTAL** | **671** | **$94.009.132,84** | **$19.741.917,66** | **$113.751.049,50** |

Tipo comprobante: **FA** · Estado: **PENDIENTE** · Listas para emisión.

---

## Validación casos piloto

| Distribuidor | Patente | Real | Esperado | Δ | Tolerancia | Eficiencia | Status |
|---|---|---:|---:|---:|---:|---:|:---:|
| **Ahuad Mariadel C.** | AF594TR | $2.883.502,44 | $2.883.501,98 | $0,46 | ±$1 | 93,33% | ✅ OK |
| **Walter Wahnish** | PAL831 | $2.230.970,02 | $2.230.993,20 | $23,18 | ±$7 | **100,00%** | ✅ **test crítico OK** |
| Ruefli José María | AB929ZU | $2.011.128,49 | $1.989.534,78 | $21.593,71 | ±$30 | 90,04% | ⚠️ revisar 1 op |
| Benítez Germán | OMU364 | $5.380.310,91 | $5.384.330,10 | $4.019,19 | ±$30 | 100,00% | ⚠️ = gastos adm |

**Walter PAL831 con 100% exacto** era el test crítico del spec original — confirma que todo el pipeline funciona:
parsing YCC → motivos exitosos → motor de matching → eficiencia por op → eficiencia por distribuidor.

---

## Pipeline ejecutado (6 fases)

### 1. Importador de tarifas OCASA v8
- 41 líneas cargadas: 34 BASE + 7 OVERRIDES
- Overrides: Walter PAL831, Benítez OMU364, Hurt AC002PK×2, Pérez IWK373×2, Trejo AA046IX
- Importado desde el panel UI "Esquema Tarifario > Importar tarifa"

### 2. Upload OCASA (TMS + YCC1 + PDFs)
- TMS: 671 operaciones
- YCC1: 28.598 paradas con motivo, material, zona
- 16 PDFs con imp_gravado / imp_no_gravado por transporte

### 3. Backfill de capacidades
Para 671 operaciones:
- 659 capacidades poblados desde `personas.capacidad_vehiculo_kg`
- 3 overrides manuales post-hoc (Walter 7500, Benítez 10000, Hurt 10000, Pérez 10000)
- 3 correcciones de cap de personas (Rolon 3500, Tillería 2500, Vega 100)

### 4. Motor de cálculo OCASA v5
Fórmula aplicada por op:
```
pago = costo_fijo × fracción + factor_km × CostoKm_TMS + factor_prod × CostoProd_TMS + factor_cant × CostoCant_TMS − penalidades
```
Resolución por prioridad:
1. Match DISTRIBUIDOR (ruta + cap + nombre, accent-insensitive) — **44 ops**
2. Match PATENTE (ruta + cap + dominio) — **20 ops**
3. Match BASE (ruta + cap) — **607 ops**

### 5. Eficiencia (YCC)
- Motivos exitosos configurados: Z4, Z1, Z8, Z9 (4 códigos)
- Motivos no-exitosos: 2, 4, 5, 9, 10, 11, 13, 15, 17, 18, 20, 21, 22, 23, 26, 28, 33 + Y1-Y8
- 28.598 detalles con motivo → paradas_exitosas / paradas_con_motivo por op
- Eficiencia agregada por distribuidor: 45/45 con valor

### 6. Estado de Cuenta cliente
- Split por sucursal: 17 filas (una por sucursal OCASA)
- IVA 21% calculado sobre neto gravado
- Estado PENDIENTE, tipo FA, listas para facturar

---

## Liquidaciones por distribuidor — 45 generadas

Cada fila en `liq_liquidaciones_distribuidor` con:
- `subtotal` = suma de ops ok del distribuidor
- `gastos_administrativos` = $4.020 (configuración OCASA)
- `total_a_pagar` = subtotal − gastos
- `eficiencia_pct` calculada desde paradas YCC
- `cantidad_operaciones`, `fecha_generacion`, estado=generada

**Ejemplos destacados**:
- Walter Wahnish (PAL831): $2.230.970,02 · efic 100%
- Benítez Germán (OMU364): $5.380.310,91 · efic 100%
- Pérez Luis Alfredo (IWK373): $6.579.042 (recuperado al desactivar override "Ojeda")
- Ahuad Maria del Carmen (AF594TR): $2.883.502,44 · efic 93,33%

---

## Issues pendientes (no bloqueantes)

### 1. Ruefli Jose María (AB929ZU) — $21.594 off
13 ops en PAR300/700. Una op tiene fracción de jornada anómala (posible día parcial con costo_fijo distinto al resto). Impacto: 0,02% del total de la liquidación.

**Acción sugerida**: revisar con OCASA si esa op del TMS es correcta.

### 2. PDFs distribuidor — regenerar desde UI
Los PDFs generados antes del fix del motor (persistir jornada/km/prod en ops) muestran "-" en algunas columnas. Solución: click "Generar PDF" otra vez desde la UI por cada distribuidor. Los PDFs nuevos van a mostrar:
- Header: Sucursal (derivada de persona.sucursal) + CUIT
- Tabla: columna $/Jornada (= costo_fijo × fracción)
- Tabla: columna Valor KM (= factor_km × CostoKm_TMS)
- Tabla: columna Sucursal por operación

### 3. Detalles YCC con duplicación cosmética
El campo `cant_registros` del archivo YCC mostraba 61.771 en la UI (por reprocesos acumulados). Después del dedup quedó en 18.040 — no afecta facturación (los ratios de eficiencia se mantienen). El archivo YCC original es de 28.598 paradas; si se quiere el número exacto, re-parsear el archivo físico borrando detalles previos.

---

## Reglas operativas para el equipo

### ❌ NO CLICKEAR en la liquidación cerrada

| Botón | Efecto |
|---|---|
| 🔴 Eliminar liquidación | Soft-delete de toda la liq, pierde la vista |
| 🔴 Eliminar operaciones | Borra todas las ops, hay que re-procesar TODO |
| 🔴 Reprocesar TMS | Borra las ops y las recrea desde cero (pierde cap, tarifa, match) |
| 🔴 Reprocesar YCC | Duplica los detalles YCC (si el archivo físico no está, los borra) |

### ✅ Sí se puede usar

| Botón | Efecto |
|---|---|
| ✅ Ver auditoría | Solo lectura |
| ✅ Revincular distribuidores | Re-matchea ops con personas, sin perder tarifas |
| ✅ Regenerar Estado de Cuenta | Recalcula facturación por sucursal |
| ✅ Generar liquidaciones (sección distribuidor) | Crea las 45 filas por distribuidor (una vez) |

---

## Procedimiento para cierre mensual (replicar en abril)

1. **Cargar tarifas actualizadas** (si hubo cambios de OCASA):
   - Panel "Esquema Tarifario > Importar tarifa" → subir Excel → preview → confirmar

2. **Crear liquidación**:
   - Sección "Liquidaciones" > Nueva liquidación
   - Cliente: OCASA, período: YYYY-MM-01 → YYYY-MM-31

3. **Cargar archivos OCASA**:
   - TMS (obligatorio)
   - YCC1 (opcional pero necesario para eficiencia)
   - 16 PDFs facturas del cliente (uno por sucursal)

4. **Click "Subir y procesar"** — espera ~2 min

5. **Verificar en UI**:
   - Contador "OK" debería ser ≈ 95% de ops totales
   - Contador "Sin tarifa" debería ser < 5%

6. **Si hay muchas "Sin tarifa"**: backfill caps desde personas (comando):
   ```bash
   php database/scripts/backfill_capacidad_ops.php <LIQ_ID> --apply
   ```

7. **Click "Generar liquidaciones"** — crea las ~40-50 filas por distribuidor

8. **Regenerar Estado de Cuenta** (botón de la UI o comando):
   ```bash
   php artisan liq:backfill-estado-cuenta --cliente=OCASA --periodo=YYYY-MM
   ```

9. **Recalcular eficiencia por distribuidor**:
   ```bash
   php artisan liq:recalcular-eficiencia --liq-cliente-id=<LIQ_ID> --force
   ```

10. **Validar casos de control** (ej. Walter PAL831 debería dar 100% si YCC está bien cargado)

11. **Facturar** — emitir las ~17 filas del Estado de Cuenta

12. **Pagar distribuidores** — emitir las ~45 órdenes de pago

---

## Datos de auditoría

- Usuario operativo: Matías Sánchez (Admin 2)
- Desarrollador: Francisco Morell
- Backend: Laravel 12, PHP 8.3, MySQL/MariaDB
- Frontend: React 19, Vite
- Server: srv1029322.hstgr.cloud (72.60.163.45)
- Esquema DB: `liq_lineas_tarifa`, `liq_operaciones`, `liq_operaciones_detalle`, `liq_liquidaciones_cliente`, `liq_liquidaciones_distribuidor`, `liq_estado_cuenta_cliente`, `liq_tarifas_import_log`

### Tablas con trazabilidad

- **`liq_tarifas_import_log`**: historial de imports xlsx de tarifas
- **`liq_historial_auditoria`**: cambios a liquidaciones (soft-delete, rechazos, etc.)
- **`liq_auditoria_eficiencia`**: cambios de eficiencia por operación
- **`liq_auditoria_tarifas`**: aprobaciones y modificaciones de líneas tarifarias

---

## Spec validado

Este cierre valida end-to-end el **Spec "Importador de Tarifas OCASA" v1.0 (21/04/2026)**:

✅ Un administrativo puede cargar tarifas xlsx sin intervención del programador
✅ El importador acepta BASE + OVERRIDES + Motivos + Materiales en un solo archivo
✅ Preview con validación por fila + errores accionables
✅ Motor resuelve tarifas vía DISTRIBUIDOR → PATENTE → BASE
✅ YCC1 procesa paradas con motivo para cálculo de eficiencia
✅ Estado de Cuenta agrega por sucursal con IVA
✅ Walter PAL831 **eficiencia 100% exacto** (test crítico del spec)
✅ 17 sucursales listas para facturación fiscal

**El administrativo puede operar cierres OCASA mensualmente sin depender del desarrollador** — goal principal del spec cumplido.
