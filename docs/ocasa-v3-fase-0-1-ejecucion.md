# OCASA v3 · Fase 0 + 1 — Ejecución en producción

**Fecha**: 2026-04-24
**Autor**: Francisco (validado local)
**Para**: Matías (ejecutar en prod `72.60.163.45`)

---

## Contenido entregado

| Archivo | Propósito |
|---|---|
| `back/database/migrations/2026_04_24_000001_ocasa_motor_v3_schema.php` | Migración Laravel · ALTER ops + CREATE contrato + CREATE reclamos + factor_distrib |
| `back/database/scripts/ocasa_v7/OCASA_v7_migracion.sql` | CREATE productividad + UPSERT materiales + 98 INSERTs ROS001/SUR001 |
| `back/database/scripts/ocasa_v7/OCASA_Tarifas_Contrato_Cliente.sql` | 93 INSERTs contrato (89 únicos + 4 duplicados upsertados) |

Los 2 SQLs del paquete original de Matías fueron **ajustados** para nuestra infra:
- Lookup de OCASA tolerante a `codigo_corto` / `nombre_corto` / `razon_social LIKE '%OCASA%'` (Matías asumía columna `codigo`)
- `ON DUPLICATE KEY UPDATE` agregado al INSERT del contrato para que sea idempotente (hay 4 filas duplicadas RIO CUARTO en el SQL original)

---

## Ejecución en prod (orden)

```bash
cd /var/www/personal/back
git pull
```

### 1. Migración schema (Fase 0)

```bash
php artisan migrate
```

Espera ver:
```
2026_04_24_000001_ocasa_motor_v3_schema ........... DONE
```

Agrega:
- `liq_operaciones.detalle_paradas` (JSON nullable) — para rama D del resolver
- `liq_operaciones.estado_calculo` (varchar 30, default 'ok') — 'sin_tarifa_definida' marca rama C
- `liq_operaciones.error_msg` (TEXT) — mensaje del motor
- `liq_operaciones.modo_pago` (varchar 30) — 'override_jornada' | 'factor_tms' | 'productividad_paradas'
- `liq_lineas_tarifa.factor_distrib` (decimal 5,4) — factor general rama B
- Tabla `liq_tarifas_contrato_cliente` (detección subpago OCASA)
- Tabla `liq_reclamos_ocasa` (flag de subpagos)

**No cambia el motor actual**. Las columnas quedan NULL y el resolver sigue funcionando con la lógica vieja. Fases 2-7 las consumen.

### 2. Cargar datos (Fase 1)

```bash
# SQL v7 (productividad + mapping materiales)
mysql -u <usuario> -p <base> < database/scripts/ocasa_v7/OCASA_v7_migracion.sql

# SQL contrato OCASA→LA (para detección subpago)
mysql -u <usuario> -p <base> < database/scripts/ocasa_v7/OCASA_Tarifas_Contrato_Cliente.sql
```

O si preferís verlo antes:

```bash
# Verificar cliente OCASA resolvable
php artisan tinker --execute='echo DB::selectOne("SELECT id, codigo_corto, nombre_corto, razon_social FROM liq_clientes WHERE codigo_corto=\"OCASA\" OR nombre_corto=\"OCASA\" OR razon_social LIKE \"%OCASA%\" ORDER BY id LIMIT 1")->id . PHP_EOL;'
# Debería devolver el cliente_id de OCASA (probablemente 3)
```

### 3. Verificar carga

