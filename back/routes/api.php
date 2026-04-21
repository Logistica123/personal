<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ArcaCertificadoController;
use App\Http\Controllers\Api\ArcaEmisorController;
use App\Http\Controllers\Api\ArcaParametrosController;
use App\Http\Controllers\Api\ArcaPuntoVentaController;
use App\Http\Controllers\Api\ChatMessageController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\ClienteRequerimientoController;
use App\Http\Controllers\Api\ClientesFacturacionController;
use App\Http\Controllers\Api\FacturaController;
use App\Http\Controllers\Api\FacturaCobranzaController;
use App\Http\Controllers\Api\LiquidacionReciboController;
use App\Http\Controllers\Api\UnidadController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PersonalController;
use App\Http\Controllers\Api\ReclamoController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PersonalDocumentController;
use App\Http\Controllers\Api\PersonalCommentController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\ActivoAsesorComercialController;
use App\Http\Controllers\Api\CierreDiarioController;
use App\Http\Controllers\Api\WorkflowTaskController;
use App\Http\Controllers\Api\GeneralInfoController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\TeamGroupController;
use App\Http\Controllers\Api\TicketRequestController;
use App\Http\Controllers\Api\NosisController;
use App\Http\Controllers\Api\TarifaImagenController;
use App\Http\Controllers\Api\TaxProfileController;
use App\Http\Controllers\Api\SolicitudPersonalController;
use App\Http\Controllers\Api\VacacionesDiasController;
use App\Http\Controllers\Api\DistriappController;
use App\Http\Controllers\Api\DistriappReadonlyController;
use App\Http\Controllers\Api\UserDocumentController;
use App\Http\Controllers\Api\CallController;
use App\Http\Controllers\Api\MembresiaController;
use App\Http\Controllers\Api\Liq\LiqClienteController;
use App\Http\Controllers\Api\Liq\LiqTarifaController;
use App\Http\Controllers\Api\Liq\LiqExtractosController;
use App\Http\Controllers\Api\Liq\LiqArchivoEntradaController;
use App\Http\Controllers\Api\Liq\LiqDistribuidorLiquidacionesController;
use App\Http\Controllers\Api\Liq\LiqDistribuidorDocumentoController;
use App\Http\Controllers\Api\Liq\LiqEstadoCuentaController;
use App\Http\Controllers\Api\Liq\LiqJurisdiccionController;
use App\Http\Controllers\Api\Liq\LiqPagosController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/twofactor/setup', [AuthController::class, 'setupTotp']);
Route::post('/twofactor/enable', [AuthController::class, 'enableTotp']);

