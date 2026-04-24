# OCASA v3 · Fases 2-5 — Entrega

**Fecha**: 2026-04-24
**Autor**: Francisco
**Para**: Matías

---

## Qué se entrega

| Fase | Archivos tocados | Estado |
|---|---|---|
| **2** | `app/Services/Liq/LiqCalculoOcasaService.php`, `app/Models/LiqOperacion.php` | ✅ resolver 4 ramas A/B/C/D |
| **3** | `app/Services/Liq/LiqDeteccionSubpagoService.php`, `app/Console/Commands/DetectarReclamosOcasa.php` | ✅ detección subpago + comando |
| **4** | `app/Services/Liq/LiqDistribuidorPdfService.php`, `resources/views/liq/liquidacion_distribuidor_ocasa.blade.php` | ✅ PDF con desglose productividad |
| **5** | `app/Http/Controllers/Api/Liq/LiqReclamosOcasaController.php`, `front/src/features/liquidaciones/ReclamosOcasaPanel.tsx`, `front/src/pages/LiquidacionesExtractosPage.tsx` | ✅ endpoints + UI |

Preview PDF productividad de muestra: `Descargas/preview_productividad_turon.pdf` (186 KB). **Abrilo antes de mergear Fase 4** y confirmame si el layout te cierra antes que los distribuidores lo reciban.

---

## Fase 2 · Motor refactor (4 ramas)

### Algoritmo nuevo

```
calcularOperacion(op, esquema):
  1) ¿Existe tarifa en liq_tarifas_productividad_cliente para cliente+ruta+fecha?
     → RAMA D · suma paradas YCC por material×zona×estado
  2) ¿Hay línea en liq_lineas_tarifa matcheando DISTRIBUIDOR?
     → RAMA A (costo_fijo_base) o RAMA B (factor_distrib)
  3) ¿Match por PATENTE?
     → RAMA A o B
  4) ¿Match BASE por ruta+cap?
     → RAMA A o B
  5) Nada → RAMA C (estado_calculo='sin_tarifa_definida')
```

### Campos persistidos por op (nuevos)

| Campo | Tipo | Valor |
|---|---|---|
| `modo_pago` | varchar(30) | `override_jornada` / `factor_tms` / `productividad_paradas` |
| `estado_calculo` | varchar(30) | `ok` / `sin_tarifa_definida` |
| `error_msg` | text | mensaje cuando estado != ok |
| `detalle_paradas` | json | array de paradas agrupadas (solo rama D) |

### Regresión esperada

Los casos piloto ya validados siguen funcionando (**rama A** con override absoluto):

| Distribuidor | Rama esperada | Importe (igual que hoy) |
|---|---|---:|
| Walter PAL831 | A (override absoluto costo_fijo_base=172087.60) | $2.230.970,02 · ef 100% |
| Ahuad AF594TR | A (BASE costo_fijo_base) | $2.883.502,44 · ef 93,33% |
| Benítez OMU364 | A (override absoluto costo_fijo_base=263582.41) | $5.380.310,91 · ef 100% |

Los 4 distribuidores ROS001 (Turón, Palavecino, Quiña, Suárez) ahora matchearán por **rama D**:

| Distribuidor | Paradas | Esperado |
|---|---:|---:|
| Palavecino | 713 | $1.818.718,96 |
| Quiña | 493 | $966.293,79 |
| Turón | 638 | $1.013.662,55 |
| Suárez | 237 | $392.781,58 |
| **TOTAL ROS001** | **2.081** | **$4.191.456,88** |

---

## Fase 3 · Detección subpago OCASA (BUG B)

### Comando artisan

```bash
# Por liquidación específica
php artisan liq:detectar-reclamos-ocasa --liq-cliente-id=43

# Por cliente+período (procesa todas las liqs del mes)
php artisan liq:detectar-reclamos-ocasa --cliente=OCASA --periodo=2026-03

# Con tolerancia ajustada (default 5%)
php artisan liq:detectar-reclamos-ocasa --liq-cliente-id=43 --tolerancia=0.10
```

