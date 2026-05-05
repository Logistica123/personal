# ADDENDUM 2 — Cláusulas también en San Cristóbal + cláusula global vs individual

> Versión: 1.0 · Fecha: 04-may-2026
> Para: IA de Francisco · De: Matías
> Tipo: addendum al spec original + addendum 10. **Asume que el modelo de cláusulas (`polizas_clausulas` + `polizas_clausulas_aplicadas`) ya está implementado.**

---

## TL;DR

En el addendum 10 dejé las cláusulas como **solo MAPFRE**. Estaba mal — **San Cristóbal también las usa**, pero con un formato distinto que requiere una variante nueva en el render.

Cambios:

1. **Cláusulas en San Cristóbal Altas** — agregar el flujo del wizard (mismo que MAPFRE pero con templates específicos).
2. **Concepto nuevo: cláusula global vs individual** — SC permite que la cláusula aplique a TODO el bloque de asegurados (1 sola línea arriba) o solo a UNO específico (inline).
3. **Templates SC Alta actualizados** con 2 versiones: con cláusula global (texto distinto en el body) y sin cláusula.
4. **Numeración del listado** — SC numera los asegurados (`1)_:`, `2)_:`...), MAPFRE no.

---

## 1. Análisis del email real San Cristóbal con cláusulas

Texto que mandó Mónica el 02/01/2026:

```
Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_N° cuenta: 01-02297625

Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:

-(Con clausula de Ocasa CUIT N 30 66204961 8)

1)_: Gonzalez , Ruben Oscar DNI: 34.451.216 FECHA DE NACIMIENTO: 23/07/1990

2)_:Wahnish, Walter Alejandro -(Con clausula de Ocasa CUIT N 30 66204961 8)  DNI: 34.056.286 FECHA DE NACIMIENTO:9/9/1988

3)_:Benítez Juan Ramón DNI:18475503 FECHA DE NACIMIENTO:18-12-1967

4)_:Lezcano Rubén Agustín DNI:27129323 FECHA DE NACIMIENTO:5-3-1979

5)_:Benítez Leonardo Fabio DNI: 24001911 FECHA DE NACIMIENTO:4-11-1974
```

### Observaciones clave

| Observación | Implicancia |
|---|---|
| **Cláusula global** "(Con clausula de Ocasa...)" arriba del listado | Aplica a todos los asegurados del bloque |
| **Cláusula individual** en Wahnish (item 2) | Aplica SOLO a Wahnish (cláusula adicional/diferente al resto) |
| Asegurados numerados `1)_:`, `2)_:`... | Formato propio de SC |
| Texto cambia en body: "Informa nuevas altas EN ÍDEM CONDICIONES..." | Cuando hay cláusula global, el body es diferente al "Informa Altas" original |
| DNI con puntos: `34.451.216` | Formato distinto al MAPFRE (sin puntos: `34451216`) |
| Fechas inconsistentes: `23/07/1990`, `9/9/1988`, `18-12-1967` | El parser/render debe normalizar formato — mejor `DD/MM/AAAA` siempre |

---

## 2. Concepto nuevo: cláusula GLOBAL vs INDIVIDUAL

### Cláusula global (única para todo el bloque)

- **Una sola** cláusula arriba del listado.
- **Aplica a todos** los asegurados del email.
- En el body aparece como una línea separada con guión: `-(Con clausula de Ocasa CUIT N 30 66204961 8)`.
- **Reemplaza el texto** del body original ("Informa Altas" → "Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:").

### Cláusula individual (por asegurado)

- Va **inline** en el nombre del asegurado (después del nombre, antes del DNI).
- **Adicional** o **distinta** a la global — se usa cuando UN asegurado específico necesita una cláusula diferente al resto.
- Caso típico: el resto del grupo tiene cláusula OCASA, y uno solo tiene cláusula adicional NEWSAN porque también trabaja para esa cuenta.

### Ambas pueden coexistir

En el ejemplo: la global "OCASA" aplica a los 5, pero Wahnish (item 2) tiene la misma "OCASA" inline. Acá podría ser un **caso de duplicación accidental** del operador, o que Wahnish necesita la cláusula reforzada.

