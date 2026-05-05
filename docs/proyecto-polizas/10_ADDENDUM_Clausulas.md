# ADDENDUM 1 — Cláusulas de no repetición + pólizas MAPFRE adicionales

> Versión: 1.0 · Fecha: 04-may-2026
> Para: IA de Francisco · De: Matías
> Tipo: addendum al spec original. **Se asume que las 7 tablas + parser + UI base ya están en producción.**

---

## TL;DR

Hay un concepto que no estaba contemplado en el spec original: las **cláusulas de no repetición**. Son cláusulas legales que el cliente con el que trabajamos (OCASA, NEWSAN, URBANO, OCA) le pide a Logística Argentina que tenga incluidas en su seguro de Accidentes Personales. Cada cláusula tiene su propio **CUIT** (el del cliente) y se incluye en el email cuando se solicita un alta a la aseguradora.

Cambios necesarios:

1. **Nueva tabla `polizas_clausulas`** — catálogo de cláusulas configurables con CUIT propio.
2. **Pivot `polizas_clausulas_aplicadas`** — qué cláusulas vigentes tiene cada póliza (histórico).
3. **2 pólizas MAPFRE adicionales** que faltaban: URBANO (2297847) + NEWSAN (2298721).
4. **Modificación del template MAPFRE Alta** para soportar 2 estilos:
   - **Estilo A — cláusula inline en el nombre** (cuando se está pidiendo aplicar una cláusula nueva)
   - **Estilo B — referencia a endosos previos** (cuando ya está cargada en la póliza)
5. **UI del wizard "Solicitar alta"** — agregar paso para elegir cliente/cláusula del dropdown.

Aviso: Mati va a pasar caso de **otra aseguradora** después. Esta lógica de cláusulas puede aplicar también a esa.

---

## 1. Qué son las cláusulas

### Concepto operativo

Cada cliente con el que opera Logística Argentina (OCASA, NEWSAN, URBANO, OCA) le exige que su seguro de Accidentes Personales tenga incluida una **cláusula de no repetición** a nombre del cliente. El objetivo legal: si pasa algo, la aseguradora paga pero **NO repite** (no le reclama) al cliente final, porque el riesgo lo asume Logística Argentina como contratista.

La cláusula se declara con un texto del estilo:
> "Con cláusula de OCASA CUIT N 30-66204961-8"

Cada cliente tiene su propio CUIT y razón social en la cláusula. Algunos clientes tienen 1 cláusula global, otros tienen 1 por sucursal:

| Cliente | Sucursal | Cláusula a nombre de | CUIT |
|---|---|---|---|
| URBANO | Suc. Moreno | NEWSAN S.A. | 30-64261755-5 |
| NEWSAN | La Tablada | CBN | 30-71159690-5 |
| NEWSAN | La Tablada | ID Supply Chain S.A. | 30-71069830-5 |
| OCA | Parque Norte / Avellaneda | OCA | 30-71702439-3 |
| OCASA | (todas) | OCASA | 30-66204961-8 |

> Algunos clientes (NEWSAN La Tablada) requieren **2 cláusulas simultáneas** — la lógica debe permitir múltiples cláusulas activas por póliza.

### Cuándo se incluye en el email

Cuando se solicita el alta de un distribuidor a la aseguradora **MAPFRE**, hay 2 escenarios:

**Escenario 1 — Cláusula nueva (que aún no está en la póliza):**
- Email muestra la cláusula **inline en el nombre** del asegurado, entre paréntesis y resaltada.
- Ejemplo:
  ```
  Buenas Carlos, me comunico para solicitar que se coloque las clausulas de Ocasa, esta dado de alta.

  Nombre Completo: MACEIRO JULIAN NICOLAS  (Con clausula de Ocasa CUIT N 30 66204961 8)
  Dni: 45893587
  Fecha de Nacimiento: 20-5-2004
  ```

**Escenario 2 — Cláusula ya vigente en la póliza (alta sólo de un asegurado más):**
- Email pide a la aseguradora "incluir las mismas cláusulas que figuran en endosos anteriores".
- Ejemplo:
  ```
  Buenas Carlos
  Me comunico para solicitar el alta del siguiente distribuidor a la póliza de
  Accidentes Personales N° 2297847 de Logística Argentina S.R.L. – CUIT 30-71706098-5.

  Por favor, incluir las mismas cláusulas que figuran en endosos anteriores
  correspondientes a este número de póliza.

  ALTAS

  Nombre Completo:
  DNI:
  Fecha de Nacimiento:
  ```

