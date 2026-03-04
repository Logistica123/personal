# Módulo de Liquidaciones – Propuesta de Infraestructura

Documento de trabajo - 02/03/2026

## Resumen ejecutivo
Esta propuesta define la infraestructura funcional y operativa del módulo de liquidaciones en la plataforma (backoffice), con foco en:

1. Cargar y versionar la liquidación original enviada por cada cliente con condiciones especiales.
2. Normalizar y validar automáticamente contra reglas por cliente y controles generales.
3. Publicar al ERP únicamente lo validado para generar la liquidación final del distribuidor y la liquidación propia para facturar.

## Objetivos
- Incorporar liquidaciones originales de clientes (p. ej., Excel) con trazabilidad completa (archivo fuente + versionado).
- Estandarizar formatos heterogéneos mediante una capa de normalización (staging).
- Detectar errores antes de liquidar: tarifas, piezas, adicionales, totales, períodos, duplicados y reglas específicas por cliente.
- Brindar un tablero de control para Administración con métricas y drill-down a nivel de línea.
- Publicar al ERP únicamente registros validados y generar las salidas operativas: liquidación del distribuidor y liquidación propia.
- Dejar auditoría completa de: cargas, validaciones, resoluciones, aprobaciones y publicación.

## Alcance funcional
### Incluye
- Carga manual de archivos y/o ingestión desde repositorio.
- Versionado por cliente y período (correcciones / reemisiones).
- Normalización a un modelo interno uniforme (staging).
- Motor de validaciones: reglas generales + reglas por cliente + tolerancias.
- Gestión de incidencias (errores críticos vs alertas), observaciones automáticas y resolución manual.
- Publicación controlada al ERP (solo validado).
- Generación de liquidación del distribuidor (detalle y neto) y liquidación propia para facturar.
- Reportes operativos y KPIs de performance.

### Fuera de alcance (por ahora)
- Automatización completa de conciliación bancaria y pagos (se recomienda integrarlo como etapa posterior).
- IA para lectura automática de documentos no estructurados (PDF escaneados, imágenes).
- Gestión de cobranzas y mora del cliente (facturación y pagos se modelan, pero se implementan en fases posteriores).

## Flujo operativo end-to-end
### A. Ingesta y versionado de liquidación original
1. Administración carga el archivo original (p. ej., Excel) indicando cliente y período (quincena/mes).
2. El sistema valida existencia previa para el mismo cliente-período y crea una nueva versión si corresponde.
3. Se almacena el archivo fuente, metadatos y huella (hash) para trazabilidad.

### B. Normalización (staging)
4. Un proceso de importación transforma el layout del cliente al modelo interno estándar.
5. Se preserva referencia a la fila/hoja/columna de origen para auditoría y drill-down.
6. Se genera un dataset de staging listo para validar y comparar.

### C. Validación automática
Validaciones mínimas recomendadas:
- Tarifas: precio unitario, adicionales, descuentos y topes según reglas del cliente.
- Piezas y volumetría: conteos, unidades, valores no nulos, consistencia entre columnas.
- Totales: sumatorias por guía/ruta/distribuidor/período y consistencia del total general.
- Períodos: fechas y cortes (quincena/mes) consistentes con el período cargado.
- Duplicados: guías/IDs repetidos dentro de la versión y contra versiones anteriores.
- Reglas de cliente: redondeos, mínimos, zonas, conceptos especiales, tolerancias de diferencia.

Salida del proceso de validación:
- `OK` (publicable).
- `Errores críticos` (bloquean publicación).
- `Alertas/diferencias` (requieren revisión o aprobación con tolerancia).
- Observaciones automáticas para facilitar la resolución (qué difiere, cuánto y posible causa).

### D. Revisión en tablero y resolución
7. Administración revisa el resumen (`OK` / críticos / alertas).
8. Se navega al detalle por línea con contexto del origen (archivo y campos).
9. Se registran resoluciones: corregir regla, marcar excepción, generar reclamo o solicitar reemisión al cliente.
10. Se re-ejecuta validación hasta dejar la versión sin errores críticos.

### E. Publicación al ERP y generación de salidas
11. Con la versión validada, un usuario autorizado ejecuta `Publicar al ERP`.
12. Se crea un registro de publicación (quién, cuándo, qué versión, hash del archivo).
13. Se generan:
- Liquidación final del distribuidor.
- Liquidación propia para facturar.

## Infraestructura en la página (Backoffice)
### 1) Carga de Liquidación Original
- Subida de archivo + selección de Cliente y Período.
- Detección de duplicado (mismo cliente-período) y creación de nueva versión.
- Estado inicial: `Cargada`.

### 2) Validación / Control
- Resumen de resultados: Correctos, Errores críticos, Alertas/Diferencias.
- Listado de incidencias con severidad, regla que falló y sugerencia/observación automática.
- Acciones: marcar resuelto (con comentario), re-procesar, generar reclamo, exportar diferencias.

