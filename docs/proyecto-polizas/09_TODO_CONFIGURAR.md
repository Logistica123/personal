# TODO — Configuraciones a completar

> Estos puntos NO bloquean la implementación. Son configuraciones operativas que se completan al setup inicial o cuando Mati las defina.

---

## TODO 1 — Casilla email institucional

**Necesario para:** Fase 6 (envío SMTP).

**Pregunta a Mati:** ¿existe `polizas@logisticaargentina.com.ar` o `seguros@...`? Si no, ¿quién la crea?

**Acción técnica:** una vez creada, configurar en `.env`:

```env
POLIZAS_SMTP_HOST=smtp.office365.com
POLIZAS_SMTP_PORT=587
POLIZAS_SMTP_USER=polizas@logisticaargentina.com.ar
POLIZAS_SMTP_PASSWORD=*****
POLIZAS_SMTP_FROM_NAME="Pólizas - Logística Argentina"
POLIZAS_SMTP_ENCRYPTION=tls
```

El `Reply-To` se setea dinámicamente al email del admin que crea la solicitud.

---

## TODO 2 — Lista de administrativos

**Necesario para:** Fase 1 (seed de permisos) y Fase 6 (rotación de admins).

**Pregunta a Mati:** ¿quiénes son los administrativos que van a usar este módulo? Por ejemplo:

- Mati Sánchez (creador, admin total)
- ¿Otros del equipo?

**Acción técnica:** una vez definidos, ejecutar:

```sql
INSERT INTO polizas_admin_permisos (
    user_id, puede_cargar_pdf, puede_solicitar_alta, puede_solicitar_baja,
    puede_confirmar_respuesta, puede_editar_email_config, recibe_alertas_vencimiento
)
SELECT id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
  FROM users
 WHERE email = 'msanchez@logisticaargentina.com.ar';

-- Repetir por cada admin.
```

---

## TODO 3 — Contactos por aseguradora

**Necesario para:** templates de email.

**En seeds quedaron como `TODO_*@...`.** Reemplazar con emails reales:

| Aseguradora | Contacto | Email | Teléfono |
|---|---|---|---|
| MAPFRE | Carlos | TODO | TODO |
| San Cristóbal | (general) | `altas@sancristobal.com.ar` (?) | TODO |
| San Cristóbal | (general) | `bajas@sancristobal.com.ar` (?) | TODO |
| La Segunda | Ramón Morel | TODO | TODO |
| La Segunda | Comercial Corrientes | TODO | TODO |

**Acción técnica:** Una vez confirmados, UPDATE directo en `polizas_email_config` o desde la UI de configuración (Fase 6).

```sql
UPDATE polizas_email_config
   SET destinatarios_to = JSON_ARRAY('carlos@mapfre.com.ar')
 WHERE poliza_id = (SELECT id FROM polizas WHERE numero_poliza = '2297608')
   AND tipo = 'alta';
-- repetir para baja MAPFRE y para todas las pólizas
```

---

## TODO 4 — Estado de `personas.cuil`

**Necesario para:** Fase 3 (matching).

**Pregunta a Mati:** ¿cuántos distribuidores activos tienen `cuil` cargado vs sin cargar?

**Query diagnóstico:**

```sql
SELECT
    COUNT(*) AS total_personas,
    SUM(CASE WHEN cuil IS NOT NULL AND cuil != '' THEN 1 ELSE 0 END) AS con_cuil,
    SUM(CASE WHEN cuil IS NULL OR cuil = '' THEN 1 ELSE 0 END) AS sin_cuil
  FROM personas
 WHERE estado_id IN (SELECT id FROM estados WHERE nombre = 'Activo');
```

**Decisión de diseño según resultado:**

| % con CUIL | Decisión |
|---|---|
| > 95% | Matching primary CUIL + fallback fuzzy nombre suficiente. |
| 80-95% | Agregar bulk-update inicial pidiendo CUILs faltantes a admin. |
| < 80% | Considerar otra columna (DNI directo) como criterio principal o pedir consolidación de datos antes de implementar. |

---

## TODO 5 — Categorización de fotos en Documentos

**Necesario para:** Fase 6 (validación de adjuntos La Segunda).

**Pregunta a Mati:** ¿hoy las fotos en Documentos del proveedor están categorizadas (frente / lateral / cédula) o son todas genéricas?

**Query diagnóstico:**

```sql
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN categoria IS NULL THEN 1 ELSE 0 END) AS sin_categoria,
    categoria,
    COUNT(*) AS por_categoria
  FROM archivos
 WHERE entidad_tipo = 'Persona'
 GROUP BY categoria
 ORDER BY por_categoria DESC;
```

**Acciones según resultado:**

- **Si NINGUNA tiene categoría:** después de aplicar el ALTER, hacer un script que recorra archivos de personas y proponga categorías por nombre del archivo (regex `frente`, `cedula`, etc.) — el admin valida y bulk-updatea.

- **Si algunas ya están categorizadas:** confirmar que los slugs coinciden con los reservados:
  - `foto_frente`, `foto_lateral_der`, `foto_lateral_izq`, `foto_trasera`
  - `cedula_frente`, `cedula_dorso`
  - `dni_frente`, `dni_dorso`
  - `generico` (para no clasificados)

  Si los slugs son distintos (ej. "foto1", "imagen_principal") → migración de slugs antes de validación.

---

## TODO 6 — Mejoras opcionales no bloqueantes

Para evaluar después del MVP:

| # | Mejora | Estimación |
|---|---|---|
| 1 | Auto-categorización de fotos por ML (clasificador frente/lateral/cédula) | 2 días |
| 2 | OAuth Gmail/Outlook para que cada admin envíe desde su casilla | 3-5 días |
| 3 | Parsing automático de email entrante para auto-confirmar respuestas | 2 días |
| 4 | Importación masiva histórica de pólizas desde Excel | 2 días |
| 5 | Workflow de aprobación (admin → supervisor → envío) | 3 días |
| 6 | Dashboard ejecutivo (gasto total por aseguradora, ratio cobertura, alertas) | 2 días |

---

## Resumen de bloqueantes

- **Bloqueante para Fase 1 (modelo):** ninguno.
- **Bloqueante para Fase 2 (parser):** ninguno (los PDFs de muestra ya están en `ejemplos_pdfs/`).
- **Bloqueante para Fase 3 (matching):** TODO 4 (CUIL completion). Si está < 80% mejor consolidarlo antes.
- **Bloqueante para Fase 6 (envío):** TODO 1 (casilla SMTP) + TODO 3 (emails reales aseguradoras).
- **Bloqueante para Fase 6 (adjuntos):** TODO 5 (categorización fotos).

Mati puede ir resolviendo TODOs en paralelo a la implementación de Francisco.
