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

        $actorEmail = $this->resolveRequestActorEmail($request);
        $actorCuil = $this->resolveRequestActorCuil($request);

        if (! $actorEmail && ! $actorCuil) {
            return false;
        }

        if ($this->isPersonalPath($request, 'personal') || $this->isPersonalPath($request, 'personal/')) {
            // Por compatibilidad, el lookup público global sigue siendo solo por email.
            return (bool) $actorEmail;
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

        if ($actorEmail && $this->personaMatchesEmail($persona, $actorEmail)) {
            return true;
        }

        return $actorCuil && $this->personaMatchesCuil($persona, $actorCuil);
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

        $actorEmail = $this->resolveRequestActorEmail($request);
        if (! $actorEmail) {
            return false;
        }

        $persona = $this->resolvePersonaFromRequest($request);
        if (! $persona) {
            return false;
        }

        return $this->personaMatchesEmail($persona, $actorEmail);
    }

    private function resolveRequestActorEmail(Request $request): ?string
    {
        $candidate = $request->input('email');
        if (! is_string($candidate) || trim($candidate) === '') {
            $candidate = $request->header('X-Actor-Email');
        }

        if (! is_string($candidate)) {
            return null;
        }

        $normalized = strtolower(trim($candidate));
        if ($normalized === '' || ! str_contains($normalized, '@')) {
            return null;
        }

        return $normalized;
    }

    private function resolveRequestActorCuil(Request $request): ?string
    {
        $candidate = $request->input('cuil');
        if (! is_string($candidate) || trim($candidate) === '') {
            $candidate = $request->header('X-Actor-Cuil');
        }

        if (! is_string($candidate) || trim($candidate) === '') {
            $candidate = $request->input('email');
            if (! is_string($candidate) || trim($candidate) === '') {
                $candidate = $request->header('X-Actor-Email');
            }
        }

        if (! is_string($candidate)) {
            return null;
        }

        return $this->normalizeCuil($candidate);
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
            ->select('id', 'email', 'cobrador_email', 'cuil', 'cobrador_cuil')
            ->with(['dueno:id,persona_id,email,cuil,cuil_cobrador'])
            ->find($personaId);
    }

    private function personaMatchesEmail(Persona $persona, string $email): bool
    {
        $personaEmail = $persona->email ? strtolower(trim($persona->email)) : null;
        if ($personaEmail && $personaEmail === $email) {
            return true;
        }

        $cobradorEmail = $persona->cobrador_email ? strtolower(trim($persona->cobrador_email)) : null;
        if ($cobradorEmail && $cobradorEmail === $email) {
            return true;
        }

        $duenoEmail = $persona->dueno?->email ? strtolower(trim($persona->dueno->email)) : null;

        return $duenoEmail && $duenoEmail === $email;
    }

    private function personaMatchesCuil(Persona $persona, string $cuil): bool
    {
        $personaCuil = $this->normalizeCuil($persona->cuil);
        if ($personaCuil && $personaCuil === $cuil) {
            return true;
        }

        $cobradorCuil = $this->normalizeCuil($persona->cobrador_cuil);
        if ($cobradorCuil && $cobradorCuil === $cuil) {
            return true;
        }

        $duenoCuil = $this->normalizeCuil($persona->dueno?->cuil);
        if ($duenoCuil && $duenoCuil === $cuil) {
            return true;
        }

        $duenoCuilCobrador = $this->normalizeCuil($persona->dueno?->cuil_cobrador);

        return $duenoCuilCobrador && $duenoCuilCobrador === $cuil;
    }

    private function normalizeCuil($value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $digits = preg_replace('/\\D+/', '', (string) $value);
        if (! is_string($digits)) {
            return null;
        }

        $digits = trim($digits);
        if ($digits === '' || strlen($digits) !== 11) {
            return null;
        }

        return $digits;
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