### 3) Reglas por Cliente
Configuraciones mínimas recomendadas:
- Tarifario: valores por servicio/zona/peso/volumen y vigencias.
- Adicionales: combustible, reintentos, devolución, peajes/viáticos (si aplica).
- Reglas de cálculo: redondeo, mínimos, topes, combinaciones fijo + variable.
- Tolerancias: diferencias aceptables por ítem y por total (umbral).
- Reglas de bloqueo: condiciones que siempre generan error crítico (p. ej., duplicado de guía).

### 4) Publicación / Cierre
- Botón `Publicar al ERP` habilitado solo sin errores críticos.
- Aprobación en dos pasos (opcional): Valida (Administración) y Publica (Contabilidad).
- Auditoría obligatoria: quién validó, quién publicó, cuándo y motivo de excepciones.

### 5) Liquidación del Distribuidor
- Vista por distribuidor con detalle de ítems y neto final.
- Descarga/impresión de comprobante y disponibilidad para el portal del distribuidor.
- Estados: `Generada` -> `Aprobada` -> `Pagada` (o Integrada a Pagos).

## Entidades y datos mínimos (modelo sugerido)

| Entidad | Propósito | Campos clave (ejemplos) |
| --- | --- | --- |
| Cliente | Identificación del cliente y sus condiciones | id, razón social, CUIT, reglas asociadas |
| Período | Corte de liquidación | tipo (quincena/mes), fecha desde/hasta |
| LiquidaciónOriginal (cabecera) | Agrupa la carga por cliente-período y versión | cliente, período, versión, estado, archivo, hash |
| LiquidaciónOriginalLinea (staging) | Detalle normalizado a modelo interno | id origen, guía, servicio, zona, piezas, importes |
| ReglaCliente | Parametrización por cliente | tarifario, adicionales, tolerancias, bloqueos, vigencias |
| ResultadoValidación | Resultados por línea y cabecera | severidad, regla, campo, diferencia, estado |
| Observación/Resolución | Gestión de incidencias | comentario, usuario, fecha, motivo, adjuntos |
| PublicaciónERP | Trazabilidad de publicación | usuario, timestamp, versión, totales, hash |
| LiquidaciónDistribuidor | Salida final al distribuidor | distribuidor, período, total, estado |
| LiquidaciónPropia | Salida para facturar | cliente, período, total, estado |

## KPIs recomendados (instrumentación desde el día 1)
- Porcentaje de filas procesadas automáticamente (objetivo > 90%).
- Errores detectados antes de liquidar (objetivo 100%).
- Tiempo total de procesamiento por liquidación (objetivo: minutos).
- Coincidencia con prefacturas/políticas (objetivo > 98%).
- Liquidaciones rechazadas por el cliente (objetivo < 1%).
- Top 10 reglas que más fallan (para priorizar mejoras).

## Backlog sugerido (MVP + evolutivo)
### MVP (Fase 1)
1. Carga de archivo + versionado + almacenamiento con metadatos y hash.
2. Normalización a staging (mapeos por cliente) + trazabilidad a origen.
3. Motor de validaciones base (tarifas, piezas, totales, período, duplicados).
4. Tablero de validación con estados (`OK`/crítico/alerta) y drill-down por línea.
5. Registro de resoluciones y re-proceso de validación.
6. Publicación al ERP (solo validado) + registro de auditoría.
7. Generación de liquidación del distribuidor y liquidación propia (cabecera + detalle).
8. Exportables (`CSV/PDF`) para control interno.

### Evolutivo (Fase 2+)
- Configurador avanzado de reglas por cliente (UI no técnica) y vigencias.
- Comparador contra históricos y detección de outliers (tarifas atípicas).
- Integración con pagos y conciliación bancaria (lotes, estados, comprobantes).
- Portal del distribuidor: consulta, descarga, notificaciones, reclamos.
- Automatización de reclamos al cliente y reemisiones con trazabilidad.
- API de importación para clientes (evitar Excel).

## Supuestos y notas
- Formato de entrada predominante: Excel/CSV (otros formatos pueden incorporarse por etapas).
- Las condiciones especiales se representan como reglas parametrizables por cliente (tarifario, adicionales, tolerancias, bloqueos).
- La publicación al ERP requiere permisos y auditoría; se recomienda esquema de doble control (`valida/publica`) cuando aplique.
- Los estados del flujo deben quedar visibles y auditados (quién/cómo/cuándo).

## Próximos pasos
- Alinear formatos de entrada por cliente (mapeo inicial) y definir el criterio de período (quincena/mes).
- Definir set de reglas mínimas por cliente (tarifario, adicionales, tolerancias, bloqueos) y responsables de aprobación.
- Armar primer piloto con 1 cliente y 1 período, medir KPIs y ajustar el motor de validaciones antes de escalar.

Documento preparado para discusión y refinamiento del alcance.
