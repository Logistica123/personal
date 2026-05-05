# ADDENDUM 3 — Cláusulas universales en todas las aseguradoras + catálogo NEWSAN

> Versión: 1.0 · Fecha: 04-may-2026
> Para: IA de Francisco · De: Matías
> Tipo: addendum a los addendums 10 y 11. **Asume que el modelo de cláusulas + render por placeholders ya está implementado.**

---

## TL;DR

Generalización: **cualquier alta en cualquier póliza puede pedirse con cláusula**. Los addendums 10 y 11 cubrieron MAPFRE y San Cristóbal, pero La Segunda quedó con la cláusula "OCA" hardcodeada en el body. Hay que migrarla al sistema universal.

Cambios:

1. **Wizard "Solicitar alta"** — paso 2 "Cláusulas" aplica a TODAS las pólizas (no solo MAPFRE/SC).
2. **La Segunda** — body deja de tener "tenga las cláusulas de OCA por favor" hardcodeado y pasa a usar placeholders.
3. **Catálogo de cláusulas** — agregar campo `alias` (nombre corto del cliente para usar en frases tipo "las cláusulas de {alias}").
4. **NEWSAN como cláusula independiente** — no es solo "URBANO Suc. Moreno - NEWSAN S.A." ni "NEWSAN La Tablada - CBN/ID Supply Chain". NEWSAN solo (a su propio CUIT) también es una cláusula posible.
5. **Cualquier cláusula puede aplicarse a cualquier alta** — no hay restricción cruzada cliente↔aseguradora. El admin elige libremente.

---

## 1. Catálogo de cláusulas — agregar campo `alias`

```sql
ALTER TABLE polizas_clausulas
  ADD COLUMN alias VARCHAR(50) NOT NULL DEFAULT '' AFTER nombre_corto;
```

`alias` = nombre corto del **cliente con el que se trabaja** para usar en frases naturales de email del estilo "las cláusulas de {alias}". Ejemplos:

| nombre_corto | razon_social_titular | alias |
|---|---|---|
| OCASA | OCASA | **OCASA** |
| URBANO Suc. Moreno - NEWSAN | NEWSAN S.A. | **URBANO** |
| NEWSAN La Tablada - CBN | CBN | **NEWSAN** |
| NEWSAN La Tablada - ID Supply Chain | ID Supply Chain S.A. | **NEWSAN** |
| OCA Parque Norte / Avellaneda | OCA | **OCA** |
| **NEWSAN (directo)** | **NEWSAN S.A.** | **NEWSAN** |

> El alias **no necesariamente** coincide con `razon_social_titular`. Es el nombre con el que el operador se refiere al cliente en lenguaje natural (lo que pondría en "tenga las cláusulas de X").

### Agregar NEWSAN como cláusula independiente

```sql
INSERT INTO polizas_clausulas
  (nombre_corto, alias, cuit_titular, razon_social_titular, descripcion_corta, tipo, activa)
VALUES
  ('NEWSAN',
   'NEWSAN',
   '30-64261755-5',
   'NEWSAN S.A.',
   'Con clausula de NEWSAN S.A. CUIT N 30 64261755 5',
   'no_repeticion', TRUE);
```

### Update aliases para las cláusulas existentes (del addendum 10)

```sql
UPDATE polizas_clausulas SET alias = 'OCASA'   WHERE nombre_corto = 'OCASA';
UPDATE polizas_clausulas SET alias = 'URBANO'  WHERE nombre_corto = 'URBANO Suc. Moreno - NEWSAN';
UPDATE polizas_clausulas SET alias = 'NEWSAN'  WHERE nombre_corto = 'NEWSAN La Tablada - CBN';
UPDATE polizas_clausulas SET alias = 'NEWSAN'  WHERE nombre_corto = 'NEWSAN La Tablada - ID Supply Chain';
UPDATE polizas_clausulas SET alias = 'OCA'     WHERE nombre_corto = 'OCA Parque Norte / Avellaneda';
```

---

## 2. La Segunda — templates con placeholders dinámicos

### Antes (mal — cláusula hardcodeada)

