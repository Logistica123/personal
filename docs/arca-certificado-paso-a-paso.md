PASO A PASO - CERTIFICADO Y ALTA ARCA

Datos cerrados
- Empresa: LOGISTICA ARGENTINA S.R.L.
- CUIT: 30717060985
- Punto de venta ERP: 00011
- Sistema: RECE para aplicativo y web services
- Alias recomendado: logarg-erp-wsfe-pv00011
- Ambiente objetivo: PRODUCCION
- WSN objetivo: wsfev1
- Service WSAA: wsfe

Meta del instructivo
Dejar lista la parte de ARCA para que el programador solo tenga que cargar certificado, consumir WSAA y luego WSFEv1.

Flujo correcto y real
1. Generar private key RSA 2048 y CSR.
2. Entrar a Administracion de Certificados Digitales.
3. Crear alias nuevo.
4. Subir el CSR.
5. Descargar el CRT emitido.
6. Entrar a Administrador de Relaciones de Clave Fiscal.
7. Asociar el certificado al WSN de Factura Electronica.
8. Cargar CRT + KEY o P12 en el ERP.
9. Probar WSAA.
10. Probar FEParamGetPtosVenta y verificar que exista el punto 00011.

Requisito previo humano
La persona que realiza el alta debe poder operar en nombre de LOGISTICA ARGENTINA S.R.L. con clave fiscal y tener acceso a:
- Administracion de Certificados Digitales
- Administrador de Relaciones de Clave Fiscal
- Administracion de puntos de venta y domicilios

Estado actual del proyecto
- el punto de venta 00011 ya fue creado
- el sistema seleccionado fue RECE para aplicativo y web services
- el domicilio fiscal ya quedo asociado

Nombre final recomendado del alias
Usar este y no cambiarlo salvo fuerza mayor:
- logarg-erp-wsfe-pv00011

Generacion del material criptografico
Usar los scripts dentro de 06_openssl:
- generar_csr.sh
- verificar_csr.sh
- generar_p12.sh

Salida esperada
- out/logarg-erp-wsfe-pv00011.key
- out/logarg-erp-wsfe-pv00011.csr
- out/logarg-erp-wsfe-pv00011.subject.txt
- out/logarg-erp-wsfe-pv00011.csr.txt

Validaciones del CSR
El CSR debe mostrar:
- C = AR
- O = LOGISTICA ARGENTINA S.R.L.
- CN = logarg-erp-wsfe-pv00011
- serialNumber = CUIT 30717060985

Alta del alias en ARCA
En Administracion de Certificados Digitales
1. Entrar con clave fiscal.
2. Elegir a LOGISTICA ARGENTINA S.R.L.
3. Click en Agregar alias.
4. Alias: logarg-erp-wsfe-pv00011.
5. Subir el archivo .csr.
6. Confirmar.
7. Entrar en Ver y descargar el CRT.

Archivos que hay que conservar
Guardar juntos y en carpeta segura:
- logarg-erp-wsfe-pv00011.key
- logarg-erp-wsfe-pv00011.crt

Opcionalmente generar:
- logarg-erp-wsfe-pv00011.p12

Asociacion al WSN
En Administrador de Relaciones de Clave Fiscal
1. Entrar al servicio.
2. Nueva Relacion.
3. Buscar el WSN de Factura Electronica.
4. Seleccionar el representante.
5. Confirmar.
6. Salir y volver a entrar si fuera necesario.

Carga en el ERP
El modulo de Configuracion ARCA debe permitir dos formas:
- CRT + KEY + passphrase opcional
- P12 + password

Checklist final antes de emitir
- certificado vigente y cargado
- alias correcto
- TA de WSAA obtenido correctamente
- punto de venta 00011 visible en FEParamGetPtosVenta
- punto 00011 no bloqueado
- prueba de FECompUltimoAutorizado OK

Importante
No compartir la private key por chat ni mail.
Generarla de preferencia en el servidor o en una PC segura.
