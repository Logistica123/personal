# ADDENDUM 5 — Matching contra TODOS los estados de personas

> Versión: 1.0 · Fecha: 05-may-2026
> Para: IA de Francisco · De: Matías
> Tipo: bugfix de matching. Se descubrió al probar el parser de La Segunda en producción.

---

## TL;DR

El servicio de matching está filtrando solo distribuidores **activos y aprobados**. Personas que están en **baja**, **suspendidas**, en **solicitud/aprobación pendiente** no aparecen como match → quedan como "asegurados sin persona en sistema" cuando en realidad SÍ existen en `personas`, solo en otro estado.

Hay que matchear contra **toda la tabla `personas`** sin filtrar por estado, y enriquecer el reporte con el estado actual de la persona.

### Caso real reproducido (smoke test exacto)

Al cargar el PDF de La Segunda Autos en producción:

- **Patente: OPT548** (fila 22 del wizard de carga)
- **Resultado actual:** `sin match` → propuesta "Crear sin persona" / "Ignorar"
- **Realidad:** existe en `personas` como Eduardo Matias Intile · CUIL 23310145599 · sucursal La Plata · estado **Suspendido** · cliente OCA · patente OPT548
- **Lo que debería pasar:** matchear con persona #698 (o el ID real) y aparecer en categoría D2 "persona suspendida en póliza activa", con acción rápida "Pedir baja en póliza" y/o "Reactivar persona".

Otras patentes que aparecen como "sin match" en la misma corrida y probablemente son el mismo bug (verificar): JSZ153, AB457NV, AA365MN, AA516HI, AF908CQ.

---

## 1. Diagnóstico

### Lo que está pasando

Probablemente el `MatchingService` arranca con algo como:

```php
$personas = Persona::where('estado_id', $estado_activo->id)
                   ->where('aprobado', true)
                   ->whereNull('fecha_baja')
                   ->get();

foreach ($asegurados_pdf as $a) {
    $match = $personas->where('cuil', $a->cuil)->first();
    // ...
}
```

Resultado: persona con CUIL match pero estado distinto a "Activo" → no aparece, queda como `null` y el asegurado se reporta como "fantasma".

### Los 4 estados que se están perdiendo

| Estado / situación | Filtro que lo excluye | Ejemplo |
|---|---|---|
| Baja | `fecha_baja IS NULL` o `estado_id = baja` | Distribuidor dado de baja hace meses sigue figurando en la póliza |
| Suspendido | `estado_id = suspendido` | Distribuidor suspendido temporalmente |
| Solicitud pendiente | `es_solicitud = true` o `aprobado = false` | Solicitud cargada pero aún sin aprobar |
| No aprobado | `aprobado = false` | Persona creada manualmente sin aprobación |

---

## 2. Fix — `MatchingService` debe buscar en todas las personas

```php
// ANTES (mal):
$personas = Persona::where('estado_id', $activo_id)
                   ->where('aprobado', true)
                   ->whereNull('fecha_baja')
                   ->get();

// DESPUÉS (bien):
$personas = Persona::all();   // sin filtros — incluye todos los estados
```

Para vehículos, lo mismo en `persona_patentes`:

```php
// El JOIN con personas debe incluir TODOS los estados
$resultado = DB::table('persona_patentes')
    ->join('personas', 'persona_patentes.persona_id', '=', 'personas.id')
    ->where('persona_patentes.patente', $patente)
    ->select('persona_patentes.*', 'personas.*')
    ->first();
// Sin filtros adicionales por estado
```

---

## 3. Enriquecer el resultado del matching con el estado

Agregar al objeto retornado por el matching info del estado actual de la persona:

```json
{
  "asegurado_id": 100,
  "identificador": "IWK373",
  "nombre_apellido_pdf": "ATEGO 1418-48",
  "match_persona": {
    "id": 42,
    "nombre_completo": "OJEDA ALFREDO",
    "cuil": "20-31675826-7",
    "estado": "Baja",
    "fecha_baja": "2026-02-15",
    "es_solicitud": false,
    "aprobado": true,
    "alerta_estado": "persona_baja_en_poliza_activa"
  },
  "match_score": 1.000,
  "match_metodo": "patente_exacto"
}
```

### Tipos de alerta de estado

```php
function calcular_alerta_estado($persona, $asegurado) {
    if ($persona->fecha_baja && $asegurado->estado == 'activo') {
        return 'persona_baja_en_poliza_activa';
    }
    if ($persona->estado_id == ESTADO_SUSPENDIDO && $asegurado->estado == 'activo') {
        return 'persona_suspendida_en_poliza_activa';
    }
    if ($persona->es_solicitud && $asegurado->estado == 'activo') {
        return 'persona_solicitud_pendiente_en_poliza_activa';
    }
    if (!$persona->aprobado && $asegurado->estado == 'activo') {
        return 'persona_sin_aprobar_en_poliza_activa';
    }
    return null; // todo OK, persona y póliza coinciden
}
```

