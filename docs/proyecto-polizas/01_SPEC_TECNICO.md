# SPEC TÉCNICO — Módulo Pólizas

> Versión: 1.0 · 04-may-2026
> Autor: Matías · Para: Francisco

---

## 1. Resumen ejecutivo

### Problema

Logística Argentina paga 3 aseguradoras (MAPFRE, San Cristóbal, La Segunda) que cubren ~88 personas + flota de vehículos y motos. Hoy:

- No hay forma sistemática de saber **si todos los asegurados de las pólizas siguen activos** como distribuidores → se pagan seguros de personas/vehículos que ya no operan.
- Las altas y bajas se piden manualmente por email → sin trazabilidad, errores administrativos.
- No hay alerta de vencimiento de pólizas.

### Solución

Módulo nuevo `Pólizas` con:

1. **Carga de PDFs** de aseguradoras (constancias + endosos) con parsing automático.
2. **Cruce** contra base de proveedores (`personas`) para detectar discrepancias.
3. **Solicitudes de alta/baja** a la aseguradora desde la plataforma con templates predefinidos por póliza.
4. **Vinculación de administrativos** con permisos para gestionar el módulo.
5. **Alertas** de vencimiento de póliza (15 días antes).

### Resultado esperado

- 0 asegurados "fantasma" (que paguemos seguros sin que correspondan).
- Trazabilidad completa de altas/bajas.
- Email institucional unificado para comunicación con aseguradoras.
- Renovaciones de póliza con aviso anticipado.

---

## 2. Alcance funcional

### Casos de uso

**CU-01: Cargar PDF de aseguradora**

```
Actor: Administrativo
1. Selecciona póliza destino
2. Sube PDF (constancia o endoso)
3. Sistema detecta tipo (auto-detect por encabezado) y parsea
4. Sistema cruza asegurados/vehículos contra `personas`
5. Muestra preview con: matches, discrepancias, dudosos
6. Administrativo confirma → se actualizan asegurados y se registra el endoso
```

**CU-02: Detectar discrepancias**

```
Trigger: Después de cargar un PDF, o consulta on-demand
Sistema genera 3 reportes por póliza:
  A) Asegurados en póliza sin match en `personas` → posible fantasma
  B) Personas activas en `personas` sin alta en póliza → falta cobertura
  C) Match dudoso (fuzzy < 0.95) → revisión manual
```

**CU-03: Solicitar alta/baja a aseguradora**

```
Actor: Administrativo
1. Selecciona póliza
2. Selecciona 1+ asegurados/vehículos a dar de alta o baja
3. Sistema arma email con template predefinido
4. Si tipo=alta y póliza requiere adjuntos (ej. La Segunda Autos: 4 fotos + cédula):
   - Sistema toma adjuntos de Documentos del proveedor
   - Si faltan → bloquea envío
5. Administrativo previsualiza y envía
6. Sistema guarda solicitud + log
7. Marca asegurados como `alta_solicitada` o `baja_solicitada`
```

**CU-04: Confirmar respuesta de aseguradora**

```
Actor: Administrativo
1. Recibe email de aseguradora confirmando
2. Va a la solicitud en plataforma
3. Click "Marcar confirmada"
4. Sistema:
   - Si alta → asegurados pasan a `activo`, registra `fecha_alta_efectiva`
   - Si baja → asegurados pasan a `dado_de_baja`, registra `fecha_baja_efectiva`
```

**CU-05: Alerta de vencimiento**

```
Cron diario:
  SELECT pólizas activas con vigencia_hasta - hoy <= alerta_dias
Para cada una → notificación a los administrativos vinculados
Badge rojo en la UI
```

---

## 3. Modelo de datos

### Diagrama de entidades

```
polizas_aseguradoras (3 filas: MAPFRE, San Cristóbal, La Segunda)
   ↓
polizas (4-5 filas)
   ├→ polizas_email_config (1 por póliza × tipo alta/baja)
   ├→ polizas_endosos (N por póliza)
   │     ↓ (FK Archivo)
   ├→ polizas_asegurados (N por póliza, FK a personas)
   └→ polizas_solicitudes (N por póliza)
         └→ polizas_solicitud_asegurados (N por solicitud)

users
   ↓
polizas_admin_permisos (vincula users con módulo)
```

### Tablas — ver SQL completo en `02_MIGRATION.sql`

