# UI Mockups — Pantallas y flujos

> Descripción funcional de pantallas. Para implementar en React TS siguiendo el estilo del módulo Proveedores existente.

---

## Pantalla 1 — Listado de Pólizas

**Path:** `/polizas`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Pólizas de Seguros                                          [+ Nueva Póliza] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Filtros: [Aseguradora ▼] [Ramo ▼] [☑ Solo activas] [Próximas a vencer]      │
│                                                                              │
│ ┌─────────────────────────┐ ┌─────────────────────────┐ ┌──────────────────┐│
│ │ 🟦 MAPFRE                │ │ 🟦 San Cristóbal         │ │ 🟦 La Segunda    ││
│ │ AP Distribuidores        │ │ AP Colectivo             │ │ Vehículos Autos  ││
│ │ N° 2297608               │ │ N° 01-06-06-30035710    │ │ N° 67.743.063    ││
│ │ Vence: 08/04/26 (-27d)🔴 │ │ Vence: 05/12/26 (215d)  │ │ Vence: 23/01/27  ││
│ │ 88 vidas vigentes        │ │ 414 vidas               │ │ 23 vehículos     ││
│ │ ⚠ 3 discrepancias        │ │ ✓ Sin discrepancias     │ │ ⚠ 2 fantasmas    ││
│ └─────────────────────────┘ └─────────────────────────┘ └──────────────────┘│
│                                                                              │
│ ┌──────────────────┐                                                         │
│ │ 🟦 La Segunda    │                                                         │
│ │ Vehículos Motos  │                                                         │
│ │ N° 45.597.407    │                                                         │
│ │ Vence: 31/05/26  │   ← 🔴 alerta porque está dentro de 15 días            │
│ │ (27d) 🔴         │                                                         │
│ │ 8 motos          │                                                         │
│ └──────────────────┘                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Click en una card → abre detalle.

---

## Pantalla 2 — Detalle de Póliza

**Path:** `/polizas/:id`

Tabs:
- **Resumen**
- **Asegurados**
- **Discrepancias**
- **Endosos**
- **Solicitudes**
- **Configuración** (solo con permiso)

### Tab Resumen

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Volver  ·  La Segunda - Vehículos Autos                                   │
│                                                                              │
│ N° Póliza: 67.743.063 ·  Aseguradora: La Segunda                            │
│ Vigencia: 23/01/2026 → 23/01/2027  ·  Premio anual: $X.XXX.XXX              │
│ Tomador: LOGISTICA ARGENTINA S.R.L.  CUIT 30-71706098-5                     │
│                                                                              │
│ Cláusulas: Cláusulas OCA                                                    │
│                                                                              │
│ ┌──── Estado ────────────┐ ┌──── Discrepancias ──────┐                      │
│ │ Vehículos activos: 23  │ │ Sin persona: 2          │                      │
│ │ Bajas pendientes: 1    │ │ Sin póliza: 0           │                      │
│ │ Altas pendientes: 0    │ │ Dudosos: 0              │                      │
│ └────────────────────────┘ └─────────────────────────┘                      │
│                                                                              │
│ [📄 Cargar PDF] [📨 Solicitar Alta] [📨 Solicitar Baja]                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tab Asegurados

Tabla con paginado:

| ✓ | Identificador | Nombre / Modelo | Persona en sistema | Estado | Alta | Acción |
|---|---|---|---|---|---|---|
| ☐ | IWK373 (Patente) | ATEGO 1418-48 / Lionetti | OJEDA ALFREDO ✓ | Activo | 23/01/26 | [Ver] |
| ☐ | A009PHB (Patente) | ZANELLA ZB 110 / Walter | WAHNISH WALTER ✓ | Activo | 28/02/26 | [Ver] |
| ☐ | NJM322 (Patente) | RENAULT KANGOO / -- | **Sin match** ⚠ | No matcheado | 28/03/26 | [Ver] |
| ☑ | JLE386 (Patente) | -- / -- | -- | Baja solicitada | -- | [Ver] |

Filtros: estado (activo / baja_solicitada / dado_de_baja / no_matcheado), búsqueda.

Selección múltiple → botones "Solicitar Alta" / "Solicitar Baja" en cabecera.

### Tab Discrepancias

Sub-tabs:
- **Sin persona en sistema** (asegurados fantasma — pago seguro de gente/vehículos no nuestros)
- **Personas activas sin cobertura** (faltan dar de alta en póliza)
- **Match dudoso** (revisión manual)

Cada sub-tab es una tabla con datos contextuales y acciones rápidas:

```
Sin persona en sistema (fantasmas)

| Identificador | Nombre/Modelo del PDF      | Antigüedad   | Acción          |
| 12345678 (DNI)| PEREZ JUAN                 | 88 días      | [Pedir baja]    |
| KFL204        | RENAULT KANGOO 2018         | 145 días     | [Pedir baja] [Vincular a persona...]|
```

### Tab Endosos

