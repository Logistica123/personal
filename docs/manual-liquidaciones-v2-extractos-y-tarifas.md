# Manual — Liquidaciones v2 (Extractos + Clientes/Tarifas)

Actualizado: 2026-04-07  
Menú: **Liquidaciones/Pagos → Extractos (nuevo)** y **Liquidaciones/Pagos → Clientes/Tarifas (nuevo)**  
Rutas: `/liquidaciones/extractos` y `/liquidaciones/cliente`  
API: `/api/liq/*`

---

## 1) Qué resuelve este módulo

Este módulo (Liquidaciones v2) sirve para:

- **Configurar** clientes, esquemas tarifarios, mapeos y gastos administrativos.
- **Cargar extractos** en Excel, transformarlos en operaciones y **validarlos** (OK / Diferencia / Sin tarifa / etc.).
- **Generar liquidaciones por distribuidor** (con subtotal, gastos y total a pagar) y **emitir PDF** para el módulo “viejo” de documentos.

---

## 2) Roles y permisos (práctico)

En v2 hay acciones que suelen estar restringidas a `admin` / `admin2`:

- Eliminar liquidaciones/archivos/operaciones (acciones destructivas).
- Importar tarifas desde Excel.
- Aprobar líneas en lote.
- Crear / desactivar tarifas por patente.
- Generar PDF de liquidación.

Acciones operativas comunes (crear liquidación, subir archivo, reprocesar, mapear conceptos, excluir/incluir operaciones) suelen estar disponibles con permisos estándar, pero puede variar según tu seteo de usuarios.

---

## 3) Clientes/Tarifas (nuevo) — `/liquidaciones/cliente`

Pantalla orientada a **configurar el cliente** y su **tarifa** (esquema + líneas) y **mapeos** para que luego “Extractos (nuevo)” pueda cruzar correctamente.

La pantalla está organizada en pestañas:

- **Clientes**
- **Esquema Tarifario**
- **Mapeos**
- **Gastos**
- **Historial Tarifa**

### 3.1) Pestaña “Clientes”

#### A) Habilitar un cliente
1. Click en **`+ Habilitar cliente`**.
2. Buscá el cliente base (por nombre/código/CUIT) y seleccioná uno del combo.
3. Click **`Habilitar`**.

Esto crea (o reactiva) el cliente dentro de liquidaciones v2 (tabla `liq_clientes`) vinculado al cliente base.

#### B) Editar configuración del cliente
En la grilla de clientes habilitados:
1. Click **`Editar`** sobre el cliente.
2. Ajustá:
   - **Nombre corto** (se usa en pantallas y PDFs).
   - **CUIT**.
   - **Tolerancia diferencia (%)**: umbral para decidir si una operación queda como `OK` o `Diferencia`.
   - **Hoja Excel (nombre)**: hoja que se leerá al procesar Excel (por defecto suele ser `Detalle`).
3. Click **`Guardar`**.

Notas:
- La tolerancia por defecto, si no está configurada, se considera **2%**.
- La “Hoja Excel” debe coincidir con el nombre real de la hoja del archivo.

---

### 3.2) Pestaña “Esquema Tarifario”

Un **esquema** define:
- Las **dimensiones** que se usan para encontrar la tarifa (por ejemplo: `sucursal`, `concepto`).
- Los **valores posibles** por dimensión (catálogo).
- Las **líneas de tarifa** (combinación de dimensiones + precio + % agencia + vigencia).

#### A) Crear un esquema
1. En “Esquemas de {cliente}”, completar:
   - **Nombre**.
   - **Descripción (opcional)**.
   - **Dimensiones** separadas por coma (ej: `sucursal, concepto`).
2. Click **`Crear esquema`**.

Regla importante:
- Cuando se crea un esquema, queda **activo** y puede desactivar otros esquemas activos del cliente (un cliente trabaja con 1 esquema activo a la vez).

#### B) Activar/Desactivar/Eliminar esquema
- **Activar**: deja ese esquema como activo para el cliente (desactiva el resto).
- **Desactivar**: el esquema queda histórico, pero ya no se usa para cruces.
- **Eliminar**: solo si **está inactivo** y **no fue usado** en operaciones históricas.

