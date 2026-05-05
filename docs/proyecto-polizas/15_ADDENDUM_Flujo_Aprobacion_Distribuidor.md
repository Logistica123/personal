# ADDENDUM 6 — Flujo bidireccional con Aprobaciones/Solicitudes

> Versión: 1.0 · Fecha: 05-may-2026
> Para: IA de Francisco · De: Matías
> Tipo: integración de flujo. Asume el addendum 5 (matching contra todos los estados) implementado.

---

## TL;DR

El flujo operativo real de Logística Argentina es:

```
1. Persona se postula como distribuidor → queda en estado "Solicitud pendiente" (es_solicitud=1, aprobado=0)
2. Mati le pide alta en la póliza de seguro (AP MAPFRE/SC + Vehículo La Segunda según corresponda)
3. Aseguradora confirma alta → asegurado en póliza pasa a "Activo"
4. Recién entonces se aprueba a la persona como distribuidor activo (aprobado=1, estado=Activo)
```

Hoy el módulo Pólizas asume que las personas ya están aprobadas. **Hay que permitir solicitar alta de póliza desde una solicitud pendiente** y, opcionalmente, auto-aprobar a la persona como distribuidor cuando se confirma el alta.

Cambios:

1. **Acción nueva en CRM Aprobaciones/Solicitudes:** botón "Solicitar alta en póliza" que abre el wizard del módulo Pólizas con la persona pre-seleccionada.
2. **Selector de personas universal en wizard:** mostrar todos los estados (no filtrar por activo/aprobado).
3. **Auto-aprobación opcional post-confirmación de alta:** cuando se confirma el alta y la persona estaba en `es_solicitud=1`, ofrecer auto-aprobación.
4. **Integración del tab "Solicitud de póliza"** del CRM con la bandeja del módulo Pólizas.

---

## 1. Caso de uso real

### Flujo actual problemático

```
Día 1 — Juan postula como distribuidor.
        Mati cargá su data en CRM Aprobaciones/Solicitudes (es_solicitud=1, aprobado=0)

Día 2 — Mati intenta dar de alta a Juan en MAPFRE.
        Va al módulo Pólizas → "Solicitar alta" → busca a Juan.
        ❌ NO APARECE — el dropdown solo muestra personas ya aprobadas.
        Mati tiene que aprobar a Juan PRIMERO (con riesgo de aprobarlo sin cobertura)
        y después pedir el alta en póliza.

Día 5 — MAPFRE responde que rechaza el alta.
        Pero Juan ya quedó aprobado como distribuidor → ahora hay que dar de baja.
        Mati pierde tiempo deshaciendo el approval.
```

### Flujo correcto que queremos

```
Día 1 — Juan postula → es_solicitud=1, aprobado=0
Día 2 — Desde CRM Aprobaciones/Solicitudes, click en Juan → "Solicitar alta en póliza"
        Se abre el wizard del módulo Pólizas con Juan pre-seleccionado.
        Mati elige póliza MAPFRE → preview email → enviar.
        Solicitud queda en estado "enviado".
Día 5 — MAPFRE confirma alta.
        Mati click "Confirmar respondida_ok" en la solicitud.
        Modal: "Juan está en solicitud pendiente. ¿Aprobarlo como distribuidor activo ahora?"
        Mati click "Sí, aprobar" → Juan pasa a aprobado=1, estado=Activo.

[Si MAPFRE rechazara]
Día 5 — Mati click "Confirmar respondida_rechazada".
        Juan sigue en estado solicitud pendiente. Sin overhead.
```

---

## 2. Cambios necesarios

### Cambio A — Selector de personas en wizard "Solicitar alta póliza"

Hoy probablemente el selector filtra por `estado.activo = TRUE` y `aprobado = TRUE`. Quitar esos filtros.

```php
// ANTES (mal):
$personas = Persona::where('estado_id', $activo_id)
                   ->where('aprobado', true)
                   ->whereNull('fecha_baja')
                   ->orderBy('apellidos')
                   ->get();

// DESPUÉS (bien):
$personas = Persona::orderBy('apellidos')->get();
```

