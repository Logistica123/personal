# ADDENDUM 4 — Parser SC para "Anexo de Adherentes" + Notificación al Distribuidor

> Versión: 1.0 · Fecha: 04-may-2026
> Para: IA de Francisco · De: Matías
> Tipo: addendum al spec original. Cubre 2 temas: **bug del parser SC** + **feature nueva de notificación al distribuidor**.

---

## TL;DR

**1. Bug confirmado:** el parser SC actual no detecta los PDFs tipo "Anexo de Adherentes" (formato más común que envía la aseguradora) — devuelve 0 asegurados. El parser solo busca encabezados "Incorporación / Baja / Modificación" pero estos PDFs vienen sin esas secciones.

**2. Feature nueva:** después de cargar una póliza con altas nuevas, mostrar lista de **distribuidores recién dados de alta** y permitir enviar un email automático a su `personas.email` notificándole que está asegurado.

3 PDFs reales agregados en `ejemplos_pdfs/` (06, 07, 08) para que Francisco use como fixtures.

---

## PARTE A — Bug parser SC

## 1. Diagnóstico

### Lo que ve el usuario

```
Aseguradora: san_cristobal · Tipo doc: endoso_modificacion · Asegurados: 0
⚠ Warnings: SC: no se detectó sección de Incorporación / Baja / Modificación
```

### Lo que el PDF realmente contiene

PDFs reales subidos (3 muestras):

| Archivo | N° Póliza | Vigencia | # Asegurados |
|---|---|---|---|
| `06_SanCristobal_AsegAdherentes_30034667.pdf` | 01-06-06-30034667 | 24/10/25 → 24/10/26 | 2 (Fillon, Gudiño) |
| `07_SanCristobal_AsegAdherentes_30034769.pdf` | 01-06-06-30034769 | 29/10/25 → 29/10/26 | 1 (Garcia Alejandro) |
| `08_SanCristobal_AsegAdherentes_30035710.pdf` | 01-06-06-30035710 | 04/05/26 → 05/12/26 | 26 páginas (~700 asegurados) |

### Estructura real del PDF "Anexo de Adherentes"

```
SAN CRISTOBAL S.M.S.G.
CUIT: 34-50004533-9 - IVA: Responsable Inscripto
...

Información de Póliza
TOMADOR | RAMO | VIGENCIA DESDE | VIGENCIA HASTA | ENDOSO
LOGISTICA ARGENTINA SRL | Accidentes personales | 00HS DEL 24/10/2025 | 00HS DEL 24/10/2026 | 0

DIRECCIÓN | N° PÓLIZA / N° FACTURA | PROVINCIA | LUGAR Y FECHA EMISIÓN
- - | 01-06-06-30034667 | 3400 - CORRIENTES CORRIENTES | Resistencia, 24/10/2025

Listado de Asegurados
Grupo 1: Grupo 1
N° ADHERENTE | APELLIDO Y NOMBRES | TIPO Y NRO DE DOC | FECHA NACIMIENTO | OCUPACIÓN | FECHA ALTA
1 | Fillon Brian Nicolas Alejandro | 20-36511252-6 | 19/05/1992 | Chofer camiones carga en general no peligrosa | 24/10/2025
2 | Gudiño Julio Cesar | 20-26309354-3 | 26/12/1977 | Chofer camiones carga en general no peligrosa | 24/10/2025

Anexo de Adherentes 1 de 1   SAN CRISTOBAL S.M.S.G.
```

### Por qué el parser falla

El parser SC actual busca encabezados:
- `Incorporación de Asegurados` → tipo `'incorporacion'`
- `Anulación de Asegurados / Bajas` → tipo `'baja'`
- `Otras Modificaciones` → tipo `'modificacion'`

Pero el "Anexo de Adherentes" usa otra estructura:
- Encabezado: `Anexo de Adherentes N de M`
- Sección: `Listado de Asegurados`
- Subgrupo: `Grupo N: <nombre>` (ej: `Grupo 1: Grupo 1` o `Grupo 1: ASEGURADOS`)
- Tabla con columna **`FECHA ALTA`** (no estaba en el de Endoso)