#### C) Importar tarifas desde Excel
1. Seleccioná **archivo Excel** (`.xlsx`).
2. Definí **vigencia desde** y opcional **vigencia hasta**.
3. Cargá **motivo**.
4. Click **`Importar`**.

Qué hace la importación:
- Crea/actualiza el **catálogo de dimensiones** y crea **líneas de tarifa** como **borrador** (pendientes de aprobación).
- Las filas incompletas o sin precio se omiten.

#### D) Valores de dimensiones
En “Valores de dimensiones”:
- Para cada dimensión (ej: `sucursal`, `concepto`) podés agregar valores con **`+ Agregar`**.

Esto ayuda a:
- Estandarizar valores (evitar typos).
- Mejorar el “match” al procesar extractos.

#### E) Líneas de tarifa (alta y aprobación)
Una **línea** se define por:
- Dimensiones (ej: `sucursal=AMBA`, `concepto=Ut. Corto AM`).
- **Precio original**.
- **% Agencia**.
- **Precio distribuidor** (se calcula automáticamente como: `precio_original * (1 - %agencia/100)`).
- **Vigencia** (desde/hasta).
- **Motivo** (audit trail).

Acciones:
- **Guardar línea**: crea la línea como **pendiente de aprobación**.
- **Aprobar**: solicita un motivo.
  - Regla: si NO sos Admin/Admin2, la aprobación puede requerir un **segundo usuario** (no aprueba el mismo que creó la línea).
- **Aprobar todas**: (solo Admin/Admin2) aprueba todas las pendientes del esquema.
- **Desactivar**: deja la línea inactiva (queda en historial).

Regla clave para “Extractos (nuevo)”:
- **Solo las líneas ACTIVAS y APROBADAS** se usan para calcular operaciones.

#### F) Tarifa por patente (override)
Sirve para casos donde la tarifa depende de la **patente** (dominio) además de las dimensiones.

Cómo se configura:
1. Completar **Patente** (ej: `AE998QN`).
2. Elegir una **Línea destino (aprobada)**.
3. Completar dimensiones “match” (se puede autocompletar desde la línea).
4. Definir **vigencia**.
5. Click **`Guardar vinculación`**.

Cómo se aplica:
- Al procesar extractos, primero intenta **patente + dimensiones** y, si no matchea, usa la tarifa general.

---

### 3.3) Pestaña “Mapeos”

Los mapeos sirven para “traducir” datos del Excel a valores consistentes que permitan matchear tarifa y sucursal.

#### A) Mapeos de concepto
Uso típico: cuando el Excel trae un “concepto” distinto al concepto que tenés en tu tarifa.

Campos del mapeo:
- **Valor en Excel** (texto tal como viene).
- **Dimensión destino** (ej: `concepto`).
- **Valor tarifa** (valor esperado por la tarifa).

Ejemplo:
- Excel: `Rango 0-100kms`
- Dimensión destino: `concepto`
- Valor tarifa: `Ut. Corto AM`

#### B) Mapeos de sucursal
Se usa para deducir **sucursal** a partir del **nombre del archivo** (cuando no se carga manualmente).

Campos:
- **Patrón de archivo**: texto que debe estar contenido en el nombre del archivo (sin extensión).
- **Sucursal tarifa**: el valor de sucursal a usar.
- **Tipo operación**: opcional (hoy se guarda, pero el procesamiento estándar no lo usa para resolver sucursal).

Ejemplo:
- Patrón: `BAHIA BLANCA`
- Sucursal tarifa: `BAHIA BLANCA`

---

### 3.4) Pestaña “Gastos”

Permite configurar “gastos administrativos” por cliente.

Campos:
- **Concepto**
- **Monto**
- **Tipo**: `Fijo` o `Porcentual`
- **Vigencia** (desde/hasta)

