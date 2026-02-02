<?php

namespace App\Http\Middleware;

use App\Models\Persona;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractToken($request);

        if ($this->isPublicPersonalLookup($request) || $this->isPublicPersonalUpload($request)) {
            return $next($request);
        }

        if ($this->isPersonalDownloadWithAuthToken($request, $token)) {
            return $next($request);
        }

        if (! $token) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $hashedToken = hash('sha256', $token);
        $user = User::query()->where('remember_token', $hashedToken)->first();

        if (! $user) {
            return response()->json(['message' => 'Sesión inválida o expirada.'], 401);
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }

    private function isPublicPersonalLookup(Request $request): bool
    {
        if (! $request->isMethod('GET')) {
            return false;
        }

        $email = $this->resolveRequestEmail($request);
        if (! $email) {
            return false;
        }

        if ($this->isPersonalPath($request, 'personal') || $this->isPersonalPath($request, 'personal/')) {
            return true;
        }

        if (! $this->isPersonalPath($request, 'personal/*/liquidaciones')
            && ! $this->isPersonalPath($request, 'personal/*/combustible')
            && ! $this->isPersonalPath($request, 'personal/*/combustible-reportes')
            && ! $this->isPersonalPath($request, 'personal/*/combustible-proyeccion')
            && ! $this->isPersonalPath($request, 'personal/*/notificaciones')
            && ! $this->isPersonalPath($request, 'personal/*/documentos/*/descargar')
            && ! $this->isPersonalPath($request, 'personal/*/documentos/*/preview')) {
            return false;
        }

        $persona = $this->resolvePersonaFromRequest($request);

        if (! $persona) {
            return false;
        }

        return $this->personaMatchesEmail($persona, $email);
    }

    private function isPublicPersonalUpload(Request $request): bool
    {
        if (! $request->isMethod('POST')) {
            return false;
        }

        if (! $this->isPersonalPath($request, 'personal/*/documentos')) {
            if (! $this->isPersonalPath($request, 'personal/*/notificaciones/*/read')) {
                return false;
            }
        }

        $email = $this->resolveRequestEmail($request);
        if (! $email) {
            return false;
        }

        $persona = $this->resolvePersonaFromRequest($request);
        if (! $persona) {
            return false;
        }

        return $this->personaMatchesEmail($persona, $email);
    }

    private function isPersonalDownloadWithAuthToken(Request $request, ?string $token): bool
    {
        if (! $request->isMethod('GET')) {
            return false;
        }

        if (! $this->isPersonalPath($request, 'personal/*/documentos/*/descargar')
            && ! $this->isPersonalPath($request, 'personal/*/documentos/*/preview')) {
            return false;
        }

        if (! $token) {
            return false;
        }

        $email = $this->resolveRequestEmail($request);
        if (! $email) {
            return false;
        }

        $persona = $this->resolvePersonaFromRequest($request);
        if (! $persona) {
            return false;
        }

        return $this->personaMatchesEmail($persona, $email);
    }

    private function resolveRequestEmail(Request $request): ?string
    {
        $candidate = $request->input('email');
        if (! is_string($candidate) || trim($candidate) === '') {
            $candidate = $request->header('X-Actor-Email');
        }

        if (! is_string($candidate)) {
            return null;
        }

        $normalized = strtolower(trim($candidate));

        return $normalized !== '' ? $normalized : null;
    }

    private function resolvePersonaFromRequest(Request $request): ?Persona
    {
        $personaParam = $request->route('persona');
        $personaId = null;

        if ($personaParam instanceof Persona) {
            $personaId = $personaParam->id;
        } elseif (is_numeric($personaParam)) {
            $personaId = (int) $personaParam;
        }

        if (! $personaId) {
            return null;
        }

        return Persona::query()
            ->select('id', 'email')
            ->with(['dueno:id,persona_id,email'])
            ->find($personaId);
    }

    private function personaMatchesEmail(Persona $persona, string $email): bool
    {
        $personaEmail = $persona->email ? strtolower(trim($persona->email)) : null;
        if ($personaEmail && $personaEmail === $email) {
            return true;
        }

        $duenoEmail = $persona->dueno?->email ? strtolower(trim($persona->dueno->email)) : null;

        return $duenoEmail && $duenoEmail === $email;
    }

    private function extractToken(Request $request): ?string
    {
        $bearerToken = $request->bearerToken();
        if ($bearerToken) {
            return $bearerToken;
        }

        $queryToken = $request->query('api_token') ?: $request->query('token');
        if ($queryToken) {
            return $queryToken;
        }

        $headerToken = $request->header('X-Api-Token');
        if ($headerToken) {
            return $headerToken;
        }

        $cookieToken = $request->cookie('api_token');

        return $cookieToken ?: null;
    }

    private function isPersonalPath(Request $request, string $pattern): bool
    {
        return $request->is($pattern) || $request->is('api/' . $pattern);
    }
}
