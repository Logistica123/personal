<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolizaAdminEmailAccount;
use App\Models\PolizaAdminPermiso;
use App\Models\PolizaSolicitudEmail;
use App\Models\PolizaSolicitudEmailAdjunto;
use App\Services\Polizas\InboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * ADDENDUM 13 Parte D — Inbox de respuestas de aseguradoras.
 *
 * Endpoints:
 *   GET    /api/polizas/inbox                                  lista emails recibidos (con filtros)
 *   GET    /api/polizas/inbox/{email}                          detalle email + adjuntos
 *   GET    /api/polizas/inbox/adjuntos/{adjunto}/descargar     stream del PDF
 *   POST   /api/polizas/inbox/adjuntos/{adjunto}/guardar-endoso  vincula adjunto a polizas_endosos
 *   POST   /api/polizas/inbox/sincronizar                      fuerza sync inmediata (de la cuenta del user)
 *   POST   /api/polizas/inbox/{email}/marcar-procesado         flag manual
 *
 * Acceso:
 *   - Por defecto el user solo ve emails de SUS propias solicitudes.
 *   - Si tiene `puede_ver_inbox_otros_admins=true`, ve los de toda la organización.
 */
class PolizaInboxController extends Controller
{
    public function __construct(private readonly InboxService $inbox)
    {
    }

    /**
     * GET /api/polizas/inbox
     * Filtros: ?solicitud_id=, ?poliza_id=, ?direccion=enviado|recibido,
     *          ?con_adjuntos=1, ?endosos_no_vinculados=1, ?desde=, ?hasta=,
     *          ?search=, ?limit=200
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $q = PolizaSolicitudEmail::query()
            ->with([
                'solicitud:id,poliza_id,administrativo_user_id,tipo,estado,fecha_solicitud',
                'solicitud.poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
                'solicitud.poliza.aseguradora:id,nombre',
                'adjuntos:id,email_id,nombre_archivo,mime_type,tamano_bytes,es_endoso,endoso_id',
            ])
            ->orderByDesc('fecha_email');

        // Scope por permiso: si NO puede ver de otros admins, restringir.
        if (!$this->puedeVerOtros($user)) {
            $q->whereHas('solicitud', fn ($s) => $s->where('administrativo_user_id', $user->id));
        }

        if ($request->filled('solicitud_id')) {
            $q->where('solicitud_id', (int) $request->input('solicitud_id'));
        }
        if ($request->filled('poliza_id')) {
            $q->whereHas('solicitud', fn ($s) => $s->where('poliza_id', (int) $request->input('poliza_id')));
        }
        if ($request->filled('direccion') && in_array($request->input('direccion'), ['enviado', 'recibido'], true)) {
            $q->where('direccion', $request->input('direccion'));
        }
        if ($request->boolean('con_adjuntos')) {
            $q->where('tiene_adjuntos', true);
        }
        if ($request->boolean('endosos_no_vinculados')) {
            $q->whereHas('adjuntos', fn ($a) => $a->where('es_endoso', true)->whereNull('endoso_id'));
        }
        if ($request->filled('desde')) {
            $q->where('fecha_email', '>=', $request->input('desde'));
        }
        if ($request->filled('hasta')) {
            $q->where('fecha_email', '<=', $request->input('hasta') . ' 23:59:59');
        }
        if ($request->filled('search')) {
            $s = '%' . trim($request->input('search')) . '%';
            $q->where(function ($qq) use ($s) {
                $qq->where('asunto', 'like', $s)
                   ->orWhere('de_email', 'like', $s)
                   ->orWhere('de_nombre', 'like', $s)
                   ->orWhere('body_preview', 'like', $s);
            });
        }

        $limit = (int) min($request->input('limit', 200), 1000);
        $rows = $q->limit($limit)->get()->map(fn ($e) => $this->serializarEmail($e));

        return response()->json(['data' => $rows]);
    }

    /**
     * GET /api/polizas/inbox/{email}
     */
    public function show(Request $request, PolizaSolicitudEmail $email): JsonResponse
    {
        $this->autorizarVer($request, $email);

        $email->load([
            'solicitud:id,poliza_id,administrativo_user_id,tipo,estado,fecha_solicitud',
            'solicitud.poliza:id,nombre_descriptivo,numero_poliza,aseguradora_id',
            'solicitud.poliza.aseguradora:id,nombre',
            'adjuntos',
        ]);

        $payload = $this->serializarEmail($email);
        $payload['body_completo'] = $email->body_completo;

        return response()->json(['data' => $payload]);
    }