#### `polizas_aseguradoras`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `nombre` | VARCHAR(100) | "MAPFRE", "San Cristóbal", "La Segunda" |
| `parser_perfil` | VARCHAR(50) | "mapfre", "san_cristobal", "la_segunda" |
| `cuit` | VARCHAR(15) | CUIT de la aseguradora |
| `domicilio` | VARCHAR(255) | |
| `web` | VARCHAR(255) | |
| `email_general` | VARCHAR(150) | |
| `notas` | TEXT | |
| `activa` | BOOLEAN | Default 1 |
| `created_at`, `updated_at` | TIMESTAMP | |

#### `polizas`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `aseguradora_id` | BIGINT FK | |
| `nombre_descriptivo` | VARCHAR(150) | "La Segunda Vehículos Autos" |
| `ramo` | ENUM | 'accidentes_personales' \| 'vehiculos' |
| `subramo` | VARCHAR(100) | "AP Colectivo", "Autos", "Motos" |
| `tipo_asegurado` | ENUM | 'persona' \| 'vehiculo' |
| `numero_poliza` | VARCHAR(50) | |
| `numero_cuenta_cliente` | VARCHAR(50) NULL | "01-02297625" (San Cristóbal) |
| `vigencia_desde` | DATE | |
| `vigencia_hasta` | DATE | |
| `tomador_cuit` | VARCHAR(15) | "30717060985" |
| `tomador_razon_social` | VARCHAR(150) | "LOGISTICA ARGENTINA S.R.L." |
| `tomador_domicilio` | VARCHAR(255) | |
| `suma_asegurada_total` | DECIMAL(18,2) NULL | |
| `premio_anual` | DECIMAL(14,2) NULL | |
| `cantidad_vidas_unidades` | INT | Calculado desde asegurados activos |
| `clausulas_especiales` | TEXT NULL | "Cláusulas OCASA" / "Cláusulas OCA" |
| `alerta_dias_antes_vencimiento` | INT | Default 15 |
| `activa` | BOOLEAN | |
| `notas` | TEXT | |
| `created_at`, `updated_at` | TIMESTAMP | |

#### `polizas_email_config`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `poliza_id` | BIGINT FK | |
| `tipo` | ENUM | 'alta' \| 'baja' |
| `destinatarios_to` | JSON | Array de emails |
| `destinatarios_cc` | JSON | Array de emails |
| `destinatarios_bcc` | JSON | Array de emails |
| `contacto_nombre` | VARCHAR(100) | "Carlos", "Ramón" — para placeholder `{contacto_nombre}` |
| `asunto_template` | VARCHAR(255) | Con placeholders |
| `body_template` | TEXT | Con placeholders |
| `asegurado_template` | TEXT | Render por cada asegurado |
| `adjuntos_requeridos` | JSON | Array slugs: `["foto_frente","cedula_frente",...]` |
| `activo` | BOOLEAN | |

#### `polizas_endosos`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `poliza_id` | BIGINT FK | |
| `numero_endoso` | VARCHAR(50) | "118", "28" |
| `tipo` | ENUM | 'constancia' \| 'incorporacion' \| 'baja' \| 'modificacion' |
| `fecha_emision` | DATE | |
| `archivo_id` | BIGINT FK Archivo | PDF original |
| `descripcion` | TEXT | |
| `premio_endoso` | DECIMAL(14,2) NULL | |
| `created_at` | TIMESTAMP | |

