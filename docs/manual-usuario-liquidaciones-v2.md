# Manual de Usuario — Liquidaciones v2

## Extractos (nuevo) y Clientes/Tarifas (nuevo)

---

## Introduccion

El sistema de Liquidaciones v2 te permite:

- **Configurar clientes y sus tarifas** para que el sistema sepa cuanto se le paga a cada distribuidor.
- **Cargar los extractos (archivos Excel)** que manda el cliente, y que el sistema cruce automaticamente cada operacion contra la tarifa correspondiente.
- **Generar las liquidaciones por distribuidor** con los montos a pagar y emitir los PDFs.

El modulo tiene **dos pantallas principales**:

| Pantalla | Donde esta | Para que sirve |
|---|---|---|
| **Clientes/Tarifas (nuevo)** | Menu: Liquidaciones/Pagos → Clientes/Tarifas | Configurar todo lo necesario ANTES de cargar extractos |
| **Extractos (nuevo)** | Menu: Liquidaciones/Pagos → Extractos | Cargar archivos, revisar operaciones y generar liquidaciones |

> **Regla de oro**: primero configura en Clientes/Tarifas, despues carga en Extractos.

---

# PARTE 1: Clientes/Tarifas (nuevo)

Esta pantalla se organiza en **5 pestanas**:

- Clientes
- Esquema Tarifario
- Mapeos
- Gastos
- Historial Tarifa

---

## 1. Pestana "Clientes"

Aca se habilitan y configuran los clientes que van a participar del modulo de liquidaciones.

### Como habilitar un cliente nuevo

1. Hacer click en **`+ Habilitar cliente`**.
2. En el buscador, escribir el nombre, codigo o CUIT del cliente.
3. Seleccionar el cliente del listado desplegable.
4. Hacer click en **`Habilitar`**.

El cliente queda habilitado y aparece en la grilla.

### Como editar la configuracion de un cliente

1. En la grilla de clientes, hacer click en **`Editar`** sobre el cliente que se quiere configurar.
2. Completar los campos:

| Campo | Que es | Ejemplo |
|---|---|---|
| **Nombre corto** | Nombre que se muestra en pantallas y PDFs | `OCA` |
| **CUIT** | CUIT del cliente | `30-12345678-9` |
| **Tolerancia diferencia (%)** | Porcentaje maximo de diferencia aceptable entre el valor del cliente y la tarifa. Si la diferencia es menor a este %, la operacion se marca como "OK". Si es mayor, se marca como "Diferencia". | `2` |
| **Hoja Excel (nombre)** | Nombre de la hoja dentro del archivo Excel que el sistema debe leer | `Detalle` |
| **Fila de datos** | Numero de fila donde estan los encabezados de columna | `1` |
| **Mapeo de columnas** | Configuracion avanzada en formato JSON para indicar que columna del Excel corresponde a cada dato (patente, concepto, valor, etc.). Solo usar si el auto-detectado no funciona. | `{"patente": "B", "valor": "F"}` |
| **Conceptos valor variable** | Lista de conceptos donde el "precio original" se toma del Excel en lugar de la tarifa (separados por coma) | `Valor Viaje, Flete especial` |
| **Tipos de archivo extra** | Tipos adicionales de archivo habilitados para subir (TARIFARIO, BASE_DISTRIB, VARIABLES) | Tildar los que correspondan |
| **Matching distribuidor** | Metodos para vincular patentes con distribuidores (patente, cuil, legajo, nombre_exacto, nombre_fuzzy) | Tildar los que correspondan |

3. Hacer click en **`Guardar`**.

> **Nota**: Si no se configura tolerancia, el sistema usa **2%** por defecto.

---

## 2. Pestana "Esquema Tarifario"

El esquema tarifario define **como se estructura la tarifa** del cliente. Es lo mas importante de configurar.

### Conceptos clave

- **Dimensiones**: Son las variables que determinan el precio. Por ejemplo, si el precio depende de la "sucursal" y del "concepto" (tipo de servicio), las dimensiones son `sucursal, concepto`.
- **Lineas de tarifa**: Son las combinaciones concretas de dimensiones con su precio. Por ejemplo: Sucursal=AMBA + Concepto=Corto AM → Precio $5.000.
- **% Agencia**: Es el porcentaje que se queda la agencia. El distribuidor cobra: `Precio × (1 - %Agencia/100)`.

### Como crear un esquema