    /**
     * GET /api/polizas/inbox/adjuntos/{adjunto}/descargar
     * Stream del PDF (descarga lazy desde Graph si no estaba cacheado).
     */
    public function descargarAdjunto(Request $request, PolizaSolicitudEmailAdjunto $adjunto): StreamedResponse
    {
        $email = $adjunto->email;
        abort_if(!$email, 404, 'Email asociado no encontrado.');
        $this->autorizarVer($request, $email);

        $cuenta = PolizaAdminEmailAccount::query()
            ->where('user_id', $email->solicitud->administrativo_user_id)
            ->where('activo', true)
            ->first();
        abort_if(!$cuenta, 422, 'La cuenta OAuth del admin que envió la solicitud no está activa.');

        $bytes = $this->inbox->obtenerContenidoAdjunto($cuenta, $adjunto);

        return response()->stream(function () use ($bytes) {
            echo $bytes;
        }, 200, [
            'Content-Type'        => $adjunto->mime_type ?: 'application/octet-stream',
            'Content-Length'      => (string) strlen($bytes),
            'Content-Disposition' => 'inline; filename="' . addslashes($adjunto->nombre_archivo) . '"',
        ]);
    }

    /**
     * POST /api/polizas/inbox/adjuntos/{adjunto}/guardar-endoso
     * Vincula manualmente el adjunto como endoso (idempotente).
     */
    public function guardarEndoso(Request $request, PolizaSolicitudEmailAdjunto $adjunto): JsonResponse
    {
        $email = $adjunto->email;
        abort_if(!$email, 404, 'Email asociado no encontrado.');
        $this->autorizarVer($request, $email);

        $solicitud = $email->solicitud;
        abort_if(!$solicitud, 422, 'Email sin solicitud asociada.');

        $cuenta = PolizaAdminEmailAccount::query()
            ->where('user_id', $solicitud->administrativo_user_id)
            ->where('activo', true)
            ->first();
        abort_if(!$cuenta, 422, 'La cuenta OAuth del admin que envió la solicitud no está activa.');

        $endoso = $this->inbox->vincularAdjuntoComoEndoso($cuenta, $adjunto, $solicitud);
        $adjunto->refresh();

        return response()->json([
            'data' => [
                'adjunto_id' => $adjunto->id,
                'endoso_id'  => $endoso->id,
                'numero_endoso' => $endoso->numero_endoso,
            ],
        ]);
    }

    /**
     * POST /api/polizas/inbox/sincronizar
     * Fuerza sync inmediata. Por default sincroniza la cuenta del user
     * autenticado; si admin con `puede_ver_inbox_otros_admins`, puede
     * pasar `?cuenta_id=` o `?todas=1` para barrer todas las cuentas.
     */
    public function sincronizar(Request $request): JsonResponse
    {
        $user = $request->user();
        $puedeVerOtros = $this->puedeVerOtros($user);

        if ($request->boolean('todas')) {
            abort_unless($puedeVerOtros, 403, 'Sin permiso para sincronizar todas las cuentas.');
            $cuentas = PolizaAdminEmailAccount::query()->where('activo', true)->get();
        } elseif ($request->filled('cuenta_id')) {
            abort_unless($puedeVerOtros, 403, 'Sin permiso para sincronizar otra cuenta.');
            $cuentas = PolizaAdminEmailAccount::query()
                ->where('id', (int) $request->input('cuenta_id'))->get();
        } else {
            $cuentas = PolizaAdminEmailAccount::query()
                ->where('user_id', $user->id)->where('activo', true)->get();
        }

        if ($cuentas->isEmpty()) {
            return response()->json([
                'data' => [
                    'cuentas_procesadas' => 0,
                    'mensaje' => 'No hay cuentas OAuth activas para sincronizar.',
                ],
            ]);
        }

        $totales = ['procesadas' => 0, 'mensajes_nuevos' => 0, 'adjuntos_nuevos' => 0, 'errores' => []];
        foreach ($cuentas as $cuenta) {
            $r = $this->inbox->sincronizarCuenta($cuenta);
            $totales['procesadas']      += $r['procesadas'];
            $totales['mensajes_nuevos'] += $r['mensajes_nuevos'];
            $totales['adjuntos_nuevos'] += $r['adjuntos_nuevos'];
            foreach ($r['errores'] as $err) {
                $totales['errores'][] = "{$cuenta->ms_account_email}: {$err}";
            }
        }

        return response()->json(['data' => array_merge(['cuentas_procesadas' => $cuentas->count()], $totales)]);
    }

