Casos de QA - Facturacion ARCA

Objetivo: validar end-to-end la facturacion y la cobranza con datos reales o controlados.

1. Crear borrador valido
   - Crear factura con cliente y sucursal existentes.
   - Verificar estado BORRADOR y hash de idempotencia generado.

2. Rechazar borrador sin cliente
   - Enviar payload sin cliente_id.
   - Debe responder 422 con error en cliente_id.

3. Rechazar borrador sin sucursal
   - Enviar payload sin sucursal_id.
   - Debe responder 422 con error en sucursal_id.

4. Rechazar borrador sin periodo comercial
   - Enviar payload sin anio_facturado, mes_facturado o periodo_facturado.
   - Debe responder 422 con errores en esos campos.

5. Validar concepto servicios sin fechas
   - Crear borrador con concepto=2 o 3 y sin fechas de servicio.
   - Al validar, debe responder 422 con errores de fechas.

6. Emision exitosa con CAE
   - Emitir factura con certificado activo y punto de venta habilitado.
   - Verificar CAE, vencimiento y estado PDF_GENERADO.

7. Persistir XML request/response
   - Al emitir, verificar que se guardaron los XML y que se pueden descargar.

8. Generacion de PDF
   - Descargar el PDF y revisar que contiene datos fiscales clave.

9. Registrar fecha aproximada de cobro
   - Actualizar cobranza con fecha futura.
   - Estado esperado: A_VENCER.

10. Registrar fecha real de pago
   - Registrar pago manual con fecha y monto.
   - Estado esperado: COBRADA.

11. Recalculo de estado de cobranza
   - Quitar fecha de pago manual y usar fecha aprox vencida.
   - Estado esperado: VENCIDA.

12. Idempotencia
   - Emitir dos facturas con mismo hash.
   - Debe reutilizar la autorizada y no duplicar CAE.

13. Sincronizar puntos de venta
   - Ejecutar sincronizacion.
   - Verificar que existe el punto 00011 habilitado.

14. Test WSAA
   - Ejecutar test de WSAA.
   - Verificar respuesta OK y timestamp de ultimo login.

15. Resumen por cliente
   - Verificar que el resumen agrega facturas por cliente/sucursal/periodo.