```json
{
  "body_template": "Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.\n\nSolicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.\n\nEstoy atenta a cualquier novedad.\n\nSaludos!"
}
```

Esto sirve solo cuando el alta es para un distribuidor de OCA. Si el alta es para uno de OCASA o NEWSAN, el texto sale mal.

### Después (universal)

```json
{
  "body_template": "Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.{texto_clausula_la_segunda}\n\nEstoy atenta a cualquier novedad.\n\nSaludos!"
}
```

### Render del placeholder `{texto_clausula_la_segunda}`

```php
function render_texto_clausula_la_segunda($solicitud) {
    if ($solicitud->tipo_clausula_global == 'aplicar' && $solicitud->clausula_global) {
        $alias = $solicitud->clausula_global->alias;
        return "\n\nSolicito que el seguro de La Segunda tenga las cláusulas de {$alias} por favor.";
    }
    return ''; // sin cláusula → no agrega nada
}
```

### Ejemplos renderizados

**Sin cláusula:**
```
Buenas Ramón, solicito el alta de esta unidad dentro de la flota de Logística Argentina.
Datos del asegurado se encuentra en la cedula.

Estoy atenta a cualquier novedad.

Saludos!
```

**Con cláusula OCA:**
```
Buenas Ramón, solicito el alta de esta unidad dentro de la flota de Logística Argentina.
Datos del asegurado se encuentra en la cedula.

Solicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.

Estoy atenta a cualquier novedad.

Saludos!
```

**Con cláusula OCASA:**
```
... Solicito que el seguro de La Segunda tenga las cláusulas de OCASA por favor. ...
```

**Con cláusula NEWSAN:**
```
... Solicito que el seguro de La Segunda tenga las cláusulas de NEWSAN por favor. ...
```

### SQL para migrar el template existente

```sql
-- Update body_template de La Segunda Autos Alta
UPDATE polizas_email_config
   SET body_template = 'Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.{texto_clausula_la_segunda}\n\nEstoy atenta a cualquier novedad.\n\nSaludos!'
 WHERE poliza_id = (SELECT id FROM polizas WHERE numero_poliza = '67.743.063')
   AND tipo = 'alta';

-- Idem La Segunda Motos Alta
UPDATE polizas_email_config
   SET body_template = 'Buenas {contacto_nombre}, solicito el alta de esta moto dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.{texto_clausula_la_segunda}\n\nEstoy atenta a cualquier novedad.\n\nSaludos!'
 WHERE poliza_id = (SELECT id FROM polizas WHERE numero_poliza = '45.597.407')
   AND tipo = 'alta';
```

---

## 3. La Segunda — placeholder asegurado_template (cláusula individual)

La Segunda no usa cláusula individual con frecuencia (es por flota, no por persona), pero la lógica debe permitirla por consistencia.

### Caso poco común — cláusula individual en La Segunda

Si el admin elige cláusula individual para un vehículo específico:

```json
"asegurado_template": "{patente}{clausula_inline}"
```

Renderiza como:
```
NJM322 -(Con clausula de OCA CUIT N 30 71702439 3)
```

Acepto que es un caso edge. Mejor: dejar el placeholder pero sin que se use frecuentemente.

---

## 4. Universalización del wizard "Solicitar alta"

### Antes (parcial)

- MAPFRE: paso 2 "Cláusulas" mostrado.
- San Cristóbal: paso 2 "Cláusulas" mostrado (post addendum 11).
- La Segunda: paso 2 NO mostrado.

### Después (universal)

