# API REST — Endpoints

> Prefijo: `/api/polizas` · Auth: igual al resto del sistema (Bearer token Laravel Sanctum)

---

## Pólizas

### `GET /api/polizas`

Listar pólizas (con filtros).

**Query params:**
- `aseguradora_id` (int, opcional)
- `ramo` (string, opcional): `accidentes_personales` | `vehiculos`
- `activa` (bool, opcional, default true)
- `proximas_a_vencer` (bool, opcional): aplica filtro de alerta_dias
- `search` (string, opcional): busca en `nombre_descriptivo` y `numero_poliza`

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "aseguradora": {"id": 1, "nombre": "MAPFRE"},
      "nombre_descriptivo": "MAPFRE - AP Distribuidores",
      "ramo": "accidentes_personales",
      "numero_poliza": "2297608",
      "vigencia_desde": "2025-04-08",
      "vigencia_hasta": "2026-04-08",
      "dias_para_vencer": -27,
      "cantidad_vidas_unidades": 88,
      "discrepancias": {"sin_persona": 3, "sin_poliza": 2, "dudosos": 1},
      "activa": true
    }
  ]
}
```

### `GET /api/polizas/{id}`

Detalle de póliza con email_config y endosos.

### `POST /api/polizas`

Crear póliza nueva (manual, sin parsear PDF).

### `PUT /api/polizas/{id}`

Editar datos generales.

### `DELETE /api/polizas/{id}`

Soft delete (marca `activa = false`, no elimina).

---

## Asegurados

### `GET /api/polizas/{id}/asegurados`

Listar asegurados de una póliza.

**Query params:**
- `estado` (opcional): `activo` | `baja_solicitada` | etc.
- `con_match` (bool, opcional)
- `search` (string, opcional): busca en `nombre_apellido_pdf`, `identificador`

**Response 200:**
```json
{
  "data": [
    {
      "id": 100,
      "tipo_asegurado": "persona",
      "identificador": "31675826",
      "identificador_tipo": "dni",
      "nombre_apellido_pdf": "Yacob Jorge Dario",
      "persona": {
        "id": 42,
        "nombre_completo": "YACOB JORGE DARIO",
        "perfil": "Distribuidor",
        "estado": "Activo"
      },
      "match_score": 1.000,
      "match_metodo": "cuil_exacto",
      "estado": "activo",
      "alta_endoso": {"id": 5, "numero": "118", "fecha": "2026-03-30"},
      "fecha_alta_efectiva": "2026-03-30"
    }
  ]
}
```

### `GET /api/polizas/{id}/discrepancias`

3 reportes de discrepancia.

**Response 200:**
```json
{
  "asegurados_sin_persona": [
    {
      "asegurado_id": 105,
      "identificador": "12345678",
      "nombre_apellido_pdf": "PEREZ JUAN",
      "creado_en": "2026-03-30",
      "riesgo": "fantasma"
    }
  ],
  "personas_sin_poliza": [
    {
      "persona_id": 88,
      "nombre_completo": "GOMEZ ANA MARIA",
      "perfil": "Distribuidor",
      "fecha_alta": "2026-04-15",
      "riesgo": "sin_cobertura"
    }
  ],
  "match_dudoso": [
    {
      "asegurado_id": 110,
      "persona_id_sugerida": 55,
      "nombre_pdf": "RUIZ NESTOR",
      "nombre_persona": "RUIZ NESTOR ALBERTO",
      "score": 0.870,
      "motivo": "fuzzy_nombre con score < 0.95"
    }
  ]
}
```

---

## Carga de PDF

### `POST /api/polizas/{id}/cargar-pdf`

Sube PDF, parsea, devuelve preview sin aplicar cambios.

**Request:** `multipart/form-data` con `file=<PDF>`

**Response 200:**
```json
{
  "preview_id": "uuid-temp",
  "aseguradora_detectada": "SAN_CRISTOBAL",
  "tipo_documento": "endoso_incorporacion",
  "endoso": {
    "numero_endoso": "118",
    "fecha_emision": "2026-03-30",
    "tipo": "incorporacion"
  },
  "asegurados_parseados": 3,
  "matching_resultado": {
    "matches_exactos": 2,
    "matches_dudosos": 0,
    "sin_match": 1
  },
  "preview": [
    {
      "identificador": "20-31675826-7",
      "nombre_apellido_pdf": "Yacob Jorge Dario",
      "match_persona": {"id": 42, "nombre": "YACOB JORGE DARIO"},
      "score": 1.0,
      "metodo": "cuil_exacto",
      "accion": "alta_persona_existente"
    },
    {
      "identificador": "20-99999999-9",
      "nombre_apellido_pdf": "INEXISTENTE PEPE",
      "match_persona": null,
      "score": null,
      "metodo": null,
      "accion": "alta_sin_match"   // requiere decisión manual
    }
  ],
  "warnings": []
}
```

### `POST /api/polizas/{id}/confirmar-carga`

Aplica el preview previo.

**Request:**
```json
{
  "preview_id": "uuid-temp",
  "decisiones": [
    {"asegurado_idx": 1, "accion": "ignorar"},
    {"asegurado_idx": 2, "accion": "crear_persona", "persona_data": {...}}
  ]
}
```

**Response 200:** lista de IDs de asegurados creados/actualizados.

---

## Endosos

### `GET /api/polizas/{id}/endosos`

Histórico de endosos.

```json
{
  "data": [
    {
      "id": 5,
      "numero_endoso": "118",
      "tipo": "incorporacion",
      "fecha_emision": "2026-03-30",
      "descripcion": "Incorporación de 3 asegurados",
      "premio_endoso": 56941.00,
      "archivo": {"id": 200, "nombre": "endoso_47.pdf", "url": "/api/archivos/200/descargar"}
    }
  ]
}
```

---

## Solicitudes

### `POST /api/polizas/{id}/solicitudes`

Crear solicitud de alta o baja (estado inicial: `borrador`).

**Request:**
```json
{
  "tipo": "baja",
  "asegurados_ids": [100, 105, 110]
}
```

**Response 200:**
```json
{
  "id": 30,
  "estado": "borrador",
  "preview_url": "/api/polizas/solicitudes/30/preview"
}
```

### `GET /api/polizas/solicitudes`

Bandeja con filtros.

**Query params:**
- `estado` (opcional)
- `poliza_id` (opcional)
- `fecha_desde`, `fecha_hasta` (opcional)

### `GET /api/polizas/solicitudes/{id}`

Detalle.

### `POST /api/polizas/solicitudes/{id}/preview`

Renderiza el email sin enviarlo. Devuelve to/cc/asunto/body finales y verifica adjuntos.

**Response 200:**
```json
{
  "to": ["altas@sancristobal.com.ar"],
  "cc": [],
  "asunto": "Altas - Póliza 01-06-06-30035710",
  "body": "Cliente Póliza 01-06-06-30035710 ...\n\nInforma Altas\n\nPenas Sali Fernando ...",
  "adjuntos_requeridos_check": {
    "ok": true,
    "faltantes": []
  }
}
```

Si `adjuntos_requeridos_check.ok = false`:
```json
{
  "adjuntos_requeridos_check": {
    "ok": false,
    "faltantes": [
      {"persona_id": 42, "nombre": "GOMEZ ANA", "categoria_faltante": "foto_frente"},
      {"persona_id": 42, "nombre": "GOMEZ ANA", "categoria_faltante": "cedula_frente"}
    ]
  }
}
```

### `POST /api/polizas/solicitudes/{id}/enviar`

Envía el email vía SMTP institucional.

**Request:** vacío (toma la solicitud existente).

**Response 200:**
```json
{
  "estado": "enviado",
  "enviado_en": "2026-05-04T16:30:00",
  "email_message_id": "<abc123@logisticaargentina.com.ar>"
}
```

**Errores:**
- `422` si faltan adjuntos (con detalle)
- `500` si falla SMTP

### `POST /api/polizas/solicitudes/{id}/confirmar`

Marca como respondida.

**Request:**
```json
{
  "tipo_respuesta": "ok" | "rechazada",
  "resumen": "Aseguradora confirmó alta el 06/05",
  "fecha_efectiva": "2026-05-06"   // opcional
}
```

**Efectos:**
- Si `tipo_respuesta = ok` y `tipo_solicitud = alta` → asegurados pasan a `activo`, registra `fecha_alta_efectiva`.
- Si `tipo_respuesta = ok` y `tipo_solicitud = baja` → asegurados pasan a `dado_de_baja`, registra `fecha_baja_efectiva`.
- Si `tipo_respuesta = rechazada` → asegurados vuelven al estado anterior; solicitud queda con detalle del rechazo.

### `POST /api/polizas/solicitudes/{id}/cancelar`

Cancela una solicitud en estado `borrador` o `enviado` (si cancelas un enviado, queda como histórico).

---

## Configuración

### `GET /api/polizas/aseguradoras`

Listar aseguradoras.

### `PUT /api/polizas/{id}/email-config/{tipo}`

Editar template de email (solo con permiso `puede_editar_email_config`).

**Request:**
```json
{
  "destinatarios_to": ["..."],
  "destinatarios_cc": ["..."],
  "contacto_nombre": "Carlos",
  "asunto_template": "...",
  "body_template": "...",
  "asegurado_template": "...",
  "adjuntos_requeridos": ["foto_frente", ...]
}
```

### `POST /api/polizas/email-config/{id}/probar`

Renderiza el template con asegurados de ejemplo (no envía).

**Request:**
```json
{
  "asegurados_ejemplo": [
    {"nombre_apellido": "PEREZ JUAN", "dni": "30123456", "fecha_nac": "15/03/1980"}
  ]
}
```

**Response:** body renderizado.

---

## Administrativos

### `GET /api/polizas/admins`

Listar usuarios con permisos en pólizas.

### `POST /api/polizas/admins`

Vincular usuario.

```json
{
  "user_id": 12,
  "puede_cargar_pdf": true,
  "puede_solicitar_alta": true,
  "puede_solicitar_baja": true,
  "puede_confirmar_respuesta": true,
  "puede_editar_email_config": false,
  "recibe_alertas_vencimiento": true
}
```

### `PUT /api/polizas/admins/{id}`

Editar permisos.

### `DELETE /api/polizas/admins/{id}`

Desvincular.

---

## Dashboard / alertas

### `GET /api/polizas/dashboard/alertas`

```json
{
  "polizas_proximas_vencimiento": [
    {"id": 4, "nombre": "La Segunda Motos", "vigencia_hasta": "2026-05-31", "dias_restantes": 27}
  ],
  "solicitudes_sin_respuesta": [
    {"id": 30, "tipo": "alta", "enviado_en": "2026-04-25", "dias_pendiente": 9}
  ],
  "discrepancias_totales": {
    "sin_persona": 3,
    "sin_poliza": 5,
    "dudosos": 2
  }
}
```

---

## Permisos por endpoint

| Endpoint | Permiso requerido |
|---|---|
| `GET /polizas/*` | autenticado |
| `POST /polizas` (crear) | admin sistema |
| `PUT /polizas/{id}` (editar) | admin sistema |
| `POST /polizas/{id}/cargar-pdf` | `puede_cargar_pdf` |
| `POST /polizas/{id}/confirmar-carga` | `puede_cargar_pdf` |
| `POST /polizas/{id}/solicitudes` (alta) | `puede_solicitar_alta` |
| `POST /polizas/{id}/solicitudes` (baja) | `puede_solicitar_baja` |
| `POST /polizas/solicitudes/{id}/enviar` | `puede_solicitar_alta` o `_baja` (según tipo) |
| `POST /polizas/solicitudes/{id}/confirmar` | `puede_confirmar_respuesta` |
| `PUT /polizas/{id}/email-config/{tipo}` | `puede_editar_email_config` |
| `POST /polizas/admins/*` | admin sistema |