**Decisión de diseño:** la lógica permite ambas cláusulas (global + individual) sin chequear duplicación. Si el operador eligió las dos, se imprimen las dos. Si en el caso real fue un error humano, no es nuestro problema corregirlo automáticamente — el admin lo ve en el preview y puede ajustar.

---

## 3. Cambio en el modelo de datos

### Agregar campo `tipo_aplicacion` al pivot

```sql
ALTER TABLE polizas_clausulas_aplicadas
  ADD COLUMN tipo_aplicacion ENUM('global','individual') NOT NULL DEFAULT 'global' AFTER clausula_id;
```

> Esto guarda **histórico**: cómo se aplicó cada cláusula a la póliza (global = a todos, individual = a uno específico).

### Tabla nueva opcional para individuales (recomendado)

Si una cláusula es individual de un asegurado específico, conviene registrarla a nivel asegurado:

```sql
CREATE TABLE polizas_asegurados_clausulas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asegurado_id BIGINT NOT NULL,
    clausula_id BIGINT NOT NULL,
    aplicada_desde DATE NOT NULL,
    aplicada_hasta DATE NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asegurado_id) REFERENCES polizas_asegurados(id) ON DELETE CASCADE,
    FOREIGN KEY (clausula_id) REFERENCES polizas_clausulas(id),
    UNIQUE KEY uniq_asegurado_clausula_desde (asegurado_id, clausula_id, aplicada_desde)
);
```

Así sabés qué cláusula adicional tiene cada persona específica.

---

## 4. Placeholders nuevos en templates

### `{clausula_global_block}`

Renderiza el bloque de cláusula global cuando se eligió aplicar una cláusula global al alta.

- Si hay cláusula global → renderiza una línea separada con guión:
  ```
  -(Con clausula de Ocasa CUIT N 30 66204961 8)
  ```
- Si no → vacío.

### `{texto_intro_alta}` (resuelve por si hay cláusula global o no)

Reemplaza el texto fijo "Informa Altas" del template SC original. Resuelve a:

| Caso | Texto |
|---|---|
| Sin cláusula global | `Informa Altas` |
| Con cláusula global | `Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:` |

### `{numero_asegurado}` (autoincremental)

Para SC, cada asegurado se renderiza con su número en formato `1)_:`, `2)_:`. El render de `{asegurados_block}` debe iterar y reemplazar este placeholder con el índice + 1.

---

## 5. Templates SC actualizados

### San Cristóbal — Alta (template universal con cláusulas)

```json
{
  "to": ["TODO_altas@sancristobal.com.ar"],
  "cc": [],
  "bcc": [],
  "contacto_nombre": null,
  "asunto_template": "Altas - Póliza {numero_poliza}",
  "body_template": "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_N° cuenta: {numero_cuenta}\n\n{texto_intro_alta}\n{clausula_global_block}\n{asegurados_block}",
  "asegurado_template": "{numero_asegurado})_: {nombre_apellido}{clausula_inline} DNI: {dni_con_puntos} FECHA DE NACIMIENTO: {fecha_nac}",
  "adjuntos_requeridos": []
}
```

### San Cristóbal — Baja (sin cláusulas, formato anterior)

Las bajas no incluyen cláusulas. Mantener el template original:

```json
{
  "asunto_template": "Bajas - Póliza {numero_poliza}",
  "body_template": "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma BAJAS\n\n{asegurados_block}",
  "asegurado_template": "{nombre_apellido} CUIL: {cuil_sin_guiones} FECHA DE NACIMIENTO: {fecha_nac}",
  "adjuntos_requeridos": []
}
```

> **Nota:** las bajas SC usan **CUIL sin guiones** y NO numeran. Es el formato original que ya estaba.

### Diferencia entre SC alta y SC baja

| Campo | Alta | Baja |
|---|---|---|
| Identificador | DNI con puntos | CUIL sin guiones |
| Numeración | Sí (`1)_:`) | No |
| Cláusulas | Sí (global + individual) | No aplica |
| Body intro | "Informa nuevas altas..." o "Informa Altas" | "Informa BAJAS" |

---

## 6. Helpers de render adicionales

