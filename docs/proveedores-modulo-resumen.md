# Módulo Proveedores — Resumen técnico

> **Naming**: en BD/código se llama `personas` / `Persona` / `personal`; en UI se muestra como "Proveedores".

Generado: 2026-05-04.

---

## Backend (Laravel)

### Modelo

[back/app/Models/Persona.php](../back/app/Models/Persona.php)

- **Fillable** (~40 campos): datos personales (`apellidos`, `nombres`, `legajo`, `cuil`, `telefono`, `email`), pago (`pago`, `cbu_alias`, `medio_pago`, `retener_pago`, `retener_pago_motivo`), combustible (`combustible`, `combustible_estado`), cobrador (`es_cobrador`, `cobrador_nombre`, `cobrador_email`, `cobrador_cuil`, `cobrador_cbu_alias`), membresía (`membresia_desde`), vínculos (`unidad_id`, `cliente_id`, `sucursal_id`, `agente_id`, `agente_responsable_id`, `agentes_responsables_ids`, `estado_id`), perfil (`tipo`, `patente`, `capacidad_vehiculo_kg`, `paga_peajes`), tarifa (`tarifaespecial`, `observaciontarifa`), `observaciones`, aprobación (`aprobado`, `aprobado_at`, `aprobado_por`, `es_solicitud`), fechas (`fecha_alta`, `fecha_baja`).
- **Casts**: `agentes_responsables_ids` → array, `paga_peajes` → bool.
- **Relaciones**:
  - `belongsTo`: `Cliente`, `Unidad`, `Sucursal`, `User` (agente), `User` (agente_responsable), `Estado`, `User` (aprobado_por).
  - `hasMany`: `Archivo` (documentos), `PersonaComment`, `PersonaHistory`, `TransportistaQrAccessLog`, `PersonaPatente` (patentes adicionales), `LiqOrdenPago` (como beneficiario).
  - `hasOne`: `Dueno`, `TaxProfile` (legajo impositivo, por `entity_id`).
- **Helpers**: `tieneCobrador(): bool`, `datosBeneficiario(): array`.

### Tabla `personas`

Migración base: [back/database/migrations/2025_10_24_132731_create_personas_table.php](../back/database/migrations/2025_10_24_132731_create_personas_table.php).

Migraciones complementarias:
- `2025_10_24_140000_add_approval_fields_to_personas_table.php` — `aprobado`, `aprobado_at`, `aprobado_por`.
- `2025_10_30_000000_add_es_solicitud_to_personas_table.php`.
- `2025_12_10_185311_add_legajo_to_personas_table.php`.
- `2026_04_18_000001_add_proveedor_id_to_liq_tarifas_patente.php` — FK desde tarifas.

### Controller

[back/app/Http/Controllers/Api/PersonalController.php](../back/app/Http/Controllers/Api/PersonalController.php)

### Endpoints (`/api/personal`)

| Método | Ruta                                                | Acción                              |
|--------|-----------------------------------------------------|-------------------------------------|
| GET    | `/`                                                 | listado (`?includePending=bool`)    |
| GET    | `/personal-meta`                                    | opciones para selectores            |
| POST   | `/`                                                 | crear                               |
| GET    | `/{persona}`                                        | detalle                             |
| PUT    | `/{persona}`                                        | actualizar                          |
| DELETE | `/{persona}`                                        | eliminar (soft delete)              |
| POST   | `/{persona}/aprobar`                                | aprobar solicitud                   |
| POST   | `/{persona}/desaprobar`                             | desaprobar                          |
| POST   | `/{persona}/contact-reveal`                         | log auditoría revelación contacto   |
| PUT    | `/{persona}/retener-pago`                           | retener / liberar pago              |
| GET    | `/{persona}/combustible`                            | historial combustible               |
| GET    | `/{persona}/combustible-reportes`                   | reportes combustible                |
| GET    | `/{persona}/combustible-proyeccion`                 | proyección consumo                  |
| GET    | `/resumen-mensual`                                  | resumen mensual global              |
| GET    | `/{persona}/notificaciones`                         | notificaciones del proveedor        |
| POST   | `/{persona}/notificaciones/{notification}/read`     | marcar leída                        |
| POST   | `/{persona}/comentarios`                            | agregar comentario                  |
| GET    | `/{persona}/membresia`                              | datos membresía                     |
| POST   | `/{persona}/membresia/cuotas`                       | alta cuota                          |
| POST   | `/{persona}/membresia/beneficios`                   | uso de beneficio                    |
| GET    | `/{persona}/documentos`                             | listar documentos (Archivo)         |
| POST   | `/{persona}/documentos`                             | subir documento                     |
| GET    | `/{persona}/documentos/{documento}/descargar`       | descargar                           |
| PUT    | `/{persona}/documentos/{documento}`                 | actualizar metadatos                |
| DELETE | `/{persona}/documentos/{documento}`                 | eliminar                            |

