SPEC VINCULACIONES Y METADATOS COMERCIALES

Vinculacion obligatoria al crear factura
Toda factura debe quedar vinculada a:
- cliente_id
- sucursal_id
- anio_facturado
- mes_facturado
- periodo_facturado

Reglas de vinculacion
1. cliente_id debe seleccionarse desde lista actual de clientes del ERP.
2. sucursal_id debe pertenecer al cliente_id seleccionado.
3. si el cliente tiene una sola sucursal, asignarla automaticamente.
4. no permitir texto libre para cliente salvo admin.
5. no permitir emitir si la vinculacion comercial esta incompleta.

Impacto de esta vinculacion
- organiza la cartera de facturas por cliente
- habilita la vista consolidada por cliente/sucursal/periodo
- evita facturas huerfanas
- permite control de cobro futuro

Metadatos comerciales
- anio_facturado
- mes_facturado
- periodo_facturado
- fecha_aprox_cobro
- fecha_pago_manual
- observaciones_cobranza

Reglas de edicion
- BORRADOR: todo editable
- AUTORIZADA: no editable fiscalmente
- AUTORIZADA: editable solo cobranza y observaciones