Route::middleware('auth.api')->group(function () {
    Route::get('/personal/documentos/tipos', [PersonalDocumentController::class, 'types']);
    Route::post('/personal/documentos/tipos', [PersonalDocumentController::class, 'storeType']);
    Route::get('/personal/documentos/tipos/{tipo}', [PersonalDocumentController::class, 'show']);
    Route::put('/personal/documentos/tipos/{tipo}', [PersonalDocumentController::class, 'update']);
    Route::match(['GET', 'POST'], '/personal/{persona}/liquidaciones', [PersonalDocumentController::class, 'liquidaciones']);
    Route::match(['GET', 'POST'], '/personal/liquidaciones', [PersonalDocumentController::class, 'liquidacionesByActor']);
    Route::get('/personal/{persona}/documentos', [PersonalDocumentController::class, 'index']);
    Route::post('/personal/{persona}/documentos', [PersonalDocumentController::class, 'store']);
    Route::post('/personal/{persona}/documentos/publicar', [PersonalDocumentController::class, 'publishPending']);
    Route::post('/personal/{persona}/documentos/pagado', [PersonalDocumentController::class, 'updatePagado']);
    Route::post('/personal/{persona}/documentos/recibido', [PersonalDocumentController::class, 'updateRecibido']);
    Route::post('/documentos/pagado', [PersonalDocumentController::class, 'updatePagadoBulk']);
    Route::put('/personal/{persona}/documentos/{documento}', [PersonalDocumentController::class, 'updateDocument']);
    Route::delete('/personal/{persona}/documentos/{documento}', [PersonalDocumentController::class, 'destroy']);
    Route::put('/personal/{persona}/retener-pago', [PersonalController::class, 'retenerPago']);
    Route::get('/personal/{persona}/combustible', [PersonalController::class, 'combustible']);
    Route::get('/personal/{persona}/combustible-reportes', [PersonalController::class, 'combustibleReports']);
    Route::get('/personal/{persona}/combustible-proyeccion', [PersonalController::class, 'combustibleProjection']);
    Route::get('/personal/resumen-mensual', [PersonalController::class, 'resumenMensual']);
    Route::get('/personal/{persona}/notificaciones', [PersonalController::class, 'personalNotifications']);
    Route::post('/personal/{persona}/notificaciones/{notification}/read', [PersonalController::class, 'markPersonalNotificationRead']);
    Route::get('/personal/{persona}/documentos/{documento}/preview', [PersonalDocumentController::class, 'preview'])
        ->name('personal.documentos.preview');
    Route::get('/personal/{persona}/documentos/descargar-todos', [PersonalDocumentController::class, 'downloadAll'])
        ->name('personal.documentos.descargarTodos');
    Route::get('/personal/{persona}/documentos/{documento}/descargar', [PersonalDocumentController::class, 'download'])->name('personal.documentos.descargar');
    Route::post('/personal/{persona}/comentarios', [PersonalCommentController::class, 'store']);
    Route::post('/personal/{persona}/aprobar', [PersonalController::class, 'approve']);
    Route::post('/personal/{persona}/desaprobar', [PersonalController::class, 'disapprove']);
    Route::get('/personal-meta', [PersonalController::class, 'meta']);
    Route::get('/personal', [PersonalController::class, 'index']);
    Route::post('/personal', [PersonalController::class, 'store']);
    Route::get('/personal/{persona}', [PersonalController::class, 'show']);
    Route::put('/personal/{persona}', [PersonalController::class, 'update']);
    Route::post('/personal/{persona}', [PersonalController::class, 'update']);
    Route::get('/personal/{persona}/legajo-impositivo', [TaxProfileController::class, 'showPersona']);
    Route::put('/personal/{persona}/legajo-impositivo', [TaxProfileController::class, 'updatePersona']);
    Route::post('/personal/{persona}/legajo-impositivo/nosis-refresh', [TaxProfileController::class, 'refreshPersonaNosis']);
    Route::post('/personal/{persona}/contact-reveal', [PersonalController::class, 'logContactReveal']);
    Route::delete('/personal/{persona}', [PersonalController::class, 'destroy']);

    Route::get('/personal/{persona}/membresia', [MembresiaController::class, 'show']);
    Route::post('/personal/{persona}/membresia/cuotas', [MembresiaController::class, 'storeCuota']);
    Route::post('/personal/{persona}/membresia/beneficios', [MembresiaController::class, 'storeBeneficioUso']);
    Route::delete('/personal/{persona}/membresia/beneficios/{uso}', [MembresiaController::class, 'destroyBeneficioUso']);

    Route::get('/solicitud-personal', [SolicitudPersonalController::class, 'index']);
    Route::post('/solicitud-personal', [SolicitudPersonalController::class, 'store']);
    Route::put('/solicitud-personal/{solicitudPersonal}', [SolicitudPersonalController::class, 'update']);
    Route::post('/solicitud-personal/{solicitudPersonal}', [SolicitudPersonalController::class, 'update']);
    Route::post('/solicitud-personal/{solicitudPersonal}/aprobar', [SolicitudPersonalController::class, 'approve']);
    Route::post('/solicitud-personal/{solicitudPersonal}/rechazar', [SolicitudPersonalController::class, 'reject']);
    Route::delete('/solicitud-personal/{solicitudPersonal}', [SolicitudPersonalController::class, 'destroy']);
    Route::get('/vacaciones-dias', [VacacionesDiasController::class, 'index']);
    Route::put('/vacaciones-dias', [VacacionesDiasController::class, 'update']);

    Route::get('/clientes', [ClienteController::class, 'index']);
    Route::get('/clientes/select', [ClienteController::class, 'select']);
    Route::get('/clientes/requerimientos', [ClienteRequerimientoController::class, 'index']);
    Route::post('/clientes/requerimientos', [ClienteRequerimientoController::class, 'store']);
    Route::put('/clientes/requerimientos/{requerimiento}', [ClienteRequerimientoController::class, 'update']);
    Route::delete('/clientes/requerimientos/{requerimiento}', [ClienteRequerimientoController::class, 'destroy']);
    Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);
    Route::get('/clientes/{cliente}/sucursales', [ClienteController::class, 'sucursales']);
    Route::post('/clientes', [ClienteController::class, 'store']);
    Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
    Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);
    Route::get('/clientes/{cliente}/legajo-impositivo', [TaxProfileController::class, 'showCliente']);
    Route::put('/clientes/{cliente}/legajo-impositivo', [TaxProfileController::class, 'updateCliente']);
    Route::post('/clientes/{cliente}/legajo-impositivo/nosis-refresh', [TaxProfileController::class, 'refreshClienteNosis']);
    Route::post('/clientes/{cliente}/legajo-impositivo/documentos', [TaxProfileController::class, 'storeClienteDocument']);
    Route::delete('/clientes/{cliente}/legajo-impositivo/documentos/{documento}', [TaxProfileController::class, 'destroyClienteDocument']);
    Route::get('/clientes/{cliente}/legajo-impositivo/documentos/{documento}/descargar', [TaxProfileController::class, 'downloadClienteDocument'])
        ->name('clientes.legajo.documentos.descargar');

    Route::get('/arca/emisores', [ArcaEmisorController::class, 'index']);
    Route::post('/arca/emisores', [ArcaEmisorController::class, 'store']);
    Route::get('/arca/emisores/{emisor}', [ArcaEmisorController::class, 'show']);
    Route::put('/arca/emisores/{emisor}', [ArcaEmisorController::class, 'update']);
    Route::get('/arca/emisores/{emisor}/certificados', [ArcaCertificadoController::class, 'index']);
    Route::post('/arca/emisores/{emisor}/certificados/importar', [ArcaCertificadoController::class, 'importar']);
    Route::post('/arca/emisores/{emisor}/certificados/import-crt-key', [ArcaCertificadoController::class, 'importCrtKey']);
    Route::post('/arca/emisores/{emisor}/certificados/import-p12', [ArcaCertificadoController::class, 'importP12']);
    Route::post('/arca/emisores/{emisor}/certificados/test-wsaa', [ArcaCertificadoController::class, 'testWsaa']);
    Route::post('/arca/certificados/generar-csr', [ArcaCertificadoController::class, 'generarCsr']);
    Route::get('/arca/certificados/{certificado}/csr', [ArcaCertificadoController::class, 'downloadCsr']);
    Route::post('/arca/certificados/{certificado}/importar', [ArcaCertificadoController::class, 'importarPorCertificado']);
    Route::post('/arca/certificados/{certificado}/test-wsaa', [ArcaCertificadoController::class, 'testWsaaPorCertificado']);
    Route::post('/arca/certificados/{certificado}/activar', [ArcaCertificadoController::class, 'activate']);
    Route::post('/arca/certificados/{certificado}/desactivar', [ArcaCertificadoController::class, 'deactivate']);
    Route::post('/arca/emisores/{emisor}/puntos-venta/sincronizar', [ArcaPuntoVentaController::class, 'sync']);
    Route::post('/arca/emisores/{emisor}/puntos-venta/sync', [ArcaPuntoVentaController::class, 'sync']);
    Route::get('/arca/emisores/{emisor}/puntos-venta', [ArcaPuntoVentaController::class, 'index']);
    Route::get('/arca/emisores/{emisor}/parametros/unidades', [ArcaParametrosController::class, 'unidades']);

    Route::get('/facturas', [FacturaController::class, 'index']);
    Route::post('/facturas', [FacturaController::class, 'store']);
    Route::get('/facturas/{factura}', [FacturaController::class, 'show']);
    Route::delete('/facturas/{factura}', [FacturaController::class, 'destroy']);
    Route::patch('/facturas/{factura}', [FacturaController::class, 'updateDraft']);
    Route::put('/facturas/{factura}/borrador', [FacturaController::class, 'updateDraft']);
    Route::post('/facturas/{factura}/validar', [FacturaController::class, 'validar']);
    Route::post('/facturas/{factura}/emitir', [FacturaController::class, 'emitir']);
    Route::get('/facturas/{factura}/pdf', [FacturaController::class, 'downloadPdf']);
    Route::get('/facturas/{factura}/xml-request', [FacturaController::class, 'downloadXmlRequest']);
    Route::get('/facturas/{factura}/xml-response', [FacturaController::class, 'downloadXmlResponse']);
    Route::get('/facturas/{factura}/auditoria', [FacturaController::class, 'auditoria']);
    Route::patch('/facturas/{factura}/cobranza', [FacturaCobranzaController::class, 'actualizar']);
    Route::post('/facturas/{factura}/actualizar-cobranza', [FacturaCobranzaController::class, 'actualizar']);
    Route::post('/facturas/{factura}/registrar-pago', [FacturaCobranzaController::class, 'registrarPago']);
    Route::get('/facturas/{factura}/historial-cobranza', [FacturaCobranzaController::class, 'historial']);

    Route::get('/clientes-facturacion/resumen', [ClientesFacturacionController::class, 'resumen']);
    Route::get('/clientes-facturacion/detalle', [ClientesFacturacionController::class, 'detalle']);
    Route::get('/clientes-facturacion/estado-cuenta', [ClientesFacturacionController::class, 'estadoCuenta']);
    Route::post('/clientes-facturacion/estado-cuenta/manual', [ClientesFacturacionController::class, 'storeManualRow']);
    Route::put('/clientes-facturacion/estado-cuenta/manual/{manualRow}', [ClientesFacturacionController::class, 'updateManualRow']);
    Route::delete('/clientes-facturacion/estado-cuenta/manual/{manualRow}', [ClientesFacturacionController::class, 'destroyManualRow']);
    Route::get('/clientes-facturacion/{cliente}/sucursales', [ClientesFacturacionController::class, 'sucursales']);
    Route::get('/clientes-facturacion/grupo/{grupoId}', [ClientesFacturacionController::class, 'grupo']);
    Route::get('/facturacion/clientes', [ClientesFacturacionController::class, 'resumen']);
    Route::get('/facturacion/clientes/{cliente}/facturas', [ClientesFacturacionController::class, 'facturasCliente']);
    Route::get('/liquidaciones/recibos', [LiquidacionReciboController::class, 'index']);
    Route::post('/liquidaciones/recibos', [LiquidacionReciboController::class, 'store']);
    Route::post('/liquidaciones/recibos/{recibo}/anular', [LiquidacionReciboController::class, 'anular']);

    Route::get('/cierres-diarios', [CierreDiarioController::class, 'index']);
    Route::get('/cierres-diarios/fechas', [CierreDiarioController::class, 'fechas']);
    Route::post('/cierres-diarios/import', [CierreDiarioController::class, 'import']);
    Route::post('/cierres-diarios/debug', [CierreDiarioController::class, 'debug']);
    Route::delete('/cierres-diarios/fecha/{fecha}', [CierreDiarioController::class, 'destroyByFecha']);
    Route::get('/cierres-diarios/informes/no-citados', [CierreDiarioController::class, 'informeNoCitados']);

    Route::get('/bdd-activos-asesores', [ActivoAsesorComercialController::class, 'index']);
    Route::post('/bdd-activos-asesores', [ActivoAsesorComercialController::class, 'store']);
    Route::post('/bdd-activos-asesores/import', [ActivoAsesorComercialController::class, 'import']);
    Route::put('/bdd-activos-asesores/{activoAsesorComercial}', [ActivoAsesorComercialController::class, 'update']);
    Route::delete('/bdd-activos-asesores/{activoAsesorComercial}', [ActivoAsesorComercialController::class, 'destroy']);

    // ── Control de Liquidaciones v2 (/api/liq/*) ─────────────────────────────
    Route::prefix('liq')->group(function () {
        // Clientes habilitados para liquidaciones
        Route::get('/clientes', [LiqClienteController::class, 'index']);
        Route::post('/clientes', [LiqClienteController::class, 'store']);
        Route::patch('/clientes/{cliente}', [LiqClienteController::class, 'update']);

        // Esquemas tarifarios
        Route::get('/clientes/{cliente}/esquemas', [LiqClienteController::class, 'esquemas']);
        Route::post('/clientes/{cliente}/esquemas', [LiqClienteController::class, 'storeEsquema']);
        Route::put('/esquemas/{esquema}/activar', [LiqTarifaController::class, 'activarEsquema']);
        Route::put('/esquemas/{esquema}/desactivar', [LiqTarifaController::class, 'desactivarEsquema']);
        Route::delete('/esquemas/{esquema}', [LiqTarifaController::class, 'destroyEsquema']);

        // Dimensiones de un esquema
        Route::get('/esquemas/{esquema}/dimensiones', [LiqTarifaController::class, 'dimensiones']);
        Route::post('/esquemas/{esquema}/dimensiones', [LiqTarifaController::class, 'storeDimension']);
        Route::put('/dimension-valores/{dimensionValor}/desactivar', [LiqTarifaController::class, 'desactivarDimension']);

        // Líneas de tarifa
        Route::get('/esquemas/{esquema}/lineas', [LiqTarifaController::class, 'lineas']);
        Route::post('/esquemas/{esquema}/lineas', [LiqTarifaController::class, 'storeLinea']);
        Route::post('/esquemas/{esquema}/importar-excel', [LiqTarifaController::class, 'importarExcel']);
        Route::post('/esquemas/{esquema}/importar-oca', [LiqTarifaController::class, 'importarOca']);
        Route::post('/esquemas/{esquema}/aumento-preview', [LiqTarifaController::class, 'aumentoPreview']);
        Route::post('/esquemas/{esquema}/aumento-aplicar', [LiqTarifaController::class, 'aumentoAplicar']);
        Route::post('/esquemas/{esquema}/lineas/aprobar-todas', [LiqTarifaController::class, 'aprobarTodasLineas']);
        Route::put('/lineas/{lineaTarifa}/aprobar', [LiqTarifaController::class, 'aprobarLinea']);
        Route::put('/lineas/{lineaTarifa}', [LiqTarifaController::class, 'updateLinea']);
        Route::put('/lineas/{lineaTarifa}/desactivar', [LiqTarifaController::class, 'desactivarLinea']);

        // Tarifa por patente (override de línea por combinación)
        Route::get('/esquemas/{esquema}/tarifas-patente', [LiqTarifaController::class, 'tarifasPatente']);
        Route::post('/esquemas/{esquema}/tarifas-patente', [LiqTarifaController::class, 'storeTarifaPatente']);
        Route::put('/tarifas-patente/{tarifaPatente}/desactivar', [LiqTarifaController::class, 'desactivarTarifaPatente']);

        // Mapeos de concepto
        Route::get('/clientes/{cliente}/mapeos-concepto', [LiqClienteController::class, 'mapeosConcepto']);
        Route::post('/clientes/{cliente}/mapeos-concepto', [LiqClienteController::class, 'storeMapeosConcepto']);
        Route::put('/mapeos-concepto/{id}/desactivar', [LiqClienteController::class, 'desactivarMapeoConcepto']);

        // Mapeos de sucursal
        Route::get('/clientes/{cliente}/mapeos-sucursal', [LiqClienteController::class, 'mapeosSucursal']);
        Route::post('/clientes/{cliente}/mapeos-sucursal', [LiqClienteController::class, 'storeMapeosSucursal']);
        Route::put('/mapeos-sucursal/{id}/desactivar', [LiqClienteController::class, 'desactivarMapeoSucursal']);

        // Gastos administrativos
        Route::get('/clientes/{cliente}/gastos', [LiqClienteController::class, 'gastos']);
        Route::post('/clientes/{cliente}/gastos', [LiqClienteController::class, 'storeGastos']);

        // Tarifa vigente + historial de auditoría
        Route::get('/clientes/{cliente}/tarifa', [LiqClienteController::class, 'tarifaVigente']);
        Route::get('/clientes/{cliente}/tarifa/historial', [LiqClienteController::class, 'tarifaHistorial']);

        // Liquidaciones del cliente (cabecera)
        Route::get('/liquidaciones', [LiqExtractosController::class, 'index']);
        Route::post('/liquidaciones', [LiqExtractosController::class, 'store']);
        Route::get('/liquidaciones/{liquidacionCliente}', [LiqExtractosController::class, 'show']);
        Route::delete('/liquidaciones/{liquidacionCliente}', [LiqExtractosController::class, 'destroy']);
        Route::post('/liquidaciones/upload', [LiqExtractosController::class, 'upload']);
        Route::post('/liquidaciones/upload-ocasa', [LiqExtractosController::class, 'uploadOcasa']);
        Route::post('/liquidaciones/{liquidacionCliente}/generar', [LiqExtractosController::class, 'generarLiquidaciones']);
        Route::get('/liquidaciones/{liquidacionCliente}/operaciones', [LiqExtractosController::class, 'operaciones']);
        Route::delete('/liquidaciones/{liquidacionCliente}/operaciones', [LiqExtractosController::class, 'destroyOperaciones']);
        Route::get('/liquidaciones/{liquidacionCliente}/distribuidores', [LiqExtractosController::class, 'distribuidores']);
        Route::get('/liquidaciones/{liquidacionCliente}/auditoria', [LiqExtractosController::class, 'auditoria']);
        Route::get('/liquidaciones/{liquidacionCliente}/origenes-sin-mapear', [LiqExtractosController::class, 'origenesSinMapear']);
        Route::get('/liquidaciones/{liquidacionCliente}/totales-por-sucursal', [LiqExtractosController::class, 'totalesPorSucursal']);
        Route::get('/liquidaciones/{liquidacionCliente}/pre-factura', [LiqExtractosController::class, 'preFactura']);
        Route::get('/liquidaciones/{liquidacionCliente}/discrepancias-tms-pdf', [LiqExtractosController::class, 'discrepanciasTmsPdf']);
        Route::get('/liquidaciones/{liquidacionCliente}/factura-lista', [LiqExtractosController::class, 'facturaLista']);
        Route::get('/liquidaciones/{liquidacionCliente}/peajes', [LiqExtractosController::class, 'peajes']);
        Route::get('/liquidaciones/{liquidacionCliente}/peajes/distribuidor/{distribuidorId}', [LiqExtractosController::class, 'peajesDistribuidor']);
        Route::post('/liquidaciones/{liquidacionCliente}/peajes/autorizar', [LiqExtractosController::class, 'autorizarPeajes']);
        Route::post('/liquidaciones/{liquidacionCliente}/reparsear-pdfs-ocasa', [LiqExtractosController::class, 'reparsearPdfsOcasa']);
        Route::get('/peajes/dashboard', [LiqExtractosController::class, 'dashboardPeajes']);
        Route::get('/peajes/dashboard/export', [LiqExtractosController::class, 'exportDashboardPeajes']);
        Route::post('/liquidaciones/{liquidacionCliente}/recalcular-totales-sucursal', [LiqExtractosController::class, 'recalcularTotalesSucursal']);
        Route::post('/liquidaciones/{liquidacionCliente}/revincular-distribuidores', [LiqExtractosController::class, 'revincularDistribuidores']);
        Route::get('/liquidaciones/{liquidacionCliente}/duplicados', [LiqExtractosController::class, 'duplicados']);
        Route::post('/liquidaciones/{liquidacionCliente}/resolver-duplicados', [LiqExtractosController::class, 'resolverDuplicados']);
        Route::post('/liquidaciones/{liquidacionCliente}/mapear-tarifa', [LiqExtractosController::class, 'mapearTarifa']);
        Route::delete('/operaciones/{operacion}', [\App\Http\Controllers\Api\Liq\LiqOperacionController::class, 'destroy']);
        Route::patch('/liquidaciones/{liquidacionCliente}/estado', [LiqExtractosController::class, 'cambiarEstado']);
        Route::put('/operaciones/{operacion}/excluir', [\App\Http\Controllers\Api\Liq\LiqOperacionController::class, 'excluir']);
        Route::put('/operaciones/{operacion}/incluir', [\App\Http\Controllers\Api\Liq\LiqOperacionController::class, 'incluir']);
        Route::put('/operaciones/{operacion}/editar-importes', [\App\Http\Controllers\Api\Liq\LiqOperacionController::class, 'editarImportes']);
        Route::put('/gastos/{gasto}/desactivar', [LiqClienteController::class, 'desactivarGasto']);

        // Archivos de entrada
        Route::get('/liquidaciones/{liquidacionCliente}/archivos', [LiqArchivoEntradaController::class, 'index']);
        Route::patch('/archivos/{archivo}/sucursal', [LiqArchivoEntradaController::class, 'updateSucursal']);
        Route::post('/archivos/{archivo}/reprocesar', [LiqArchivoEntradaController::class, 'reprocesar']);
        Route::delete('/archivos/{archivo}', [LiqArchivoEntradaController::class, 'destroy']);

        // OCA - procesamiento PDF con microservicio Python
        Route::get('/oca/health', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'health']);
        Route::get('/oca/buscar-personas', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'buscarPersonas']);

        // BUGFIX 19: Contratos OCA dinamicos
        Route::get('/oca/contratos', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'listarContratos']);
        Route::post('/oca/contratos', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'crearContrato']);
        Route::put('/oca/contratos/{id}', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'actualizarContrato']);
        Route::delete('/oca/contratos/{id}', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'eliminarContrato']);

        // BUGFIX 19: Reproceso OCA
        Route::post('/oca/{liquidacionCliente}/reprocesar', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'reprocesar']);
        Route::post('/oca/upload', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'upload']);
        Route::post('/oca/upload-ocr', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'uploadOcr']);
        Route::post('/oca/{liquidacionCliente}/operaciones-manuales', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'cargarOperacionesManuales']);
        Route::get('/oca/{liquidacionCliente}/vinculaciones', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'vinculaciones']);
        Route::get('/oca/{liquidacionCliente}/resumen', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'resumen']);
        Route::get('/oca/{liquidacionCliente}/tarifas-detectadas', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'tarifasDetectadas']);
        Route::post('/oca/{liquidacionCliente}/mapear-tarifa', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'mapearTarifa']);
        Route::post('/oca/{liquidacionCliente}/generar-operaciones', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'generarOperaciones']);
        Route::get('/oca/{liquidacionCliente}/historial', [\App\Http\Controllers\Api\Liq\LiqOcaController::class, 'historial']);

        // Feature C: Mapeos sucursal-distribuidor (plataforma-wide)
        Route::get('/mapeos-sucursal-distribuidor', [LiqExtractosController::class, 'mapeosSucursalDistribuidor']);
        Route::post('/mapeos-sucursal-distribuidor', [LiqExtractosController::class, 'storeMapeoSucursalDistribuidor']);
        Route::delete('/mapeos-sucursal-distribuidor/{mapeo}', [LiqExtractosController::class, 'destroyMapeoSucursalDistribuidor']);

        // Feature C: Asignacion masiva e individual de distribuidores
        Route::post('/liquidaciones/{liquidacionCliente}/asignar-distribuidor-masivo', [LiqExtractosController::class, 'asignarDistribuidorMasivo']);
        Route::post('/liquidaciones/{liquidacionCliente}/asignar-distribuidor-individual', [LiqExtractosController::class, 'asignarDistribuidorIndividual']);

        // Feature D: Liquidacion manual de distribuidor
        Route::post('/liquidaciones-distribuidor/manual', [LiqExtractosController::class, 'crearLiquidacionManual']);

        // Vista de proveedor (LiquidacionesPage) - liquidaciones generadas desde extractos (v2)
        Route::get('/distribuidores/{persona}/liquidaciones', [LiqDistribuidorLiquidacionesController::class, 'index']);

        // Materializar un documento en el módulo viejo para poder publicar/enviar
        Route::post('/liquidaciones-distribuidor/{liquidacionDistribuidor}/documento', [LiqDistribuidorDocumentoController::class, 'store']);
        Route::get('/liquidaciones-distribuidor/{liquidacionDistribuidor}/pdf', [LiqDistribuidorDocumentoController::class, 'descargarPdf']);
        Route::put('/liquidaciones-distribuidor/{liquidacionDistribuidor}/editar', [LiqDistribuidorLiquidacionesController::class, 'editar']);
        Route::post('/liquidaciones-distribuidor/{liquidacionDistribuidor}/recalcular-eficiencia', [LiqExtractosController::class, 'recalcularEficiencia']);

        // BUGFIX 27.1: ciclo de vida (preparar/anular/borrar con auditoría) en ambas tablas.
        // El endpoint DELETE /liquidaciones/{id} existente hace HARD delete para admins; estos agregan
        // SOFT delete con motivo para uso operativo cotidiano (reversible).
        Route::post(  '/liquidaciones-distribuidor/{liquidacionDistribuidor}/preparar',     [\App\Http\Controllers\Api\Liq\LiqLiquidacionDistribuidorCicloController::class, 'preparar']);
        Route::patch( '/liquidaciones-distribuidor/{liquidacionDistribuidor}/anular',       [\App\Http\Controllers\Api\Liq\LiqLiquidacionDistribuidorCicloController::class, 'anularDistribuidor']);
        Route::delete('/liquidaciones-distribuidor/{liquidacionDistribuidor}/soft',         [\App\Http\Controllers\Api\Liq\LiqLiquidacionDistribuidorCicloController::class, 'destroyDistribuidor']);
        Route::patch( '/liquidaciones/{liquidacionCliente}/rechazar',                       [\App\Http\Controllers\Api\Liq\LiqLiquidacionDistribuidorCicloController::class, 'rechazarCliente']);
        Route::delete('/liquidaciones/{liquidacionCliente}/soft',                           [\App\Http\Controllers\Api\Liq\LiqLiquidacionDistribuidorCicloController::class, 'destroyCliente']);
        // BUGFIX 25 Feature 25.3: resumen fiscal para facturar LA → cliente
        Route::get('/facturacion-clientes/{clienteId}/periodo/{periodo}/resumen-fiscal', [LiqExtractosController::class, 'resumenFiscalCliente']);
        // BUGFIX 26 Feature 26.2: split por sucursal con IVA
        Route::get('/facturacion-clientes/{clienteId}/periodo/{periodo}/split-por-sucursal', [LiqExtractosController::class, 'splitPorSucursalCliente']);
        // BUGFIX 28: regenerar estado de cuenta de cliente
        Route::post('/liquidaciones/{liquidacionCliente}/regenerar-estado-cuenta', [LiqExtractosController::class, 'regenerarEstadoCuenta']);
        Route::get('/liquidaciones-distribuidor/{liquidacionDistribuidor}/historial', [LiqDistribuidorLiquidacionesController::class, 'historial']);
        Route::get('/distribuidores/{persona}/historial-auditoria', [LiqDistribuidorLiquidacionesController::class, 'historialDistribuidor']);

        // Estado de Cuenta de Clientes
        Route::get('/estado-cuenta', [LiqEstadoCuentaController::class, 'index']);
        Route::post('/estado-cuenta', [LiqEstadoCuentaController::class, 'store']);
        Route::get('/estado-cuenta/exportar', [LiqEstadoCuentaController::class, 'exportar']);
        Route::get('/estado-cuenta/{estadoCuenta}', [LiqEstadoCuentaController::class, 'show']);
        Route::patch('/estado-cuenta/{estadoCuenta}', [LiqEstadoCuentaController::class, 'update']);
        Route::delete('/estado-cuenta/{estadoCuenta}', [LiqEstadoCuentaController::class, 'destroy']);
        Route::post('/estado-cuenta/{estadoCuenta}/facturar', [LiqEstadoCuentaController::class, 'facturar']);
        Route::post('/estado-cuenta/{estadoCuenta}/cobrar', [LiqEstadoCuentaController::class, 'cobrar']);

        // Jurisdicciones IIBB
        Route::get('/jurisdicciones', [LiqJurisdiccionController::class, 'index']);
        Route::get('/jurisdicciones/sucursal', [LiqJurisdiccionController::class, 'sucursales']);
        Route::post('/jurisdicciones/sucursal', [LiqJurisdiccionController::class, 'store']);

        // ── Módulo de Pagos y Ordenes de Pago ───────────────────────────────
        Route::prefix('pagos')->group(function () {
            // Lectura (cualquier usuario autenticado con acceso a la sección)
            Route::get('/conceptos', [LiqPagosController::class, 'conceptos']);
            Route::get('/conceptos/{concepto}/proximo-numero', [LiqPagosController::class, 'proximoNumero']);
            Route::get('/liquidaciones', [LiqPagosController::class, 'liquidaciones']);
            Route::get('/liquidaciones/exportar', [LiqPagosController::class, 'exportarLiquidaciones']);
            Route::get('/liquidaciones-unificado', [LiqPagosController::class, 'liquidacionesUnificado']);
            Route::get('/factura-distribuidor/{personaId}', [LiqPagosController::class, 'facturaDistribuidor']);
            Route::get('/ordenes', [LiqPagosController::class, 'ordenes']);
            Route::get('/ordenes/exportar', [LiqPagosController::class, 'exportarOrdenes']);
            Route::get('/ordenes/{ordenPago}', [LiqPagosController::class, 'showOrden']);
            Route::get('/ordenes/{ordenPago}/resumen', [LiqPagosController::class, 'resumenOrden']);
            Route::get('/ordenes/{ordenPago}/pdf', [LiqPagosController::class, 'descargarPdf']);
            Route::get('/ordenes/{ordenPago}/transferencias', [LiqPagosController::class, 'transferencias']);
            Route::get('/config-banco', [LiqPagosController::class, 'configBanco']);

            // Escritura (solo Admin / Admin2)
            Route::middleware('admin')->group(function () {
                // Conceptos
                Route::post('/conceptos', [LiqPagosController::class, 'storeConcepto']);
                Route::patch('/conceptos/{concepto}', [LiqPagosController::class, 'updateConcepto']);

                // Validación y preview
                Route::post('/validar-beneficiarios', [LiqPagosController::class, 'validarBeneficiarios']);
                Route::post('/preview', [LiqPagosController::class, 'preview']);

                // Ordenes de pago
                Route::post('/ordenes', [LiqPagosController::class, 'storeOrden']);
                Route::patch('/ordenes/{ordenPago}/estado', [LiqPagosController::class, 'cambiarEstado']);
                Route::delete('/ordenes/{ordenPago}', [LiqPagosController::class, 'destroyOrden']);

                // Transferencias bancarias
                Route::post('/ordenes/{ordenPago}/ejecutar-pago', [LiqPagosController::class, 'ejecutarPago']);
                Route::post('/ordenes/{ordenPago}/reintentar', [LiqPagosController::class, 'reintentar']);

                // Configuración bancaria
                Route::put('/config-banco', [LiqPagosController::class, 'updateConfigBanco']);
                Route::post('/config-banco/test', [LiqPagosController::class, 'testConfigBanco']);
            });
        });
    });

    Route::get('/unidades', [UnidadController::class, 'index']);
    Route::post('/unidades', [UnidadController::class, 'store']);
    Route::get('/unidades/{unidad}', [UnidadController::class, 'show']);
    Route::put('/unidades/{unidad}', [UnidadController::class, 'update']);
    Route::delete('/unidades/{unidad}', [UnidadController::class, 'destroy']);

    Route::get('/usuarios', [UserController::class, 'index']);
    Route::post('/usuarios', [UserController::class, 'store']);
    Route::get('/usuarios/{usuario}', [UserController::class, 'show']);
    Route::put('/usuarios/{usuario}', [UserController::class, 'update']);
    Route::delete('/usuarios/{usuario}', [UserController::class, 'destroy']);
    Route::get('/usuarios/{usuario}/documentos', [UserDocumentController::class, 'index']);
    Route::post('/usuarios/{usuario}/documentos', [UserDocumentController::class, 'store']);
    Route::put('/usuarios/{usuario}/documentos/{documento}', [UserDocumentController::class, 'update']);
    Route::delete('/usuarios/{usuario}/documentos/{documento}', [UserDocumentController::class, 'destroy']);
    Route::get('/usuarios/{usuario}/documentos/{documento}/descargar', [UserDocumentController::class, 'download'])
        ->name('usuarios.documentos.descargar');

    Route::get('/reclamos/meta', [ReclamoController::class, 'meta']);
    Route::get('/distriapp/reclamos', [ReclamoController::class, 'distriappIndex']);
    Route::get('/reclamos', [ReclamoController::class, 'index']);
    Route::post('/reclamos', [ReclamoController::class, 'store']);
    Route::get('/reclamos/{reclamo}', [ReclamoController::class, 'show']);
    Route::patch('/reclamos/{reclamo}/adelanto-status', [ReclamoController::class, 'updateAdelantoStatus']);
    Route::patch('/reclamos/{reclamo}/revision', [ReclamoController::class, 'updateRevision']);
    Route::put('/reclamos/{reclamo}', [ReclamoController::class, 'update']);
    Route::post('/reclamos/{reclamo}', [ReclamoController::class, 'update']);
    Route::delete('/reclamos/{reclamo}', [ReclamoController::class, 'destroy']);
    Route::post('/reclamos/{reclamo}/comments', [ReclamoController::class, 'storeComment']);
    Route::post('/reclamos/{reclamo}/documentos', [ReclamoController::class, 'storeDocument']);
    Route::get('/reclamos/{reclamo}/documentos/{documento}/descargar', [ReclamoController::class, 'downloadDocument']);
    Route::delete('/reclamos/{reclamo}/documentos/{documento}', [ReclamoController::class, 'destroyDocument']);

    Route::get('/notificaciones', [NotificationController::class, 'index']);
    Route::match(['GET', 'POST'], '/notificaciones/eliminadas', [NotificationController::class, 'deletions']);
    Route::post('/notificaciones/{notification}/leer', [NotificationController::class, 'markAsRead']);
    Route::delete('/notificaciones/{notification}', [NotificationController::class, 'destroy']);

    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::match(['GET', 'POST'], '/attendance/logs', [AttendanceController::class, 'index']);
    Route::post('/attendance', [AttendanceController::class, 'store']);
    Route::post('/attendance/import', [AttendanceController::class, 'import']);
    Route::delete('/attendance', [AttendanceController::class, 'clear']);

    Route::get('/workflow-tasks', [WorkflowTaskController::class, 'index']);
    Route::get('/workflow-tasks/export', [WorkflowTaskController::class, 'export']);
    Route::post('/workflow-tasks', [WorkflowTaskController::class, 'store']);
    Route::put('/workflow-tasks/{workflowTask}', [WorkflowTaskController::class, 'update']);
    Route::post('/workflow-tasks/{workflowTask}/status', [WorkflowTaskController::class, 'updateStatus']);
    Route::delete('/workflow-tasks/{workflowTask}', [WorkflowTaskController::class, 'destroy']);
    Route::get('/workflow-tasks/users', [WorkflowTaskController::class, 'users']);

    Route::get('/tickets', [TicketRequestController::class, 'index']);
    Route::post('/tickets', [TicketRequestController::class, 'store']);
    Route::get('/tickets/{ticketRequest}', [TicketRequestController::class, 'show']);
    Route::put('/tickets/{ticketRequest}', [TicketRequestController::class, 'update']);
    Route::get('/tickets/{ticketRequest}/facturas/{index}/descargar', [TicketRequestController::class, 'downloadFactura'])
        ->whereNumber('index')
        ->name('tickets.facturas.download');

    Route::get('/general-info/posts', [GeneralInfoController::class, 'index']);
    Route::post('/general-info/posts', [GeneralInfoController::class, 'store']);
    Route::delete('/general-info/posts/{post}', [GeneralInfoController::class, 'destroy']);

    Route::get('/chat/messages', [ChatMessageController::class, 'index']);
    Route::post('/chat/messages', [ChatMessageController::class, 'store']);
    Route::post('/chat/messages/{messageId}/reactions', [ChatMessageController::class, 'toggleReaction']);
    Route::post('/chat/typing', [ChatMessageController::class, 'heartbeatTyping']);
    Route::get('/nosis/validar-cbu', [NosisController::class, 'validarCbu']);
    Route::get('/nosis/consultar-documento', [NosisController::class, 'consultarDocumento']);
    Route::get('/nosis/auditoria', [NosisController::class, 'auditoria']);

    Route::get('/auditoria', [AuditController::class, 'index']);
    Route::get('/team-groups', [TeamGroupController::class, 'index']);
    Route::post('/team-groups', [TeamGroupController::class, 'store']);
    Route::put('/team-groups/{teamGroup}', [TeamGroupController::class, 'update']);
    Route::delete('/team-groups/{teamGroup}', [TeamGroupController::class, 'destroy']);

    Route::get('/tarifas/imagenes', [TarifaImagenController::class, 'index']);
    Route::get('/tarifas/imagen', [TarifaImagenController::class, 'show']);
    Route::post('/tarifas/imagen', [TarifaImagenController::class, 'store']);
    Route::delete('/tarifas/imagen/{tarifaImagen}', [TarifaImagenController::class, 'destroy']);

    Route::post('/facturas/validar', [\App\Http\Controllers\Api\FacturaAiController::class, 'validar']);


    Route::post('/combustible/extractos/preview', [\App\Http\Controllers\Api\FuelExtractController::class, 'preview']);
    Route::post('/combustible/extractos/process', [\App\Http\Controllers\Api\FuelExtractController::class, 'process']);
    Route::get('/combustible/distribuidores', [\App\Http\Controllers\Api\FuelModuleController::class, 'distributors']);
    Route::post('/combustible/distribuidores', [\App\Http\Controllers\Api\FuelModuleController::class, 'createDistributor']);
    Route::get('/combustible/liquidaciones', [\App\Http\Controllers\Api\FuelModuleController::class, 'liquidaciones']);
    Route::get('/combustible/pendientes', [\App\Http\Controllers\Api\FuelModuleController::class, 'pendientes']);
    Route::get('/combustible/pendientes-distribuidor', [\App\Http\Controllers\Api\FuelModuleController::class, 'pendientesPorDistribuidor']);
    Route::get('/combustible/tardias', [\App\Http\Controllers\Api\FuelModuleController::class, 'tardias']);
    Route::post('/combustible/tardias/{movement}/requiere-ajuste', [\App\Http\Controllers\Api\FuelModuleController::class, 'requiereAjuste']);
    Route::post('/combustible/pendientes/vincular', [\App\Http\Controllers\Api\FuelModuleController::class, 'vincularPendiente']);
    Route::post('/combustible/pendientes/invalidar', [\App\Http\Controllers\Api\FuelModuleController::class, 'invalidarPendiente']);
    Route::post('/combustible/pendientes/vincular-masivo', [\App\Http\Controllers\Api\FuelModuleController::class, 'vincularPendientesMasivo']);
    Route::post('/combustible/pendientes/invalidar-masivo', [\App\Http\Controllers\Api\FuelModuleController::class, 'invalidarPendientesMasivo']);
    Route::get('/combustible/consumos', [\App\Http\Controllers\Api\FuelModuleController::class, 'consumos']);
    Route::delete('/combustible/movimientos', [\App\Http\Controllers\Api\FuelModuleController::class, 'deleteMovimientos']);
    Route::post('/combustible/reportes/draft', [\App\Http\Controllers\Api\FuelReportController::class, 'draft']);
    Route::get('/combustible/reportes/{report}', [\App\Http\Controllers\Api\FuelReportController::class, 'show']);
    Route::post('/combustible/reportes/{report}/ajustes', [\App\Http\Controllers\Api\FuelReportController::class, 'addAdjustment']);
    Route::post('/combustible/reportes/{report}/guardar', [\App\Http\Controllers\Api\FuelReportController::class, 'saveDraft']);
    Route::post('/combustible/reportes/{report}/listo', [\App\Http\Controllers\Api\FuelReportController::class, 'markReady']);
    Route::post('/combustible/reportes/{report}/aplicar', [\App\Http\Controllers\Api\FuelReportController::class, 'apply']);
    Route::post('/combustible/reportes/seleccion', [\App\Http\Controllers\Api\FuelReportController::class, 'applySelection']);
    Route::post('/combustible/cierre', [\App\Http\Controllers\Api\FuelReportController::class, 'closePeriod']);
    Route::get('/combustible/reportes-globales', [\App\Http\Controllers\Api\FuelReportController::class, 'globalReports']);
    Route::post('/personal/{persona}/liquidaciones/{documento}/ajustes', [\App\Http\Controllers\Api\PersonalDocumentController::class, 'addLiquidacionAdjustment']);
    Route::get('/distriapp/resumen', [DistriappController::class, 'resumen']);
    Route::get('/distriapp/mobile/overview', [DistriappController::class, 'mobileOverview']);
    Route::get('/distriapp/mobile/module/{module}', [DistriappController::class, 'mobileModule']);

    Route::post('/calls/token', [CallController::class, 'token'])->middleware('throttle:20,1');
    Route::post('/calls/anura/click2dial', [CallController::class, 'anuraClickToDial'])->middleware('throttle:20,1');
    Route::post('/calls/whatsapp/start', [CallController::class, 'whatsappStart'])->middleware('throttle:20,1');
    Route::get('/calls/webrtc/config', [CallController::class, 'webrtcConfig'])->middleware('throttle:30,1');
    Route::get('/calls/sessions', [CallController::class, 'index'])->middleware('throttle:30,1');
    Route::post('/calls/sessions', [CallController::class, 'store'])->middleware('throttle:20,1');
    Route::get('/calls/sessions/{session}', [CallController::class, 'show'])->middleware('throttle:60,1');
    Route::patch('/calls/sessions/{session}', [CallController::class, 'update'])->middleware('throttle:30,1');
    Route::get('/calls/sessions/{session}/webrtc/sync', [CallController::class, 'webrtcSync'])->middleware('throttle:120,1');
    Route::post('/calls/sessions/{session}/webrtc/offer', [CallController::class, 'webrtcOffer'])->middleware('throttle:120,1');
    Route::post('/calls/sessions/{session}/webrtc/answer', [CallController::class, 'webrtcAnswer'])->middleware('throttle:120,1');
    Route::post('/calls/sessions/{session}/webrtc/candidate', [CallController::class, 'webrtcCandidate'])->middleware('throttle:240,1');
    Route::post('/calls/sessions/{session}/hangup', [CallController::class, 'hangup'])->middleware('throttle:60,1');
});

