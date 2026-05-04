# Email Templates por Póliza

> Cada póliza tiene 1-2 templates: alta y/o baja. Persistidos en `polizas_email_config`.

---

## Sistema de placeholders

### Globales (resueltos al renderizar)

| Placeholder | Valor | Origen |
|---|---|---|
| `{numero_poliza}` | "01-06-06-30035710" | `polizas.numero_poliza` |
| `{numero_cuenta}` | "01-02297625" | `polizas.numero_cuenta_cliente` |
| `{contacto_nombre}` | "Carlos", "Ramón" | `polizas_email_config.contacto_nombre` |
| `{cuit_logarg}` | "30-71706098-5" | constante |
| `{razon_social_logarg}` | "Logística Argentina S.R.L." | constante |
| `{admin_nombre}` | "Matías Sánchez" | usuario logueado |
| `{admin_email}` | "msanchez@logarg..." | usuario logueado |
| `{fecha_solicitud}` | "04/05/2026" | now() |
| `{asegurados_block}` | (render iterado) | Ver abajo |

### A nivel asegurado (dentro del `asegurado_template`)

| Placeholder | Valor |
|---|---|
| `{nombre_apellido}` | "Yacob Jorge Dario" |
| `{cuil}` | "20-31675826-7" |
| `{cuil_sin_guiones}` | "20316758267" |
| `{dni}` | "31675826" |
| `{fecha_nac}` | "17/07/1985" (formato DD/MM/AAAA) |
| `{patente}` | "IWK373" |
| `{marca_modelo}` | "ATEGO 1418-48" |
| `{tipo_vehiculo}` | "CAMIONES SEMI-PESADOS" |
| `{numero_orden_aseguradora}` | "412" |

---

## Renderizado del `{asegurados_block}`

```python
def render_asegurados_block(template, asegurados):
    lines = []
    for a in asegurados:
        line = template
        line = line.replace('{nombre_apellido}', a.nombre_apellido or '')
        line = line.replace('{cuil}', a.cuil or '')
        line = line.replace('{cuil_sin_guiones}', a.cuil.replace('-','') if a.cuil else '')
        line = line.replace('{dni}', a.dni or '')
        line = line.replace('{fecha_nac}', formatear_fecha(a.fecha_nac))
        line = line.replace('{patente}', a.patente or '')
        # ... resto
        lines.append(line)
    return '\n'.join(lines)
```

Separador entre asegurados: `\n` (newline). Para SC el template ya viene en una línea, para MAPFRE viene en bloque de 3 líneas — el `\n` final del template se encarga.

---

## Template 1 — MAPFRE Alta

```json
{
  "to": ["TODO_carlos@mapfre.com.ar"],
  "cc": [],
  "bcc": [],
  "contacto_nombre": "Carlos",
  "asunto": "Solicitud de Alta - Póliza {numero_poliza}",
  "body": "Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nEn este número de póliza se encuentran las cláusulas correspondientes a OCASA, por lo que solicitamos incluirlas, por favor.\n\nALTAS\n\n{asegurados_block}",
  "asegurado_template": "Apellido y Nombre: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
  "adjuntos_requeridos": []
}
```

### Ejemplo renderizado

Asegurados: PEREZ JUAN (DNI 30123456 nac 15/03/1980), GOMEZ ANA (DNI 31987654 nac 22/07/1985).

```
Buenas Carlos

Me comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° 2297608 de Logística Argentina S.R.L. – CUIT 30-71706098-5.

En este número de póliza se encuentran las cláusulas correspondientes a OCASA, por lo que solicitamos incluirlas, por favor.

ALTAS

Apellido y Nombre: PEREZ JUAN
DNI: 30123456
Fecha de Nacimiento: 15/03/1980

Apellido y Nombre: GOMEZ ANA
DNI: 31987654
Fecha de Nacimiento: 22/07/1985

```

---

## Template 2 — MAPFRE Baja

```json
{
  "to": ["TODO_carlos@mapfre.com.ar"],
  "cc": [],
  "bcc": [],
  "contacto_nombre": "Carlos",
  "asunto": "Solicitud de Baja - Póliza {numero_poliza}",
  "body": "Buenas {contacto_nombre}\n\nMe comunico para solicitar la baja de los siguientes distribuidores de la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nBAJAS\n\n{asegurados_block}",
  "asegurado_template": "Apellido y Nombre: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
  "adjuntos_requeridos": []
}
```

---

## Template 3 — San Cristóbal Alta

```json
{
  "to": ["TODO_altas@sancristobal.com.ar"],
  "cc": [],
  "bcc": [],
  "contacto_nombre": null,
  "asunto": "Altas - Póliza {numero_poliza}",
  "body": "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma Altas\n\n{asegurados_block}",
  "asegurado_template": "{nombre_apellido} CUIL: {cuil_sin_guiones} FECHA DE NACIMIENTO: {fecha_nac}",
  "adjuntos_requeridos": []
}
```

### Ejemplo renderizado

Asegurados: Penas Sali Fernando Lionel (CUIL 20-21131674-9 nac 03/12/1969), Fleitas Pedro Sebastian (CUIL 20-28101530-4 nac 23/03/1980).