#### `polizas_asegurados`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `poliza_id` | BIGINT FK | |
| `persona_id` | BIGINT FK NULL | NULL si no matchea |
| `tipo_asegurado` | ENUM | 'persona' \| 'vehiculo' |
| `identificador` | VARCHAR(50) | DU/CUIL/Patente |
| `identificador_tipo` | ENUM | 'dni' \| 'cuil' \| 'patente' |
| `numero_orden_aseguradora` | VARCHAR(20) NULL | "412", "1", "2" |
| `nombre_apellido_pdf` | VARCHAR(200) | Texto crudo del PDF |
| `marca_modelo_pdf` | VARCHAR(150) NULL | Solo vehículos |
| `tipo_vehiculo_pdf` | VARCHAR(50) NULL | "MOTO", "CAMIONES SEMI-PESADOS" |
| `localidad_pdf` | VARCHAR(100) NULL | |
| `suma_asegurada` | DECIMAL(14,2) NULL | |
| `premio_individual` | DECIMAL(14,2) NULL | |
| `alta_endoso_id` | BIGINT FK NULL | |
| `baja_endoso_id` | BIGINT FK NULL | |
| `fecha_alta_efectiva` | DATE NULL | |
| `fecha_baja_efectiva` | DATE NULL | |
| `estado` | ENUM | 'activo' \| 'alta_solicitada' \| 'baja_solicitada' \| 'dado_de_baja' \| 'no_matcheado' |
| `match_score` | DECIMAL(4,3) NULL | 1.000 = exacto, < 1 = fuzzy |
| `match_metodo` | ENUM | 'cuil_exacto' \| 'dni_exacto' \| 'patente_exacto' \| 'fuzzy_nombre' |
| `revision_manual_pendiente` | BOOLEAN | TRUE si match dudoso |
| `notas` | TEXT | |
| `created_at`, `updated_at` | TIMESTAMP | |

UNIQUE: (`poliza_id`, `identificador`)

#### `polizas_solicitudes`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `poliza_id` | BIGINT FK | |
| `tipo` | ENUM | 'alta' \| 'baja' |
| `administrativo_user_id` | BIGINT FK users | Quien creó |
| `fecha_solicitud` | TIMESTAMP | |
| `destinatarios_to_resueltos` | JSON | Snapshot al momento del envío |
| `destinatarios_cc_resueltos` | JSON | |
| `asunto` | VARCHAR(255) | Renderizado final |
| `body` | LONGTEXT | Renderizado final |
| `adjuntos` | JSON | Array de `archivo_id` adjuntados |
| `estado` | ENUM | 'borrador' \| 'enviado' \| 'respondida_ok' \| 'respondida_rechazada' \| 'cancelada' |
| `enviado_en` | TIMESTAMP NULL | |
| `respuesta_recibida_en` | TIMESTAMP NULL | |
| `respuesta_resumen` | TEXT NULL | |
| `email_message_id` | VARCHAR(255) NULL | Para correlación con bandeja |
| `created_at`, `updated_at` | TIMESTAMP | |

#### `polizas_solicitud_asegurados`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `solicitud_id` | BIGINT FK | |
| `asegurado_id` | BIGINT FK polizas_asegurados | |
| `observaciones` | TEXT NULL | |

#### `polizas_admin_permisos`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK users | |
| `puede_cargar_pdf` | BOOLEAN | |
| `puede_solicitar_alta` | BOOLEAN | |
| `puede_solicitar_baja` | BOOLEAN | |
| `puede_confirmar_respuesta` | BOOLEAN | |
| `recibe_alertas_vencimiento` | BOOLEAN | |
| `notas` | TEXT | |

---

## 4. Parser PDF

Microservicio Python (similar al de OCASA `/api/ocasa/parse-pdf`). Endpoint:

```
POST /api/polizas/parse-pdf
Body: multipart {file: PDF}
Returns: JSON con {aseguradora_detectada, tipo_documento, poliza, asegurados, endoso}
```

### Auto-detección de aseguradora

Lectura de header del PDF:
- Contiene "MAPFRE Argentina" → perfil `mapfre`
- Contiene "SAN CRISTOBAL S.M.S.G." → perfil `san_cristobal`
- Contiene "lasegunda.com.ar" → perfil `la_segunda`

### Detalle de cada perfil

Ver **`03_PARSER_PDF.md`** para regex y ejemplos por perfil.

### Ejemplos de PDFs incluidos

En `ejemplos_pdfs/`:
- `01_LaSegunda_Autos_CertCobertura.pdf` — póliza 67.743.063, vehículos
- `02_LaSegunda_Motos_CertCobertura.pdf` — póliza 45.597.407, motos
- `03_SanCristobal_FrenteEndoso_47.pdf` — endoso 118 con incorporaciones
- `04_MAPFRE_Endoso_28.pdf` — endoso de modificación
- `05_MAPFRE_CertEndoso_28.pdf` — constancia con 88 vidas vigentes

---

## 5. Algoritmo de matching contra `personas`

### Persona (AP)