El parser nunca matchea las palabras clave esperadas y devuelve 0.

---

## 2. Fix — agregar perfil "Anexo de Adherentes" al parser SC

### Detección del tipo de documento

```python
def detectar_tipo_documento_sc(text):
    if re.search(r'Anexo de Adherentes\s+\d+\s+de\s+\d+', text):
        return 'asegurados_adherentes'   # NUEVO TIPO
    if re.search(r'Incorporación de Asegurados', text):
        return 'endoso_incorporacion'
    if re.search(r'Anulación de Asegurados|Bajas', text):
        return 'endoso_baja'
    if re.search(r'Otras Modificaciones', text):
        return 'endoso_modificacion'
    return 'desconocido'
```

### Nuevo tipo enum

Agregar `'asegurados_adherentes'` al ENUM de `polizas_endosos.tipo`:

```sql
ALTER TABLE polizas_endosos
  MODIFY COLUMN tipo ENUM(
    'constancia',
    'incorporacion',
    'baja',
    'modificacion',
    'asegurados_adherentes'   -- NUEVO
  ) NOT NULL;
```

### Parser para "Anexo de Adherentes"

```python
def parse_sc_adherentes(file):
    """
    Parsea PDFs SC tipo 'Anexo de Adherentes'.
    Retorna lista de asegurados con cuil, nombre, fecha_nac, ocupación, fecha_alta.
    """
    asegurados = []
    with pdfplumber.open(file) as pdf:
        # Datos de póliza desde la página 1
        text_p1 = pdf.pages[0].extract_text()
        poliza = {
            'numero_poliza': extract(r'(\d{2}-\d{2}-\d{2}-\d{8})', text_p1),
            'vigencia_desde': parse_date(extract(r'VIGENCIA DESDE.*?(\d{2}/\d{2}/\d{4})', text_p1)),
            'vigencia_hasta': parse_date(extract(r'VIGENCIA HASTA.*?(\d{2}/\d{2}/\d{4})', text_p1)),
            'numero_endoso': extract(r'ENDOSO\s+(\d+)', text_p1),
            'fecha_emision': parse_date(extract(r'Resistencia,\s*(\d{2}/\d{2}/\d{4})', text_p1)),
        }

        # Asegurados desde todas las páginas
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                # Header esperado: ['N° ADHERENTE', 'APELLIDO Y NOMBRES', 'TIPO Y NRO DE DOC',
                #                   'FECHA NACIMIENTO', 'OCUPACIÓN', 'FECHA ALTA']
                header = [c.strip() if c else '' for c in table[0]]
                if not any('ADHERENTE' in h.upper() for h in header):
                    continue

                # Mapear índices de columnas
                col_idx = {
                    'numero': find_col(header, 'ADHERENTE'),
                    'nombre': find_col(header, 'APELLIDO'),
                    'doc': find_col(header, 'DOC'),
                    'fecha_nac': find_col(header, 'NACIMIENTO'),
                    'ocupacion': find_col(header, 'OCUPACIÓN'),
                    'fecha_alta': find_col(header, 'FECHA ALTA'),
                }

                for row in table[1:]:
                    if not row[col_idx['numero']] or not row[col_idx['numero']].strip().isdigit():
                        continue
                    cuil = row[col_idx['doc']].strip()
                    asegurados.append({
                        'tipo': 'persona',
                        'identificador': cuil,
                        'identificador_tipo': 'cuil',
                        'numero_orden_aseguradora': row[col_idx['numero']].strip(),
                        'nombre_apellido': row[col_idx['nombre']].strip(),
                        'fecha_nacimiento': parse_date(row[col_idx['fecha_nac']]),
                        'ocupacion': normalize_ocupacion(row[col_idx['ocupacion']]),
                        'fecha_alta_efectiva': parse_date(row[col_idx['fecha_alta']]),
                    })

    return {
        'tipo_documento': 'asegurados_adherentes',
        'poliza': poliza,
        'asegurados': asegurados,
    }


def normalize_ocupacion(ocup):
    """ Une líneas multi-línea en una sola string. """
    return ' '.join(ocup.split())   # 'Chofer camiones\ncarga en general\nno peligrosa' → 'Chofer camiones carga en general no peligrosa'
```