El admin elige el escenario al solicitar el alta.

---

## 2. Pólizas MAPFRE adicionales

En el seed inicial cargamos solo la póliza MAPFRE OCASA (N° 2297608). Faltan 2:

| Cliente | Póliza MAPFRE | Comentario |
|---|---|---|
| OCASA | 2297608 | (ya cargada en seed inicial) |
| URBANO / OTRAS EMPRESAS | **2297847** | nueva — falta crearla |
| NEWSAN | **2298721** | nueva — falta crearla |

### SQL de actualización

```sql
SET @mapfre_id = (SELECT id FROM polizas_aseguradoras WHERE parser_perfil = 'mapfre');

-- Póliza MAPFRE URBANO
INSERT INTO polizas (
    aseguradora_id, nombre_descriptivo, ramo, subramo, tipo_asegurado,
    numero_poliza, vigencia_desde, vigencia_hasta,
    tomador_cuit, tomador_razon_social, tomador_domicilio,
    activa
) VALUES (
    @mapfre_id,
    'MAPFRE - AP URBANO / Otras Empresas',
    'accidentes_personales', 'AP Ámbito Laboral + In Itinere', 'persona',
    '2297847',
    '2025-04-08', '2026-04-08',                     -- TODO confirmar vigencia
    '30-71706098-5', 'LOGISTICA ARGENTINA S.R.L.',
    'Patagonia 1475, Corrientes',
    TRUE
);

-- Póliza MAPFRE NEWSAN
INSERT INTO polizas (
    aseguradora_id, nombre_descriptivo, ramo, subramo, tipo_asegurado,
    numero_poliza, vigencia_desde, vigencia_hasta,
    tomador_cuit, tomador_razon_social, tomador_domicilio,
    activa
) VALUES (
    @mapfre_id,
    'MAPFRE - AP NEWSAN',
    'accidentes_personales', 'AP Ámbito Laboral + In Itinere', 'persona',
    '2298721',
    '2025-04-08', '2026-04-08',                     -- TODO confirmar vigencia
    '30-71706098-5', 'LOGISTICA ARGENTINA S.R.L.',
    'Patagonia 1475, Corrientes',
    TRUE
);

-- Email config para cada nueva póliza (alta + baja)
-- Se replican los templates MAPFRE pero con el nuevo numero_poliza correspondiente
-- (los placeholders {numero_poliza} se resuelven con el dato de la póliza específica)
```

> El admin debe confirmar las vigencias correctas con MAPFRE — quedan como TODO.

---

## 3. Modelo de datos nuevo

### Tabla `polizas_clausulas`

```sql
CREATE TABLE polizas_clausulas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre_corto VARCHAR(100) NOT NULL,
        -- "OCASA", "NEWSAN La Tablada CBN", "NEWSAN La Tablada ID Supply Chain", etc.
    cliente_id BIGINT NULL,
        -- FK a tabla `clientes` existente (si la cláusula aplica directo a un cliente)
    sucursal_id BIGINT NULL,
        -- FK a tabla `sucursales` existente (si aplica a sucursal específica)
    cuit_titular VARCHAR(15) NOT NULL,
        -- "30-66204961-8"
    razon_social_titular VARCHAR(150) NOT NULL,
        -- "OCASA"
    tipo VARCHAR(50) NOT NULL DEFAULT 'no_repeticion',
        -- 'no_repeticion', 'subrogacion', 'otra'
    descripcion_corta VARCHAR(255) NULL,
        -- texto que va inline en el email cuando se aplica:
        -- "Con clausula de Ocasa CUIT N 30 66204961 8"
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE SET NULL,
    INDEX idx_cliente (cliente_id),
    INDEX idx_sucursal (sucursal_id)
);
```

### Tabla pivot `polizas_clausulas_aplicadas`

Registra qué cláusulas están vigentes en cada póliza (histórico de qué se incluyó):