Cómo impacta en la generación:
- Al generar liquidaciones por distribuidor, se toma **el primer gasto activo** que **solape el período**.
- Actualmente el cálculo usa el **monto como descuento fijo por distribuidor**:
  - `total_a_pagar = subtotal - gastos`

---

### 3.5) Pestaña “Historial Tarifa”

Muestra auditoría de cambios de tarifa:
- Creaciones, aprobaciones, desactivaciones, etc.
- Usuario y motivo.

---

## 4) Extractos (nuevo) — `/liquidaciones/extractos`

Pantalla orientada a:
- crear una **liquidación de cliente** (cabecera),
- subir archivos Excel,
- revisar operaciones y auditoría,
- generar liquidaciones por distribuidor y PDF.

### 4.1) Lista “Todas las liquidaciones”

Acciones:
- **`+ Nueva liquidación`**: seleccionás cliente y período (desde/hasta).
- **Ver detalle**: abre el detalle de la liquidación.
- **Eliminar** / **Eliminar seleccionadas**: elimina cabecera + archivos + operaciones (acción destructiva).

Columnas relevantes:
- Estado (`Pendiente`, `En proceso`, `Auditada`, `Aprobada`, `Rechazada`)
- Total operaciones
- Total cliente
- Diferencia total

### 4.2) Detalle de una liquidación

#### A) Estados y transiciones
Transiciones permitidas (simplificado):
- `Pendiente` → `En proceso`
- `En proceso` → `Auditada` / `Rechazada`
- `Auditada` → `Aprobada` / `Rechazada` / `En proceso`
- `Rechazada` → `En proceso`

Además:
- Al **generar liquidaciones por distribuidor**, el estado de la cabecera suele quedar como `Auditada`.

#### B) “Esquema activo”
En el detalle se muestra el esquema activo del cliente y podés **cambiarlo** (activar otro).

Importante:
- Cambiar el esquema activo impacta el cruce para futuras cargas y reprocesos (es global al cliente).

#### C) Resumen por estados (tarjetas)
Se muestran conteos por estado de operación (OK, Diferencia, Sin tarifa, etc.) para ubicar rápidamente problemas.

#### D) Auditoría (botón “Ver auditoría”)
Muestra:
- Resumen ejecutivo (importes totales, margen, diferencia total).
- Resumen por sucursal.
- Resumen por distribuidor.
- Listados de:
  - Diferencias
  - Sin tarifa (agrupado)
  - Sin distribuidor (agrupado)
  - Duplicados

---

### 4.3) Cargar archivo Excel

Botón: **`Subir y procesar`**

Campos:
- **Archivo**: `.xlsx` / `.xls`
- **Sucursal (opcional)**: si la completás, se usa para las dimensiones tipo `sucursal` (y se guarda en el archivo).
- **Tipo archivo (opcional)**: ayuda a clasificar el archivo (por defecto: `DATA_CLIENTE` / `DETALLE_SUCURSAL`; algunos clientes pueden habilitar más tipos).

Qué valida el procesador:
- Necesita columnas mínimas:
  - `patente` (o equivalente en el header: dominio/placa/etc.)
  - `valor` (o equivalente: importe/monto/precio/etc.)
  - `concepto` si tu esquema requiere `concepto` (o si existe esa columna en el archivo)
- Usa por defecto la hoja `Detalle` (o la configurada en el cliente).
- Omite filas vacías y filas “TOTAL”.
- Para elegir la tarifa por **vigencia**, se toma como referencia el **`período desde`** de la liquidación (no la fecha de cada fila del Excel).

Cómo se decide “Sucursal tarifa”:
1. Si cargaste **Sucursal** al subir el archivo, se usa esa.
2. Si no, intenta deducirla desde el **nombre del archivo** usando “Mapeos de sucursal”.
3. Si igual no hay sucursal y la dimensión lo requiere, las operaciones pueden quedar `Sin tarifa (sucursal)`.

---

### 4.4) Archivos cargados