Histórico cronológico:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 30/03/2026 · Endoso 118 · Incorporación de 3 asegurados                │
│ Premio: $56.941,00 · [📄 Ver PDF]                                       │
│                                                                        │
│ + Yacob Jorge Dario (CUIL 20-31675826-7)                               │
│ + Marolo Eva Gabriela (CUIL 27-26787470-6)                             │
│ + Lorences Emiliano Emanuel (CUIL 20-36401691-4)                       │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ 15/02/2026 · Endoso 117 · Anulación de 1 asegurado                     │
│ ...                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Tab Solicitudes

Bandeja de solicitudes propias de esta póliza con estado.

### Tab Configuración

Edición de email_config (alta + baja) — solo con permiso.

---

## Pantalla 3 — Wizard Cargar PDF

**Path:** `/polizas/:id/cargar-pdf`

### Paso 1: Subir PDF

```
┌──────────────────────────────────────────────────────────┐
│ Cargar PDF a: La Segunda - Vehículos Autos               │
│                                                          │
│ ┌─────── Drop zone ────────────────────────────────────┐ │
│ │       Arrastrá el PDF acá o click para seleccionar   │ │
│ │       (Solo PDF · máx 10 MB)                         │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Tipo de documento esperado: Constancia o Endoso         │
│                                                          │
│ [Cancelar]                            [Subir y parsear ▶]│
└──────────────────────────────────────────────────────────┘
```

### Paso 2: Preview del parsing

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Preview de carga — PDF parseado correctamente                            │
│                                                                          │
│ ✓ Aseguradora detectada: La Segunda                                      │
│ ✓ Tipo: Constancia de Cobertura                                          │
│ ✓ N° Póliza: 67.743.063 (matchea con la póliza destino)                 │
│ ✓ Vigencia: 23/01/2026 → 23/01/2027                                      │
│                                                                          │
│ Asegurados parseados: 23                                                 │
│   ✓ 21 con match exacto en personas                                      │
│   ⚠ 2 sin match (revisar abajo)                                          │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ ✓ IWK373 → OJEDA ALFREDO (CUIL match)                                │ │
│ │ ✓ A009PHB → WAHNISH WALTER (patente match)                           │ │
│ │ ✓ ... (21 más)                                                       │ │
│ │ ⚠ NJM322 → sin match en personas                                     │ │
│ │   Acciones: [Crear persona] [Vincular existente] [Ignorar]           │ │
│ │ ⚠ KFL204 → sin match                                                 │ │
│ │   Acciones: [Crear persona] [Vincular existente] [Ignorar]           │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ [Cancelar]                                  [Confirmar y aplicar ▶]      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Paso 3: Confirmación aplicada

```
✓ Carga aplicada:
  - 21 asegurados creados/actualizados con match
  - 2 sin match → quedaron como "no_matcheado" para revisión
  - Endoso registrado: Constancia 04/05/2026
  - PDF guardado en archivos
```

---

## Pantalla 4 — Solicitar Alta/Baja

**Path:** `/polizas/:id/solicitar-baja` (o alta)

### Paso 1: Selección

Vine pre-seleccionado si llegamos desde el tab Asegurados con checkboxes activos. Sino:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Solicitar BAJA — La Segunda - Vehículos Autos                            │
│                                                                          │
│ Seleccionar asegurados a dar de baja:                                    │
│                                                                          │
│ Filtro estado: [Activos ▼]   Buscar: [____________]                      │
│                                                                          │
│ ☑ JLE386 - Renault Kangoo - González Juan          (activo desde mar-26) │
│ ☑ KOM123 - Ford Ranger - Pérez Pedro              (activo desde abr-25) │
│ ☐ LIM234 - Fiat Fiorino - Gómez Ana               (activo desde ene-26) │
│ ...                                                                      │
│                                                                          │
│ Seleccionados: 2 vehículos                                               │
│                                                                          │
│ [Cancelar]                                          [Continuar ▶]         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Paso 2: Preview del email

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Preview Email — Solicitud de BAJA                                        │
│                                                                          │
│ De:      Pólizas - Logística Argentina <polizas@logarg...>               │
│ Para:    comercial.corrientes@lasegunda.com.ar                           │
│ CC:      ramon.morel@lasegunda.com.ar, admin@logarg...                   │
│ Reply-To: msanchez@logarg... (admin que crea la solicitud)               │
│                                                                          │
│ Asunto:  BAJA                                                            │
│                                                                          │
│ ┌─── Cuerpo ─────────────────────────────────────────────────────────┐  │
│ │ Buenos días Ramón                                                   │  │
│ │                                                                     │  │
│ │ Solicito bajas de las siguientes unidades que se encuentran dentro │  │
│ │ de la flota de Logística Argentina.                                │  │
│ │                                                                     │  │
│ │ JLE386                                                              │  │
│ │ KOM123                                                              │  │
│ │                                                                     │  │
│ │ Aguardo confirmación                                                │  │
│ │                                                                     │  │
│ │ Saludos                                                             │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│ Adjuntos: ninguno requerido para baja                                   │
│                                                                          │
│ [← Volver]                              [✏ Editar] [✉ Enviar ahora]      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Paso 3 (caso La Segunda Autos Alta): Validación de adjuntos