### Derivador de concepto

Implementado en `LiqDeteccionSubpagoService::derivarConcepto()` según RESPUESTAS pregunta 5:

| Prioridad | Condición | Concepto |
|---|---|---|
| 1 | `idtrack_tms ∈ {2,3}` | `2da_3ra_vuelta` |
| 2 | `cap ≤ 150` o denominación contiene "moto" | `motos` |
| 3 | `cap ≥ 1500` | `jornada_{cap}` |
| 4 | `cap < 1500`, distancia ≤ 120 | `hasta_120` |
| 5 | distancia ≤ 240 | `121_240` |
| 6 | otro | `mas_240` |

### Idempotencia

Re-correr el comando **borra los reclamos previos** de esa liquidación y los recrea. Seguro para ajustar tolerancia y re-detectar.

### Expected output Tortuguitas mar-26

```
Reclamos creados: ~22 ± algunos según tolerancia
Total subpago:   $~1.36M
Por sucursal:
  TORTUGUITAS · 22 ops · $1.361.632 aprox
```

Cuando lo corras, **pasame el listado completo** (output del comando incluye tabla). Si te da 18 o 25 ops en vez de 22, afinamos tolerancia.

---

## Fase 4 · PDF productividad

### Cambios en layout (ver `Descargas/preview_productividad_turon.pdf`)

1. **Columna nueva "Modalidad"** en tabla de ops: muestra `Jornada` / `Jornada+KM` / `Productividad` en color (violeta para productividad).
2. **Columna "Paradas"** (reemplaza "Fracc" cuando es productividad)
3. **Sub-filas de desglose** bajo cada op productividad:
   - Una fila por combinación `material × zona × estado`
   - Color violeta claro para diferenciar del dato principal
   - Campos: cantidad paradas, tarifa unitaria LA, subtotal
4. **Sección "Resumen mensual de paradas"** al pie del PDF (solo aparece si hay ops productividad)
   - Agrupa todas las paradas del mes por material×zona×estado
   - Total mensual de paradas + importe

### Pendiente revisar antes de mergear

- Layout general (ancho de columnas, legibilidad del desglose)
- Color violeta ¿está bien contrastado o muy claro?
- ¿Querés mostrar bultos o solo cantidad de paradas?
- ¿El "Entregado OK / No entregado/VNE" es el texto que usa OCASA o hay terminología interna distinta?

---

## Fase 5 · UI reclamos OCASA

### Botón "Reclamos OCASA"

Agregado al header de la liquidación junto a "Regenerar Estado de Cuenta". Al clickear:
1. Confirma la acción (explica que borra reclamos previos)
2. Corre `POST /liquidaciones/{id}/reclamos-ocasa/detectar` con tolerancia 0.05
3. Dispara recarga del panel

### Panel `ReclamosOcasaPanel`

Se renderiza al pie de la vista de liquidación (después de "Liquidaciones por distribuidor"):

- **4 tiles** de totales: cantidad, subpago, sobrepago, neto reclamable
- **Sección colapsable "Agrupado por sucursal"** — tabla con ops y diferencia por sucursal
- **Tabla de reclamos individuales** con columnas: op, sucursal, patente, distribuidor, ruta, concepto_contrato, TMS, contrato, Δ, estado, acciones
- **Botones por fila**: según estado
  - `pendiente_reclamo` → [Reclamar]
  - `reclamado` → [Ajustado] / [Cerrar]

### Endpoints

```
GET    /api/liq/liquidaciones/{liq}/reclamos-ocasa      — listar + totales + por sucursal
POST   /api/liq/liquidaciones/{liq}/reclamos-ocasa/detectar  — correr detección (body: {tolerancia: 0.05})
PATCH  /api/liq/reclamos-ocasa/{id}/estado              — cambiar estado (body: {estado, resolucion?})
```

