SECUENCIA TECNICA - WSAA Y WSFEv1

A. Obtener TA
1. Leer certificado activo.
2. Construir loginTicketRequest con service=wsfe.
3. Firmar CMS con private key y certificado.
4. Enviar loginCms al endpoint del ambiente.
5. Parsear XML respuesta.
6. Guardar token/sign + expirationTime en cache.

B. Validar punto de venta
1. Usar TA vigente.
2. Invocar FEParamGetPtosVenta.
3. Confirmar que exista nro=11, no bloqueado, sin fecha de baja.

C. Obtener ultimo comprobante
1. Invocar FECompUltimoAutorizado con pto_vta y cbte_tipo.
2. Si devuelve n, usar n+1.
3. Si no hay comprobantes, usar 1.

D. Emitir CAE
1. Construir FECAESolicitar.
2. Enviar SOAP.
3. Guardar XML request.
4. Guardar XML response.
5. Si resultado=A, persistir CAE y numero.
6. Si resultado=R, persistir errores y observaciones.
7. Generar PDF solo cuando hay autorizacion.

E. Reconsulta / soporte
1. Si hubo timeout, no reenviar de inmediato.
2. Reconsultar por ultimo autorizado y/o FECompConsultar.
3. Si el comprobante impacto, completar datos locales.
4. Solo si se confirma que no impacto, permitir reintento.
