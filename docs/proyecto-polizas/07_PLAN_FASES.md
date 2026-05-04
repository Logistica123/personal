# Plan de fases — Implementación Módulo Pólizas

> Estimación rough: ~10-12 días Francisco para MVP completo. Detalle por fase abajo.

---

## Fase 1 — Modelo de datos + seed inicial

**Estimación: 1 día**

### Tareas

- [ ] Crear migración con las 7 tablas (`02_MIGRATION.sql`)
- [ ] Aplicar `ALTER TABLE archivos ADD COLUMN categoria` (si no existe)
- [ ] Correr seeders con 3 aseguradoras + 4 pólizas + 8 email_configs
- [ ] Crear modelos Eloquent: `Poliza`, `PolizaAseguradora`, `PolizaEmailConfig`, `PolizaEndoso`, `PolizaAsegurado`, `PolizaSolicitud`, `PolizaSolicitudAsegurado`, `PolizaAdminPermiso`
- [ ] Definir relaciones Eloquent (belongsTo, hasMany)
- [ ] Tests unitarios de las relaciones

### Output verificable

```sql
SELECT * FROM polizas_aseguradoras;             -- 3 filas
SELECT * FROM polizas;                          -- 4 filas
SELECT * FROM polizas_email_config;             -- 8 filas
```

---

## Fase 2 — Parser PDF

**Estimación: 2-3 días**

### Tareas

- [ ] Crear microservicio Python `polizas_parser` (FastAPI o Flask, similar al de OCASA)
- [ ] Implementar `detectar_aseguradora()` con auto-detect por header
- [ ] Implementar perfil `mapfre`:
  - [ ] Parser constancia (88 vidas)
  - [ ] Parser endoso/suplemento
- [ ] Implementar perfil `san_cristobal`:
  - [ ] Parser frente de endoso (incorporación/baja/modificación)
- [ ] Implementar perfil `la_segunda`:
  - [ ] Parser tabla con `pdfplumber.extract_tables()`
  - [ ] Distinguir Autos (póliza 67.743.063) vs Motos (póliza 45.597.407) por header
- [ ] Tests con los 5 PDFs de muestra (`ejemplos_pdfs/`)
- [ ] Endpoint REST `POST /api/polizas/parse-pdf`
- [ ] Integración con backend Laravel (`OcasaPdfProcessor` como modelo de referencia)

### Output verificable

```bash
curl -X POST /api/polizas/parse-pdf -F "file=@01_LaSegunda_Autos.pdf"
# Devuelve JSON con poliza, asegurados, etc.
```

---

## Fase 3 — Matching + discrepancias

**Estimación: 1 día**

### Tareas

- [ ] Implementar `MatchingService` con los 4 métodos (cuil, dni, patente, fuzzy_nombre)
- [ ] Service `DiscrepanciasService` con los 3 reportes
- [ ] Endpoint `GET /api/polizas/{id}/discrepancias`
- [ ] Definir umbral fuzzy (`>= 0.85` y revisión manual si `< 0.95`)
- [ ] Tests con dataset real (88 personas MAPFRE vs base proveedores)

### Output verificable

```bash
curl /api/polizas/1/discrepancias
# Devuelve {asegurados_sin_persona, personas_sin_poliza, match_dudoso}
```

---

## Fase 4 — UI Pólizas (listado + detalle)

**Estimación: 2 días**

### Tareas

- [ ] Página `ProveedoresPage` análoga `PolizasPage` con cards
- [ ] Página detalle `PolizaDetallePage` con 6 tabs
- [ ] Componente `PolizaCard` con badges de discrepancias y vencimiento
- [ ] Tabla de asegurados con filtros y selección múltiple
- [ ] Tab Discrepancias con sub-tabs

### Output verificable

- Navegar a `/polizas` → ver 4 cards.
- Click en una → ver detalle con tabs operativos.

---

## Fase 5 — Wizard cargar PDF + matching preview

**Estimación: 1 día**

### Tareas

- [ ] Página `PolizaCargarPdfPage` con wizard de 3 pasos
- [ ] Componente `PreviewMatching` con acciones por línea (crear / vincular / ignorar)
- [ ] Endpoint `POST /api/polizas/{id}/confirmar-carga` con decisiones del admin
- [ ] Persistir endoso + asegurados al confirmar

### Output verificable

- Subo `01_LaSegunda_Autos_*.pdf` → veo preview con 23 vehículos.
- Confirmar → se crean los registros en `polizas_asegurados` y `polizas_endosos`.

---

## Fase 6 — Solicitudes + email composer + SMTP

**Estimación: 2 días**

### Tareas

- [ ] Service `SolicitudService` con creación + render
- [ ] Service `EmailRenderService` con resolución de placeholders
- [ ] Service `AdjuntosCheckService` para validar archivos requeridos
- [ ] Service `SmtpEmailService` (PHPMailer o similar) para envío
- [ ] Configuración SMTP institucional en `.env`
- [ ] Página `SolicitarBajaPage` (selección + preview + envío)
- [ ] Página `SolicitarAltaPage` (idem + check de adjuntos)
- [ ] Página `SolicitudesPage` (bandeja)
- [ ] Endpoints REST de solicitudes

### Output verificable