    /**
     * POST /api/polizas/inbox/{email}/marcar-procesado
     * Toggle manual del flag `procesado`.
     */
    public function marcarProcesado(Request $request, PolizaSolicitudEmail $email): JsonResponse
    {
        $this->autorizarVer($request, $email);
        $procesado = (bool) $request->input('procesado', true);
        $email->update(['procesado' => $procesado]);
        return response()->json(['data' => ['id' => $email->id, 'procesado' => $procesado]]);
    }

    private function puedeVerOtros($user): bool
    {
        if (!$user) return false;
        if (($user->role ?? null) === 'admin') return true;
        $perm = PolizaAdminPermiso::query()->where('user_id', $user->id)->first();
        return (bool) ($perm?->puede_ver_inbox_otros_admins ?? false);
    }

    private function autorizarVer(Request $request, PolizaSolicitudEmail $email): void
    {
        $user = $request->user();
        if ($this->puedeVerOtros($user)) return;
        $admin = $email->solicitud?->administrativo_user_id;
        abort_unless($admin === $user?->id, 403, 'No autorizado a ver este email.');
    }

    private function serializarEmail(PolizaSolicitudEmail $e): array
    {
        return [
            'id'                => $e->id,
            'solicitud_id'      => $e->solicitud_id,
            'direccion'         => $e->direccion,
            'fecha_email'       => $e->fecha_email?->toIso8601String(),
            'de_email'          => $e->de_email,
            'de_nombre'         => $e->de_nombre,
            'para_emails'       => $e->para_emails,
            'cc_emails'         => $e->cc_emails,
            'asunto'            => $e->asunto,
            'body_preview'      => $e->body_preview,
            'tiene_adjuntos'    => $e->tiene_adjuntos,
            'procesado'         => $e->procesado,
            'conversation_id'   => $e->conversation_id,
            'solicitud'         => $e->solicitud ? [
                'id'              => $e->solicitud->id,
                'tipo'            => $e->solicitud->tipo,
                'estado'          => $e->solicitud->estado,
                'fecha_solicitud' => $e->solicitud->fecha_solicitud?->toIso8601String(),
                'poliza'          => $e->solicitud->poliza ? [
                    'id'                 => $e->solicitud->poliza->id,
                    'nombre_descriptivo' => $e->solicitud->poliza->nombre_descriptivo,
                    'numero_poliza'      => $e->solicitud->poliza->numero_poliza,
                    'aseguradora'        => $e->solicitud->poliza->aseguradora?->nombre,
                ] : null,
            ] : null,
            'adjuntos'          => collect($e->adjuntos ?? [])->map(fn ($a) => [
                'id'             => $a->id,
                'nombre_archivo' => $a->nombre_archivo,
                'mime_type'      => $a->mime_type,
                'tamano_bytes'   => $a->tamano_bytes,
                'es_endoso'      => $a->es_endoso,
                'endoso_id'      => $a->endoso_id,
                'descargado'     => !is_null($a->storage_path) || !empty($a->contenido_base64),
            ])->values()->all(),
        ];
    }
}
