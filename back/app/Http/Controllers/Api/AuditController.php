<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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

        $logs = $query->limit($limit)->get()->map(function (AuditLog $log) {
            return [
                'id' => $log->id,
                'action' => $log->action,
                'entityType' => $log->entity_type,
                'entityId' => $log->entity_id,
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