```python
def match_persona(asegurado_pdf, personas_db):
    """
    asegurado_pdf: {dni|cuil, nombre_apellido}
    Returns: {persona_id, score, metodo} | None
    """
    # 1. Match exacto por CUIL
    if asegurado_pdf.cuil:
        cuil_norm = asegurado_pdf.cuil.replace('-', '').replace('.', '')
        match = personas_db.where(cuil_normalizado=cuil_norm).first()
        if match:
            return {persona_id: match.id, score: 1.0, metodo: 'cuil_exacto'}

    # 2. Match exacto por DNI (extraído del CUIL si no tiene DNI directo)
    dni = asegurado_pdf.dni or extraer_dni_del_cuil(asegurado_pdf.cuil)
    if dni:
        match = personas_db.where(dni=dni).first()
        if match:
            return {persona_id: match.id, score: 1.0, metodo: 'dni_exacto'}

    # 3. Fuzzy por nombre + apellido
    nombre_norm = normalizar(asegurado_pdf.nombre_apellido)
    candidatos = personas_db.where_score(nombre_norm) > 0.85
    if candidatos.count == 1:
        return {persona_id: candidatos[0].id,
                score: candidatos[0].score,
                metodo: 'fuzzy_nombre',
                revision_manual_pendiente: True if score < 0.95}

    # 4. Sin match
    return None
```

### Vehículo

```python
def match_vehiculo(vehiculo_pdf, personas_db, persona_patentes_db):
    """
    vehiculo_pdf: {patente, marca_modelo, tipo}
    Returns: {persona_id, score, metodo} | None
    """
    patente = vehiculo_pdf.patente.upper().replace(' ', '')

    # 1. Match en personas.patente (patente principal)
    match = personas_db.where(patente=patente).first()
    if match:
        return {persona_id: match.id, score: 1.0, metodo: 'patente_exacto'}

    # 2. Match en persona_patentes (patentes adicionales)
    match = persona_patentes_db.where(patente=patente).first()
    if match:
        return {persona_id: match.persona_id, score: 1.0, metodo: 'patente_exacto'}

    # 3. Sin match → fantasma
    return None
```

### Reportes de discrepancia

Generados on-demand por endpoint `GET /api/polizas/{id}/discrepancias`:

```json
{
  "asegurados_sin_persona": [
    {asegurado_id, identificador, nombre_apellido_pdf, riesgo: "fantasma"}
  ],
  "personas_sin_poliza": [
    {persona_id, nombre, perfil: "Distribuidor", riesgo: "sin_cobertura"}
  ],
  "match_dudoso": [
    {asegurado_id, persona_id_sugerida, score, motivo}
  ]
}
```

---

## 6. Templates de email

Ver **`04_EMAIL_TEMPLATES.md`** para los 4 templates completos en JSON (1 por póliza × tipo).

### Renderizado

Al armar el email:

1. Cargar `polizas_email_config` correspondiente.
2. Resolver placeholders globales: `{numero_poliza}`, `{numero_cuenta}`, `{contacto_nombre}`, `{cuit_logarg}`.
3. Resolver placeholder admin: `{admin_nombre}`, `{admin_email}` (del usuario logueado).
4. Renderizar `{asegurados_block}` iterando los asegurados seleccionados, aplicando `asegurado_template` a cada uno.
5. Validar `adjuntos_requeridos`:
   - Para cada asegurado seleccionado, buscar en `Archivo` los documentos categorizados con los slugs requeridos.
   - Si falta alguno → bloquear envío y mostrar lista de qué falta.

### Ejemplo de body renderizado (San Cristóbal Baja)

Input:
- Póliza: 01-06-06-30035710 / Cuenta: 01-02297625
- Asegurados a dar de baja: Fernando Penas Sali, Pedro Fleitas

Output:
```
Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_ N° cuenta: 01-02297625

Informa BAJAS

Fernando Lionel Penas Sali CUIL: 20211316749 FECHA DE NACIMIENTO: 03/12/1969
Fleitas Pedro Sebastian CUIL: 20281015304 FECHA DE NACIMIENTO: 23/03/1980
```

---

## 7. Flujo de envío de email

### Opción técnica adoptada: SMTP institucional (Fase MVP)

**Por qué:**
- Permite adjuntos automáticos (clave para La Segunda Autos).
- 1 día de implementación.
- Más simple que OAuth Gmail/Outlook.

