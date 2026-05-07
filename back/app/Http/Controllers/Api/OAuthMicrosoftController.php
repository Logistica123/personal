<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Polizas\OAuthMicrosoftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * ADDENDUM 9 Parte A — endpoints del flow OAuth de Outlook.
 *
 *  - GET  /api/oauth/microsoft/authorize  (auth)  inicia el flow, redirige a Microsoft.
 *  - GET  /api/oauth/microsoft/callback   (NO auth, recibe state) callback de Microsoft.
 *  - POST /api/oauth/microsoft/unlink     (auth)  desvincula la cuenta del admin.
 *  - GET  /api/oauth/microsoft/status     (auth)  estado de vinculación del admin actual.
 */
class OAuthMicrosoftController extends Controller
{
    public function __construct(private readonly OAuthMicrosoftService $oauth)
    {
    }

    /**
     * Genera la URL de Microsoft y redirige al admin.
     */
    public function authorize(Request $request): RedirectResponse|JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }
        $url = $this->oauth->getAuthorizeUrl($user);
        return redirect()->away($url);
    }

    /**
     * Microsoft redirige acá con `?code=...&state=...` (o `?error=...` si falla).
     * Validamos state, intercambiamos tokens y volvemos al frontend con un flag.
     */
    public function callback(Request $request): RedirectResponse
    {
        $frontend = config('services.microsoft.frontend_redirect');

        if ($error = $request->query('error')) {
            return redirect()->away($frontend . '?ok=0&error=' . urlencode($error));
        }

        $code = (string) $request->query('code', '');
        $state = (string) $request->query('state', '');
        if (!$code || !$state) {
            return redirect()->away($frontend . '?ok=0&error=missing_code_or_state');
        }

        try {
            $acc = $this->oauth->exchangeCode($code, $state);
        } catch (\Throwable $e) {
            return redirect()->away($frontend . '?ok=0&error=' . urlencode($e->getMessage()));
        }

        return redirect()->away($frontend . '?ok=1&email=' . urlencode((string) $acc->ms_account_email));
    }

    /** Borra la cuenta vinculada del admin actual. */
    public function unlink(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }
        $acc = $this->oauth->findByUser($user);
        if ($acc) {
            $acc->delete();
        }
        return response()->json(['data' => ['unlinked' => true]]);
    }

    /**
     * Estado de vinculación del admin actual: si tiene cuenta, su email,
     * cuándo expira el token, si está activa.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }
        $acc = $this->oauth->findByUser($user);
        if (!$acc) {
            return response()->json(['data' => ['vinculado' => false]]);
        }
        return response()->json(['data' => [
            'vinculado'         => true,
            'activo'            => (bool) $acc->activo,
            'email'             => $acc->ms_account_email,
            'token_expires_at'  => $acc->token_expires_at?->toIso8601String(),
            'last_refresh_at'   => $acc->last_refresh_at?->toIso8601String(),
            'last_error'        => $acc->last_error,
            'scope'             => $acc->scope,
        ]]);
    }
}