1. En la seccion "Esquemas de {cliente}", completar:
   - **Nombre**: un nombre descriptivo (ej: `Tarifa 2026`)
   - **Descripcion** (opcional)
   - **Dimensiones**: separadas por coma (ej: `sucursal, concepto`)
2. Hacer click en **`Crear esquema`**.

> **Importante**: Un cliente trabaja con **1 esquema activo** a la vez. Al crear o activar un esquema, los demas se desactivan.

### Acciones sobre esquemas

| Accion | Que hace |
|---|---|
| **Activar** | Pone ese esquema como el activo (desactiva los demas) |
| **Desactivar** | El esquema queda historico, no se usa para cruces |
| **Eliminar** | Solo se puede si esta inactivo y no fue usado en operaciones |

### Como cargar lineas de tarifa manualmente

1. Seleccionar el esquema haciendo click en su nombre.
2. En la seccion "Nueva linea de tarifa", completar:
   - Valor para cada **dimension** (ej: Sucursal = `AMBA`, Concepto = `Ut. Corto AM`)
   - **Precio original** (ej: `5000`)
   - **% Agencia** (ej: `10`)
   - **Vigencia desde** (fecha)
   - **Vigencia hasta** (opcional)
   - **Motivo** (ej: `Carga inicial`)
3. Hacer click en **`Guardar linea`**.

La linea se crea como **pendiente de aprobacion**. No se va a usar para cruces hasta que sea aprobada.

### Como importar tarifas desde Excel

Si tenes un archivo Excel con muchas lineas de tarifa:

1. Seleccionar el esquema.
2. En la seccion "Importar tarifas desde Excel":
   - Elegir el **archivo .xlsx**
   - Completar **Vigencia desde** y opcionalmente **Vigencia hasta**
   - Completar **Motivo** (ej: `Importacion tarifa abril 2026`)
3. Hacer click en **`Importar`**.

El sistema lee el Excel, crea los valores de dimensiones y las lineas como **borrador** (pendientes de aprobacion).

### Como aprobar lineas de tarifa

Las lineas pendientes no se usan para calcular operaciones. Hay que aprobarlas:

- **Aprobar una linea**: Hacer click en **`Aprobar`** sobre la linea. El sistema pide un motivo.
- **Aprobar todas**: Hacer click en **`Aprobar todas`** para aprobar todas las pendientes del esquema de una vez. (Solo disponible para administradores.)

> **Regla**: Solo las lineas **ACTIVAS y APROBADAS** se usan para cruzar operaciones.

### Como desactivar una linea

Si una tarifa ya no aplica, hacer click en **`Desactivar`**. La linea queda en historial pero no se usa mas.

### Valores de dimensiones (catalogo)

En la seccion "Valores de dimensiones" se pueden agregar manualmente los valores posibles para cada dimension:

1. Seleccionar la **dimension** (ej: `sucursal`).
2. Escribir el **valor** (ej: `BAHIA BLANCA`).
3. Hacer click en **`+ Agregar`**.

Esto ayuda a estandarizar valores y evitar errores de tipeo.

### Tarifa por patente (override)

Cuando una patente especifica necesita una tarifa diferente a la general:

1. Completar la **Patente** (ej: `AE998QN`).
2. Seleccionar la **Linea destino** (una linea aprobada).
3. Completar las dimensiones de match.
4. Definir **vigencia**.
5. Hacer click en **`Guardar vinculacion`**.

Al procesar extractos, el sistema primero busca si hay tarifa por patente; si no la encuentra, usa la tarifa general.

---

## 3. Pestana "Mapeos"

Los mapeos sirven para **traducir** valores que vienen en el Excel del cliente a valores que el sistema entiende para cruzar con la tarifa.

### Mapeos de concepto

Cuando el Excel trae un nombre de concepto distinto al que tenes en tu tarifa:

1. Completar:
   - **Valor en Excel**: el texto tal cual viene en el Excel (ej: `Rango 0-100kms`)
   - **Dimension destino**: generalmente `concepto`
   - **Valor tarifa**: el valor que usa tu tarifa (ej: `Ut. Corto AM`)
2. Hacer click en **`Guardar mapeo`**.

**Ejemplo practico**:
- El Excel de OCA dice `Rango 0-100kms`
- Tu tarifa tiene el concepto `Ut. Corto AM`
- Creas un mapeo: `Rango 0-100kms` → `concepto` → `Ut. Corto AM`
- Ahora cuando subas el Excel, el sistema traduce automaticamente.

### Mapeos de sucursal

