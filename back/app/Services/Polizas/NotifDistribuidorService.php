<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaNotifDistribuidorConfig;
use App\Models\PolizaNotificacionDistribuidor;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

/**
 * ADDENDUM 13B — Detecta altas pendientes de notificar y envía emails.
 *
 *  - `altasNuevasPendientes()` lista los asegurados activos con persona+email y
 *    sin notificación previa de tipo='alta'.
 *  - `enviar()` crea registros en `polizas_notificaciones_distribuidor` y manda
 *    el email vía SMTP (driver `log` en dev → loggea pero no manda).
 *
 * Templates por póliza viven en `polizas_notif_distribuidor_config`. Default
 * razonable si no hay config — devuelve un template hard-coded.
 */
class NotifDistribuidorService
{
    private const ASUNTO_DEFAULT = 'Alta en póliza {numero_poliza} - {aseguradora}';
    private const BODY_DEFAULT = "Hola {nombre_apellido},\n\nTe informamos que fuiste dado de alta en la póliza de {ramo} con la aseguradora {aseguradora}, póliza N° {numero_poliza}, con vigencia desde {fecha_alta_efectiva}.\n\nYa estás cubierto. Si tenés alguna duda escribinos a {email_admin}.\n\nSaludos,\nLogística Argentina S.R.L.";

    /**
     * Asegurados activos con persona y email cargado, que no tienen notificación
     * previa de tipo='alta' (en estado 'enviado'). Los que ya rebotaron pueden re-notificarse.
     *
     * @return Collection<int,PolizaAsegurado>
     */
    public function altasNuevasPendientes(Poliza $poliza): Collection
    {
        // IDs ya notificados con éxito (estado=enviado).
        $yaNotificados = PolizaNotificacionDistribuidor::query()
            ->where('poliza_id', $poliza->id)
            ->where('tipo', 'alta')
            ->where('estado', 'enviado')
            ->pluck('asegurado_id');

        return PolizaAsegurado::query()
            ->where('poliza_id', $poliza->id)
            ->where('estado', 'activo')
            ->whereNotNull('persona_id')
            ->whereNotIn('id', $yaNotificados)
            ->with('persona:id,apellidos,nombres,cuil,email')
            ->orderBy('id')
            ->get();
    }

    /**
     * Renderiza preview SIN crear registros ni enviar.
     *
     * @return array{altas_nuevas: array, template_preview: array}
     */
    public function preview(Poliza $poliza, User $admin): array
    {
        $config = $this->cargarConfig($poliza);
        $asegurados = $this->altasNuevasPendientes($poliza);

        $altas = $asegurados->map(fn (PolizaAsegurado $a) => [
            'asegurado_id'      => $a->id,
            'persona_id'        => $a->persona_id,
            'nombre_apellido'   => trim(($a->persona?->apellidos ?? '') . ' ' . ($a->persona?->nombres ?? '')),
            'email'             => $a->persona?->email,
            'puede_notificar'   => !empty($a->persona?->email),
            'razon'             => empty($a->persona?->email) ? 'sin_email' : null,
        ])->all();

        // Preview con datos del primer asegurado notificable.
        $primero = $asegurados->first(fn ($a) => !empty($a->persona?->email));
        $templatePreview = ['asunto' => '', 'body' => ''];
        if ($primero) {
            $rendered = $this->renderEmail($poliza, $primero, $config, $admin);
            $templatePreview = ['asunto' => $rendered['asunto'], 'body' => $rendered['body']];
        }

        return [
            'altas_nuevas'     => $altas,
            'template_preview' => $templatePreview,
        ];
    }

    /**
     * Envía notificaciones a los asegurados indicados (o a todos los pendientes
     * si `$aseguradoIds` está vacío). Devuelve stats.
     *
     * @return array{enviadas:int, fallidas:int, sin_email:int, ids_creados:int[]}
     */
    public function enviar(Poliza $poliza, array $aseguradoIds, User $admin): array
    {
        $config = $this->cargarConfig($poliza);

        $asegurados = $this->altasNuevasPendientes($poliza);
        if (!empty($aseguradoIds)) {
            $asegurados = $asegurados->whereIn('id', $aseguradoIds)->values();
        }

        $enviadas = 0;
        $fallidas = 0;
        $sinEmail = 0;
        $idsCreados = [];

        foreach ($asegurados as $a) {
            $email = $a->persona?->email;
            $rendered = $this->renderEmail($poliza, $a, $config, $admin);

            if (empty($email)) {
                $registro = $this->registrar($poliza, $a, $admin, $rendered, '', 'sin_email');
                $sinEmail++;
                $idsCreados[] = $registro->id;
                continue;
            }

            $registro = $this->registrar($poliza, $a, $admin, $rendered, $email, 'pendiente');
            $idsCreados[] = $registro->id;

            try {
                Mail::raw($rendered['body'], function ($mail) use ($rendered, $email, $admin, $config) {
                    $mail->subject($rendered['asunto'])->to($email);
                    if (!empty($config['cc_admin_email'])) $mail->cc($config['cc_admin_email']);
                    if ($admin->email) $mail->replyTo($admin->email, $admin->name ?: '');
                });
                $registro->update(['estado' => 'enviado', 'enviado_en' => now()]);
                $enviadas++;
            } catch (\Throwable $e) {
                $registro->update(['estado' => 'rebotado', 'error_envio' => $e->getMessage()]);
                $fallidas++;
            }
        }

        return [
            'enviadas'    => $enviadas,
            'fallidas'    => $fallidas,
            'sin_email'   => $sinEmail,
            'ids_creados' => $idsCreados,
        ];
    }