**Para TODAS las aseguradoras**, el wizard incluye paso 2 con 3 opciones:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cláusulas (opcional)                                                     │
│                                                                          │
│ ⦿ Sin cláusula                                                           │
│ ⚪ Aplicar cláusula global a todos:                                      │
│   Cláusula: [Seleccionar... ▼]                                          │
│     · OCASA                                                              │
│     · URBANO (NEWSAN S.A.)                                              │
│     · NEWSAN                                                             │
│     · NEWSAN La Tablada - CBN                                            │
│     · NEWSAN La Tablada - ID Supply Chain                               │
│     · OCA Parque Norte                                                   │
│ ⚪ Usar cláusulas ya vigentes en la póliza (solo MAPFRE)                 │
│                                                                          │
│ [Saltar] [← Volver]                                  [Continuar ▶]       │
└──────────────────────────────────────────────────────────────────────────┘
```

> El **default** depende de la póliza:
> - Si la póliza tiene cláusulas vigentes en `polizas_clausulas_aplicadas` → ofrece "usar cláusulas ya vigentes" (MAPFRE).
> - Si no → "sin cláusula" preseleccionada.

> El admin **puede saltar** este paso siempre. No es obligatorio elegir cláusula.

### Paso 2B (cláusulas individuales) — opcional para todas las aseguradoras

Igual que en SC. Aplica a cualquier aseguradora, no solo SC. La Segunda casi nunca lo usa pero está disponible.

---

## 5. Tabla resumen de comportamiento por aseguradora

| Aseguradora | Cláusula global | Cláusula individual | Estilo "endosos previos" | Placeholder específico |
|---|---|---|---|---|
| MAPFRE Alta | ✅ inline en cada nombre | ✅ inline en nombre específico | ✅ (si la póliza ya tiene vigentes) | `{texto_clausula_previa}` |
| MAPFRE Baja | ❌ | ❌ | ❌ | — |
| San Cristóbal Alta | ✅ línea separada `-(...)` arriba | ✅ inline `-(...)` después del nombre | ❌ | `{clausula_global_block}`, `{texto_intro_alta}` |
| San Cristóbal Baja | ❌ | ❌ | ❌ | — |
| **La Segunda Alta** | **✅ frase dinámica "tenga las cláusulas de {alias}"** | ✅ inline (raro) | ❌ | `{texto_clausula_la_segunda}` |
| La Segunda Baja | ❌ | ❌ | ❌ | — |

> **Conclusión:** todas las altas pueden tener cláusulas. Solo cambia el formato de render según la aseguradora.

---

## 6. Estructura final de placeholders

### A nivel body (resueltos por aseguradora según corresponda)

| Placeholder | Aseguradoras que lo usan | Renderiza |
|---|---|---|
| `{clausula_global_block}` | San Cristóbal | Línea separada `-(descripcion_corta)` |
| `{texto_intro_alta}` | San Cristóbal | "Informa Altas" o "Informa nuevas altas EN ÍDEM..." |
| `{texto_clausula_previa}` | MAPFRE | "Por favor, incluir las mismas cláusulas..." |
| `{texto_clausula_la_segunda}` | La Segunda | "Solicito que el seguro de La Segunda tenga las cláusulas de {alias}..." |

### A nivel asegurado (todas las aseguradoras)

| Placeholder | Renderiza |
|---|---|
| `{nombre_apellido}` | Nombre completo |
| `{clausula_inline}` | Cláusula individual de ese asegurado, formato según aseguradora |
| `{numero_asegurado}` | Solo SC: 1, 2, 3... |
| `{dni}`, `{dni_con_puntos}`, `{cuil}`, `{cuil_sin_guiones}`, `{patente}` | Identificadores |
| `{fecha_nac}` | Fecha en formato DD/MM/AAAA |

### Render de `{clausula_inline}` por aseguradora

```php
function render_clausula_inline($asegurado_decision, $aseguradora_perfil) {
    if (!$asegurado_decision->clausula) return '';
    $desc = $asegurado_decision->clausula->descripcion_corta;
    switch ($aseguradora_perfil) {
        case 'mapfre':         return ' (' . $desc . ')';        // entre paréntesis
        case 'san_cristobal':  return ' -(' . $desc . ')';       // con guión-paréntesis
        case 'la_segunda':     return ' -(' . $desc . ')';       // mismo formato que SC
        default:               return ' (' . $desc . ')';
    }
}
```

---

## 7. Endpoints API afectados

### `POST /api/polizas/{id}/solicitudes` (alta)

Ya soporta los campos del addendum 11. **Sin cambios adicionales.** El payload se aplica a todas las aseguradoras:

```json
{
  "tipo": "alta",
  "asegurados_ids": [100],
  "tipo_clausula_global": "aplicar",
  "clausula_global_id": 1,
  "clausulas_individuales": []
}
```

### `GET /api/polizas/clausulas`

Devuelve también el campo `alias`:

```json
{
  "data": [
    {
      "id": 1,
      "nombre_corto": "OCASA",
      "alias": "OCASA",
      "cuit_titular": "30-66204961-8",
      "razon_social_titular": "OCASA",
      "descripcion_corta": "Con clausula de Ocasa CUIT N 30 66204961 8",
      "activa": true
    }
  ]
}
```

---

## 8. Validaciones adicionales

| Regla | Acción |
|---|---|
| `alias` no vacío al crear cláusula | Error 422 |
| `alias` ≤ 50 caracteres | Error 422 |
| Cláusula global aplicada a póliza La Segunda → render usa `{alias}` no `{razon_social_titular}` | (el render lo resuelve solo) |
| Si admin elige cláusula sin `alias` cargado en La Segunda → mostrar warning "Cláusula sin alias, no se renderizará bien en La Segunda" | Warning + permitir |

---

## 9. Criterios de aceptación adicionales

- [ ] El catálogo `polizas_clausulas` tiene 6 cláusulas vigentes (5 originales + NEWSAN nueva).
- [ ] Cada cláusula tiene `alias` cargado.
- [ ] Wizard "Solicitar alta" muestra paso 2 "Cláusulas" para **TODAS** las aseguradoras (incluida La Segunda).
- [ ] La Segunda Alta sin cláusula → email NO contiene "Solicito que el seguro de La Segunda tenga las cláusulas...".
- [ ] La Segunda Alta con cláusula OCA → email contiene "Solicito que el seguro de La Segunda tenga las cláusulas de **OCA** por favor.".
- [ ] La Segunda Alta con cláusula OCASA → email contiene "...las cláusulas de **OCASA** por favor.".
- [ ] La Segunda Alta con cláusula NEWSAN → email contiene "...las cláusulas de **NEWSAN** por favor.".
- [ ] La Segunda Alta puede recibir cláusula individual por vehículo (caso edge, igual debe funcionar).
- [ ] MAPFRE y SC siguen funcionando idéntico al addendum 10/11 (no regresión).

---

## 10. Estimación adicional

| Tarea | Tiempo |
|---|---|
| ALTER + UPDATE catálogo cláusulas (campo `alias` + NEWSAN) | ¼ día |
| Helper `render_texto_clausula_la_segunda()` + render `{clausula_inline}` por aseguradora | ¼ día |
| Migración data: actualizar templates La Segunda | ¼ día |
| Habilitar paso 2 del wizard para La Segunda | ¼ día |
| Smoke tests | ¼ día |
| **TOTAL** | **~1.25 días** sobre el addendum 11 |

---

## 11. Resumen acumulado de los 3 addendums

### Lo que cubre cada addendum

| # | Cobertura |
|---|---|
| 10 | Concepto de cláusulas + 5 cláusulas iniciales + 2 pólizas MAPFRE adicionales + render MAPFRE |
| 11 | Cláusulas en SC + global vs individual + numeración `N)_:` + DNI con puntos |
| **12 (este)** | **Universalización: La Segunda + agregar NEWSAN + campo `alias` + cualquier cláusula en cualquier póliza** |

### Estimación total cláusulas

- Addendum 10: ~3 días
- Addendum 11: ~1.5 días
- Addendum 12 (este): ~1.25 días
- **TOTAL feature cláusulas: ~5.75 días** sobre el MVP base de 10-12 días.

### Principio rector final

> **Cualquier alta en cualquier póliza puede tener cláusula global y/o individual.** El catálogo de cláusulas (`polizas_clausulas`) es genérico — independiente de aseguradora. Lo que cambia entre aseguradoras es **cómo se renderiza** la cláusula en el body del email (placeholders + helpers específicos por perfil).

Cualquier duda, cortame en el momento.