Sirven para que el sistema deduzca la sucursal a partir del **nombre del archivo** Excel:

1. Completar:
   - **Patron de archivo**: texto que tiene que estar contenido en el nombre del archivo (ej: `BAHIA BLANCA`)
   - **Sucursal tarifa**: el valor de sucursal para la tarifa (ej: `BAHIA BLANCA`)
2. Hacer click en **`Guardar mapeo`**.

**Ejemplo practico**:
- Subis un archivo que se llama `Extracto_BAHIA BLANCA_Abril2026.xlsx`
- El mapeo detecta `BAHIA BLANCA` en el nombre y asigna sucursal `BAHIA BLANCA` automaticamente.

Para desactivar un mapeo que ya no se usa, hacer click en **`Desactivar`**.

---

## 4. Pestana "Gastos"

Permite configurar gastos administrativos que se descuentan al generar las liquidaciones por distribuidor.

### Como agregar un gasto

1. Completar:
   - **Concepto** (ej: `Administracion`)
   - **Monto** (ej: `5000`)
   - **Tipo**: `Fijo` (monto fijo) o `Porcentual`
   - **Vigencia desde** y **Vigencia hasta** (opcional)
2. Hacer click en **`Guardar gasto`**.

Al generar liquidaciones por distribuidor, el sistema toma el primer gasto activo que coincida con el periodo y lo descuenta:

> `Total a pagar = Subtotal - Gastos`

---

## 5. Pestana "Historial Tarifa"

Muestra un registro de todos los cambios realizados en tarifas:
- Quien creo, aprobo o desactivo cada linea
- Fecha y hora
- Motivo del cambio
- Valores anteriores y nuevos

Es unicamente de consulta, no se realizan acciones aca.

---

# PARTE 2: Extractos (nuevo)

Una vez que Clientes/Tarifas esta configurado, se pasa a esta pantalla para cargar los archivos y generar liquidaciones.

---

## 1. Lista de liquidaciones

Al entrar se ve la lista de todas las liquidaciones creadas con las columnas:

| Columna | Que muestra |
|---|---|
| **ID** | Numero de liquidacion |
| **Cliente** | Nombre del cliente |
| **Periodo** | Rango de fechas |
| **Estado** | Pendiente, En proceso, Auditada, Aprobada o Rechazada |
| **Operaciones** | Cantidad total de operaciones |
| **Total cliente** | Suma de importes del cliente |
| **Diferencia** | Diferencia total detectada |

### Como crear una nueva liquidacion

1. Hacer click en **`+ Nueva liquidacion`**.
2. Seleccionar el **Cliente** del desplegable.
3. Elegir **Periodo desde** y **Periodo hasta** (las fechas del periodo que cubre esta liquidacion).
4. Hacer click en **`Crear`**.

La liquidacion se crea con estado **Pendiente**.

### Acciones sobre la lista

- **Ver detalle**: Abre el detalle completo de la liquidacion.
- **Eliminar**: Borra la liquidacion y todo su contenido (archivos, operaciones). Pide confirmacion.
- **Eliminar seleccionadas**: Tildar varias liquidaciones con el checkbox y eliminar en lote.

---

## 2. Detalle de una liquidacion

Al hacer click en "Ver detalle", se abre la vista completa con varias secciones.

### Estados y como cambiarlos

La liquidacion pasa por estos estados:

```
Pendiente → En proceso → Auditada → Aprobada
                ↓              ↓
            Rechazada ← ← ← ←
```

En la parte superior del detalle aparecen botones para cambiar el estado segun donde este:

| Estado actual | Acciones disponibles |
|---|---|
| **Pendiente** | → En proceso |
| **En proceso** | → Auditada, Rechazar |
| **Auditada** | → Aprobar, Rechazar, ← Volver a proceso |
| **Rechazada** | ← Reabrir (vuelve a En proceso) |

### Esquema activo

Se muestra cual es el esquema tarifario activo del cliente. Si necesitas cambiarlo, se puede seleccionar otro del desplegable. **Cuidado**: cambiar el esquema afecta a todas las futuras cargas y reprocesos de ese cliente.

### Tarjetas de resumen

Se muestran tarjetas con la cantidad de operaciones en cada estado:
- **OK**: Operaciones donde el valor del cliente coincide con la tarifa (dentro de la tolerancia).
- **Diferencia**: El valor del cliente no coincide con la tarifa (fuera de tolerancia).
- **Sin tarifa**: No se encontro una tarifa que coincida con la operacion.
- **Sin distribuidor**: No se encontro un distribuidor con esa patente.
- **Duplicado**: El Excel trajo la misma operacion repetida.
- **Excluida**: Operaciones que se excluyeron manualmente.

