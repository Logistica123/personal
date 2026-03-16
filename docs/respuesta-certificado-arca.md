RESPUESTA - CERTIFICADO ARCA (CSR)

Esto me pide, el certificado, como crea el programador el certificado
Si: esa pantalla no te pide el certificado final, te pide el CSR en formato PKCS#10. El circuito oficial de ARCA para produccion es: generar clave privada, generar CSR, subir ese CSR en Administracion de Certificados Digitales, y despues descargar el CRT emitido.

Para tu caso, el programador tiene que crear estos 2 archivos primero:
- privada.key -> la clave privada
- pedido.csr -> el archivo que vos subis en esa pantalla

Y recien despues ARCA te devuelve el certificado (.crt).

Que tiene que hacer el programador

1) Generar la clave privada
ARCA publica como base una clave RSA de 2048 bits.

openssl genrsa -out privada.key 2048

2) Generar el CSR
ARCA publica que el CSR se genera con OpenSSL y que en el serialNumber debe ir CUIT + la CUIT sin guiones.

Para LOGISTICA ARGENTINA S.R.L. con CUIT 30717060985, usar:

openssl req -new \
  -key privada.key \
  -subj "/C=AR/O=LOGISTICA ARGENTINA S.R.L./CN=logarg-erp-wsfe-pv00011/serialNumber=CUIT 30717060985" \
  -out logarg-erp-wsfe-pv00011.csr

Ese comando esta alineado con el formato oficial de ARCA para el CSR:
/C=AR/O=.../CN=.../serialNumber=CUIT ...

Que cargas vos en esa pantalla
En esa pantalla:
- en Alias pone: logarg-erp-wsfe-pv00011
- en Elegir archivo subi: logarg-erp-wsfe-pv00011.csr

No subas:
- privada.key
- .crt
- .pfx/.p12

Ahi se sube solo el CSR.

Que pasa despues
Despues de hacer clic en Agregar alias:
1. ARCA crea el alias y emite el certificado.
2. Entras en Ver sobre ese alias.
3. Descargas el certificado CRT a tu PC.

Que necesita despues el programador
Con eso ya tendra:
- privada.key
- certificado.crt

Y si quiere trabajar con un unico archivo, se puede convertir a PFX/PKCS#12:

openssl pkcs12 -export \
  -inkey privada.key \
  -in certificado.crt \
  -out logarg-erp-wsfe-pv00011.pfx

Paso obligatorio despues del certificado
Tener el CRT no alcanza. Despues hay que asociar ese certificado al web service de negocio desde Administrador de Relaciones de Clave Fiscal con Nueva Relacion y seleccion del WSN.

Para tu modulo, el web service correcto sigue siendo wsfev1 para comprobantes A/B/C/M, y en la autenticacion WSAA el servicio tecnico a pedir es wsfe.

Lo mas importante para que no se rompa despues
Decile al programador esto:
- la privada.key debe generarse en el servidor final o en un equipo seguro;
- esa clave no se pierde;
- si se pierde la privada.key, el CRT emitido despues no les va a servir para autenticarse.

Texto exacto para mandarle al programador

Necesito que generes el CSR para ARCA produccion del emisor LOGISTICA ARGENTINA S.R.L. (CUIT 30717060985), para el alias logarg-erp-wsfe-pv00011 y el punto de venta ERP 00011.

Genera:
1) privada.key (RSA 2048)
2) logarg-erp-wsfe-pv00011.csr

Usa este subject:
 /C=AR/O=LOGISTICA ARGENTINA S.R.L./CN=logarg-erp-wsfe-pv00011/serialNumber=CUIT 30717060985

Comando esperado:
openssl genrsa -out privada.key 2048
openssl req -new -key privada.key -subj "/C=AR/O=LOGISTICA ARGENTINA S.R.L./CN=logarg-erp-wsfe-pv00011/serialNumber=CUIT 30717060985" -out logarg-erp-wsfe-pv00011.csr

Luego yo voy a subir ese .csr en Administracion de Certificados Digitales de ARCA. Cuando descargue el .crt, vas a usar privada.key + certificado.crt para conectar el ERP a WSAA + WSFEv1.

Referencias
[1] https://www.afip.gob.ar/ws/WSAA/cert-req-howto.txt
[2] https://www.arca.gob.ar/ws/documentacion/ws-factura-electronica.asp