Y mostrar el estado al lado del nombre:

```
Seleccionar persona:
  ┌────────────────────────────────────────────────────────────┐
  │ Buscar...                                                   │
  ├────────────────────────────────────────────────────────────┤
  │ JUAN PEREZ           [Solicitud pendiente]   CUIL ...       │
  │ ANA GOMEZ            [Activo]                CUIL ...       │
  │ CARLOS LOPEZ         [Suspendido]            CUIL ...       │
  │ MARIA RAMIREZ        [Baja]                  CUIL ...       │
  │ EDUARDO INTILE       [Suspendido]            CUIL 23310145599│  ← (caso del addendum 5)
  └────────────────────────────────────────────────────────────┘
```

Badge color por estado:
- Activo → verde
- Solicitud pendiente → azul
- Suspendido → ámbar
- Baja → rojo

### Cambio B — Acción "Solicitar alta en póliza" en CRM

En la pantalla `CRM → Aprobaciones/Solicitudes` agregar:

**Por fila** (en la columna Acciones, junto a los iconos existentes 👁 ✏ 🗑):

```
[👁 Ver] [✏ Editar] [📋 Solicitar alta en póliza] [🗑 Eliminar]
```

Click en "Solicitar alta en póliza" → redirige a `/polizas/solicitar-alta?persona_id={id}` con la persona pre-seleccionada en el paso 1 del wizard.

**Acción masiva** (para múltiples solicitudes seleccionadas):

```
☑ Seleccionados: 5 solicitudes
[📋 Solicitar alta en póliza (5)]
```

Si los 5 son del mismo perfil (todos transportistas, por ejemplo), abre el wizard con los 5 pre-seleccionados. Si son perfiles distintos, advertencia de qué póliza usar.

### Cambio C — Auto-aprobación post-confirmación de alta

Cuando se confirma una solicitud de alta como `respondida_ok`, el sistema verifica si los asegurados estaban en estado `es_solicitud=1`. Si sí:

```php
function confirmar_solicitud_ok($solicitud) {
    // 1. Actualizar asegurados → estado = 'activo' + fecha_alta_efectiva = ahora
    // 2. Detectar personas con es_solicitud=1
    $personas_a_aprobar = collect();
    foreach ($solicitud->asegurados as $a) {
        if ($a->persona_id && $a->persona->es_solicitud == 1) {
            $personas_a_aprobar->push($a->persona);
        }
    }

    // 3. Si hay → modal en UI ofreciendo auto-aprobación
    return [
        'asegurados_activados' => count($solicitud->asegurados),
        'personas_a_aprobar' => $personas_a_aprobar,
    ];
}
```

UI del modal:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Solicitud confirmada — 3 asegurados activados                            │
│                                                                          │
│ De estos asegurados, 2 son personas que aún están en solicitud pendiente │
│ en el sistema. ¿Querés aprobarlos como distribuidores activos ahora?     │
│                                                                          │
│ ☑ JUAN PEREZ      (Solicitud pendiente desde 28/04/2026)                 │
│ ☑ ANA GOMEZ       (Solicitud pendiente desde 30/04/2026)                 │
│                                                                          │
│ El tercero (CARLOS LOPEZ) ya estaba aprobado.                            │
│                                                                          │
│ [No aprobar ahora]                          [Aprobar 2 distribuidores]  │
└──────────────────────────────────────────────────────────────────────────┘
```

Click "Aprobar 2 distribuidores":

```sql
UPDATE personas
   SET aprobado = TRUE,
       aprobado_at = NOW(),
       aprobado_por = {user_actual},
       es_solicitud = FALSE,
       estado_id = (SELECT id FROM estados WHERE nombre = 'Activo')
 WHERE id IN ({ids_seleccionados});