### Helper `find_col`

```python
def find_col(header, keyword):
    """ Busca el índice de la columna que contiene la keyword (case insensitive). """
    for i, h in enumerate(header):
        if keyword.upper() in h.upper():
            return i
    return -1
```

### Tests sugeridos

```python
def test_sc_adherentes_30034667():
    result = parse_pdf('ejemplos_pdfs/06_SanCristobal_AsegAdherentes_30034667.pdf')
    assert result['aseguradora_detectada'] == 'SAN_CRISTOBAL'
    assert result['tipo_documento'] == 'asegurados_adherentes'
    assert result['poliza']['numero_poliza'] == '01-06-06-30034667'
    assert len(result['asegurados']) == 2
    assert result['asegurados'][0]['nombre_apellido'].startswith('Fillon')
    assert result['asegurados'][0]['fecha_alta_efectiva'] == '2025-10-24'

def test_sc_adherentes_30035710_completo():
    result = parse_pdf('ejemplos_pdfs/08_SanCristobal_AsegAdherentes_30035710.pdf')
    assert result['poliza']['numero_endoso'] == '185'
    assert len(result['asegurados']) > 100   # 26 páginas, mucho asegurados
```

### Pólizas adicionales SC

Las 2 pólizas SC nuevas (30034667 y 30034769) que aparecieron en los PDFs **no están en seed**. ¿Son pólizas operativas distintas a la 30035710 que ya teníamos?

**TODO Mati:** confirmar si las 3 pólizas SC son distintas vigentes en paralelo, o si las 2 viejas (30034667, 30034769) están vencidas/anuladas. Si están vigentes, hay que cargarlas como pólizas separadas en seed.

---

## PARTE B — Feature: Notificación al Distribuidor

## 3. Caso de uso

Cuando se confirma una solicitud de alta o se carga un PDF que da de alta a distribuidores nuevos, el operador quiere notificarles **a ellos** (los distribuidores) que ya tienen cobertura.

### Flujo

```
1. Admin sube PDF "Anexo de Adherentes" o confirma una solicitud de alta enviada
2. Sistema identifica los distribuidores NUEVOS (los que pasaron a estado 'activo' en esta operación)
3. UI muestra modal: "5 distribuidores recién dados de alta. ¿Notificar?"
4. Admin selecciona qué distribuidores notificar (checkboxes, todos por default)
5. Admin previsualiza email
6. Click "Enviar notificaciones"
7. Sistema manda 1 email a cada `persona.email` con template de notificación
8. Queda registrado en log
```

### Texto del email (sugerido)

```
Hola {nombre_apellido},

Te informamos que fuiste dado de alta en la póliza de {tipo_cobertura}
con la aseguradora {aseguradora}, póliza N° {numero_poliza},
con vigencia desde {fecha_alta_efectiva}.

Ya estás cubierto por la póliza. Si tenés alguna duda o querés más
información sobre las condiciones, escribinos a {email_admin}.

Saludos,
Logística Argentina S.R.L.
```

---

## 4. Modelo de datos nuevo

### Tabla `polizas_notificaciones_distribuidor`

