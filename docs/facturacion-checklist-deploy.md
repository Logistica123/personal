Checklist final de deploy - Facturacion ARCA

1. Backend
   - Migraciones ejecutadas hasta 2026_03_16_000004.
   - Storage disk configurado en services.arca.storage_disk.
   - Logs tecnicos habilitados.
   - Permisos de roles para facturacion cargados.

2. Configuracion ARCA
   - Emisor activo con CUIT correcto.
   - Punto de venta 00011 sincronizado y habilitado para ERP.
   - Certificado activo para PROD.

3. Servicios
   - WSAA responde OK.
   - WSFEv1 responde OK.
   - Lock de emision activo por (emisor, ambiente, pto_vta, cbte_tipo).

4. Front
   - URLs de API correctas.
   - Formulario de factura con validaciones visibles.
   - Pantallas de detalle muestran PDF/XML/auditoria.

Checklist carga de certificados (CRT+KEY / P12)

1. Preparacion
   - Verificar CSR aprobado en ARCA y CRT descargado.
   - Confirmar password del P12 (si aplica).
   - Confirmar alias sugerido: logarg-erp-wsfe-pv00011.

2. Importacion en ERP
   - Subir CRT + KEY o P12 desde Configuracion ARCA.
   - Verificar vigencia y subject del certificado.
   - Activar certificado para el ambiente deseado.

3. Verificacion
   - Ejecutar test WSAA.
   - Confirmar ultimo_login_wsaa_ok_at actualizado.

Checklist de prueba de emision real

1. Borrador
   - Crear borrador con cliente y sucursal reales.
   - Validar importes y periodo comercial.

2. Emision
   - Ejecutar emitir ARCA.
   - Verificar CAE y vencimiento.
   - Verificar PDF generado.
   - Verificar XML request/response guardados.

3. Cobranza
   - Registrar fecha aproximada de cobro.
   - Registrar pago manual.
   - Verificar estado COBRADA.

4. Auditoria
   - Confirmar eventos de emision y cobranza en auditoria.
