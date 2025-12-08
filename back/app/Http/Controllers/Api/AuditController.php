<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->input('limit', 200), 500));
        $query = AuditLog::query()->orderByDesc('id');

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('entityType')) {
            $query->where('entity_type', $request->input('entityType'));
        }

        if ($request->filled('entityId')) {
            $query->where('entity_id', (int) $request->input('entityId'));
        }

        if ($request->filled('actorEmail')) {
            $email = trim((string) $request->input('actorEmail'));
            if ($email !== '') {
                $query->where('actor_email', 'like', '%' . $email . '%');
            }
        }

        if ($request->filled('actorName')) {
            $name = trim((string) $request->input('actorName'));
            if ($name !== '') {
                $query->where('actor_name', 'like', '%' . $name . '%');
            }
        }

        if ($request->filled('agentName')) {
            $agentName = trim((string) $request->input('agentName'));
            if ($agentName !== '') {
                $matchingAgents = User::query()
                    ->select('id', 'name', 'email')
                    ->where('name', 'like', '%' . $agentName . '%')
                    ->orWhere('email', 'like', '%' . $agentName . '%')
                    ->get();

                $agentIds = $matchingAgents->pluck('id')->filter()->all();
                $agentEmails = $matchingAgents
                    ->pluck('email')
                    ->filter()
                    ->map(fn ($email) => strtolower(trim($email)))
                    ->all();

                if (empty($agentIds) && empty($agentEmails)) {
                    return response()->json(['data' => collect()]);
                }

                $query->where(function ($subQuery) use ($agentName, $agentIds, $agentEmails) {
                    $subQuery->where('actor_name', 'like', '%' . $agentName . '%');
                    if (! empty($agentIds)) {
                        $subQuery->orWhereIn('user_id', $agentIds);
                    }
                    if (! empty($agentEmails)) {
                        $subQuery->orWhereIn('actor_email', $agentEmails);
                    }
                });
            }
        }

        $logs = $query->limit($limit)->get();

        $userIds = $logs->pluck('user_id')->filter()->unique()->values();
        $userEmails = $logs->pluck('actor_email')->filter()->unique()->values();
        $users = collect();

        if ($userIds->isNotEmpty() || $userEmails->isNotEmpty()) {
            $users = User::query()
                ->select('id', 'name', 'email')
                ->where(function ($query) use ($userIds, $userEmails) {
                    if ($userIds->isNotEmpty()) {
                        $query->whereIn('id', $userIds);
                    }

                    if ($userEmails->isNotEmpty()) {
                        $method = $userIds->isNotEmpty() ? 'orWhereIn' : 'whereIn';
                        $query->{$method}('email', $userEmails);
                    }
                })
                ->get();
        }

        $logs = $logs->map(function (AuditLog $log) use ($users) {
            $matchedUser = $users->first(function (User $user) use ($log) {
                if ($log->user_id && $user->id === $log->user_id) {
                    return true;
                }
                if ($log->actor_email && $user->email && strtolower($user->email) === strtolower($log->actor_email)) {
                    return true;
                }

                return false;
            });

            return [
                'id' => $log->id,
                'action' => $log->action,
                'entityType' => $log->entity_type,
                'entityId' => $log->entity_id,
                'agentId' => $matchedUser?->id,
                'agentName' => $matchedUser?->name ?? $log->actor_name,
                'actorEmail' => $log->actor_email,
                'actorName' => $log->actor_name,
                'metadata' => $log->metadata,
                'ipAddress' => $log->ip_address,
                'userAgent' => $log->user_agent,
                'createdAt' => optional($log->created_at)->toDateTimeString(),
            ];
        });

        return response()->json([
            'data' => $logs,
        ]);
    }
}