```bash
php artisan tinker --execute='
$ocasa = DB::table("liq_clientes")->where("codigo_corto","OCASA")->orWhere("nombre_corto","OCASA")->orWhere("razon_social","like","%OCASA%")->value("id");
echo "OCASA cliente_id: $ocasa\n\n";

echo "=== Materiales ===\n";
foreach (DB::table("liq_material_mapeo")->where("cliente_id",$ocasa)->orderBy("codigo_ycc")->get(["codigo_ycc","material_tarifario"]) as $m) {
    echo "  $m->codigo_ycc → $m->material_tarifario\n";
}
echo "\n=== Tarifas contrato por sucursal ===\n";
foreach (DB::table("liq_tarifas_contrato_cliente")->where("cliente_id",$ocasa)->selectRaw("sucursal, COUNT(*) as n")->groupBy("sucursal")->orderBy("sucursal")->get() as $r) {
    echo "  $r->sucursal · $r->n conceptos\n";
}
$total = DB::table("liq_tarifas_contrato_cliente")->where("cliente_id",$ocasa)->count();
echo "  TOTAL: $total filas\n";

echo "\n=== Tarifas productividad ===\n";
foreach (DB::table("liq_tarifas_productividad_cliente")->where("cliente_id",$ocasa)->selectRaw("ruta, tipo, COUNT(*) as n")->groupBy("ruta","tipo")->orderBy("ruta")->get() as $r) {
    echo "  $r->ruta · $r->tipo · $r->n filas\n";
}
$total = DB::table("liq_tarifas_productividad_cliente")->where("cliente_id",$ocasa)->count();
echo "  TOTAL: $total filas\n";

echo "\n=== Schema nuevo en liq_operaciones ===\n";
foreach (["detalle_paradas","estado_calculo","error_msg","modo_pago"] as $c) {
    echo "  $c: " . (Schema::hasColumn("liq_operaciones",$c) ? "OK" : "FALTA") . "\n";
}

echo "\n=== Schema nuevo en liq_lineas_tarifa ===\n";
echo "  factor_distrib: " . (Schema::hasColumn("liq_lineas_tarifa","factor_distrib") ? "OK" : "FALTA") . "\n";
'
```

Esperado:

```
OCASA cliente_id: 3

=== Materiales ===
  BI → Salud
  BO → Clearing
  PA → Paquetería
  SO → Postal

=== Tarifas contrato por sucursal ===
  AZUL · 5 conceptos
  BAHIA BLANCA · 5 conceptos
  ... (15 sucursales aprox, 89 filas totales)

=== Tarifas productividad ===
  ROS001 · exitoso · 24 filas
  ROS001 · fallido · 24 filas
  SUR001 · exitoso · 25 filas
  SUR001 · fallido · 25 filas
  TOTAL: 98 filas

=== Schema nuevo en liq_operaciones ===
  detalle_paradas: OK
  estado_calculo: OK
  error_msg: OK
  modo_pago: OK

=== Schema nuevo en liq_lineas_tarifa ===
  factor_distrib: OK
```

---

## Notas

- Las **4 filas duplicadas de RIO CUARTO** en el SQL original hacen que se carguen 89 en vez de 93. La 2da copia sobreescribe la 1era vía `ON DUPLICATE KEY UPDATE` (mismo valor, no hay pérdida de data).
- El **cliente_id OCASA en prod** es 3 (no 7 como en mi local). El lookup tolerante funciona en ambos.
- **No se tocó el motor**. Los distribuidores siguen liquidándose como hasta ahora. La migración es seguro para mergear.

---

## Smoke test post-ejecución

Correr el recálculo existente para confirmar que **nada rompió**:

```bash
php artisan liq:recalcular --cliente=OCASA --periodo=2026-03 --dry-run
```

Debería seguir dando:
- Motor: 671 recalculadas, 0 sin tarifa
- Eficiencia: 671 ops con YCC cargado
- Estado cuenta: 17 filas

Si baja el número de matches o sube sin_tarifa, **parar y avisar**.

---

## Próximo paso (mañana)

Fase 2 · Resolver 4 ramas (A/B/C/D) en `LiqCalculoOcasaService::calcularOperacion()`:

| Rama | Condición | Fórmula |
|---|---|---|
| **A** override absoluto | tarifa tiene `costo_fijo_distrib` | `costo_fijo × fracción + factor_km × CostoKm_TMS` |
| **B** factor explícito | tarifa tiene `factor_distrib` | `factor × (CostoFijo_TMS + CostoKm_TMS)` |
| **D** productividad | tarifa matchea en `liq_tarifas_productividad_cliente` (fecha/ruta/cliente) | `Σ (tarifa_LA por parada YCC según material × zona × motivo)` |
| **C** error visible | ninguna matchea | `estado_calculo = 'sin_tarifa_definida'` |

Casos piloto que deben seguir dando OK post-fix:
- Walter PAL831 → rama A (override absoluto) · 100% eficiencia
- Ahuad AF594TR → rama B · dentro de tolerancia
- Benítez OMU364 → rama A · 100% eficiencia
- Turón/Palavecino/Quiña/Suárez (ROS001) → rama D · total $4.191.456,88

El derivador de concepto para BUG B (subpago OCASA) va en la misma PR de la Fase 2-3.