Por cada archivo podés:
- Ver nombre, tipo y cantidad de registros/operaciones.
- **Editar Sucursal** y click **`Guardar`**.
- **Reprocesar**: borra y recalcula las operaciones de ese archivo con la configuración/mapeos/tarifas actuales.
- **Eliminar**: borra archivo y sus operaciones (y también invalida liquidaciones por distribuidor ya generadas).

---

### 4.5) Operaciones

Grilla con filtro por **Estado**.

Columnas típicas:
- Dominio (patente)
- Distribuidor
- Concepto
- Sucursal
- Valor cliente
- Tarifa original
- Valor distribuidor
- Diferencia
- Estado (con tooltip de observaciones)

Acciones por operación:
- **Excluir**: marca la operación como excluida (no entra en generación de liquidaciones).
- **Incluir**: revierte una exclusión y recalcula el estado según la data disponible.
- **Eliminar**: borra la operación (acción destructiva).

Acción rápida para “Sin tarifa”:
- Botón **`+ Mapeo`**: crea un mapeo de concepto (ej: traducir el concepto del Excel a un valor válido de tarifa).
- Luego hay que **Reprocesar** el archivo para que el mapeo se aplique.

---

### 4.6) Liquidaciones por distribuidor

Botón: **`Generar liquidaciones`**

Qué incluye:
- Solo operaciones con estado `ok` o `diferencia`,
- que no estén excluidas,
- y que tengan distribuidor asignado.

Qué calcula:
- `subtotal`: suma de “valor distribuidor” de esas operaciones.
- `gastos`: descuento administrativo vigente (si existe).
- `total a pagar`: `subtotal - gastos`.

Por cada distribuidor:
- **Generar PDF / Regenerar PDF**: crea un documento PDF para poder usar el flujo de “Subir liquidaciones” del módulo viejo.
- **Ver PDF**: abre el PDF generado.
- **Ir a proveedor**: navega al distribuidor en el módulo de liquidaciones (vista proveedor).

---

## 5) Cómo resolver problemas comunes (rápido)

### A) Operaciones “Sin tarifa”
Causas típicas:
- Falta sucursal (no se cargó y no se pudo deducir del nombre del archivo).
- El “concepto” del Excel no coincide con el valor usado en tarifa.
- La línea existe pero está **pendiente de aprobación** (no se usa para cruces).
- El caso “Valor Viaje” necesita una línea aprobada para aplicar el % agencia.

Acciones:
- Cargar/guardar sucursal en el archivo + reprocesar.
- Crear mapeo de concepto (`+ Mapeo`) + reprocesar.
- Aprobar la línea de tarifa pendiente (y reprocesar si hace falta).

### B) “Sin distribuidor”
Causa:
- No se encuentra una Persona con esa patente (se normaliza sacando espacios/guiones).

Acciones:
- Corregir patente en el maestro de Personas / Proveedores.
- Reprocesar el archivo.

### C) “Duplicado”
Causa:
- El Excel trae la misma columna `id_viaje` repetida.

Acciones:
- Depurar archivo fuente o aceptar que quede marcado como duplicado (no se toma para generación).

### D) “Diferencia”
Causa:
- `abs(valor_cliente - tarifa_original)` supera el **% tolerancia** configurado en el cliente.

Acciones:
- Revisar tolerancia del cliente.
- Corregir tarifa o valor del Excel según corresponda.
- Usar auditoría para ver los mayores desvíos.

---

## 6) Checklist recomendado (cliente nuevo)

1. **Habilitar cliente** en Clientes/Tarifas.
2. Configurar **Hoja Excel** y **Tolerancia %**.
3. Crear o importar **Esquema tarifario** (dimensiones correctas).
4. Cargar **valores de dimensiones** (catálogo) para evitar errores.
5. Cargar **líneas de tarifa** y **aprobarlas**.
6. Configurar **mapeos de concepto** (si el Excel no coincide con tu tarifa).
7. Configurar **mapeos de sucursal** (para deducción automática desde nombre de archivo).
8. Configurar **gastos** (si aplica).
9. Recién ahí: ir a **Extractos (nuevo)**, crear liquidación, subir Excel, auditar y generar liquidaciones por distribuidor.