    /** Reenviar una notificación rebotada o pendiente. */
    public function reenviar(PolizaNotificacionDistribuidor $notif, User $admin): PolizaNotificacionDistribuidor
    {
        if (!in_array($notif->estado, ['rebotado', 'pendiente', 'sin_email'], true)) {
            throw new RuntimeException("La notificación #{$notif->id} ya fue enviada con éxito");
        }
        if (empty($notif->email_destinatario)) {
            throw new RuntimeException('Sin email de destinatario — no se puede reenviar');
        }

        try {
            Mail::raw($notif->body, function ($mail) use ($notif, $admin) {
                $mail->subject($notif->asunto)->to($notif->email_destinatario);
                if ($admin->email) $mail->replyTo($admin->email, $admin->name ?: '');
            });
            $notif->update(['estado' => 'enviado', 'enviado_en' => now(), 'error_envio' => null]);
        } catch (\Throwable $e) {
            $notif->update(['estado' => 'rebotado', 'error_envio' => $e->getMessage()]);
        }

        return $notif->fresh();
    }

    private function registrar(
        Poliza $poliza,
        PolizaAsegurado $a,
        User $admin,
        array $rendered,
        string $email,
        string $estado
    ): PolizaNotificacionDistribuidor {
        return PolizaNotificacionDistribuidor::create([
            'asegurado_id'        => $a->id,
            'poliza_id'           => $poliza->id,
            'persona_id'          => $a->persona_id,
            'tipo'                => 'alta',
            'email_destinatario'  => $email,
            'asunto'              => $rendered['asunto'],
            'body'                => $rendered['body'],
            'estado'              => $estado,
            'enviado_por_user_id' => $admin->id,
        ]);
    }

    private function cargarConfig(Poliza $poliza): array
    {
        $cfg = PolizaNotifDistribuidorConfig::query()
            ->where('poliza_id', $poliza->id)
            ->first();

        return [
            'activo'           => $cfg?->activo ?? true,
            'asunto_template'  => $cfg?->asunto_template ?: self::ASUNTO_DEFAULT,
            'body_template'    => $cfg?->body_template   ?: self::BODY_DEFAULT,
            'cc_admin_email'   => $cfg?->cc_admin_email,
        ];
    }

    /** @return array{asunto:string, body:string} */
    private function renderEmail(Poliza $poliza, PolizaAsegurado $a, array $config, User $admin): array
    {
        $nombre = trim(($a->persona?->apellidos ?? '') . ' ' . ($a->persona?->nombres ?? ''));
        if ($a->nombre_apellido_pdf && !$nombre) {
            $nombre = $a->nombre_apellido_pdf;
        }

        $fechaAlta = $a->fecha_alta_efectiva
            ? Carbon::parse($a->fecha_alta_efectiva)->format('d/m/Y')
            : '';

        $reemplazos = [
            '{nombre_apellido}'        => $nombre,
            '{numero_poliza}'          => $poliza->numero_poliza ?? '',
            '{aseguradora}'            => $poliza->aseguradora?->nombre ?? '',
            '{ramo}'                   => $this->ramoLegible($poliza->ramo),
            '{fecha_alta_efectiva}'    => $fechaAlta,
            '{vigencia_hasta}'         => $poliza->vigencia_hasta?->format('d/m/Y') ?? '',
            '{email_admin}'            => $admin->email ?? '',
            '{razon_social_logarg}'    => 'Logística Argentina S.R.L.',
        ];

        return [
            'asunto' => str_replace(array_keys($reemplazos), array_values($reemplazos), $config['asunto_template']),
            'body'   => str_replace(array_keys($reemplazos), array_values($reemplazos), $config['body_template']),
        ];
    }

    private function ramoLegible(?string $ramo): string
    {
        return match ($ramo) {
            'accidentes_personales' => 'Accidentes Personales',
            'vehiculos'             => 'Vehículos',
            default                 => $ramo ?? '',
        };
    }
}
