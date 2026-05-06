# Gap Analysis — Spec v2 vs Código actual

> Fecha: 2026-05-06 · Comparativa entre [spec-v2.md](spec-v2.md) y la implementación existente en el repo.
>
> **TL;DR:** El módulo está implementado al ~80%. La base (modelo de datos, parser, matching, solicitudes, notificaciones, cron) ya corre. Lo que falta es mayormente integración de UI (tab en proveedores, acción en CRM Aprobaciones, pantalla de admins) + algunos endpoints menores + middleware de permisos.

---

## §2 — Modelo de datos

### ✅ Implementado (6 migraciones, 13 modelos)

- `2026_05_04_000001_create_polizas_module_schema.php` → 8 tablas base.
- `2026_05_04_000002_add_fecha_nacimiento_pdf_to_polizas_asegurados.php` → campo extra (no en spec, útil).
- `2026_05_05_000001_polizas_module_clausulas.php` → 3 tablas de cláusulas + `tipo_clausula_global`/`clausula_global_id` en solicitudes + `puede_gestionar_clausulas` + `separador_entre_asegurados`.
- `2026_05_05_000002_polizas_asegurados_estado_persona.php` → `persona_estado_al_matchear` + `persona_alerta_estado` + extiende enum endosos a `asegurados_adherentes`.
- `2026_05_05_000003_polizas_notificacion_distribuidor.php` → 2 tablas notificación + `puede_notificar_distribuidores`.
- `2026_05_05_000004_polizas_auto_aprobacion_distribuidor.php` → `ofrecer_auto_aprobacion_distribuidor` en pólizas.
- 13 modelos Eloquent en [back/app/Models/Poliza*.php](../../back/app/Models/).

### ❌ Falta

| Item | Spec | Estado | Trabajo |
|---|---|---|---|
| `archivos.categoria` | ALTER agregar columna VARCHAR(50) | NO existe | 1 migración + backfill (~10 min) |
| `polizas_asegurados.sugerencia_fuzzy_persona_id` y `sugerencia_fuzzy_score` | Campos de "sugerencia visual" del fuzzy (sin auto-vincular) | NO existen | 1 migración (~5 min) |
| `polizas_solicitud_asegurados.persona_id` (NULL) | Para alta de persona NO asegurada aún | columna actual `asegurado_id NOT NULL` | 1 migración (relajar NOT NULL + agregar `persona_id` y `clausula_individual_id`) (~15 min) |

### ⚠️ Decisiones / diferencias

- **`personas.cuil_normalizado` NO existe**, pero el spec asume que sí. **El código real ya soluciona esto** con `whereRaw('REPLACE(REPLACE(REPLACE(cuil, "-", ""), ".", ""), " ", "") = ?')` en `MatchingService::buscarPorCuil`. → No se necesita la columna; sólo aclarar el spec.
- `polizas_asegurados.match_metodo` enum tiene `fuzzy_nombre` extra (spec lo prohíbe explícitamente). Convivir o quitar — ver §4.
- `polizas_asegurados.revision_manual_pendiente` (booleano) en código, no en spec. Útil — mantener.
- **2 formas de representar cláusulas individuales**:
  - Migración 000001: JSON `polizas_solicitudes.clausulas_individuales`.
  - Migración 000001 también crea pivot `polizas_asegurados_clausulas` por asegurado.
  - Spec quiere `polizas_solicitud_asegurados.clausula_individual_id` (no implementado).
  - Hay que decidir cuál de las 3 representaciones usar. Mi recomendación: **eliminar el JSON en favor del pivot** + `polizas_solicitud_asegurados.clausula_individual_id` para snapshot histórico de la solicitud.

---

## §3 — Parser PDF

### ✅ Implementado

