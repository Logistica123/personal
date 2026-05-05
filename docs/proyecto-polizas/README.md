# Proyecto Pólizas — Paquete completo para Francisco

> Para: IA de Francisco · De: Matías
> Fecha: 04-may-2026
> Módulo nuevo: gestión de pólizas de seguros con cruce contra base de proveedores + envío de altas/bajas a aseguradoras.

---

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `README.md` | Este índice |
| `01_SPEC_TECNICO.md` | **Spec técnico completo** (modelo de datos, parser, matching, UI, API) |
| `02_MIGRATION.sql` | Script SQL con las 7 tablas nuevas + datos seed |
| `03_PARSER_PDF.md` | Especificación detallada del parser para los 3 perfiles (MAPFRE / San Cristóbal / La Segunda) |
| `04_EMAIL_TEMPLATES.md` | Templates JSON para cada póliza × tipo (alta/baja) con placeholders |
| `05_API_ENDPOINTS.md` | Endpoints REST con request/response |
| `06_UI_MOCKUPS.md` | Pantallas + flujos de usuario |
| `07_PLAN_FASES.md` | Fases de implementación con estimaciones |
| `08_CRITERIOS_ACEPTACION.md` | Validación post-deploy |
| `09_TODO_CONFIGURAR.md` | Configuraciones que faltan responder (5 preguntas pendientes) |
| **`10_ADDENDUM_Clausulas.md`** | **ADDENDUM 1 — Cláusulas de no repetición + 2 pólizas MAPFRE adicionales (URBANO + NEWSAN)** |
| **`11_ADDENDUM_SanCristobal_Clausulas.md`** | **ADDENDUM 2 — Cláusulas también en San Cristóbal + cláusula global vs individual + numeración `N)_:`** |
| **`12_ADDENDUM_Clausulas_Universal.md`** | **ADDENDUM 3 — Cláusulas universales (La Segunda incluida) + catálogo NEWSAN + campo `alias`** |
| **`13_ADDENDUM_Parser_SC_Adherentes_y_Notificacion.md`** | **ADDENDUM 4 — Fix parser SC "Anexo de Adherentes" + Notificación al distribuidor por email** |
| **`14_ADDENDUM_Matching_Estados_Persona.md`** | **ADDENDUM 5 — Fix matching contra TODOS los estados de personas (caso OPT548 real)** |
| **`15_ADDENDUM_Flujo_Aprobacion_Distribuidor.md`** | **ADDENDUM 6 — Flujo bidireccional CRM Aprobaciones ↔ Pólizas (alta de seguro antes de aprobar distribuidor)** |
| `00_proveedores_modulo_resumen.md` | Doc de referencia del módulo Proveedores existente |
| `ejemplos_pdfs/` | 5 PDFs reales para que Francisco pueda probar el parser |

## Cómo usar este paquete

1. **Leer primero** `01_SPEC_TECNICO.md` — resumen ejecutivo + diseño completo del MVP.
2. **Después leer** `10_ADDENDUM_Clausulas.md` — cambios y nuevas tablas para soportar cláusulas de no repetición + 2 pólizas MAPFRE adicionales (asume el MVP ya implementado en producción).
3. **Pasar a Francisco** todo el zip con `Proyecto_Polizas/` adentro.
4. **Su IA** trabaja directo desde esa carpeta — todo lo necesario está en los 10 docs + los PDFs de muestra.

## Lo bloqueante

El doc `09_TODO_CONFIGURAR.md` lista 5 configuraciones que faltan definir. **Ninguna es bloqueante** para arrancar la implementación — el parser, modelo de datos y matching están definidos. Las 5 son configuraciones operativas que se completan al hacer el setup inicial:

1. Cómo cruzar `personas.cuil` (definido fallback fuzzy)
2. Quiénes son los administrativos (definir lista)
3. Casilla email institucional (`polizas@logarg...`)
4. Categorización de fotos del vehículo
5. Contactos por póliza (Carlos / Ramon / etc.)

## Pólizas en alcance

| Aseguradora | Póliza | N° | Vigencia | Cliente / cláusula |
|---|---|---|---|---|
| MAPFRE | AP Distribuidores OCASA | 2297608 | 08/04/25 → 08/04/26 | OCASA (CUIT 30-66204961-8) |
| MAPFRE | AP URBANO / Otras Empresas | **2297847** | TODO confirmar | URBANO Suc. Moreno (NEWSAN S.A.) |
| MAPFRE | AP NEWSAN | **2298721** | TODO confirmar | NEWSAN La Tablada (CBN + ID Supply Chain) |
| San Cristóbal | AP Colectivo | 01-06-06-30035710 | 30/03/26 → 05/12/26 | — |
| La Segunda | Vehículos Autos | 67.743.063 | 23/01/26 → 23/01/27 | — |
| La Segunda | Vehículos Motos | 45.597.407 | 28/02/26 → 31/05/26 | — |

## Estimación

**MVP completo: ~10-12 días** Francisco. Detalle de fases en `07_PLAN_FASES.md`.

**Addendum 1 (cláusulas + 2 pólizas MAPFRE): +3 días** sobre lo anterior. Detalle en `10_ADDENDUM_Clausulas.md`.

**Addendum 2 (cláusulas en SC + global vs individual): +1.5 días** sobre el addendum 1. Detalle en `11_ADDENDUM_SanCristobal_Clausulas.md`.

**Addendum 3 (cláusulas universales en La Segunda + NEWSAN + alias): +1.25 días** sobre el addendum 2. Detalle en `12_ADDENDUM_Clausulas_Universal.md`.

**Total feature cláusulas (10+11+12): ~5.75 días** sobre el MVP base.

**Addendum 4 (parser SC adherentes + notificación distribuidor): +5 días** sobre lo anterior. Detalle en `13_ADDENDUM_Parser_SC_Adherentes_y_Notificacion.md`.

**Addendum 5 (fix matching todos los estados): +2.5 días** sobre lo anterior. Detalle en `14_ADDENDUM_Matching_Estados_Persona.md`.

**Addendum 6 (flujo bidireccional CRM Aprobaciones ↔ Pólizas + auto-aprobación): +3.25 días** sobre lo anterior. Detalle en `15_ADDENDUM_Flujo_Aprobacion_Distribuidor.md`.

**TOTAL acumulado proyecto pólizas: ~27 días Francisco** (12 MVP + 5.75 cláusulas + 5 addendum 4 + 2.5 addendum 5 + 3.25 addendum 6 + medio día integración).

Cualquier duda, cortame en el momento.