---

## Plan de ejecución en prod

### 1. Deploy del código (4 fases en 1 commit)

```bash
cd /var/www/personal
git pull
```

No hay migración nueva — las tablas y columnas ya se crearon en Fase 0.

### 2. Smoke de regresión ANTES de cualquier otra acción

```bash
cd back
php artisan liq:recalcular --cliente=OCASA --periodo=2026-03 --dry-run | head -10
```

Esperado (igual que hoy):
```
Liquidaciones cliente: 1  |  Operaciones: 671
Motor cálculo:
  ops recalculadas: 671  |  sin tarifa: 0
  matches: DISTRIBUIDOR=44  PATENTE=20  BASE=607  sin_match=0
```

**Si falla, NO avanzar** — reportame y reviso.

### 3. Aplicar motor nuevo (Fase 2)

```bash
php artisan liq:recalcular --cliente=OCASA --periodo=2026-03
```

Esperado: mismos matches + Turón/Palavecino/Quiña/Suárez matchean por **PRODUCTIVIDAD** (cambia `modo_pago='productividad_paradas'` y persiste `detalle_paradas`).

Smoke test Walter/Ahuad/Benítez **debe seguir dando los mismos importes**.

### 4. Re-generar liquidaciones distribuidor

```bash
php artisan tinker --execute='
DB::table("liq_liquidaciones_distribuidor")->where("liquidacion_cliente_id",43)->delete();
$liq = App\Models\LiqLiquidacionCliente::find(43);
$req = new Illuminate\Http\Request(); $req->merge(["confirmar_sin_autorizar"=>true]);
$r = app(App\Http\Controllers\Api\Liq\LiqExtractosController::class)->generarLiquidaciones($req, $liq);
echo $r->getContent() . "\n";
'
```

Y validar los 4 casos ROS001 suman $4.191.456,88.

### 5. Detectar subpagos OCASA (Fase 3)

```bash
php artisan liq:detectar-reclamos-ocasa --liq-cliente-id=43
```

Pegame el output. Expected ~22 ops Tortuguitas con $1.36M.

### 6. Regenerar PDFs distribuidor (Fase 4)

Desde la UI, click "Generar PDF" para los 4 distribuidores ROS001. Abrí uno (ej Turón) y confirmá que aparece:
- Columna "Modalidad" = Productividad
- Desglose expandido con paradas agrupadas
- Sección "Resumen mensual de paradas" al pie

### 7. Probar UI reclamos (Fase 5)

En el navegador, liq #43 → click "Reclamos OCASA" del header → verifica que el panel al pie muestra los reclamos detectados.

---

## Criterios de merge

Bloqueantes:
- [ ] Smoke de regresión post-deploy da 671/0
- [ ] Walter PAL831 sigue dando $2.230.970,02 ± $7 con ef 100%
- [ ] Ahuad AF594TR dentro de tolerancia
- [ ] Benítez OMU364 dentro de tolerancia
- [ ] Turón 638 paradas en PDF preview (**vos validás layout**)
- [ ] 4 ROS001 suman $4.191.456,88
- [ ] Detección Tortuguitas da ~22 ops (± razonable)

No bloqueantes (ajuste post-merge):
- Layout final del PDF (colores, textos "Entregado OK / No entregado")
- Rutas productividad adicionales si aparecen (Ruefli/Lescano Resistencia)

---

## Pendientes para Fase 6-7 (mañana si se hace tarde)

- Importador v7 UI: agregar hoja "Tarifas_Productividad" al parser (Camino A) — alternativa al SQL de Matías
- Smoke tests automatizados: PHPUnit contra los 4 casos piloto + ROS001 total

Si llegamos hasta acá **hoy**, el ciclo OCASA mar-26 queda cerrable completo este fin de semana.