Si faltan adjuntos:

```
⚠ NO SE PUEDE ENVIAR — Faltan documentos requeridos:

GONZALEZ JUAN (JLE386):
  ✗ Falta foto_frente
  ✗ Falta cedula_frente

PEREZ PEDRO (KOM123):
  ✗ Falta foto_lateral_der
  ✗ Falta foto_trasera

Acciones:
[📷 Cargar archivos faltantes (te lleva al perfil de cada persona)]
[Quitar de la solicitud los que faltan documentos]
```

### Paso 4: Envío

```
✓ Solicitud enviada a las 16:45
   ID: 30
   Email message-id: <abc123@logarg...>

Próximos pasos:
- Cuando recibas la respuesta de La Segunda, marcá la solicitud como confirmada
- [Ir a Solicitudes →]
```

---

## Pantalla 5 — Bandeja de Solicitudes

**Path:** `/polizas/solicitudes`

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Solicitudes                                                                │
│                                                                            │
│ Filtros: [Estado ▼] [Póliza ▼] [Tipo ▼] [Fecha ▼]                         │
│                                                                            │
│ #  | Fecha     | Póliza            | Tipo  | # Asegurados| Estado          │
│ 30 | 04/05/26  | La Segunda Autos  | Baja  | 2          | Enviado (5d)    │
│ 29 | 28/04/26  | San Cristóbal AP  | Alta  | 3          | Confirmada ✓     │
│ 28 | 25/04/26  | MAPFRE AP         | Baja  | 1          | Enviado (12d) ⚠  │
│ 27 | 20/04/26  | La Segunda Motos  | Alta  | 1          | Borrador         │
└────────────────────────────────────────────────────────────────────────────┘
```

Hover sobre estado "Enviado (12d)" → tooltip "Sin respuesta hace 12 días".

Click en fila → detalle con timeline de eventos.

---

## Pantalla 6 — Tab Pólizas en Proveedor

**Path:** `/personal/:id/editar` (tab nuevo)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Datos | Documentos | Membresía | Cobrador | Tax | [Pólizas]              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Pólizas en las que figura este proveedor:                                │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ 🟦 MAPFRE - AP Distribuidores                                         │ │
│ │ Estado: Activo · Alta efectiva: 08/04/2025                           │ │
│ │ [Solicitar baja]                                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ 🟦 La Segunda - Vehículos Autos                                       │ │
│ │ Patente: IWK373 · Estado: Activo · Alta efectiva: 23/01/2026         │ │
│ │ [Solicitar baja]                                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ Cobertura: ✓ Tiene AP + Vehículo                                         │
│                                                                          │
│ Si la persona NO está en alguna póliza relevante:                        │
│ ⚠ Falta cobertura en San Cristóbal AP Colectivo                          │
│   [Solicitar alta]                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Pantalla 7 — Configuración Email Templates

**Path:** `/polizas/:id/configuracion`

Solo accesible con permiso `puede_editar_email_config`.

Tabs internos: **Alta** | **Baja**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Configuración email — La Segunda Autos    [Alta] [Baja]                  │
│                                                                          │
│ ▶ Destinatarios                                                          │
│   Para (To):     [chip] ramon.morel@... [+ agregar]                      │
│   CC:            [chip] comercial.corrientes@... [chip] admin@... [+]    │
│   BCC:           [+ agregar]                                             │
│   Contacto nombre: [Ramón]                                               │
│                                                                          │
│ ▶ Asunto                                                                 │
│   [NUEVA ALTA - {patente}]                                               │
│   Placeholders disponibles: {numero_poliza}, {patente}, ...              │
│                                                                          │
│ ▶ Body                                                                   │
│   ┌────────────────────────────────────────────────────────────────────┐ │
│   │ Buenas {contacto_nombre}, solicito el alta...                      │ │
│   │ ...                                                                │ │
│   └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ▶ Asegurado template                                                     │
│   [{patente}]                                                            │
│                                                                          │
│ ▶ Adjuntos requeridos                                                    │
│   [chip] foto_frente [chip] foto_lateral_der [chip] foto_lateral_izq     │
│   [chip] foto_trasera [chip] cedula_frente [+ agregar]                   │
│                                                                          │
│ [Probar con ejemplo]            [Cancelar] [Guardar]                     │
└──────────────────────────────────────────────────────────────────────────┘
```

Click "Probar con ejemplo" → genera preview del email con datos dummy en modal.

---

## Componentes a reutilizar del módulo Proveedores existente

- `PersonaPicker` (selector con búsqueda)
- `ArchivoUploader` (componente de subida con categoría)
- `EstadoBadge` (badges de estado)
- Tablas con paginado y filtros
- Modal genérico
- Toast notifications

## Componentes nuevos

- `PolizaCard` (card del listado)
- `EmailPreview` (preview con sintaxis tipo email client)
- `EmailTemplateEditor` (editor con placeholders)
- `AdjuntosCheck` (panel de validación de adjuntos)
- `DiscrepanciasReport` (3 sub-tabs)
