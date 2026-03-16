SPEC FRONTEND - FACTURADOR Y CLIENTES DE FACTURACION

1. Objetivo visual
Integrar el modulo al ERP existente, replicando el patron visual general:
- sidebar izquierda
- titulo y subtitulo arriba
- fila de filtros horizontal
- tarjetas KPI debajo de filtros
- tabla principal en tarjeta blanca con bordes suaves
- acciones por fila al extremo derecho

2. Navegacion del menu
Agregar dentro del sidebar:
- Facturacion
  - Facturas
  - Nueva factura
  - Clientes facturacion
  - Configuracion ARCA

3. Pantallas
3.1 Facturas / Listado
Header:
- titulo: Gestionar facturas
- subtitulo: Facturacion electronica y seguimiento de cobranza

Filtros superiores:
- cliente
- sucursal
- tipo comprobante
- estado fiscal
- estado cobranza
- ano
- mes
- periodo
- rango fecha emision
- rango fecha aprox cobro
- texto libre (numero, CAE, CUIT, razon social)

Botones:
- Buscar
- Limpiar
- Exportar Excel
- Nueva factura

Tarjetas KPI:
- Total facturas del filtro
- Total facturado
- Total cobrado
- Facturas vencidas
- Facturas por cobrar

Tabla:
Columnas minimas:
- numero
- tipo
- cliente
- sucursal
- ano
- mes
- periodo
- fecha_emision
- fecha_vto_pago
- fecha_aprox_cobro
- fecha_pago_manual
- neto_gravado
- no_gravado
- iva
- total
- estado fiscal
- estado cobranza
- CAE
- acciones

Acciones por fila:
- ver detalle
- descargar PDF
- ver XML
- editar cobranza
- reimprimir PDF

3.2 Nueva factura
Composicion en bloques:
1. Datos ARCA
2. Receptor
3. Vinculacion comercial
4. Detalle PDF
5. Totales
6. Acciones

3.2.1 Datos ARCA
- emisor
- ambiente
- pto_vta (default 00011)
- tipo comprobante
- concepto
- fecha comprobante
- fecha_serv_desde
- fecha_serv_hasta
- fecha_vto_pago
- moneda
- cotizacion

3.2.2 Receptor
- doc_tipo
- doc_nro
- razon_social
- domicilio
- condicion IVA receptor (opcional informativo interno)

3.2.3 Vinculacion comercial
- cliente_id (autocomplete obligatorio)
- sucursal_id (dependiente del cliente, obligatorio)
- anio_facturado (obligatorio)
- mes_facturado (obligatorio)
- periodo_facturado (obligatorio)
- fecha_aprox_cobro
- observaciones_cobranza

3.2.4 Detalle PDF
Grilla editable con filas:
- descripcion
- cantidad
- unidad
- precio_unitario
- bonificacion_pct
- subtotal
- alicuota_iva
- subtotal_con_iva

Botones:
- agregar renglon
- eliminar renglon

3.2.5 Totales
Mostrar y recalcular:
- importe no gravado
- neto gravado
- exento
- tributos
- IVA
- total

3.2.6 Acciones
- Guardar borrador
- Validar
- Emitir en ARCA
- Cancelar

3.3 Detalle factura
Secciones:
- resumen de cabecera
- cliente y sucursal
- importes
- CAE y vencimiento
- detalle PDF
- timeline de estados
- timeline de cobranza
- descargas tecnicas

3.4 Configuracion ARCA
Pestanas:
- Emisor
- Certificados
- Puntos de venta
- Pruebas tecnicas

Emisor
- razon social
- cuit
- condicion IVA
- ambiente default

Certificados
- alias
- ambiente
- vigencia desde / hasta
- thumbprint
- activo
- boton importar CRT/KEY
- boton importar P12
- boton test WSAA

Puntos de venta
- tabla con nro, sistema, bloqueado, fecha_baja, habilitado_para_erp
- resaltar 00011
- boton sincronizar desde ARCA

Pruebas tecnicas
- test WSAA
- test FEParamGetPtosVenta
- test FECompUltimoAutorizado

3.5 Clientes de Facturacion / Consolidado
Filtros:
- cliente
- sucursal
- ano
- mes
- periodo
- estado cobranza

Tarjetas:
- grupos visibles
- total neto gravado
- total IVA
- total final
- total vencido

Tabla consolidada:
- cliente
- sucursal
- ano
- mes
- periodo
- cantidad_facturas
- total_neto
- total_no_gravado
- total_iva
- total_final
- facturas_cobradas
- facturas_vencidas
- facturas_pendientes
- primera_fecha_aprox_cobro
- ultima_fecha_aprox_cobro
- ultima_fecha_pago
- acciones

Accion:
- Ver detalle

3.6 Clientes de Facturacion / Detalle grupo
Tabla de facturas del grupo:
- numero
- tipo
- fecha_emision
- neto
- no_gravado
- iva
- total
- CAE
- fecha_vto_pago
- fecha_aprox_cobro
- fecha_pago_manual
- estado fiscal
- estado cobranza
- acciones

4. Comportamientos UX
- si cliente tiene una sola sucursal, autoseleccionar
- si concepto exige fechas de servicio, mostrar inputs obligatorios
- impedir Emitir si el formulario no esta validado
- mostrar resumen de errores local antes de llamar a ARCA
- durante emision, bloquear doble click y mostrar loading persistente
- al autorizar, redirigir al detalle y mostrar CAE destacado

5. Componentes sugeridos
- PageHeader
- FilterBar
- KpiCard
- DataTable
- FacturaForm
- TotalesPanel
- CertificadoUploadCard
- PuntoVentaTable
- CobranzaEditorModal
- TimelineEstados
- TimelineCobranza

6. Colores y estilo
Mantener estilo sobrio del ERP actual.
No inventar UI oscura ni layout full-screen separado.
Inputs y tablas compactos, tipografia legible, acentos de color discretos.

7. Responsive
Prioridad desktop.
En resoluciones medianas:
- filtros pueden wrappear en dos filas
- tabla con scroll horizontal

8. Criterios de aceptacion frontend
- listado con filtros funcionando
- formulario de nueva factura con validaciones visibles
- emision con spinner y bloqueo de reenvio
- detalle con PDF y XML descargables
- modulo Clientes de Facturacion consolidando por cliente/sucursal/periodo
- carga y edicion de cobranza desde UI