```php
function format_dni_con_puntos($dni) {
    // 34451216 → 34.451.216
    if (!$dni) return '';
    $dni = preg_replace('/\D/', '', $dni);
    return number_format((int)$dni, 0, '', '.');
}

function format_fecha_dd_mm_aaaa($fecha) {
    // '1990-07-23' → '23/07/1990'
    return date('d/m/Y', strtotime($fecha));
}

function render_clausula_global_block($solicitud) {
    if ($solicitud->tipo_clausula_global == 'aplicar' && $solicitud->clausula_global) {
        return "\n-(" . $solicitud->clausula_global->descripcion_corta . ")\n";
    }
    return '';
}

function render_texto_intro_alta($solicitud, $aseguradora) {
    if ($aseguradora->parser_perfil == 'san_cristobal') {
        if ($solicitud->tipo_clausula_global == 'aplicar') {
            return 'Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:';
        }
        return 'Informa Altas';
    }
    return ''; // MAPFRE no usa este placeholder
}

function render_asegurados_block($asegurado_template, $asegurados, $decisiones_individuales = []) {
    $lines = [];
    foreach ($asegurados as $i => $a) {
        $line = $asegurado_template;
        $line = str_replace('{numero_asegurado}', $i + 1, $line);
        $line = str_replace('{nombre_apellido}', $a->nombre_apellido, $line);
        $line = str_replace('{dni_con_puntos}', format_dni_con_puntos($a->dni), $line);
        $line = str_replace('{cuil_sin_guiones}', preg_replace('/-/', '', $a->cuil), $line);
        $line = str_replace('{fecha_nac}', format_fecha_dd_mm_aaaa($a->fecha_nac), $line);

        // Cláusula individual de este asegurado específico (si la pidieron)
        $clausula_inline = '';
        if (isset($decisiones_individuales[$a->id]) && $decisiones_individuales[$a->id]['clausula']) {
            $clausula = $decisiones_individuales[$a->id]['clausula'];
            $clausula_inline = ' -(' . $clausula->descripcion_corta . ')';
        }
        $line = str_replace('{clausula_inline}', $clausula_inline, $line);

        $lines[] = $line;
    }
    return implode("\n\n", $lines);  // SC separa con doble newline
}
```

> Nota: para MAPFRE, `{asegurados_block}` se separa con `\n` simple (formato compacto). Para SC con doble newline porque cada asegurado va en su propia "línea con espacio". Esto se puede agregar como campo del template (`separador_entre_asegurados`).

### Agregar al modelo

```sql
ALTER TABLE polizas_email_config
  ADD COLUMN separador_entre_asegurados VARCHAR(10) NOT NULL DEFAULT '\n' AFTER asegurado_template;
```

Para SC alta = `'\n\n'`, para MAPFRE = `'\n'`.

---

## 7. Modificación del wizard "Solicitar Alta"

El paso 2 "Cláusulas" del addendum 10 sigue valiendo, pero se aplica también a SC. Y se amplía con la opción de cláusula individual:

### Paso 2A: cláusula global

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cláusulas — Paso 1: GLOBAL (aplica a todos)                              │
│                                                                          │
│ ⦿ Sin cláusula global                                                    │
│ ⚪ Aplicar cláusula global a todos:                                      │
│   [Seleccionar cláusula ▼]                                              │
│     · OCASA (CUIT 30-66204961-8)                                        │
│     · NEWSAN La Tablada - CBN                                           │
│     · OCA Parque Norte                                                  │
│                                                                          │
│ ⚪ Usar cláusulas ya vigentes en la póliza (estilo "endosos previos")    │
│   ☑ NEWSAN S.A.                                                         │
│   (solo aparece como opción en MAPFRE — SC no soporta este estilo)      │
│                                                                          │
│ [← Volver]                                          [Continuar ▶]        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Paso 2B: cláusulas individuales (opcional)

