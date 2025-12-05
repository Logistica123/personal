<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function log(
        Request $request,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        array $metadata = []
    ): AuditLog {
        $user = $request->user();
        $actorEmail = static::resolveActorEmail($request, $user);
        $actorName = $user?->name;

        return AuditLog::create([
            'user_id' => $user?->id,
            'actor_email' => $actorEmail,
            'actor_name' => $actorName,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    public static function resolveActorEmail(Request $request, ?User $user = null): ?string
    {
        $candidates = [
            $request->header('X-Actor-Email'),
            $request->input('actorEmail'),
            $request->input('userEmail'),
            $request->input('email'),
            $user?->email,
        ];

        foreach ($candidates as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }

            $normalized = strtolower(trim($candidate));
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }
}