**Configuración:**
```env
POLIZAS_SMTP_HOST=smtp.office365.com
POLIZAS_SMTP_PORT=587
POLIZAS_SMTP_USER=polizas@logisticaargentina.com.ar  ← TODO confirmar dirección
POLIZAS_SMTP_PASSWORD=*****
POLIZAS_SMTP_FROM_NAME="Pólizas - Logística Argentina"
POLIZAS_SMTP_REPLY_TO=admin_que_creo_la_solicitud@... ← dinámico, según user_id
```

### Migración futura a OAuth (Fase 2)

Si querés que cada admin envíe desde su propia casilla:
- Tabla `polizas_admin_email_accounts` (definida en modelo de datos como opcional)
- OAuth flow con Microsoft Graph API (Outlook)
- Tokens guardados encriptados
- Estimación adicional: 3-5 días Francisco

---

## 8. UI

Ver **`06_UI_MOCKUPS.md`** para descripción detallada de pantallas.

### Resumen de pantallas

| Path | Pantalla |
|---|---|
| `/polizas` | Listado de pólizas con cards |
| `/polizas/:id` | Detalle de póliza + tabs |
| `/polizas/:id/cargar-pdf` | Wizard de carga + matching |
| `/polizas/:id/asegurados` | Tabla de asegurados con filtros |
| `/polizas/:id/discrepancias` | 3 reportes (sin match / sin póliza / dudosos) |
| `/polizas/:id/solicitar-alta` | Selección + preview email + envío |
| `/polizas/:id/solicitar-baja` | Selección + preview email + envío |
| `/polizas/:id/endosos` | Histórico de endosos |
| `/polizas/solicitudes` | Bandeja de solicitudes con estados |
| `/polizas/configuracion` | Email config, contactos, administrativos |

### Integración con módulo Proveedores

En la página de detalle de un proveedor (`/personal/:id/editar`):
- Tab nuevo: **"Pólizas"** que muestra todas las pólizas en las que figura ese proveedor (AP + vehículos asociados).
- Botón "Solicitar baja" rápido si está activo.

---

## 9. API REST

Ver **`05_API_ENDPOINTS.md`** para detalle completo.

### Resumen

```
GET    /api/polizas                           Listar pólizas
GET    /api/polizas/{id}                      Detalle
POST   /api/polizas                           Crear
PUT    /api/polizas/{id}                      Editar
GET    /api/polizas/{id}/asegurados           Listar asegurados
GET    /api/polizas/{id}/discrepancias        3 reportes
POST   /api/polizas/{id}/cargar-pdf           Subir + parsear + preview
POST   /api/polizas/{id}/confirmar-carga      Aplicar el preview
GET    /api/polizas/{id}/endosos              Histórico
POST   /api/polizas/{id}/solicitudes          Crear solicitud (alta/baja)
GET    /api/polizas/solicitudes               Bandeja
GET    /api/polizas/solicitudes/{id}          Detalle
POST   /api/polizas/solicitudes/{id}/preview  Render email sin enviar
POST   /api/polizas/solicitudes/{id}/enviar   Enviar el email
POST   /api/polizas/solicitudes/{id}/confirmar Marcar respuesta OK/rechazada
GET    /api/polizas/aseguradoras              Listar
PUT    /api/polizas/{id}/email-config/{tipo}  Editar templates
GET    /api/polizas/dashboard/alertas         Pólizas próximas a vencer
```

---

## 10. Permisos y administrativos

### Roles

- **Admin Pólizas** → puede todo (CRUD pólizas, cargar PDF, solicitar alta/baja, confirmar respuestas).
- **Operador Pólizas** → puede cargar PDF y solicitar alta/baja, NO puede editar pólizas.
- **Auditor Pólizas** → solo lectura.

### Asignación de permisos

Tabla `polizas_admin_permisos` con flags granulares (ver modelo de datos).

### Onboarding de un administrativo

```
1. Admin sistema crea/usa user existente en `users`
2. Va a /polizas/configuracion → "Administrativos"
3. Click "Agregar administrativo" → selecciona user
4. Tilda los flags (puede_cargar_pdf, puede_solicitar_alta, etc.)
5. Tilda "Recibe alertas vencimiento" si aplica
6. Guarda
```

---

## 11. Cron jobs

### Alerta vencimiento

```bash
# Diario a las 8 AM
php artisan polizas:alertas-vencimiento

# Lógica:
# SELECT polizas activas WHERE DATEDIFF(vigencia_hasta, today) <= alerta_dias_antes_vencimiento
#   AND DATEDIFF >= 0
# Por cada póliza → notificar a usuarios con `recibe_alertas_vencimiento = TRUE`
# Email + notificación in-app
```