```sql
CREATE TABLE polizas_notificaciones_distribuidor (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asegurado_id BIGINT NOT NULL,
    poliza_id BIGINT NOT NULL,
    persona_id BIGINT NOT NULL,
    tipo ENUM('alta','baja') NOT NULL DEFAULT 'alta',
    email_destinatario VARCHAR(150) NOT NULL,
    asunto VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    estado ENUM('pendiente','enviado','rebotado','sin_email') NOT NULL DEFAULT 'pendiente',
    enviado_en TIMESTAMP NULL,
    error_envio TEXT NULL,
    enviado_por_user_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asegurado_id) REFERENCES polizas_asegurados(id) ON DELETE CASCADE,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id),
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (enviado_por_user_id) REFERENCES users(id),
    INDEX idx_persona (persona_id),
    INDEX idx_estado (estado),
    INDEX idx_poliza (poliza_id)
);
```

### Templates a nivel póliza (notificación)

Agregar tabla `polizas_notif_distribuidor_config` (1 por póliza):

```sql
CREATE TABLE polizas_notif_distribuidor_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    asunto_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    cc_admin_email VARCHAR(150) NULL,    -- copia opcional al admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_poliza (poliza_id)
);
```

### Seed por póliza (genérico)

```sql
-- Default para todas las pólizas activas
INSERT INTO polizas_notif_distribuidor_config (poliza_id, asunto_template, body_template)
SELECT id,
       'Alta en póliza {numero_poliza} - {aseguradora}',
       'Hola {nombre_apellido},\n\nTe informamos que fuiste dado de alta en la póliza de {ramo} con la aseguradora {aseguradora}, póliza N° {numero_poliza}, con vigencia desde {fecha_alta_efectiva}.\n\nYa estás cubierto por la póliza. Si tenés alguna duda o querés más información sobre las condiciones, escribinos a {email_admin}.\n\nSaludos,\nLogística Argentina S.R.L.'
  FROM polizas
 WHERE activa = TRUE;
```

---

## 5. Detección de "altas nuevas"

Al confirmar una carga de PDF o una solicitud, el sistema compara el estado **antes vs después** y detecta los asegurados que pasaron de:

- `no existían` → `activo` (alta directa por carga de constancia)
- `alta_solicitada` → `activo` (confirmación de solicitud)

```php
function detectar_altas_nuevas($poliza_id, $cambios_recientes) {
    $altas = [];
    foreach ($cambios_recientes as $asegurado) {
        if ($asegurado->estado_anterior IN ['no_existia', 'alta_solicitada']
            && $asegurado->estado_actual == 'activo') {
            // Solo si tiene persona vinculada con email
            if ($asegurado->persona_id && $asegurado->persona->email) {
                $altas[] = $asegurado;
            }
        }
    }
    return $altas;
}
```

### Casos donde NO se notifica

- Asegurado sin `persona_id` (no matcheado)
- Persona sin email cargado (`personas.email = NULL` o vacío)
- Admin desmarca el asegurado en el modal de selección
- Notificación ya enviada (mismo asegurado, misma póliza) → no duplicar
- Póliza tiene `polizas_notif_distribuidor_config.activo = FALSE`

---

## 6. UI nueva — Modal post-carga / post-confirmación

### Trigger