Si el admin quiere agregar cláusula adicional a uno o más asegurados específicos:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cláusulas — Paso 2: INDIVIDUALES (opcional)                              │
│                                                                          │
│ ¿Algún asegurado necesita una cláusula adicional o distinta?             │
│                                                                          │
│ Asegurado seleccionado            | Cláusula individual                  │
│ Gonzalez, Ruben Oscar             | (ninguna ▼)                          │
│ Wahnish, Walter Alejandro         | OCASA ▼          ← agregada extra    │
│ Benítez Juan Ramón                | (ninguna ▼)                          │
│ Lezcano Rubén Agustín             | (ninguna ▼)                          │
│ Benítez Leonardo Fabio            | (ninguna ▼)                          │
│                                                                          │
│ [← Volver]                              [Saltar y continuar] [Aplicar ▶]│
└──────────────────────────────────────────────────────────────────────────┘
```

Si no se selecciona ninguna individual → continúa al preview directamente.

---

## 8. Ejemplos renderizados — SC

### Ejemplo 1: 5 asegurados con cláusula global OCASA + Wahnish con cláusula individual OCASA adicional

Input:
- Póliza: 01-06-06-30035710 / Cuenta: 01-02297625
- 5 asegurados (los del email real)
- Cláusula global: OCASA
- Cláusula individual de Wahnish: OCASA (adicional)

Output:
```
Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_N° cuenta: 01-02297625

Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:

-(Con clausula de Ocasa CUIT N 30 66204961 8)

1)_: Gonzalez, Ruben Oscar DNI: 34.451.216 FECHA DE NACIMIENTO: 23/07/1990

2)_: Wahnish, Walter Alejandro -(Con clausula de Ocasa CUIT N 30 66204961 8) DNI: 34.056.286 FECHA DE NACIMIENTO: 09/09/1988

3)_: Benítez, Juan Ramón DNI: 18.475.503 FECHA DE NACIMIENTO: 18/12/1967

4)_: Lezcano, Rubén Agustín DNI: 27.129.323 FECHA DE NACIMIENTO: 05/03/1979

5)_: Benítez, Leonardo Fabio DNI: 24.001.911 FECHA DE NACIMIENTO: 04/11/1974
```

### Ejemplo 2: 3 asegurados sin cláusula global ni individual (formato anterior preservado)

Input:
- Sin cláusula global
- Sin cláusulas individuales

Output:
```
Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_N° cuenta: 01-02297625

Informa Altas

1)_: Penas Sali, Fernando Lionel DNI: 21.131.674 FECHA DE NACIMIENTO: 03/12/1969

2)_: Fleitas, Pedro Sebastian DNI: 28.101.530 FECHA DE NACIMIENTO: 23/03/1980

3)_: Pacheco, Juan DNI: 27.250.520 FECHA DE NACIMIENTO: 05/04/1979
```

> **Atención:** este formato sin cláusulas también usa numeración `1)_:` (no era así en el template original que armé). Es la convención del operador SC. Lo unifico — todas las altas SC numeradas.

### Ejemplo 3: con cláusula global pero sin individual

Input:
- Cláusula global: OCA Parque Norte

Output:
```
Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_N° cuenta: 01-02297625

Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:

-(Con clausula de No Repetición a nombre de OCA CUIT N 30 71702439 3)

1)_: Distribuidor Uno DNI: 30.123.456 FECHA DE NACIMIENTO: 15/03/1980

2)_: Distribuidor Dos DNI: 31.987.654 FECHA DE NACIMIENTO: 22/07/1985
```

---

## 9. Ajuste al template original (CUIL → DNI en altas SC)

En el template SC original (de altas) usaba `{cuil_sin_guiones}`. **Cambia a DNI con puntos para mantener consistencia con el ejemplo real de Mati**.

Las **bajas SC siguen usando CUIL sin guiones** (formato confirmado del email anterior de bajas).

| Operación | Identificador | Formato |
|---|---|---|
| **Alta SC** | DNI | con puntos: `34.451.216` |
| **Baja SC** | CUIL | sin guiones: `20211316749` |

> No es lo más consistente, pero es lo que el operador SC le pide históricamente. Conservar fielmente.

---

## 10. Cambios al SQL de seed

```sql
-- Reemplazar el body_template SC Alta con la versión universal con cláusulas
UPDATE polizas_email_config
   SET body_template = 'Cliente Póliza {numero_poliza} _Logística Argentina Srl-_N° cuenta: {numero_cuenta}\n\n{texto_intro_alta}\n{clausula_global_block}\n{asegurados_block}',
       asegurado_template = '{numero_asegurado})_: {nombre_apellido}{clausula_inline} DNI: {dni_con_puntos} FECHA DE NACIMIENTO: {fecha_nac}',
       separador_entre_asegurados = '\n\n'
 WHERE poliza_id = (SELECT id FROM polizas WHERE numero_poliza = '01-06-06-30035710')
   AND tipo = 'alta';