### Recordatorio solicitudes pendientes

```bash
# Diario a las 8 AM
php artisan polizas:recordar-solicitudes-pendientes

# Lógica:
# SELECT solicitudes WHERE estado='enviado' AND enviado_en < NOW() - 7 days
# Notificar al administrativo creador para que recuerde hacer follow-up
```

---

## 12. Integración con módulo Proveedores

### Cambios mínimos al módulo existente

1. **Tab nuevo "Pólizas"** en `ProveedorEditarPage` (`/personal/:id/editar`):
   - Muestra todas las pólizas activas en las que aparece la persona.
   - Estado en cada una.
   - Acción rápida: "Solicitar baja" (si está activa).

2. **Categorización de archivos** en `Archivo` (de la persona):
   - Agregar columna `categoria` (VARCHAR 50, NULL).
   - Slugs reservados: `foto_frente`, `foto_lateral_der`, `foto_lateral_izq`, `foto_trasera`, `cedula_frente`, `cedula_dorso`, `dni_frente`, `dni_dorso`.
   - UI: dropdown al subir documento, opcional.

3. **Vista en listado de proveedores** (`ProveedoresPage`):
   - Columna nueva opcional "Cobertura": badge según `polizas_asegurados.estado` (verde si tiene póliza activa, rojo si no, amarillo si pendiente).

### Sin cambios destructivos

No se modifica `personas`, `Archivo`, ni endpoints existentes. Solo se agregan campos opcionales y un tab nuevo.

---

## 13. Plan de fases

Ver **`07_PLAN_FASES.md`** para detalle completo. Resumen:

| Fase | Tiempo | Output |
|---|---|---|
| 1. Modelo de datos + seed inicial | 1 día | 7 tablas creadas, datos seed (3 aseguradoras, 4 pólizas) |
| 2. Parser PDF (3 perfiles) | 2-3 días | Microservicio Python `/api/polizas/parse-pdf` funcional |
| 3. Matching + discrepancias | 1 día | Endpoint con 3 reportes |
| 4. UI Pólizas (listado + detalle) | 2 días | Pantallas básicas funcionando |
| 5. Carga PDF + preview matching | 1 día | Wizard de carga |
| 6. Solicitudes + email composer + SMTP | 2 días | Solicitudes alta/baja con envío |
| 7. Confirmación manual + auditoría | ½ día | Botón confirmar respuesta |
| 8. Cron alertas + integración Proveedores | 1 día | Cron + tab nuevo |
| 9. Documentación + smoke tests | ½ día | Doc usuario + criterios aceptación |
| **TOTAL MVP** | **~10-12 días** | — |

---

## 14. Criterios de aceptación

Ver **`08_CRITERIOS_ACEPTACION.md`** para checklist completo. Resumen:

- [ ] Cargo PDF de las 4 pólizas (Autos / Motos / SC / MAPFRE) y parsea correctamente.
- [ ] Matching da los 3 reportes con datos reales de la base.
- [ ] Solicitud de alta MAPFRE genera email con formato exacto del template.
- [ ] Solicitud de alta La Segunda Autos bloquea envío si faltan las 5 fotos.
- [ ] Solicitud de baja San Cristóbal genera email con CUIL sin guiones.
- [ ] Confirmar respuesta OK marca asegurado como activo / dado_de_baja según corresponda.
- [ ] Cron de vencimientos dispara notificación 15 días antes.
- [ ] Tab Pólizas en proveedor muestra cobertura actual.

---

## 15. TODO / Configuraciones

Ver **`09_TODO_CONFIGURAR.md`** para detalle. Resumen:

| # | Configurar |
|---|---|
| 1 | Casilla email institucional (`polizas@...`) — si no existe, crear |
| 2 | Lista de administrativos (Mati pasa nombres + flags por rol) |
| 3 | Contactos de aseguradora (Carlos MAPFRE, Ramón La Segunda) — emails reales |
| 4 | Estado de `personas.cuil` — cuántos están sin CUIL → impacta matching fuzzy |
| 5 | Categorización de fotos en Documentos — bulk-update si todas son genéricas |

Ninguna es bloqueante para arrancar la implementación.
