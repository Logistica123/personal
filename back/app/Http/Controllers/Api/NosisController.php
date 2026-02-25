<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AuditLogger;
use App\Services\NosisClient;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use RuntimeException;

class NosisController extends Controller
{
    public function __construct(private readonly NosisClient $client)
    {
    }

    public function validarCbu(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'documento' => ['required', 'string', 'max:20'],
            'cbu' => ['required', 'digits:22'],
            'grupoVid' => ['nullable', 'integer'],
            'fechaNacimiento' => ['nullable', 'date'],
        ]);

        try {
            $result = $this->client->validateCbu(
                $validated['documento'],
                $validated['cbu'],
                $validated['grupoVid'] ?? null,
                $validated['fechaNacimiento'] ?? null,
            );
        } catch (RuntimeException $e) {
            $this->logConsulta($request, 'CBU', $validated['documento'], false, 'error', [
                'error' => $e->getMessage(),
                'cbu_masked' => $this->maskValue($validated['cbu']),
            ]);

            return response()->json([
                'message' => $e->getMessage(),
            ], 502);
        }

        $this->logConsulta(
            $request,
            'CBU',
            $validated['documento'],
            (bool) ($result['valid'] ?? false),
            (bool) ($result['valid'] ?? false) ? 'validado' : 'rechazado',
            [
                'message' => $result['message'] ?? null,
                'cbu_masked' => $this->maskValue($validated['cbu']),
            ]
        );

        return response()->json([
            'message' => $result['message'],
            'valid' => $result['valid'],
            'data' => [
                'raw' => $result['raw'],
            ],
        ]);
    }

    public function consultarDocumento(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'documento' => ['required', 'string', 'max:20'],
            'grupoVid' => ['nullable', 'integer'],
            'fechaNacimiento' => ['nullable', 'date'],
        ]);

        try {
            $result = $this->client->lookupDocumento(
                $validated['documento'],
                $validated['grupoVid'] ?? null,
                $validated['fechaNacimiento'] ?? null,
            );
        } catch (RuntimeException $e) {
            $this->logConsulta($request, 'CUIL', $validated['documento'], false, 'error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => $e->getMessage(),
            ], 502);
        }

        $this->logConsulta(
            $request,
            'CUIL',
            $validated['documento'],
            (bool) ($result['valid'] ?? false),
            (bool) ($result['valid'] ?? false) ? 'validado' : 'rechazado',
            [
                'message' => $result['message'] ?? null,
            ]
        );

        return response()->json([
            'message' => $result['message'],
            'valid' => $result['valid'],
            'data' => [
                'raw' => $result['raw'],
            ],
        ]);
    }

    public function auditoria(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'agent' => ['nullable', 'string', 'max:120'],
            'tipo' => ['nullable', 'in:CUIL,CBU'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ]);

        $from = isset($validated['from'])
            ? Carbon::parse($validated['from'])->startOfDay()
            : now()->startOfMonth()->startOfDay();
        $to = isset($validated['to'])
            ? Carbon::parse($validated['to'])->endOfDay()
            : now()->endOfDay();
        $limit = (int) ($validated['limit'] ?? 1000);

        $query = AuditLog::query()
            ->whereIn('action', ['nosis.lookup_document', 'nosis.validate_cbu'])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('id')
            ->limit($limit);

        if (!empty($validated['agent'])) {
            $agent = trim((string) $validated['agent']);
            $query->where(function ($q) use ($agent) {
                $q->where('actor_name', 'like', '%' . $agent . '%')
                    ->orWhere('actor_email', 'like', '%' . $agent . '%');
            });
        }

        /** @var Collection<int, AuditLog> $logs */
        $logs = $query->get();

        if (!empty($validated['tipo'])) {
            $requiredType = (string) $validated['tipo'];
            $logs = $logs->filter(function (AuditLog $log) use ($requiredType) {
                return (($log->metadata['consulta_tipo'] ?? null) === $requiredType);
            })->values();
        }

        $byAgent = $logs
            ->groupBy(function (AuditLog $log) {
                $email = strtolower(trim((string) ($log->actor_email ?? '')));
                $name = trim((string) ($log->actor_name ?? ''));
                return ($email !== '' ? $email : '_sin_email_') . '|' . ($name !== '' ? $name : 'Sin nombre');
            })
            ->map(function (Collection $groupedLogs) {
                /** @var AuditLog $first */
                $first = $groupedLogs->first();
                $totalsByType = [
                    'CUIL' => 0,
                    'CBU' => 0,
                ];
                $totalsByResult = [
                    'validado' => 0,
                    'rechazado' => 0,
                    'error' => 0,
                ];
                $totalEstimatedCost = 0.0;

                foreach ($groupedLogs as $log) {
                    $tipo = (string) ($log->metadata['consulta_tipo'] ?? '');
                    $result = (string) ($log->metadata['resultado'] ?? '');
                    if (isset($totalsByType[$tipo])) {
                        $totalsByType[$tipo]++;
                    }
                    if (isset($totalsByResult[$result])) {
                        $totalsByResult[$result]++;
                    }
                    $totalEstimatedCost += $this->resolveCostFromMetadata($log);
                }

                return [
                    'agentName' => $first->actor_name ?: 'Sin nombre',
                    'actorEmail' => $first->actor_email,
                    'totalConsultas' => $groupedLogs->count(),
                    'porTipo' => $totalsByType,
                    'porResultado' => $totalsByResult,
                    'costoEstimado' => round($totalEstimatedCost, 2),
                ];
            })
            ->values();

        $details = $logs->map(function (AuditLog $log) {
            return [
                'id' => $log->id,
                'fechaHora' => optional($log->created_at)->toDateTimeString(),
                'agentName' => $log->actor_name ?: 'Sin nombre',
                'actorEmail' => $log->actor_email,
                'tipoConsulta' => $log->metadata['consulta_tipo'] ?? null,
                'identificador' => $log->metadata['identificador_mascara'] ?? null,
                'resultado' => $log->metadata['resultado'] ?? null,
                'estadoRespuesta' => $log->metadata['estado_respuesta'] ?? null,
                'message' => $log->metadata['message'] ?? null,
                'costoEstimado' => $this->resolveCostFromMetadata($log),
            ];
        })->values();

        return response()->json([
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'summary' => $byAgent,
            'details' => $details,
        ]);
    }

    private function logConsulta(
        Request $request,
        string $consultaTipo,
        string $identifier,
        bool $valid,
        string $status,
        array $extraMetadata = []
    ): void {
        AuditLogger::log(
            $request,
            $consultaTipo === 'CBU' ? 'nosis.validate_cbu' : 'nosis.lookup_document',
            'nosis_query',
            null,
            array_merge([
                'consulta_tipo' => $consultaTipo,
                'identificador_mascara' => $this->maskValue($identifier),
                'resultado' => $status,
                'estado_respuesta' => $valid ? 'ok' : ($status === 'error' ? 'error' : 'ok'),
                'costo_estimado' => $this->resolveConfiguredCost(),
            ], $extraMetadata)
        );
    }

    private function maskValue(?string $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $clean = preg_replace('/\D+/', '', $value) ?: '';
        if ($clean === '') {
            return null;
        }

        $visible = min(3, strlen($clean));
        return str_repeat('*', strlen($clean) - $visible) . substr($clean, -$visible);
    }

    private function resolveConfiguredCost(): float
    {
        $cost = (float) config('nosis.cost_per_query', 0);
        if ($cost < 0) {
            $cost = 0;
        }

        return round($cost, 4);
    }

    private function resolveCostFromMetadata(AuditLog $log): float
    {
        $raw = $log->metadata['costo_estimado'] ?? null;
        if ($raw === null || $raw === '') {
            return $this->resolveConfiguredCost();
        }

        $cost = (float) $raw;
        if ($cost < 0) {
            $cost = 0;
        }

        return round($cost, 4);
    }
}