Route::post('/voice/twilio/status', [CallController::class, 'twilioStatusWebhook'])
    ->name('voice.twilio.status')
    ->middleware('throttle:120,1');
Route::post('/voice/anura/status', [CallController::class, 'anuraStatusWebhook'])
    ->name('voice.anura.status')
    ->middleware('throttle:120,1');
Route::match(['GET', 'POST'], '/voice/twilio/twiml/outbound', [CallController::class, 'twilioOutboundTwiml'])
    ->name('voice.twilio.twiml.outbound')
    ->middleware('throttle:120,1');

// ── DistriApp API Read-Only (/api/distriapp/readonly/*) ─────────────
Route::prefix('distriapp/readonly')->middleware(['distriapp.readonly', 'throttle:60,1'])->group(function () {
    Route::get('/dashboard', [DistriappReadonlyController::class, 'dashboard']);
    Route::get('/activos', [DistriappReadonlyController::class, 'activos']);
    Route::get('/pre-activos', [DistriappReadonlyController::class, 'preActivos']);
    Route::get('/pausados', [DistriappReadonlyController::class, 'pausados']);
    Route::get('/no-citados', [DistriappReadonlyController::class, 'noCitados']);
    Route::get('/sin-estado', [DistriappReadonlyController::class, 'sinEstado']);
    Route::get('/bajas', [DistriappReadonlyController::class, 'bajas']);
    Route::get('/semanas', [DistriappReadonlyController::class, 'semanas']);
    Route::get('/cierres-diarios', [DistriappReadonlyController::class, 'cierresDiarios']);
    Route::get('/cierres-diarios/fechas', [DistriappReadonlyController::class, 'cierresFechas']);
    Route::get('/buscar-persona', [DistriappReadonlyController::class, 'buscarPersona']);
    Route::get('/persona/{personaId}/documentos', [DistriappReadonlyController::class, 'personaDocumentos']);
    Route::get('/persona/{personaId}/historial', [DistriappReadonlyController::class, 'personaHistorial']);
    Route::get('/documentos-vencidos', [DistriappReadonlyController::class, 'documentosVencidos']);
    Route::get('/vencimientos', [DistriappReadonlyController::class, 'vencimientos']);
    Route::get('/tipos-documento', [DistriappReadonlyController::class, 'tiposDocumento']);
});

Route::options('/{any}', fn () => response()->noContent())->where('any', '.*');