---

## 4. Cambio en el reporte de discrepancias

El reporte original tenía 3 categorías. Ahora se suma una 4ta:

### Antes

```
A) Asegurados sin persona en sistema (fantasmas)
B) Personas activas sin póliza (sin cobertura)
C) Match dudoso (fuzzy < 0.95)
```

### Después

```
A) Asegurados sin persona en sistema (fantasmas)
B) Personas activas sin póliza (sin cobertura)
C) Match dudoso (fuzzy < 0.95)
D) Estado inconsistente (NUEVO):
   D1) Persona en baja pero asegurado activo en póliza
   D2) Persona suspendida pero asegurado activo en póliza
   D3) Persona en solicitud pendiente pero asegurado activo en póliza
   D4) Persona sin aprobar pero asegurado activo en póliza
```

### Endpoint actualizado

```
GET /api/polizas/{id}/discrepancias

Response:
{
  "asegurados_sin_persona": [...],
  "personas_sin_poliza": [...],
  "match_dudoso": [...],
  "estado_inconsistente": {
    "persona_baja_en_poliza_activa": [...],
    "persona_suspendida_en_poliza_activa": [...],
    "persona_solicitud_pendiente_en_poliza_activa": [...],
    "persona_sin_aprobar_en_poliza_activa": [...]
  }
}
```

---

## 5. UI — Nuevo sub-tab en Discrepancias

Agregar al tab "Discrepancias" un cuarto bloque:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ D. Estado inconsistente — persona y póliza no coinciden                  │
│                                                                          │
│ ⚠ Persona en BAJA pero asegurado activo en póliza (3)                    │
│   ┌────────────────────────────────────────────────────────────────────┐│
│   │ IWK373 → OJEDA ALFREDO (baja desde 15/02/2026)                     ││
│   │   [Pedir baja en póliza] [Ver perfil]                              ││
│   │ AB393MN → PEREZ JUAN (baja desde 22/03/2026)                       ││
│   │   [Pedir baja en póliza] [Ver perfil]                              ││
│   │ ...                                                                ││
│   └────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ ⚠ Persona SUSPENDIDA pero asegurada (1)                                  │
│ ⚠ Persona en SOLICITUD pero asegurada (0)                                │
│ ⚠ Persona SIN APROBAR pero asegurada (0)                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Acción rápida más útil:** "Pedir baja en póliza" — porque casi siempre lo que querés cuando una persona está en baja interna pero sigue en la póliza es **que la aseguradora la dé de baja** y dejes de pagar el seguro de alguien que no opera.

---

## 6. Modelo de datos — guardar estado en `polizas_asegurados`

Para no recalcular cada vez, persistir el estado al momento del match:

```sql
ALTER TABLE polizas_asegurados
  ADD COLUMN persona_estado_al_matchear VARCHAR(50) NULL AFTER match_metodo,
  ADD COLUMN persona_alerta_estado VARCHAR(80) NULL AFTER persona_estado_al_matchear;
```

Valores posibles de `persona_alerta_estado`:
- `null` (todo OK)
- `persona_baja_en_poliza_activa`
- `persona_suspendida_en_poliza_activa`
- `persona_solicitud_pendiente_en_poliza_activa`
- `persona_sin_aprobar_en_poliza_activa`

### Recálculo periódico

Cron diario que actualiza estos campos por si el estado de la persona cambió después del matching original:

```bash
php artisan polizas:recalcular-estados-asegurados
```

```sql
UPDATE polizas_asegurados pa
  JOIN personas p ON pa.persona_id = p.id
   SET pa.persona_estado_al_matchear = (CASE
        WHEN p.fecha_baja IS NOT NULL THEN 'baja'
        WHEN p.estado_id = (SELECT id FROM estados WHERE nombre = 'Suspendido') THEN 'suspendido'
        WHEN p.es_solicitud = 1 THEN 'solicitud_pendiente'
        WHEN p.aprobado = 0 THEN 'sin_aprobar'
        ELSE 'activo'
       END),
       pa.persona_alerta_estado = (CASE
        WHEN p.fecha_baja IS NOT NULL AND pa.estado = 'activo' THEN 'persona_baja_en_poliza_activa'
        WHEN p.estado_id = (SELECT id FROM estados WHERE nombre = 'Suspendido') AND pa.estado = 'activo' THEN 'persona_suspendida_en_poliza_activa'
        WHEN p.es_solicitud = 1 AND pa.estado = 'activo' THEN 'persona_solicitud_pendiente_en_poliza_activa'
        WHEN p.aprobado = 0 AND pa.estado = 'activo' THEN 'persona_sin_aprobar_en_poliza_activa'
        ELSE NULL
       END)
 WHERE pa.persona_id IS NOT NULL;
```