```
Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_ N° cuenta: 01-02297625

Informa Altas

Penas Sali Fernando Lionel CUIL: 20211316749 FECHA DE NACIMIENTO: 03/12/1969
Fleitas Pedro Sebastian CUIL: 20281015304 FECHA DE NACIMIENTO: 23/03/1980
```

---

## Template 4 — San Cristóbal Baja

```json
{
  "to": ["TODO_bajas@sancristobal.com.ar"],
  "cc": [],
  "bcc": [],
  "contacto_nombre": null,
  "asunto": "Bajas - Póliza {numero_poliza}",
  "body": "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma BAJAS\n\n{asegurados_block}",
  "asegurado_template": "{nombre_apellido} CUIL: {cuil_sin_guiones} FECHA DE NACIMIENTO: {fecha_nac}",
  "adjuntos_requeridos": []
}
```

---

## Template 5 — La Segunda Autos Alta

```json
{
  "to": ["TODO_ramon.morel@lasegunda.com.ar"],
  "cc": [
    "TODO_comercial.corrientes@lasegunda.com.ar",
    "TODO_admin1@logarg...",
    "TODO_admin2@logarg..."
  ],
  "bcc": [],
  "contacto_nombre": "Ramón",
  "asunto": "NUEVA ALTA - {patente}",
  "body": "Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.\n\nSolicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.\n\nEstoy atenta a cualquier novedad.\n\nSaludos!",
  "asegurado_template": "{patente}",
  "adjuntos_requeridos": [
    "foto_frente",
    "foto_lateral_der",
    "foto_lateral_izq",
    "foto_trasera",
    "cedula_frente"
  ]
}
```

### Caso especial — La Segunda Autos solo permite 1 vehículo por solicitud

El asunto incluye la patente directamente (`NUEVA ALTA - NJM322`). Para no romper el flujo:

- Si el admin selecciona 1 vehículo → asunto = `NUEVA ALTA - {patente}` y body queda como está.
- Si selecciona N vehículos → forzar 1 solicitud por vehículo (la UI lo divide automáticamente y manda N emails).

Por qué: cada vehículo necesita sus propias 5 fotos + cédula. No tiene sentido juntarlos.

---

## Template 6 — La Segunda Autos Baja

```json
{
  "to": ["TODO_comercial.corrientes@lasegunda.com.ar"],
  "cc": ["TODO_ramon.morel@lasegunda.com.ar", "TODO_admin@logarg..."],
  "bcc": [],
  "contacto_nombre": "Ramón",
  "asunto": "BAJA",
  "body": "Buenos días {contacto_nombre}\n\nSolicito bajas de las siguientes unidades que se encuentran dentro de la flota de Logística Argentina.\n\n{asegurados_block}\n\nAguardo confirmación\n\nSaludos",
  "asegurado_template": "{patente}",
  "adjuntos_requeridos": []
}
```

### Ejemplo renderizado

Asegurados: JLE386, KOM123, LEM456.

```
Buenos días Ramón

Solicito bajas de las siguientes unidades que se encuentran dentro de la flota de Logística Argentina.

JLE386
KOM123
LEM456

Aguardo confirmación

Saludos
```

---

## Templates 7-8 — La Segunda Motos Alta/Baja

Idénticos a los de Autos — cambian solo el asunto y la palabra "moto" en lugar de "unidad" donde corresponda. Ver `02_MIGRATION.sql` seed.

---

## Adjuntos requeridos — La Segunda Autos/Motos Alta

### Slugs reservados

| Slug | Descripción |
|---|---|
| `foto_frente` | Foto del frente del vehículo |
| `foto_lateral_der` | Foto del lateral derecho |
| `foto_lateral_izq` | Foto del lateral izquierdo |
| `foto_trasera` | Foto de la parte trasera |
| `cedula_frente` | Foto del frente de la cédula |
| `cedula_dorso` | Foto del dorso de la cédula (opcional) |
| `dni_frente` | DNI del titular (no requerido por La Segunda) |

### Validación pre-envío

```python
def validar_adjuntos(persona, adjuntos_requeridos):
    archivos = persona.archivos.where_in('categoria', adjuntos_requeridos).get()
    presentes = set([a.categoria for a in archivos])
    requeridos = set(adjuntos_requeridos)
    faltantes = requeridos - presentes
    if faltantes:
        raise ValidationError(
            f"Faltan los siguientes documentos del proveedor {persona.nombre}: {faltantes}"
        )
    return [a.id for a in archivos]
```

Se ejecuta antes del envío. Si faltan → bloqueo + mensaje claro al admin con la lista de qué falta.

---

## UI de edición de templates

Pantalla `/polizas/{id}/configuracion` con dos tabs (Alta / Baja). Cada tab tiene:

- Editor de destinatarios To / CC / BCC (chips)
- Input contacto_nombre
- Input asunto_template (con preview live)
- Textarea body_template (con preview live)
- Textarea asegurado_template (con preview live)
- Multi-select adjuntos_requeridos (chips de los slugs reservados)
- Botón "Probar con asegurados de ejemplo" → renderiza el preview completo
- Botón "Guardar"

Permiso: solo usuarios con `puede_editar_email_config = TRUE` pueden modificar.
