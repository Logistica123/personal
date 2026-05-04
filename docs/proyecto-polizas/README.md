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
| `00_proveedores_modulo_resumen.md` | Doc de referencia del módulo Proveedores existente |
| `ejemplos_pdfs/` | 5 PDFs reales para que Francisco pueda probar el parser |

## Cómo usar este paquete

1. **Leer primero** `01_SPEC_TECNICO.md` — resumen ejecutivo + diseño completo.
2. **Pasar a Francisco** todo el zip con `Proyecto_Polizas/` adentro.
3. **Su IA** trabaja directo desde esa carpeta — todo lo necesario está en los 9 docs + los PDFs de muestra.

## Lo bloqueante

El doc `09_TODO_CONFIGURAR.md` lista 5 configuraciones que faltan definir. **Ninguna es bloqueante** para arrancar la implementación — el parser, modelo de datos y matching están definidos. Las 5 son configuraciones operativas que se completan al hacer el setup inicial:

1. Cómo cruzar `personas.cuil` (definido fallback fuzzy)
2. Quiénes son los administrativos (definir lista)
3. Casilla email institucional (`polizas@logarg...`)
4. Categorización de fotos del vehículo
5. Contactos por póliza (Carlos / Ramon / etc.)

## Pólizas en alcance

| Aseguradora | Póliza | N° | Vigencia |
|---|---|---|---|
| MAPFRE | AP Distribuidores | 1520222860404 / 2297608 | 08/04/25 → 08/04/26 |
| San Cristóbal | AP Colectivo | 01-06-06-30035710 | 30/03/26 → 05/12/26 |
| La Segunda | Vehículos Autos | 67.743.063 | 23/01/26 → 23/01/27 |
| La Segunda | Vehículos Motos | 45.597.407 | 28/02/26 → 31/05/26 |

## Estimación

**MVP completo: ~10-12 días** Francisco. Detalle de fases en `07_PLAN_FASES.md`.

Cualquier duda, cortame en el momento.