---

## 3. Cargar un archivo Excel

En la seccion de archivos:

1. Hacer click en **`Elegir archivo`** y seleccionar el Excel (.xlsx o .xls).
2. **Sucursal** (opcional): Si el archivo es de una sucursal especifica, seleccionarla aca. Si no, el sistema intenta deducirla del nombre del archivo usando los mapeos de sucursal.
3. **Tipo archivo** (opcional): Clasificacion del archivo (DATA_CLIENTE, DETALLE_SUCURSAL, etc.).
4. Hacer click en **`Subir y procesar`**.

El sistema:
- Lee el Excel (la hoja configurada en el cliente).
- Genera una operacion por cada fila relevante.
- Cruza cada operacion contra la tarifa activa.
- Clasifica cada operacion (OK, Diferencia, Sin tarifa, etc.).

> **Requisitos minimos del Excel**: Debe tener al menos columnas de **patente** (dominio/placa) y **valor** (importe/monto). Si el esquema usa la dimension "concepto", tambien necesita una columna de concepto.

### Archivos cargados

Por cada archivo que se subio se puede:

| Accion | Que hace |
|---|---|
| **Editar Sucursal** | Cambiar la sucursal asignada al archivo y hacer click en `Guardar` |
| **Reprocesar** | Borra y recalcula todas las operaciones de ese archivo usando la configuracion y tarifas actuales. Util despues de crear mapeos o aprobar tarifas. |
| **Eliminar** | Borra el archivo y todas sus operaciones |

---

## 4. Operaciones

La grilla de operaciones muestra todas las operaciones generadas. Se puede filtrar por estado usando el selector de filtro.

### Columnas de la grilla

| Columna | Que muestra |
|---|---|
| **Dominio** | Patente del vehiculo |
| **Distribuidor** | Nombre del distribuidor asignado |
| **Concepto** | Concepto de la operacion |
| **Sucursal** | Sucursal asignada |
| **Valor cliente** | El importe que declara el cliente en el Excel |
| **Tarifa original** | El precio segun la tarifa configurada |
| **Valor distribuidor** | Lo que le corresponde al distribuidor (tarifa - % agencia) |
| **Diferencia** | Diferencia entre valor cliente y tarifa |
| **Estado** | OK, Diferencia, Sin tarifa, Sin distribuidor, Duplicado, Excluida |

### Acciones por operacion

| Accion | Que hace |
|---|---|
| **Excluir** | Marca la operacion como excluida (no se incluye en la generacion de liquidaciones). Pide un motivo. |
| **Incluir** | Revierte una exclusion y recalcula el estado. |
| **Eliminar** | Borra la operacion definitivamente. |
| **+ Mapeo** | (solo para operaciones "Sin tarifa") Crea un mapeo de concepto rapido para traducir el concepto del Excel a un valor de tarifa. Despues hay que **Reprocesar** el archivo para que aplique. |

---

## 5. Auditoria

El boton **`Ver auditoria`** (arriba a la derecha) muestra un panel con informacion de control:

### Resumen ejecutivo
- Total de operaciones
- Importe total del cliente
- Importe total del distribuidor
- Margen de agencia
- Diferencia total

### Resumen por sucursal
Tabla con cantidad de operaciones, estados e importes agrupados por sucursal.

### Resumen por distribuidor
Tabla con cantidad de operaciones, estados e importes agrupados por distribuidor.

### Listados de problemas
- **Diferencias**: Operaciones donde el valor del cliente no coincide con la tarifa.
- **Sin tarifa (agrupado)**: Operaciones sin tarifa, agrupadas por concepto y dimension fallida.
- **Sin distribuidor (agrupado)**: Patentes que no se pudieron vincular a un distribuidor.
- **Duplicados**: Operaciones repetidas en el Excel.

---

## 6. Generar liquidaciones por distribuidor

Una vez que se revisaron las operaciones y la auditoria:

1. Hacer click en **`Generar liquidaciones`**.
2. Confirmar la accion.

El sistema:
- Toma solo operaciones con estado **OK** o **Diferencia** que no esten excluidas y tengan distribuidor.
- Agrupa por distribuidor.
- Calcula: `Subtotal` (suma de valores distribuidor) - `Gastos` (si hay gastos configurados) = `Total a pagar`.