Aparece después de:
- Confirmar carga de PDF con altas
- Confirmar solicitud de alta como respondida_ok

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Carga aplicada — 5 asegurados nuevos en San Cristóbal AP Colectivo       │
│                                                                          │
│ ¿Querés notificar a los distribuidores que ya están asegurados?         │
│                                                                          │
│ ☑ Fillon Brian Nicolas    fillon@email.com         CUIL 20-36511252-6   │
│ ☑ Gudiño Julio Cesar      gudino@email.com          CUIL 20-26309354-3  │
│ ☑ Garcia Alejandro Agustin garcia@email.com        CUIL 20-24031978-1   │
│ ☐ Pérez Juan              (sin email — no se puede notificar)           │
│ ☑ Lopez Carlos            lopez@email.com          CUIL 20-30123456-1   │
│                                                                          │
│ Email a enviar (preview):                                                │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Asunto: Alta en póliza 01-06-06-30035710 - San Cristóbal           │ │
│ │                                                                     │ │
│ │ Hola {nombre_apellido},                                             │ │
│ │ Te informamos que fuiste dado de alta en la póliza...               │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [✏ Editar template]                                                     │
│                                                                          │
│ [No notificar ahora]                          [Enviar 4 notificaciones] │
└──────────────────────────────────────────────────────────────────────────┘
```

### Si admin elige "No notificar ahora"

Las notificaciones quedan en estado `pendiente` en `polizas_notificaciones_distribuidor`. Admin puede ir a `/polizas/notificaciones-pendientes` y enviarlas después.

---

## 7. Pantalla nueva — Bandeja de notificaciones

`/polizas/notificaciones`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Notificaciones a distribuidores                                          │
│                                                                          │
│ Filtros: [Estado ▼] [Póliza ▼] [Fecha ▼]                                 │
│                                                                          │
│ #  | Distribuidor          | Póliza             | Estado       | Acción │
│ 18 | Fillon Brian Nicolas | SC AP Colectivo    | enviado ✓     | Ver    │
│ 17 | Gudiño Julio Cesar   | SC AP Colectivo    | enviado ✓     | Ver    │
│ 16 | Garcia Alejandro     | SC AP 30034769     | sin_email ⚠   | Ver    │
│ 15 | Lopez Carlos         | MAPFRE OCASA       | pendiente     | Enviar │
│ 14 | Pérez Juan           | La Segunda Autos   | rebotado ✗    | Reenviar│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Endpoints API nuevos

### `POST /api/polizas/{id}/notificaciones-distribuidor/preview`

Genera la lista de altas recientes pendientes de notificar.

**Response:**
```json
{
  "altas_nuevas": [
    {
      "asegurado_id": 100,
      "persona_id": 42,
      "nombre_apellido": "Fillon Brian Nicolas",
      "email": "fillon@email.com",
      "puede_notificar": true,
      "ya_notificado_antes": false
    },
    {
      "asegurado_id": 101,
      "persona_id": 50,
      "nombre_apellido": "Pérez Juan",
      "email": null,
      "puede_notificar": false,
      "razon": "sin_email"
    }
  ],
  "template_preview": {
    "asunto": "Alta en póliza 01-06-06-30035710 - San Cristóbal",
    "body": "Hola Fillon Brian Nicolas,\n\nTe informamos..."
  }
}
```

### `POST /api/polizas/{id}/notificaciones-distribuidor/enviar`

Crea registros y envía emails.

**Request:**
```json
{
  "asegurados_ids": [100, 102, 105]
}
```

**Response:**
```json
{
  "enviadas": 3,
  "fallidas": 0,
  "ids_creados": [18, 19, 20]
}
```

### `GET /api/polizas/notificaciones`

Bandeja con filtros.

### `POST /api/polizas/notificaciones/{id}/reenviar`

Reenvía notificación rebotada o pendiente.

### `PUT /api/polizas/{id}/notif-distribuidor-config`

Editar template del email por póliza.

```json
{
  "asunto_template": "...",
  "body_template": "...",
  "cc_admin_email": "msanchez@logarg...",
  "activo": true
}
```

---

## 9. Placeholders del template notificación

| Placeholder | Valor |
|---|---|
| `{nombre_apellido}` | Nombre completo del distribuidor |
| `{numero_poliza}` | "01-06-06-30035710" |
| `{aseguradora}` | "San Cristóbal", "MAPFRE", "La Segunda" |
| `{ramo}` | "Accidentes Personales" o "Vehículos" (legible) |
| `{fecha_alta_efectiva}` | "24/10/2025" |
| `{vigencia_hasta}` | "05/12/2026" |
| `{email_admin}` | Email del admin que crea (para que el distribuidor pueda responder a alguien específico) |
| `{razon_social_logarg}` | "Logística Argentina S.R.L." |

---

## 10. Permisos

Agregar permiso en `polizas_admin_permisos`:

```sql
ALTER TABLE polizas_admin_permisos
  ADD COLUMN puede_notificar_distribuidores BOOLEAN NOT NULL DEFAULT FALSE
  AFTER puede_gestionar_clausulas;