```

Click "No aprobar ahora":
- Asegurados quedan activos en póliza.
- Personas siguen en solicitud pendiente.
- Mati puede aprobarlas manualmente desde el CRM cuando quiera.

### Cambio D — Tab "Solicitud de póliza" en CRM

La pantalla actual `CRM → Aprobaciones/Solicitudes` tiene un tab **"Solicitud de póliza"** que probablemente está vacío o desactualizado.

**Integrarlo** con el módulo Pólizas:

```
CRM → Aprobaciones/Solicitudes → tab "Solicitud de póliza"

Muestra: bandeja de polizas_solicitudes con filtros:
  - estado: borrador / enviado / respondida_ok / respondida_rechazada
  - tipo: alta / baja
  - aseguradora
  - admin
  - fecha desde / hasta

Es la misma vista que /polizas/solicitudes — embebida en el CRM.
```

> Implementación: usar un componente compartido `SolicitudesPolizasBandeja` que se renderiza tanto en `/polizas/solicitudes` como en el tab del CRM.

---

## 3. Cambios técnicos

### Endpoint nuevo

```
GET  /api/personal/{id}/polizas-aplicables
     Devuelve qué pólizas aplican a esta persona según su perfil/cliente.
     Útil para sugerir desde la acción "Solicitar alta en póliza" en CRM.

Response:
{
  "data": [
    {"poliza_id": 1, "nombre": "MAPFRE - AP OCASA", "razon": "Persona con cliente OCASA"},
    {"poliza_id": 3, "nombre": "La Segunda - Vehículos Autos", "razon": "Persona con patente ZUL050"}
  ]
}
```

### Endpoint actualizado

```
POST /api/polizas/solicitudes/{id}/confirmar
```

Response actualizado para incluir las personas pendientes de aprobar:

```json
{
  "estado": "respondida_ok",
  "asegurados_activados": 3,
  "personas_pendientes_aprobacion": [
    {"persona_id": 88, "nombre": "JUAN PEREZ", "es_solicitud": true},
    {"persona_id": 89, "nombre": "ANA GOMEZ", "es_solicitud": true}
  ]
}
```

### Endpoint nuevo para aprobación masiva

```
POST /api/personal/aprobar-masivo
{
  "ids": [88, 89]
}
```

Response: lista de personas aprobadas + ids fallidos.

---

## 4. Configuración por póliza — auto-aprobación on/off

Algunas pólizas pueden no requerir aprobación de distribuidor (ej. La Segunda Motos puede aprobar la moto sin aprobar al distribuidor).

Agregar columna a `polizas`:

```sql
ALTER TABLE polizas
  ADD COLUMN ofrecer_auto_aprobacion_distribuidor BOOLEAN NOT NULL DEFAULT TRUE
  AFTER alerta_dias_antes_vencimiento;
```

- TRUE → cuando se confirma alta, modal pregunta auto-aprobación.
- FALSE → no muestra modal (caso edge).

---

## 5. Integración con tab Pólizas en perfil de proveedor

El tab "Pólizas" del perfil de proveedor (definido en spec original) ahora también tiene que mostrar:

```
Estado del proveedor: Solicitud pendiente

⚠ Para aprobar a este distribuidor como activo, primero hay que dar
   de alta en la póliza de seguro correspondiente:

Pólizas sugeridas según su perfil:
- MAPFRE - AP OCASA  [Solicitar alta]
- La Segunda - Vehículos Autos (patente ZUL050)  [Solicitar alta]

Pólizas en las que ya figura:
(ninguna)
```

Si el proveedor está en estado activo y aprobado:

```
Estado del proveedor: Activo · Aprobado el 04/05/2026 por Mati