- Microservicio Python FastAPI con endpoint [POST /api/polizas/parse-pdf](../../python/app/main.py#L131).
- Dispatcher por header en [python/app/parsers/polizas/dispatch.py](../../python/app/parsers/polizas/dispatch.py).
- 3 perfiles: [mapfre.py](../../python/app/parsers/polizas/mapfre.py), [san_cristobal.py](../../python/app/parsers/polizas/san_cristobal.py), [la_segunda.py](../../python/app/parsers/polizas/la_segunda.py).
- Bridge Laravel: [PolizaPdfService](../../back/app/Services/Polizas/PolizaPdfService.php) usa `services.oca.base_url`.
- Endpoint Laravel `POST /api/polizas/{poliza}/cargar-pdf` (requiere póliza pre-elegida — diferente del spec).

### ⚠️ Pendiente verificar (no mirado en detalle)

- ¿El parser SC maneja los 4 tipos del spec (`asegurados_adherentes`, `incorporacion`, `baja`, `modificacion`)? Confirmar en `san_cristobal.py`.
- ¿La Segunda distingue Autos vs Motos por header? Confirmar en `la_segunda.py`.
- ¿Los regex de MAPFRE están según spec §3.4? Confirmar en `mapfre.py`.

### ❌ Falta

- Endpoint stateless `POST /api/polizas/parse-pdf` (sin `{poliza}`) — el actual obliga a elegir póliza antes. Si se quiere flexibilidad para "subir y elegir póliza después" hay que agregarlo. **Bajo impacto, posiblemente no necesario.**

---

## §4 — Algoritmo de matching

### ✅ Implementado correctamente

- Match exacto por CUIL/DNI/patente con normalización en query (sin necesidad de `cuil_normalizado`).
- Match contra `Persona` y `PersonaPatente` (incluye `patente_norm`).
- Sin filtro de estado: persona en baja/suspendida/solicitud/sin aprobar SÍ matchea (correcto vs spec §4.2 "Caso OPT548").
- `persona_estado_al_matchear` snapshot con precedencia correcta (baja > suspendido > solicitud > sin_aprobar > activo).
- `persona_alerta_estado` calculado para reporte D.
- Constante `ESTADO_ACTIVO_ID = 1` y `estado_id == 3 ⇒ Suspendido` ([MatchingService.php:21,168](../../back/app/Services/Polizas/MatchingService.php#L21)).

### ⚠️ Conflicto filosófico con spec

- **Spec §4.3:** "fuzzy SOLO como sugerencia, NO auto-match".
- **Implementación actual:** fuzzy con score `>= 0.95` se auto-vincula como `match_metodo='fuzzy_nombre'` y se guarda en `persona_id`. Sólo se marca `revision_manual_pendiente=true` si score < 0.95 o hay varios candidatos.

**Decisión a tomar:** ¿alinear con spec (nunca auto-vincular fuzzy → todos los fuzzy van a `sugerencia_fuzzy_*` campos nuevos) o mantener auto-match con threshold alto (más cómodo operativamente, pero con riesgo de falsos positivos como el caso BRIZUELA del spec §16.3)?

Mi recomendación: **alinear con spec**. Es lo que el spec explícitamente quiere, y agregar `sugerencia_fuzzy_persona_id` + `sugerencia_fuzzy_score` (los 2 campos faltantes en §2) hace fácil migrar.

---

## §5-6 — Discrepancias y cláusulas

### ✅ Implementado

- 4 categorías de discrepancia en [DiscrepanciasService](../../back/app/Services/Polizas/DiscrepanciasService.php).
- Categoría D con 4 sub-tipos (baja, suspendida, solicitud_pendiente, sin_aprobar).
- 6 cláusulas seed con campo `alias` ([PolizasClausulasSeeder](../../back/database/seeders/PolizasClausulasSeeder.php)).
- 3 pólizas MAPFRE con cláusulas aplicadas inicialmente (OCASA, URBANO/NEWSAN, NEWSAN La Tablada CBN+ID Supply).
- Render de cláusulas inline con [`ClausulaService`](../../back/app/Services/Polizas/ClausulaService.php).

### ⚠️ Diferencias menores

- `personas_sin_poliza` filtra por `estado_id = 1` (sólo Activos). Spec no es claro pero está bien para "sin cobertura".
- `match_dudoso` usa `revision_manual_pendiente` boolean, no threshold explícito.

---

## §7 — Templates de email

### ✅ Implementado

- 3 aseguradoras + 6 pólizas + 12 email_configs en [PolizasSeeder](../../back/database/seeders/PolizasSeeder.php) + [PolizasClausulasSeeder](../../back/database/seeders/PolizasClausulasSeeder.php).
- Adjuntos requeridos La Segunda Autos/Motos Alta (5 fotos categorizadas).
- Placeholders por aseguradora (MAPFRE / SC / La Segunda) según spec.
- [`EmailRenderService`](../../back/app/Services/Polizas/EmailRenderService.php) (no inspeccionado en detalle).
- [`AdjuntosCheckService`](../../back/app/Services/Polizas/AdjuntosCheckService.php) verifica slugs faltantes.

### ⚠️ Pendiente verificar

- Validación de adjuntos pre-envío bloquea el flujo cuando faltan fotos para La Segunda (spec §7.3) — confirmar comportamiento de `AdjuntosCheckService::verificar`.
- Caso especial: La Segunda Autos Alta con N vehículos → forzar N solicitudes (spec §7.4) — confirmar que la UI/wizard lo maneja.

### ❌ Bloqueante real

- Slugs `foto_frente`, `foto_lateral_*`, `cedula_*`, `dni_*` requieren la columna `archivos.categoria` (gap §2). **Sin esto, la validación de adjuntos La Segunda no puede funcionar.**
- Emails seed son `TODO_carlos@mapfre...`, `TODO_ramon.morel@...`, `TODO_admin@logarg...` — no se puede enviar real hasta cargar emails verdaderos.

---

## §8-9 — Solicitudes y notificación distribuidor

### ✅ Implementado

- [`PolizaSolicitudController`](../../back/app/Http/Controllers/Api/PolizaSolicitudController.php) con `store / index / show / preview / enviar / confirmar / aprobarPersonas`.
- [`SolicitudService`](../../back/app/Services/Polizas/SolicitudService.php) (365 líneas — más extenso de los services).
- Cláusulas global (`tipo_clausula_global`, `clausula_global_id`) e individuales (JSON) en payload.
- Confirmar `respondida_ok` devuelve `personas_pendientes_aprobacion` para modal de auto-aprobación.
- `aprobarPersonas` masivo (ADD 15) — endpoint `POST /api/polizas/personas/aprobar-masivo`.
- [`NotifDistribuidorService`](../../back/app/Services/Polizas/NotifDistribuidorService.php) con `altasNuevasPendientes / preview / enviar / reenviar`.

### ❌ Falta

- **Endpoint `GET /api/polizas/{id}/personas-disponibles-para-alta`** (spec §8.2 — listar personas que NO son asegurados activos en la póliza). El wizard frontend no puede armar la lista para "Solicitar alta" sin esto.
- **Soporte para alta de persona NO asegurada todavía** (spec §8.2 / §11.1). Hoy `store` requiere `asegurado_ids` con IDs existentes en `polizas_asegurados`. El spec quiere `personas_ids_a_alta` para crear simultáneamente la `polizas_asegurados` y la solicitud. Necesario para el flow CRM → Pólizas.
- `POST /api/polizas/solicitudes/{id}/cancelar` — endpoint para cancelar borradores.

---

## §10-11 — Integración con Proveedores y CRM Aprobaciones

### ✅ Implementado

- Página separada [`PersonaPolizasPage.tsx`](../../front/src/pages/PersonaPolizasPage.tsx) en ruta `/personal/:personaId/polizas`.
- Endpoints `GET /api/personal/{id}/polizas` y `GET /api/personal/{id}/polizas-aplicables` ([PolizasController:89,116](../../back/app/Http/Controllers/Api/PolizasController.php#L89)).
- Heurística simple para sugerir pólizas según perfil (vehículo si tiene patente, persona si no).

### ❌ Falta crítico

- **NO hay tab "Pólizas" embebida en `/personal/:id/editar`** (spec §10.1). La página existe pero es separada — el spec quiere ver pólizas del proveedor sin salir del formulario de edición. Refactor de [`ProveedorEditarPage.tsx`](../../front/src/pages/ProveedorEditarPage.tsx) para sumar tab.
- **NO hay alertas en ProveedorEditarPage** cuando proveedor está en baja/suspendido pero figura activo en póliza (spec §10.1 caso 3). Esta es la lógica que detecta inconsistencias *desde el lado del proveedor*.
- **CRM Aprobaciones (`ApprovalsRequestsPage.tsx`) NO tiene la acción "Solicitar alta en póliza"** (spec §11.2). Ni por fila ni masiva.
- **NO hay tab "Solicitud de póliza" embebida en CRM** (spec §11.3) que muestre la bandeja de `polizas_solicitudes`.
- Sin "componente compartido `SolicitudesPolizasBandeja`" (spec §14.7).

---

## §12-13 — Permisos y cron jobs

### ✅ Implementado (cron jobs completos)

- [`PolizasAlertasVencimiento.php`](../../back/app/Console/Commands/PolizasAlertasVencimiento.php)
- [`PolizasRecalcularEstados.php`](../../back/app/Console/Commands/PolizasRecalcularEstados.php)
- [`PolizasRecordarSolicitudes.php`](../../back/app/Console/Commands/PolizasRecordarSolicitudes.php)
- Bonus: [`PolizasTestMatching.php`](../../back/app/Console/Commands/PolizasTestMatching.php) (no en spec).
- Tabla `polizas_admin_permisos` con los 8 flags del spec.

### ❌ Falta

- **Permisos NO se aplican como middleware**. Los endpoints aceptan cualquier usuario autenticado sin chequear `puede_cargar_pdf`, `puede_solicitar_alta`, etc. Spec §16.10:
  - "Endpoints rechazan request con 403 si falta permiso" → no implementado.
  - "Auditor (todos los flags FALSE) puede ver pero no editar" → no implementado.
- Permisos sólo se usan en [`PolizasAlertasVencimiento`](../../back/app/Console/Commands/PolizasAlertasVencimiento.php) para destinatarios.
- **Frontend no oculta botones según permisos** (sólo backend importa, pero UX requiere ambos).

Trabajo: middleware Laravel `polizas.permission:puede_X` + `<RequirePermission>` HOC en frontend (~3-4 h).

---

## §14 — UI completa (frontend)

### ✅ Páginas existentes (9)

| Path | Página |
|---|---|
| `/polizas` | `PolizasPage` |
| `/polizas/:polizaId` | `PolizaDetallePage` (probablemente con sub-tabs) |
| `/polizas/:polizaId/cargar-pdf` | `PolizaCargarPdfPage` |
| `/polizas/:polizaId/solicitar` | `PolizaSolicitarPage` (alta y baja unificada con `?tipo=`) |
| `/polizas/solicitudes` | `PolizaSolicitudesPage` |
| `/polizas/solicitudes/:solicitudId` | `PolizaSolicitudDetallePage` |
| `/polizas/configuracion/clausulas` | `PolizaClausulasPage` |
| `/polizas/notificaciones` | `PolizaNotificacionesPage` |
| `/personal/:personaId/polizas` | `PersonaPolizasPage` |

### ⚠️ Pendiente verificar

- Tabs internos de `PolizaDetallePage`: ¿incluye Asegurados / Discrepancias / Endosos / Solicitudes / Configuración como tabs? Spec §14.1 los lista como rutas separadas pero pueden estar como tabs (válido).
- Wizard `PolizaCargarPdfPage` — ¿filtros + selección masiva + dropdown decisión por fila + sugerencia fuzzy visible? (spec §14.3).
- Wizard `PolizaSolicitarPage` — ¿paso 2 cláusulas con sub-paso A/B? (spec §14.5).

### ❌ Falta

- **`/polizas/admins`** — pantalla CRUD de administrativos con permisos. No existe (spec §14.1).
- Los componentes reusables del spec §14.7 (`PersonaPicker`, `EmailPreview`, `EmailTemplateEditor`, `AdjuntosCheck`, `DiscrepanciasReport`, `SolicitudesPolizasBandeja`) — no auditado en detalle pero algunos seguro existen embedded. Falta probable: el componente compartido `SolicitudesPolizasBandeja` para reusar en CRM.

---

## §15 — API REST endpoints

### Cross-check spec vs `routes/api.php` (líneas 61-90)

| Endpoint spec | Estado | Nota |
|---|---|---|
| `GET /api/polizas` | ✅ | |
| `GET /api/polizas/{id}` | ✅ | |
| `POST /api/polizas` | ❌ | crear póliza desde UI no implementado |
| `PUT /api/polizas/{id}` | ❌ | editar póliza no implementado |
| `DELETE /api/polizas/{id}` | ❌ | soft delete no implementado |
| `GET /api/polizas/aseguradoras` | ❌ | catálogo de aseguradoras |
| `GET /api/polizas/dashboard/alertas` | ❌ | resumen para dashboard |
| `GET /api/polizas/{id}/asegurados` | ✅ | |
| `GET /api/polizas/{id}/discrepancias` | ✅ | |
| `GET /api/polizas/{id}/personas-disponibles-para-alta` | ❌ | **bloqueante para wizard alta** |
| `POST /api/polizas/parse-pdf` | ⚠️ | en Python, no expuesto desde Laravel (sólo `/cargar-pdf`) |
| `POST /api/polizas/{id}/cargar-pdf` | ✅ | |
| `POST /api/polizas/{id}/confirmar-carga` | ✅ | |
| `GET /api/polizas/{id}/endosos` | ❌ | listado de endosos |
| `POST /api/polizas/{id}/solicitudes` | ✅ | |
| `GET /api/polizas/solicitudes` | ✅ | |
| `GET /api/polizas/solicitudes/{id}` | ✅ | |
| `POST /api/polizas/solicitudes/{id}/preview` | ✅ | |
| `POST /api/polizas/solicitudes/{id}/enviar` | ✅ | |
| `POST /api/polizas/solicitudes/{id}/confirmar` | ✅ | |
| `POST /api/polizas/solicitudes/{id}/cancelar` | ❌ | cancelar borradores |
| `GET /api/polizas/clausulas` | ✅ | |
| `POST /api/polizas/clausulas` | ✅ | |
| `PUT /api/polizas/clausulas/{id}` | ✅ | |
| `GET /api/polizas/{id}/clausulas-vigentes` | ✅ | |
| `POST /api/polizas/{id}/clausulas-aplicar` | ✅ | |
| `POST /api/polizas/{id}/clausulas-remover` | ⚠️ | actual `/polizas/clausulas-aplicadas/{aplicacion}/remover` |
| `POST /api/polizas/{id}/notificaciones-distribuidor/preview` | ✅ | |
| `POST /api/polizas/{id}/notificaciones-distribuidor/enviar` | ✅ | |
| `GET /api/polizas/notificaciones` | ⚠️ | actual `/polizas/notificaciones-distribuidor` |
| `POST /api/polizas/notificaciones/{id}/reenviar` | ⚠️ | actual `/polizas/notificaciones-distribuidor/{n}/reenviar` |
| `PUT /api/polizas/{id}/notif-distribuidor-config` | ❌ | editar config notificación |
| `PUT /api/polizas/{id}/email-config/{tipo}` | ❌ | editar config email |
| `POST /api/polizas/email-config/{id}/probar` | ❌ | enviar email de prueba |
| `GET /api/personal/{id}/polizas` | ✅ | |
| `GET /api/personal/{id}/polizas-aplicables` | ✅ | |
| `POST /api/personal/aprobar-masivo` | ⚠️ | actual `/polizas/personas/aprobar-masivo` |
| `GET /api/polizas/admins` | ❌ | |
| `POST /api/polizas/admins` | ❌ | |
| `PUT /api/polizas/admins/{id}` | ❌ | |
| `DELETE /api/polizas/admins/{id}` | ❌ | |

**Resumen:** 25/41 endpoints existen ✅, 4 con paths diferentes ⚠️, 12 faltan ❌.

---

## Resumen ejecutivo y próximos pasos

### Lo que YA funciona end-to-end

1. Cargar PDF (los 3 perfiles), parsear, matchear contra personas, generar `polizas_asegurados`.
2. Reportar las 4 categorías de discrepancia con sub-tipos.
3. Crear solicitudes alta/baja con cláusulas globales/individuales, renderizar email, enviar SMTP, confirmar.
4. Notificar distribuidores con plantilla y bandeja con reenvío.
5. Cron jobs de alertas de vencimiento, recordatorios y recalculo de estados.
6. Cláusulas catálogo + aplicaciones + render por aseguradora.

### Bloqueantes reales para uso productivo

1. **`archivos.categoria`** — sin esto, La Segunda Autos Alta NO puede validar las 5 fotos. Migración + backfill (~10 min).
2. **`GET /api/polizas/{id}/personas-disponibles-para-alta`** — sin esto, el wizard de alta no puede listar candidatos. Endpoint + query (~30 min).
3. **Soporte para alta de persona NO asegurada todavía** en `POST /solicitudes` — sin esto, el flow CRM Aprobaciones → Pólizas no cierra. Refactor `SolicitudService::crearBorrador` (~1 h).
4. **Emails reales en seeders** — todos los `TODO_*@*` deben reemplazarse antes de habilitar envío (depende de sysadmin/contactos).

### Trabajo pendiente prioritario (en orden)

| # | Item | Sección spec | Esfuerzo |
|---|---|---|---|
| 1 | Migración `archivos.categoria` | §2.14 | 10 min |
| 2 | Endpoint `personas-disponibles-para-alta` | §8.2 | 30 min |
| 3 | Soporte `personas_ids_a_alta` en solicitudes | §8.2 / §11.1 | 1 h |
| 4 | Tab "Pólizas" en `ProveedorEditarPage` | §10.1 | 2-3 h |
| 5 | Acción "Solicitar alta en póliza" en CRM Aprobaciones | §11.2 | 2-3 h |
| 6 | Componente `SolicitudesPolizasBandeja` + tab en CRM | §11.3 / §14.7 | 2 h |
| 7 | Pantalla `/polizas/admins` (CRUD permisos) | §14.1 | 2 h |
| 8 | Middleware permisos backend + UI condicional | §12 / §16.10 | 3-4 h |
| 9 | Endpoints faltantes (configuración email/notif, cancelar, endosos) | §15.6, §15.7 | 2-3 h |
| 10 | Migración `sugerencia_fuzzy_*` + ajuste `MatchingService` | §2.5 / §4.3 | 2 h |
| 11 | Migración `polizas_solicitud_asegurados` (persona_id NULL + clausula_individual_id) | §2.7 | 1 h |
| 12 | Verificar parser SC 4 tipos + La Segunda Autos/Motos | §3.5 / §3.6 | 1 h cada uno |
| 13 | Reemplazar `TODO_*` emails en seeders | — | depende de Mati |

**Total estimado:** ~22-28 horas de trabajo + decisiones operativas pendientes.

### Decisiones a tomar antes de avanzar

1. **Fuzzy matching:** ¿auto-vincular score≥0.95 (actual) o sólo sugerir (spec)?
2. **Cláusulas individuales en solicitud:** ¿JSON, pivot por asegurado, o `polizas_solicitud_asegurados.clausula_individual_id`? (3 representaciones posibles).
3. **`/api/personal/aprobar-masivo` vs `/api/polizas/personas/aprobar-masivo`:** ¿alinear con spec o dejar el actual?
4. **Permisos:** ¿implementar middleware ahora o postergar hasta tener un primer usuario "auditor" real?
5. **Endpoints faltantes (`POST /polizas`, `PUT /polizas/{id}`, etc.):** ¿son necesarios o las pólizas se mantienen sólo via seeder/migración?