```

---

## 11. Configuración de email

Las notificaciones a distribuidores usan el **mismo SMTP institucional** (`POLIZAS_SMTP_*` definido en el spec original) que las solicitudes a aseguradoras.

`Reply-To` = email del admin que disparó las notificaciones.

---

## 12. Criterios de aceptación

### Parser

- [ ] Subir `06_SanCristobal_AsegAdherentes_30034667.pdf` → detecta tipo `asegurados_adherentes`, parsea 2 asegurados (Fillon, Gudiño).
- [ ] Subir `08_SanCristobal_AsegAdherentes_30035710.pdf` → parsea ~700 asegurados de las 26 páginas.
- [ ] Cada asegurado tiene `cuil`, `nombre_apellido`, `fecha_nacimiento`, `ocupacion` (multi-línea normalizada), `fecha_alta_efectiva`.
- [ ] El parser sigue funcionando OK con `03_SanCristobal_FrenteEndoso_47.pdf` (no romper el detector previo).

### Notificaciones

- [ ] Después de confirmar carga con 5 altas → modal pregunta "¿Notificar?" con la lista.
- [ ] Asegurados sin email aparecen pero deshabilitados con etiqueta "sin email".
- [ ] Click "Enviar 4 notificaciones" → 4 emails llegan a las casillas de los distribuidores.
- [ ] Cada email tiene asunto y body resueltos correctamente.
- [ ] `polizas_notificaciones_distribuidor` tiene 4 filas con estado `enviado`.
- [ ] El distribuidor sin email tiene fila con estado `sin_email`.
- [ ] Reintentar notificación rebotada funciona desde la bandeja.
- [ ] Si admin elige "No notificar ahora" → quedan pendientes y se pueden enviar luego desde `/polizas/notificaciones`.
- [ ] El template se puede editar por póliza desde `/polizas/{id}/configuracion` → tab "Notificación distribuidor".

---

## 13. Estimación

### Parser SC adherentes

| Tarea | Tiempo |
|---|---|
| Agregar tipo `asegurados_adherentes` al ENUM | ¼ día |
| Implementar `parse_sc_adherentes()` con `pdfplumber.extract_tables()` | 1 día |
| Tests con los 3 PDFs de muestra | ¼ día |
| **Subtotal parser** | **~1.5 días** |

### Notificación al distribuidor

| Tarea | Tiempo |
|---|---|
| Migración: 2 tablas nuevas + columna permiso | ¼ día |
| Lógica de detección "altas nuevas" + endpoint preview | ½ día |
| Endpoint enviar + integración SMTP | ½ día |
| Modal post-carga + UI preview | 1 día |
| Pantalla bandeja `/polizas/notificaciones` | ½ día |
| UI configuración template por póliza | ½ día |
| Smoke tests | ½ día |
| **Subtotal notificación** | **~3.75 días** |

### Total addendum 4

**~5 días** sobre el resto.

---

## 14. PDFs nuevos en `ejemplos_pdfs/`

Se sumaron 3 archivos a la carpeta para tests del parser:

- `06_SanCristobal_AsegAdherentes_30034667.pdf` — 1 página, 2 asegurados (póliza nueva, Endoso 0)
- `07_SanCristobal_AsegAdherentes_30034769.pdf` — 1 página, 1 asegurado (póliza nueva, Endoso 0)
- `08_SanCristobal_AsegAdherentes_30035710.pdf` — 26 páginas, ~700 asegurados (póliza ya existente en seed, Endoso 185)

---

## 15. TODO confirmaciones

- [ ] **¿Las pólizas SC 30034667 y 30034769 son distintas a la 30035710?** Si están todas activas en paralelo, hay que crearlas en seed.
- [ ] **Email de Logística Argentina como remitente para notificación distribuidor:** ¿el mismo `polizas@logarg...` que usamos para aseguradoras, u otro distinto tipo `notificaciones@...`?

Cualquier duda, cortame en el momento.