```sql
CREATE TABLE polizas_clausulas_aplicadas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    clausula_id BIGINT NOT NULL,
    aplicada_desde DATE NOT NULL,
    aplicada_hasta DATE NULL,
        -- NULL si está vigente, fecha si fue removida
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    FOREIGN KEY (clausula_id) REFERENCES polizas_clausulas(id),
    UNIQUE KEY uniq_poliza_clausula_desde (poliza_id, clausula_id, aplicada_desde),
    INDEX idx_poliza (poliza_id),
    INDEX idx_clausula (clausula_id)
);
```

### Seed inicial de cláusulas

```sql
INSERT INTO polizas_clausulas (nombre_corto, cuit_titular, razon_social_titular, descripcion_corta, tipo, activa)
VALUES
  ('OCASA',
   '30-66204961-8', 'OCASA',
   'Con clausula de Ocasa CUIT N 30 66204961 8',
   'no_repeticion', TRUE),

  ('URBANO Suc. Moreno - NEWSAN',
   '30-64261755-5', 'NEWSAN S.A.',
   'Con clausula de NEWSAN S.A. CUIT N 30 64261755 5',
   'no_repeticion', TRUE),

  ('NEWSAN La Tablada - CBN',
   '30-71159690-5', 'CBN',
   'Con clausula de CBN CUIT N 30 71159690 5',
   'no_repeticion', TRUE),

  ('NEWSAN La Tablada - ID Supply Chain',
   '30-71069830-5', 'ID Supply Chain S.A.',
   'Con clausula de ID Supply Chain S.A. CUIT N 30 71069830 5',
   'no_repeticion', TRUE),

  ('OCA Parque Norte / Avellaneda',
   '30-71702439-3', 'OCA',
   'Con clausula de No Repetición a nombre de OCA CUIT N 30 71702439 3',
   'no_repeticion', TRUE);

-- Vincular cláusulas con clientes existentes (TODO confirmar IDs reales en clientes)
-- UPDATE polizas_clausulas SET cliente_id = X WHERE nombre_corto = 'OCASA';
-- (Se hace después con los IDs reales de la tabla `clientes`)

-- Aplicar cláusulas a las pólizas correspondientes
SET @poliza_ocasa = (SELECT id FROM polizas WHERE numero_poliza = '2297608');
SET @poliza_urbano = (SELECT id FROM polizas WHERE numero_poliza = '2297847');
SET @poliza_newsan = (SELECT id FROM polizas WHERE numero_poliza = '2298721');

SET @c_ocasa = (SELECT id FROM polizas_clausulas WHERE nombre_corto = 'OCASA');
SET @c_urbano = (SELECT id FROM polizas_clausulas WHERE nombre_corto = 'URBANO Suc. Moreno - NEWSAN');
SET @c_newsan_cbn = (SELECT id FROM polizas_clausulas WHERE nombre_corto = 'NEWSAN La Tablada - CBN');
SET @c_newsan_isc = (SELECT id FROM polizas_clausulas WHERE nombre_corto = 'NEWSAN La Tablada - ID Supply Chain');

INSERT INTO polizas_clausulas_aplicadas (poliza_id, clausula_id, aplicada_desde) VALUES
  (@poliza_ocasa,  @c_ocasa,        '2025-04-08'),
  (@poliza_urbano, @c_urbano,       '2025-04-08'),
  (@poliza_newsan, @c_newsan_cbn,   '2025-04-08'),
  (@poliza_newsan, @c_newsan_isc,   '2025-04-08');
```

---

## 4. Modificación de templates MAPFRE Alta

### Nuevo placeholder a nivel asegurado

`{clausula_inline}` — se renderiza en el `asegurado_template` cuando el admin tildó "incluir cláusula nueva" al solicitar el alta. Si no, queda vacío.

### Nuevo placeholder a nivel body

`{texto_clausula_previa}` — se renderiza en el `body_template` según qué tipo de email se está armando:

| Caso | Renderiza |
|---|---|
| Admin pidió "cláusula NUEVA" para 1+ asegurados | `"\n\nSolicito que se coloquen las cláusulas correspondientes."` (o vacío — la cláusula va inline en el nombre) |
| Admin pidió "cláusula YA VIGENTE en póliza" | `"\n\nPor favor, incluir las mismas cláusulas que figuran en endosos anteriores correspondientes a este número de póliza."` |
| No aplica cláusula | `""` (vacío) |

### Templates actualizados para MAPFRE

Reemplazar el contenido de `polizas_email_config` para las pólizas MAPFRE:

#### MAPFRE - Alta (template universal con cláusulas)

```json
{
  "to": ["TODO_carlos@mapfre.com.ar"],
  "cc": [],
  "bcc": [],
  "contacto_nombre": "Carlos",
  "asunto_template": "Solicitud de Alta - Póliza {numero_poliza}",
  "body_template": "Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.{texto_clausula_previa}\n\nALTAS\n\n{asegurados_block}",
  "asegurado_template": "Nombre Completo: {nombre_apellido}{clausula_inline}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
  "adjuntos_requeridos": []
}
```

### Renderización de placeholders nuevos

```php
// En EmailRenderService
function render_clausula_inline(asegurado_decision) {
    if (asegurado_decision.aplicar_clausula_nueva && asegurado_decision.clausula) {
        return ' (' . asegurado_decision.clausula.descripcion_corta . ')';
        //  "  (Con clausula de Ocasa CUIT N 30 66204961 8)"
    }
    return '';
}

function render_texto_clausula_previa(solicitud) {
    if (solicitud.tipo_clausula == 'nueva') {
        return ''; // la cláusula va inline en cada nombre
    }
    if (solicitud.tipo_clausula == 'previa_existente') {
        return "\n\nPor favor, incluir las mismas cláusulas que figuran en endosos anteriores correspondientes a este número de póliza.";
    }
    return ''; // sin cláusulas
}
```

### Ejemplo renderizado — Estilo A (cláusula inline)

Input:
- Póliza: 2297608 (OCASA)
- 1 asegurado: Maceiro Julian Nicolas (DNI 45893587, nac 20-5-2004)
- Cláusula: "OCASA" (inline)

Output:
```
Buenas Carlos

Me comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° 2297608 de Logística Argentina S.R.L. – CUIT 30-71706098-5.

ALTAS

Nombre Completo: MACEIRO JULIAN NICOLAS (Con clausula de Ocasa CUIT N 30 66204961 8)
DNI: 45893587
Fecha de Nacimiento: 20/05/2004

```

### Ejemplo renderizado — Estilo B (referencia a endosos previos)

Input:
- Póliza: 2297847 (URBANO)
- 3 asegurados sin cláusula nueva (la URBANO ya está vigente en la póliza)

Output:
```
Buenas Carlos

Me comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° 2297847 de Logística Argentina S.R.L. – CUIT 30-71706098-5.

Por favor, incluir las mismas cláusulas que figuran en endosos anteriores correspondientes a este número de póliza.

ALTAS

Nombre Completo: PEREZ JUAN
DNI: 30123456
Fecha de Nacimiento: 15/03/1980

Nombre Completo: GOMEZ ANA
DNI: 31987654
Fecha de Nacimiento: 22/07/1985

Nombre Completo: LOPEZ MIGUEL
DNI: 32555888
Fecha de Nacimiento: 10/11/1990

```

---

## 5. Modificación de la UI — Wizard "Solicitar Alta"

Hoy el wizard tiene 2 pasos (Selección + Preview). Agregar paso intermedio:

### Nuevo Paso 2 — Cláusulas (solo MAPFRE AP)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Solicitar ALTA — MAPFRE AP URBANO (Póliza 2297847)                      │
│                                                                          │
│ [✓ 1. Selección]  [▶ 2. Cláusulas]  [3. Preview]  [4. Enviar]           │
│                                                                          │
│ ¿Cómo querés manejar las cláusulas en este alta?                        │
│                                                                          │
│ ⦿ Usar cláusulas ya vigentes en la póliza (referencia a endosos)        │
│   La aseguradora aplicará las cláusulas que ya están registradas:       │
│   ☑ NEWSAN S.A. - CUIT 30-64261755-5                                    │
│                                                                          │
│ ⚪ Aplicar UNA cláusula nueva inline en cada nombre                      │
│   Cláusula: [Seleccionar... ▼]                                          │
│     · OCASA (CUIT 30-66204961-8)                                        │
│     · NEWSAN La Tablada - CBN (CUIT 30-71159690-5)                      │
│     · NEWSAN La Tablada - ID Supply Chain (CUIT 30-71069830-5)          │
│     · OCA Parque Norte (CUIT 30-71702439-3)                             │
│     · URBANO Suc. Moreno - NEWSAN (CUIT 30-64261755-5)                  │
│                                                                          │
│ ⚪ Sin cláusula                                                          │
│                                                                          │
│ [← Volver]                                          [Continuar ▶]        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Detección automática del estilo por defecto