- Selecciono 2 personas → "Solicitar baja MAPFRE" → preview correcto del template.
- Click "Enviar" → email llega al destinatario con `Reply-To` del admin.
- Solicitud queda en estado `enviado` con `email_message_id`.

---

## Fase 7 — Confirmación manual + auditoría

**Estimación: ½ día**

### Tareas

- [ ] Botón "Marcar confirmada" en detalle de solicitud
- [ ] Endpoint `POST /api/polizas/solicitudes/{id}/confirmar`
- [ ] Lógica: actualizar `estado` y `fecha_alta_efectiva` o `fecha_baja_efectiva` de los asegurados según tipo
- [ ] Lógica de rollback si `tipo_respuesta = rechazada`

### Output verificable

- Marco solicitud de baja como confirmada → asegurados pasan a `dado_de_baja` con fecha.
- Marco solicitud de alta como confirmada → asegurados pasan a `activo`.

---

## Fase 8 — Cron alertas + integración Proveedores

**Estimación: 1 día**

### Tareas

- [ ] Comando artisan `polizas:alertas-vencimiento`
- [ ] Comando artisan `polizas:recordar-solicitudes-pendientes`
- [ ] Schedule en `Kernel.php` (diario 8 AM)
- [ ] Notificación in-app + email para admins con `recibe_alertas_vencimiento`
- [ ] Tab "Pólizas" en `ProveedorEditarPage` con listado de pólizas del proveedor
- [ ] Endpoint `GET /api/personal/{id}/polizas`

### Output verificable

- Avanzo el clock 14 días → cron dispara alerta de vencimiento de La Segunda Motos.
- En perfil de un proveedor activo → veo todas sus pólizas y puedo solicitar baja directo.

---

## Fase 9 — Documentación + smoke tests

**Estimación: ½ día**

### Tareas

- [ ] Doc usuario en `docs/manual-modulo-polizas.md`
- [ ] Smoke tests E2E con los 4 escenarios principales:
  - Carga PDF Constancia MAPFRE
  - Carga PDF Endoso San Cristóbal (incorporación)
  - Carga PDF La Segunda Autos
  - Solicitar baja con email enviado real
- [ ] Validación de criterios de aceptación (`08_CRITERIOS_ACEPTACION.md`)

---

## Resumen ejecutivo

| Fase | Tiempo | Output |
|---|---|---|
| 1. Modelo de datos + seed | 1 día | 7 tablas + 4 pólizas seed |
| 2. Parser PDF (3 perfiles) | 2-3 días | Microservicio Python |
| 3. Matching + discrepancias | 1 día | 3 reportes funcionales |
| 4. UI listado + detalle | 2 días | Pantallas básicas |
| 5. Wizard cargar PDF | 1 día | Carga end-to-end |
| 6. Solicitudes + SMTP | 2 días | Envío de altas/bajas |
| 7. Confirmación manual | ½ día | Cierre de solicitudes |
| 8. Cron + integración | 1 día | Alertas + tab Proveedor |
| 9. Doc + smoke tests | ½ día | Validación final |
| **TOTAL MVP** | **~10-12 días** | — |

---

## Roadmap post-MVP (Fase 2.0)

Una vez en producción, mejoras opcionales:

| Feature | Estimación |
|---|---|
| OAuth Gmail/Outlook (cada admin desde su casilla) | 3-5 días |
| Auto-confirmación por parsing de email entrante (IMAP) | 2 días |
| Dashboard ejecutivo (gastos por aseguradora, ratio cobertura, etc.) | 2 días |
| Comparación entre cotizaciones (renovación) | 3 días |
| Carga masiva de pólizas históricas (Excel) | 2 días |
| Workflow de aprobación (admin pide baja → supervisor aprueba → se envía) | 3 días |

---

## Riesgos / mitigación

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Parser La Segunda falla con nuevas variantes de PDF | Media | Usar `pdfplumber.extract_tables()` con tolerancia + warnings, no fail |
| Adjuntos requeridos sin categoría en Documentos existentes | Alta | Bulk update inicial categorizando con script + dejar UI para re-categorizar |
| Email institucional con cuotas o anti-spam | Baja | Configurar SPF/DKIM, throttle a 30 emails/hora |
| `personas.cuil` con guiones inconsistentes | Alta | Normalizar siempre antes de comparar (helper `normalizar_cuil`) |
| Match fuzzy con falsos positivos | Media | Score 0.95+ auto, 0.85-0.94 revisión manual obligatoria |

---

## Definición de "MVP listo para producción"

Un módulo se considera MVP listo cuando:

1. ✅ Las 4 pólizas están cargadas con sus asegurados actuales correctamente matcheados.
2. ✅ Discrepancias están identificadas y se generó un primer reporte de "fantasmas" para Mati.
3. ✅ Se envió al menos 1 solicitud real (ej. alta NJM322 La Segunda) y llegó al destinatario.
4. ✅ La solicitud fue confirmada y el asegurado quedó activo en el sistema.
5. ✅ El cron de vencimientos disparó la primera alerta de La Segunda Motos (vence 31/05).
6. ✅ Tab Pólizas en perfil de proveedor muestra cobertura correctamente.
7. ✅ Mati pudo darle de baja a 1 distribuidor desde el módulo y se actualizaron las pólizas correspondientes.