Pólizas en las que figura:
- MAPFRE - AP OCASA · Activo desde 02/05/2026  [Solicitar baja]
- La Segunda - Vehículos Autos · IWK373 · Activo  [Solicitar baja]
```

---

## 6. Criterios de aceptación

- [ ] Wizard "Solicitar alta póliza" — selector incluye personas en TODOS los estados (Activo, Solicitud, Suspendido, Baja, Sin aprobar).
- [ ] Al lado del nombre se muestra badge de estado.
- [ ] CRM Aprobaciones/Solicitudes tiene acción "Solicitar alta en póliza" por fila y masiva.
- [ ] Click en acción → redirige a wizard con persona(s) pre-seleccionada(s).
- [ ] Confirmar solicitud `respondida_ok` con personas en `es_solicitud=1` → modal pregunta auto-aprobación.
- [ ] Click "Aprobar X distribuidores" → personas pasan a `aprobado=1`, `es_solicitud=0`, `estado=Activo`.
- [ ] Click "No aprobar ahora" → personas siguen en solicitud pendiente.
- [ ] Si la solicitud se rechaza (`respondida_rechazada`) → personas siguen en solicitud, no se aprueban.
- [ ] Tab "Solicitud de póliza" del CRM muestra la misma bandeja que `/polizas/solicitudes`.
- [ ] Tab Pólizas del perfil de proveedor muestra mensaje correcto según estado (activo / solicitud / etc.).
- [ ] **Caso de prueba real:** elegir una solicitud pendiente del CRM (ej. Alberto Jacinto Celi #912) → "Solicitar alta en póliza" → se abre wizard con persona pre-cargada → flujo completo hasta confirmar → modal aprobación → persona pasa a activo.

---

## 7. Estimación

| Tarea | Tiempo |
|---|---|
| Quitar filtros del selector de personas en wizard | ¼ día |
| Badge de estado al lado del nombre en selector | ¼ día |
| Acción "Solicitar alta en póliza" en CRM (por fila + masiva) | ½ día |
| Endpoint `/api/personal/{id}/polizas-aplicables` | ¼ día |
| Modal auto-aprobación post-confirmación | ½ día |
| Endpoint `/api/personal/aprobar-masivo` | ¼ día |
| Integrar tab "Solicitud de póliza" en CRM con módulo Pólizas | ½ día |
| Mejora del tab Pólizas en perfil (mensaje según estado) | ¼ día |
| Smoke tests con flujo completo (postulación → alta póliza → aprobación) | ½ día |
| **TOTAL** | **~3.25 días** |

---

## 8. Riesgo / consideraciones

| Riesgo | Mitigación |
|---|---|
| Mati apruebe distribuidor sin querer al confirmar | Modal con confirmación explícita, no automatización silenciosa |
| Persona aprobada queda asegurada pero después rechazan el alta | El estado `respondida_rechazada` revierte: si se había auto-aprobado, ofrecer "deshacer aprobación" |
| Confusión entre solicitud pendiente CRM vs solicitud pendiente Pólizas | Distinto naming en UI: "Solicitud de proveedor" (CRM) vs "Solicitud a aseguradora" (Pólizas) |

---

## 9. Resumen del flujo bidireccional final

```
┌─────────────────┐    "Solicitar alta en póliza"    ┌──────────────────┐
│ CRM Aprobaciones│───────────────────────────────→ │ Wizard Pólizas   │
│ /Solicitudes    │                                   │ (alta a aseg.)   │
│ (es_solicitud=1)│                                   └──────────────────┘
│                 │                                            │
│                 │                                            ▼
│                 │                                   ┌──────────────────┐
│                 │  ←─── Modal "Aprobar X?"  ────── │ Confirmar OK     │
│ (aprobado=1)   │                                   │ aseguradora      │
└─────────────────┘                                   └──────────────────┘
       ▲                                                       │
       │                                                       │
       │                                                       ▼
┌─────────────────┐    "Solicitar baja"               ┌──────────────────┐
│ Perfil Proveedor│───────────────────────────────→ │ Wizard Pólizas   │
│ (estado: Baja)  │                                   │ (baja en aseg.)  │
└─────────────────┘                                   └──────────────────┘
```

Cualquier duda, cortame en el momento.