- Si la póliza ya tiene cláusulas en `polizas_clausulas_aplicadas` con `aplicada_hasta IS NULL` → **default: estilo B** (referencia a endosos previos).
- Si la póliza no tiene cláusulas registradas → **default: ninguna seleccionada** (admin debe decidir).
- Cuando se elige una cláusula nueva → al confirmar el envío, opcionalmente registrar en `polizas_clausulas_aplicadas` (preguntar al admin: "¿La aseguradora ya confirmó esta cláusula? Marcar como vigente").

### Aplicación a otras aseguradoras

Por ahora **solo MAPFRE** muestra este paso. Para San Cristóbal y La Segunda no aparece — siguen funcionando igual que antes.

Cuando llegue la info de la otra aseguradora que mencionó Mati, evaluamos si también necesita el paso.

---

## 6. Endpoints API nuevos

### `GET /api/polizas/clausulas`

Listar catálogo de cláusulas.

```json
{
  "data": [
    {
      "id": 1,
      "nombre_corto": "OCASA",
      "cuit_titular": "30-66204961-8",
      "razon_social_titular": "OCASA",
      "descripcion_corta": "Con clausula de Ocasa CUIT N 30 66204961 8",
      "tipo": "no_repeticion",
      "cliente": {"id": 5, "nombre": "OCASA"},
      "activa": true
    }
  ]
}
```

### `POST /api/polizas/clausulas`

Crear nueva cláusula.

### `PUT /api/polizas/clausulas/{id}`

Editar.

### `GET /api/polizas/{id}/clausulas-vigentes`

Listar cláusulas vigentes en una póliza:

```json
{
  "data": [
    {"id": 1, "nombre_corto": "NEWSAN S.A.", "aplicada_desde": "2025-04-08"},
    {"id": 3, "nombre_corto": "ID Supply Chain S.A.", "aplicada_desde": "2025-04-08"}
  ]
}
```

### `POST /api/polizas/{id}/clausulas-aplicar`

Aplicar cláusula a póliza:

```json
{
  "clausula_id": 1,
  "aplicada_desde": "2026-05-04"
}
```

### `POST /api/polizas/{id}/clausulas-remover`

Remover cláusula (registra `aplicada_hasta`):

```json
{
  "clausula_aplicada_id": 12,
  "aplicada_hasta": "2026-05-04"
}
```

### Cambios en `POST /api/polizas/{id}/solicitudes` (alta)

Agregar campos opcionales:

```json
{
  "tipo": "alta",
  "asegurados_ids": [100, 105],
  "tipo_clausula": "previa_existente" | "nueva" | "ninguna",
  "clausula_id": 1                          // requerido si tipo_clausula="nueva"
}
```

---

## 7. Permisos nuevos

Agregar a `polizas_admin_permisos`:

```sql
ALTER TABLE polizas_admin_permisos
  ADD COLUMN puede_gestionar_clausulas BOOLEAN NOT NULL DEFAULT FALSE AFTER puede_editar_email_config;
```

Solo usuarios con `puede_gestionar_clausulas = TRUE` pueden:
- Crear/editar cláusulas en el catálogo
- Aplicar/remover cláusulas a una póliza

Solicitar alta con cláusula nueva → cualquier usuario con `puede_solicitar_alta` (no requiere permiso especial).

---

## 8. Pantalla de Configuración — Catálogo de cláusulas

