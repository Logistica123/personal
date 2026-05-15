<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\PolizaEmailConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * Bloque C.5 — administrar templates de email por póliza.
 *
 *  - PUT  /api/polizas/{poliza}/email-config/{tipo}  body: { destinatarios_to, body_template, ... }
 *  - POST /api/polizas/email-config/{config}/probar  body: { destinatario_test }
 *
 * El "probar" envía un email con `[PRUEBA]` en el asunto a la casilla de
 * test, sin renderizar asegurados (sirve para validar credenciales SMTP /
 * conectividad sin afectar pólizas reales).
 */
class PolizaEmailConfigController extends Controller
{
    /**
     * Editar template de email para `alta`, `baja` o `combinado` de una póliza.
     *
     * ADDENDUM 16 Parte B: para `combinado` se permite además `crear` la fila
     * (no existe en el seeder de pólizas que aún no soportan combinado).
     * La existencia de la fila + `activo=true` es la señal de "soporta combinado".
     */
    public function update(Request $request, Poliza $poliza, string $tipo): JsonResponse
    {
        if (!in_array($tipo, ['alta', 'baja', 'combinado'], true)) {
            return response()->json(['message' => 'tipo debe ser alta, baja o combinado'], 422);
        }

        $data = $request->validate([
            'destinatarios_to'           => ['nullable', 'array'],
            'destinatarios_to.*'         => ['email'],
            'destinatarios_cc'           => ['nullable', 'array'],
            'destinatarios_cc.*'         => ['email'],
            'destinatarios_bcc'          => ['nullable', 'array'],
            'destinatarios_bcc.*'        => ['email'],
            'contacto_nombre'            => ['nullable', 'string', 'max:100'],
            'asunto_template'            => ['nullable', 'string', 'max:255'],
            'body_template'              => ['nullable', 'string'],
            'asegurado_template'         => ['nullable', 'string'],
            'separador_entre_asegurados' => ['nullable', 'string', 'max:10'],
            'adjuntos_requeridos'        => ['nullable', 'array'],
            'adjuntos_requeridos.*'      => ['string', 'max:50'],
            'activo'                     => ['nullable', 'boolean'],
        ]);

        $config = PolizaEmailConfig::query()
            ->where('poliza_id', $poliza->id)
            ->where('tipo', $tipo)
            ->first();

        if (!$config) {
            // Combinado puede crearse on-demand desde la UI; alta/baja deben
            // venir del seeder (estructura de la póliza).
            if ($tipo !== 'combinado') {
                return response()->json([
                    'message' => "No existe email_config para tipo '{$tipo}' en esta póliza. " .
                                 "Las configs base se crean con el seeder; pedile al admin que la genere si falta.",
                ], 404);
            }
            $config = new PolizaEmailConfig([
                'poliza_id' => $poliza->id,
                'tipo'      => 'combinado',
                'activo'    => true,
            ]);
        }

        $config->fill(array_filter($data, fn ($v) => $v !== null))->save();

        return response()->json(['data' => $config->fresh()]);
    }

    /**
     * Envía un email de prueba a una casilla específica usando los destinatarios
     * configurados como CC. El "to" se reemplaza por la casilla de test para no
     * spamear a la aseguradora real. NO usa OAuth — siempre va por SMTP para
     * que el test sea independiente del estado de OAuth.
     */
    public function probar(Request $request, PolizaEmailConfig $config): JsonResponse
    {
        $data = $request->validate([
            'destinatario_test' => ['required', 'email'],
        ]);

        $asunto = '[PRUEBA] ' . str_replace('{numero_poliza}', $config->poliza?->numero_poliza ?? '?', $config->asunto_template ?? 'Test');
        $body = "Este es un email de PRUEBA enviado desde DistriApp.\n\n"
            . "Póliza: {$config->poliza?->nombre_descriptivo}\n"
            . "Tipo template: {$config->tipo}\n"
            . "Si recibís este mensaje, la configuración SMTP del módulo Pólizas funciona.\n";

        Mail::raw($body, function ($mail) use ($asunto, $data) {
            $mail->subject($asunto);
            $mail->to($data['destinatario_test']);
        });

        return response()->json(['data' => [
            'enviado_a' => $data['destinatario_test'],
            'asunto'    => $asunto,
        ]]);
    }
}