### Acciones por cada distribuidor generado

| Accion | Que hace |
|---|---|
| **Generar PDF / Regenerar PDF** | Crea un documento PDF para usar en el flujo de subir liquidaciones del modulo viejo |
| **Ver PDF** | Abre el PDF generado |
| **Ir a proveedor** | Navega al distribuidor en el modulo de liquidaciones (vista proveedor) |

---

# PARTE 3: Guia rapida de resolucion de problemas

## Operaciones "Sin tarifa"

**Causas posibles**:
1. **Falta sucursal**: No se cargo al subir el archivo y no se pudo deducir del nombre.
   - **Solucion**: Editar la sucursal del archivo → Guardar → Reprocesar.
2. **Concepto no coincide**: El Excel usa un nombre diferente al de la tarifa.
   - **Solucion**: Crear un mapeo de concepto (desde la operacion con `+ Mapeo` o desde la pestana Mapeos) → Reprocesar.
3. **Linea de tarifa pendiente**: Existe la tarifa pero no esta aprobada.
   - **Solucion**: Ir a Clientes/Tarifas → Esquema Tarifario → Aprobar la linea → Reprocesar.
4. **Vigencia**: La tarifa existe pero su vigencia no cubre el periodo de la liquidacion.
   - **Solucion**: Crear o ajustar la linea de tarifa con la vigencia correcta → Reprocesar.

## Operaciones "Sin distribuidor"

**Causa**: No se encuentra un distribuidor/persona con esa patente en el sistema.

**Solucion**: Verificar que la patente este correctamente cargada en el maestro de Personas/Proveedores. Luego reprocesar el archivo.

## Operaciones "Duplicado"

**Causa**: El Excel trae la misma operacion (mismo id_viaje) mas de una vez.

**Solucion**: Depurar el archivo fuente o aceptar que quede marcado (los duplicados no se incluyen en la generacion).

## Operaciones "Diferencia"

**Causa**: La diferencia entre el valor del cliente y la tarifa supera el % de tolerancia configurado.

**Solucion**:
- Revisar si la tolerancia del cliente es correcta.
- Verificar si la tarifa esta actualizada.
- Usar la auditoria para ver los mayores desvios.

---

# PARTE 4: Checklist para configurar un cliente nuevo

Seguir estos pasos en orden:

1. Ir a **Clientes/Tarifas** → Pestana **Clientes** → **Habilitar** el cliente.
2. **Editar** el cliente: configurar nombre corto, tolerancia %, hoja Excel.
3. Ir a pestana **Esquema Tarifario** → **Crear esquema** con las dimensiones correctas (ej: `sucursal, concepto`).
4. Cargar **valores de dimensiones** (catalogo) para estandarizar.
5. Cargar **lineas de tarifa** (manualmente o importando desde Excel).
6. **Aprobar** las lineas de tarifa.
7. Ir a pestana **Mapeos** → Crear **mapeos de concepto** si el Excel usa nombres distintos a la tarifa.
8. Crear **mapeos de sucursal** si se quiere deduccion automatica desde el nombre de archivo.
9. Ir a pestana **Gastos** → Configurar **gastos administrativos** si aplica.
10. Recien ahora ir a **Extractos (nuevo)** → **Crear liquidacion** → **Subir Excel** → **Revisar** → **Generar liquidaciones por distribuidor**.

---

# PARTE 5: Preguntas frecuentes

**P: Puedo subir varios archivos Excel a la misma liquidacion?**
R: Si. Cada archivo se procesa por separado y las operaciones se suman.

**P: Que pasa si cambio un mapeo o una tarifa despues de haber subido archivos?**
R: Hay que **Reprocesar** los archivos afectados para que los cambios se apliquen.

**P: Puedo eliminar una liquidacion ya generada?**
R: Si, pero se elimina todo su contenido (archivos, operaciones, liquidaciones por distribuidor). La accion no se puede deshacer.

**P: Que sucede con las operaciones excluidas?**
R: No se incluyen en la generacion de liquidaciones por distribuidor. Se pueden volver a incluir en cualquier momento.

**P: Puedo regenerar el PDF de un distribuidor?**
R: Si, el boton "Regenerar PDF" recrea el documento con los datos actuales.

**P: Como se determina la vigencia de la tarifa?**
R: Se usa el **periodo desde** de la liquidacion (no la fecha de cada fila del Excel). La tarifa debe tener una vigencia que cubra esa fecha.
