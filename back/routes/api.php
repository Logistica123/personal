<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatMessageController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\UnidadController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PersonalController;
use App\Http\Controllers\Api\ReclamoController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PersonalDocumentController;
use App\Http\Controllers\Api\PersonalCommentController;
use App\Http\Controllers\Api\AttendanceController;
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
use App\Http\Controllers\Api\LiquidacionRunController;
use App\Http\Controllers\Api\UserDocumentController;
use App\Http\Controllers\Api\CallController;
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
    Route::get('/personal/{persona}/documentos', [PersonalDocumentController::class, 'index']);
    Route::post('/personal/{persona}/documentos', [PersonalDocumentController::class, 'store']);
    Route::post('/personal/{persona}/documentos/publicar', [PersonalDocumentController::class, 'publishPending']);
    Route::post('/personal/{persona}/documentos/pagado', [PersonalDocumentController::class, 'updatePagado']);
    Route::post('/documentos/pagado', [PersonalDocumentController::class, 'updatePagadoBulk']);
    Route::put('/personal/{persona}/documentos/{documento}', [PersonalDocumentController::class, 'updateDocument']);
    Route::delete('/personal/{persona}/documentos/{documento}', [PersonalDocumentController::class, 'destroy']);
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
    Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);
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
    Route::get('/liquidaciones/runs', [LiquidacionRunController::class, 'index']);
    Route::post('/liquidaciones/runs/upload-preview', [LiquidacionRunController::class, 'uploadPreview']);
    Route::post('/liquidaciones/runs/upload', [LiquidacionRunController::class, 'upload']);
    Route::post('/liquidaciones/runs', [LiquidacionRunController::class, 'store']);
    Route::get('/liquidaciones/runs/{run}', [LiquidacionRunController::class, 'show']);
    Route::delete('/liquidaciones/runs/{run}', [LiquidacionRunController::class, 'destroy']);
    Route::post('/liquidaciones/runs/{run}/upsert', [LiquidacionRunController::class, 'upsert']);
    Route::post('/liquidaciones/runs/{run}/approve', [LiquidacionRunController::class, 'approve']);
    Route::post('/liquidaciones/runs/{run}/sync-personal', [LiquidacionRunController::class, 'syncToPersonal']);
    Route::post('/liquidaciones/runs/{run}/publicar-erp', [LiquidacionRunController::class, 'publishToErp']);
    Route::get('/liquidaciones/reglas-template', [LiquidacionRunController::class, 'rulesTemplate']);
    Route::get('/liquidaciones/reglas-cliente/{clientCode}', [LiquidacionRunController::class, 'showClientRules']);
    Route::put('/liquidaciones/reglas-cliente/{clientCode}', [LiquidacionRunController::class, 'upsertClientRules']);
    Route::post('/liquidaciones/reglas-cliente/{clientCode}', [LiquidacionRunController::class, 'upsertClientRules']);
    Route::get('/liquidaciones/proveedores/buscar', [LiquidacionRunController::class, 'searchProviders']);
    Route::post('/liquidaciones/importaciones', [LiquidacionRunController::class, 'createImportacion']);
    Route::get('/liquidaciones/importaciones/{run}/preview', [LiquidacionRunController::class, 'previewImportacion']);
    Route::post('/liquidaciones/importaciones/{run}/asignar-proveedor', [LiquidacionRunController::class, 'assignImportacionProvider']);
    Route::post('/liquidaciones/importaciones/{run}/approve', [LiquidacionRunController::class, 'approveImportacion']);
    Route::post('/liquidaciones/importaciones/{run}/publish', [LiquidacionRunController::class, 'publishImportacion']);
    Route::get('/liquidaciones/distribuidores/{distribuidor}', [LiquidacionRunController::class, 'showDistribuidor']);
    Route::patch('/liquidaciones/distribuidores/{distribuidor}', [LiquidacionRunController::class, 'updateDistribuidor']);
    Route::patch('/liquidaciones/lineas/{linea}', [LiquidacionRunController::class, 'updateLinea']);
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

Route::options('/{any}', fn () => response()->noContent())->where('any', '.*');