### Seeder

[back/database/seeders/PersonasSeeder.php](../back/database/seeders/PersonasSeeder.php) — 2 registros demo (Juan Pérez, María Gómez). No hay factory.

---

## Frontend (React TS)

### Rutas (en `App.tsx`)

| Path                                  | Página                                                                      |
|---------------------------------------|-----------------------------------------------------------------------------|
| `/personal`                           | [ProveedoresPage.tsx](../front/src/pages/ProveedoresPage.tsx)              |
| `/personal/nuevo`                     | [ProveedorNuevoPage.tsx](../front/src/pages/ProveedorNuevoPage.tsx)        |
| `/personal/:personaId/editar`         | [ProveedorEditarPage.tsx](../front/src/pages/ProveedorEditarPage.tsx)      |
| `/personal/:personaId/membresia`      | `MembresiaPanelPage`                                                        |

### Capacidades del listado (`ProveedoresPage`)

- Paginado 50 por página.
- Filtros: cliente, sucursal, perfil, agente, unidad, patente, legajo, estado, combustible, tarifa especial, pago, fecha de alta (preset + rango), membresía, vencimiento de documentación (`vencido` / `por_vencer` / `vigente` / `sin_documentos`).
- Búsqueda full-text sobre: nombre, cuil, teléfono, email, cliente, unidad, sucursal, estado, perfil, agente, observaciones, datos del dueño.
- Columnas configurables (mostrar/ocultar).
- Export CSV.
- QR transportista por fila.
- Acciones: editar, eliminar, generar QR.

### Alta (`ProveedorNuevoPage`)

- Formulario con validación.
- Auto-aprobación opcional (requiere permiso).

### Edición (`ProveedorEditarPage`)

- Datos generales.
- Gestión de documentos (Archivo).
- Datos del dueño (`Dueno`, hasOne).
- Datos del cobrador (si `es_cobrador`).
- Legajo impositivo (`TaxProfile`).

### Tipos

[front/src/features/personal/types.ts](../front/src/features/personal/types.ts) → `PersonalRecord`.

### Componentes auxiliares

- `PersonalRadarPanel`
- `PersonalTeamsPanel`

---

## Integraciones

- **Liquidaciones v2**: cada proveedor es beneficiario en `LiqOrdenPago`; tarifas por patente vía `liq_tarifas_patente.proveedor_id` (FK agregada el 2026-04-18).
- **Documentos / Archivo**: cálculo de vencimientos para indicadores en listado.
- **TaxProfile** (legajo impositivo): vinculado por `entity_id`.
- **QR transportista**: con `TransportistaQrAccessLog` para auditoría de accesos.
- **Combustible**: tracking + reportes + proyección de consumo.
- **Membresía**: cuotas y uso de beneficios.

---

## Documentación existente

Sin doc dedicada al módulo. Sólo menciones en:

- [docs/manual-usuario-liquidaciones-v2.md](manual-usuario-liquidaciones-v2.md) — acción "Ir a proveedor" + uso del maestro Personas para resolver patentes sin distribuidor.
- [docs/manual-liquidaciones-v2-extractos-y-tarifas.md](manual-liquidaciones-v2-extractos-y-tarifas.md) — ídem.

---

## Estado actual

Módulo maduro y en producción. CRUD completo, validaciones, soft delete, auditoría, permisos, export CSV, búsqueda. Sin `TODO`/`FIXME` visibles en el código crítico.