-- Las bajas SC NO se tocan
```

---

## 11. Endpoints API afectados

### Cambio en `POST /api/polizas/{id}/solicitudes`

Nuevos campos:

```json
{
  "tipo": "alta",
  "asegurados_ids": [100, 105, 110],

  "tipo_clausula_global": "ninguna" | "aplicar" | "previa_existente",
  "clausula_global_id": 1,

  "clausulas_individuales": [
    {"asegurado_id": 105, "clausula_id": 1}
  ]
}
```

> `tipo_clausula_global`:
> - `"ninguna"` → no se renderiza `{clausula_global_block}` ni se cambia `{texto_intro_alta}`.
> - `"aplicar"` → se renderiza el bloque y cambia el texto intro a "Informa nuevas altas EN ÍDEM CONDICIONES...".
> - `"previa_existente"` → solo MAPFRE: agrega párrafo "incluir las mismas cláusulas...".

---

## 12. Criterios de aceptación adicionales

- [ ] San Cristóbal Alta con cláusula global "OCASA" + 5 asegurados → email tiene la línea `-(Con clausula de Ocasa CUIT N 30 66204961 8)` arriba del listado.
- [ ] San Cristóbal Alta con cláusula global + Wahnish con cláusula individual → la cláusula individual aparece inline en el item 2 del listado.
- [ ] San Cristóbal Alta sin cláusula → texto intro dice "Informa Altas" y NO aparece el bloque de cláusula global.
- [ ] Numeración `1)_:`, `2)_:`, ..., `N)_:` se aplica en TODAS las altas SC (con o sin cláusula).
- [ ] DNI en altas SC se renderiza con puntos (`34.451.216`).
- [ ] Fechas en SC se renderizan siempre como `DD/MM/AAAA` (con cero a la izquierda).
- [ ] Bajas SC siguen funcionando con CUIL sin guiones (NO se tocan).
- [ ] El paso 2A "Cláusula global" del wizard aparece tanto para MAPFRE como para SC al solicitar alta.
- [ ] El paso 2B "Cláusulas individuales" es opcional — admin puede saltarlo.
- [ ] Si admin elige cláusulas individuales y registra histórico → se persiste en `polizas_asegurados_clausulas`.

---

## 13. Estimación adicional

| Tarea | Tiempo |
|---|---|
| Migración: nuevas columnas (`tipo_aplicacion`, `separador_entre_asegurados`) + tabla `polizas_asegurados_clausulas` | ¼ día |
| Helpers de render nuevos (DNI con puntos, fecha, cláusula global block, texto intro alta) | ¼ día |
| Wizard paso 2B "cláusulas individuales" | ½ día |
| Update templates SC y migración data | ¼ día |
| Smoke tests + validación con email real | ½ día |
| **TOTAL** | **~1.5 días** sobre el addendum 10 |

---

## 14. Resumen acumulado addendums

| Aseguradora / Operación | Cláusula global | Cláusula individual | Numeración | Identificador |
|---|---|---|---|---|
| MAPFRE Alta | ❌ (estilo B = "endosos previos") | ✅ inline en nombre | ❌ | DNI sin puntos |
| MAPFRE Baja | ❌ | ❌ | ❌ | DNI sin puntos |
| **San Cristóbal Alta** | **✅ línea separada con guión** | **✅ inline con `-(...)`** | **✅ `N)_:`** | **DNI con puntos** |
| San Cristóbal Baja | ❌ | ❌ | ❌ | CUIL sin guiones |
| La Segunda Alta | ❌ | ❌ | ❌ | Patente |
| La Segunda Baja | ❌ | ❌ | ❌ | Patente |

> El modelo de cláusulas (`polizas_clausulas`, `polizas_clausulas_aplicadas`, `polizas_asegurados_clausulas`) sigue siendo **genérico** — no atado a una aseguradora específica. Solo cambian los templates por aseguradora.

Cualquier duda, cortame en el momento.
