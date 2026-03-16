CASOS DE PRUEBA Y ACEPTACION

1. Certificado
Caso 1
Dado un CSR generado con los scripts del pack,
cuando se lo verifica,
entonces debe mostrar:
- CN = logarg-erp-wsfe-pv00011
- O = LOGISTICA ARGENTINA S.R.L.
- serialNumber = CUIT 30717060985

Caso 2
Dado un CRT + KEY o P12 importados,
cuando se ejecuta test WSAA,
entonces debe obtenerse token/sign sin error.

2. Punto de venta
Caso 3
Dado el emisor configurado,
cuando se sincronizan puntos de venta,
entonces debe existir el 00011 y estar habilitado para ERP.

3. Borrador
Caso 4
No debe permitir guardar borrador sin cliente_id, sucursal_id, anio, mes o periodo.

Caso 5
Si concepto=2 y faltan fechas de servicio,
la validacion local debe bloquear la emision.

4. Emision
Caso 6
Dado un borrador valido,
cuando se emite,
entonces debe:
- obtener TA
- consultar ultimo autorizado
- solicitar CAE
- guardar request_xml_path y response_xml_path
- guardar cae y cae_vto
- generar pdf_path
- pasar a AUTORIZADA/PDF_GENERADO

Caso 7
Si ARCA responde rechazo,
la factura debe quedar en RECHAZADA_ARCA con errores y observaciones persistidos.

Caso 8
Si hay timeout tecnico,
la factura debe quedar en ERROR_TECNICO y no debe reenviarse automaticamente.

5. Idempotencia
Caso 9
Si se intenta emitir dos veces el mismo hash de idempotencia,
solo debe existir una emision real.

6. Cobranza
Caso 10
Si se crea factura con fecha_aprox_cobro futura y sin fecha_pago_manual,
estado_cobranza = A_VENCER.

Caso 11
Si la fecha_aprox_cobro vence y sigue sin fecha_pago_manual,
estado_cobranza = VENCIDA.

Caso 12
Si se completa fecha_pago_manual,
estado_cobranza = COBRADA.

7. Clientes de Facturacion
Caso 13
El consolidado debe agrupar por cliente_id + sucursal_id + anio + mes + periodo.

Caso 14
El total_iva y total_final del consolidado deben coincidir con la suma del detalle del grupo.

8. UI
Caso 15
El listado debe mostrar filtros, KPIs y tabla.

Caso 16
Nueva Factura debe usar selector de cliente y selector dependiente de sucursal.

Caso 17
Detalle Factura debe permitir descargar PDF y XMLs.

9. Aceptacion funcional final
Se considera aprobado cuando:
- el ERP emite una factura real en ARCA con CAE
- esa factura queda guardada localmente
- puede descargarse el PDF
- queda asociada a cliente/sucursal/periodo
- luego puede marcarse como cobrada
- aparece correctamente en el modulo Clientes de Facturacion
