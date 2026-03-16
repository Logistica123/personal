SPEC MODULO CLIENTES DE FACTURACION

Objetivo
Dar una vista comercial y de cobranza de las facturas emitidas, agrupadas por cliente, sucursal y periodo, sin alterar la validez fiscal del comprobante.

Fuentes de verdad
- datos fiscales: factura_cabecera y sus detalles
- maestro cliente: tabla clientes del ERP
- maestro sucursal: tabla sucursales del ERP
- seguimiento de cobranza: factura_cabecera.fecha_aprox_cobro / fecha_pago_manual / historial_cobranza_factura

Reglas
- una factura debe pertenecer a un cliente existente
- una factura debe pertenecer a una sucursal existente del cliente
- la metadata comercial se define al crear la factura o antes de emitirla
- luego de autorizada, solo se puede editar cobranza y observaciones no fiscales

Acciones disponibles
- listar consolidado
- ver detalle del grupo
- editar cobranza de una factura
- exportar consolidado
- exportar detalle del grupo

KPI del consolidado
- total grupos
- total neto gravado
- total no gravado
- total iva
- total final
- total vencido
- total pendiente de cobro

KPI del detalle de grupo
- cantidad facturas
- total grupo
- total cobrado
- total pendiente
- primera fecha aprox cobro
- ultima fecha aprox cobro

Permisos
- operador_facturacion: lectura + alta de metadata comercial inicial
- cobranzas: lectura + fecha_pago_manual + observaciones_cobranza
- admin_facturacion: todo lo anterior + correccion de cliente/sucursal solo en BORRADOR

Exportables
- CSV / XLSX del consolidado
- CSV / XLSX del detalle de facturas del grupo