Nueva pantalla `/polizas/configuracion/clausulas`:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cláusulas de no repetición                          [+ Nueva cláusula]  │
│                                                                          │
│ Cliente / Sucursal       | Razón social      | CUIT             | Estado│
│ OCASA                    | OCASA             | 30-66204961-8    | activa│
│ URBANO Suc. Moreno       | NEWSAN S.A.       | 30-64261755-5    | activa│
│ NEWSAN La Tablada        | CBN               | 30-71159690-5    | activa│
│ NEWSAN La Tablada        | ID Supply Chain   | 30-71069830-5    | activa│
│ OCA Parque Norte         | OCA               | 30-71702439-3    | activa│
└──────────────────────────────────────────────────────────────────────────┘
```

Click en una fila → modal con detalle + lista de pólizas donde está aplicada.

---

## 9. Validaciones

| Regla | Acción si falla |
|---|---|
| Cláusula con `cuit_titular` válido (formato 99-99999999-9) | Error 422 al guardar |
| `descripcion_corta` no vacía | Error 422 al guardar |
| No remover cláusula vigente sin `aplicada_hasta` | Error 422 |
| Tipo `previa_existente` requiere que la póliza tenga al menos 1 cláusula vigente | Warning + permitir |
| Tipo `nueva` requiere `clausula_id` | Error 422 |

---

## 10. Criterios de aceptación adicionales

- [ ] Las 5 cláusulas seed están cargadas en `polizas_clausulas`.
- [ ] Las 2 pólizas MAPFRE adicionales (URBANO 2297847 y NEWSAN 2298721) están creadas con sus cláusulas vigentes.
- [ ] Al solicitar alta MAPFRE → aparece paso 2 "Cláusulas" con las 3 opciones.
- [ ] **Estilo A** — Selecciono cláusula OCASA → preview muestra `Nombre Completo: PEREZ JUAN (Con clausula de Ocasa CUIT N 30 66204961 8)`.
- [ ] **Estilo B** — Selecciono "Usar cláusulas vigentes" → preview muestra párrafo "Por favor, incluir las mismas cláusulas que figuran en endosos anteriores...".
- [ ] **Estilo C** — Sin cláusula → preview no agrega texto extra.
- [ ] Al solicitar alta San Cristóbal o La Segunda → NO aparece paso 2 (no aplica para esas).
- [ ] CRUD de cláusulas funciona desde `/polizas/configuracion/clausulas`.
- [ ] Auditoría: `polizas_clausulas_aplicadas` registra histórico (no se pisa).

---

## 11. Migración del data existente

Si Francisco ya guardó los templates MAPFRE con texto fijo "cláusulas correspondientes a OCASA", hay que actualizarlos:

```sql
-- Reemplazar el body_template MAPFRE Alta con la versión universal
UPDATE polizas_email_config
   SET body_template = 'Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.{texto_clausula_previa}\n\nALTAS\n\n{asegurados_block}',
       asegurado_template = 'Nombre Completo: {nombre_apellido}{clausula_inline}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n'
 WHERE poliza_id IN (SELECT id FROM polizas WHERE aseguradora_id = (SELECT id FROM polizas_aseguradoras WHERE parser_perfil = 'mapfre'))
   AND tipo = 'alta';

-- Idem para baja MAPFRE (si quieren mantener formato similar)
UPDATE polizas_email_config
   SET body_template = 'Buenas {contacto_nombre}\n\nMe comunico para solicitar la baja del siguiente distribuidor de la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nBAJAS\n\n{asegurados_block}',
       asegurado_template = 'Nombre Completo: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n'
 WHERE poliza_id IN (SELECT id FROM polizas WHERE aseguradora_id = (SELECT id FROM polizas_aseguradoras WHERE parser_perfil = 'mapfre'))
   AND tipo = 'baja';
```

---

## 12. Estimación

| Tarea | Tiempo |
|---|---|
| Tablas nuevas + pivot + seed cláusulas | ½ día |
| Endpoints CRUD cláusulas | ½ día |
| Lógica de render con `{clausula_inline}` y `{texto_clausula_previa}` | ½ día |
| UI paso 2 "Cláusulas" en wizard de alta | ½ día |
| Pantalla `/polizas/configuracion/clausulas` (CRUD UI) | 1 día |
| Migración data + creación 2 pólizas MAPFRE faltantes | ¼ día |
| Smoke tests + validación contra ejemplos | ½ día |
| **TOTAL** | **~3 días** |

---

## 13. Aviso

Mati va a pasar **caso de otra aseguradora** después. Esta lógica de cláusulas (catálogo + aplicación + render inline / referencia previa) **probablemente aplica también** a esa aseguradora. Por eso el modelo es genérico: `polizas_clausulas` no está atado a MAPFRE, vale para cualquier aseguradora.

Cuando llegue, evaluamos si:
- Es solo agregar templates más + asociar cláusulas a sus pólizas (caso ideal).
- Tiene un comportamiento distinto que requiere otro placeholder.

Cualquier duda, cortame en el momento.