---

## 7. Caso especial — alerta en perfil del proveedor

Cuando un proveedor está en estado "Baja" o "Suspendido" pero sigue figurando en una póliza activa, el tab "Pólizas" del perfil del proveedor (que se agregó en el spec original) debería mostrar una alerta extra:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⚠ Atención: este proveedor está dado de baja desde 15/02/2026 pero      │
│   sigue activo en las siguientes pólizas:                                │
│                                                                          │
│   La Segunda - Vehículos Autos · IWK373                                  │
│   [Solicitar baja en póliza]                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Criterios de aceptación

- [ ] **Caso real OPT548:** al re-cargar el PDF de La Segunda Autos, la patente **OPT548** debe matchear con Eduardo Matias Intile (persona #698, Suspendido) — NO debe figurar como "sin match" / "Ignorar".
- [ ] OPT548 aparece en categoría D2 "Persona suspendida en póliza activa" con acción "Pedir baja en póliza".
- [ ] Las otras patentes que figuraban "sin match" (JSZ153, AB457NV, AA365MN, AA516HI, AF908CQ) — si corresponden a personas en cualquier estado, también deben matchear correctamente. Las que efectivamente no existen en `personas` siguen siendo fantasmas.
- [ ] Cargar PDF La Segunda → matching encuentra patentes de personas con cualquier estado (incluyendo baja, suspendido, solicitud, no aprobado).
- [ ] Reporte de discrepancias muestra cuarta categoría "Estado inconsistente" con sub-tipos.
- [ ] Asegurados con `persona_alerta_estado != NULL` se ven en la UI con badge ámbar.
- [ ] Click "Pedir baja en póliza" desde la alerta D1 → genera solicitud de baja para la aseguradora.
- [ ] Recalcular estados con `php artisan polizas:recalcular-estados-asegurados` actualiza los flags si una persona cambió de estado.
- [ ] Tab "Pólizas" en perfil de proveedor de baja/suspendido muestra alerta clara.
- [ ] Las patentes de personas en baja/suspensión/solicitud que antes caían en "fantasma" ahora aparecen correctamente categorizadas en "estado inconsistente".

---

## 9. Estimación

| Tarea | Tiempo |
|---|---|
| Quitar filtros de estado en `MatchingService` | ¼ día |
| Agregar columnas `persona_estado_al_matchear` + `persona_alerta_estado` | ¼ día |
| Calcular `alerta_estado` durante el match + persistirlo | ¼ día |
| Actualizar endpoint `/discrepancias` con cuarta categoría | ¼ día |
| Cron `polizas:recalcular-estados-asegurados` | ¼ día |
| UI sub-tab "Estado inconsistente" + acción "Pedir baja en póliza" | ½ día |
| Alerta en tab Pólizas del perfil del proveedor | ¼ día |
| Smoke tests con casos reales (proveedores en baja, suspendidos, etc.) | ½ día |
| **TOTAL** | **~2.5 días** |

---

## 10. Ejemplo concreto de lo que tendría que pasar

### Antes del fix

Mati carga PDF La Segunda Autos con 23 patentes. De esas:
- 18 matchean exacto contra personas activas → OK
- 2 sin match (NJM322, KFL204) → caen en "fantasmas"
- 3 sin match aparente porque la persona está en BAJA, SUSPENDIDA o solicitud pendiente → ¡también caen en "fantasmas"!

Total reportado: **5 fantasmas**. Pero en realidad solo 2 son fantasmas reales — los otros 3 son personas conocidas en otro estado.

### Después del fix

- 18 matchean exacto activos → OK
- 2 sin match → 2 fantasmas reales
- 3 matchean pero con `persona_alerta_estado` poblado:
  - IWK373 → OJEDA ALFREDO (baja) → categoría D1
  - JLE386 → PEREZ JUAN (suspendido) → categoría D2
  - LIM234 → GOMEZ ANA (solicitud pendiente) → categoría D3

Total reportado correctamente: **2 fantasmas + 3 estados inconsistentes**.

Mati puede actuar:
- Sobre los 2 fantasmas reales → investigar qué son.
- Sobre los 3 estados inconsistentes → pedir baja en póliza directo (porque ya sabemos que la persona no opera más).

Cualquier duda, cortame en el momento.
