<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\FuelReport;
use App\Models\Persona;
use App\Models\Reclamo;
use App\Models\Unidad;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Throwable;

class DistriappController extends Controller
{
    public function resumen(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canAccessDistriapp($user?->role, $user?->permissions)) {
            return response()->json([
                'message' => 'No tenés permisos para acceder al módulo Distriapp.',
            ], 403);
        }

        $proveedoresQuery = Persona::query()
            ->where(function ($query) {
                $query->whereNull('es_solicitud')
                    ->orWhere('es_solicitud', false);
            });

        $proveedoresTotal = (clone $proveedoresQuery)->count();
        $proveedoresActivos = (clone $proveedoresQuery)
            ->whereHas('estado', fn ($query) => $query->whereRaw('LOWER(nombre) = ?', ['activo']))
            ->count();

        $reclamosAbiertos = Reclamo::query()
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereNotIn('status', ['finalizado', 'rechazado']);
            })
            ->count();

        $combustibleReportesPendientes = FuelReport::query()
            ->whereIn('status', ['DRAFT', 'READY'])
            ->count();

        return response()->json([
            'data' => [
                'clientesTotal' => Cliente::query()->count(),
                'unidadesTotal' => Unidad::query()->count(),
                'proveedoresTotal' => $proveedoresTotal,
                'proveedoresActivos' => $proveedoresActivos,
                'reclamosAbiertos' => $reclamosAbiertos,
                'combustibleReportesPendientes' => $combustibleReportesPendientes,
                'updatedAt' => now()->toIso8601String(),
            ],
        ]);
    }

    public function mobileOverview(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canAccessDistriapp($user?->role, $user?->permissions)) {
            return response()->json([
                'message' => 'No tenés permisos para acceder al módulo Distriapp.',
            ], 403);
        }

        $month = max(1, min(12, (int) $request->query('month', now()->month)));
        $year = max(2020, min(2100, (int) $request->query('year', now()->year)));

        $mobileConfig = $this->mobileApiConfig();
        if (! $mobileConfig['configured']) {
            return response()->json([
                'data' => [
                    'configured' => false,
                    'message' => 'Falta configurar DISTRIAPP_MOBILE_API_URL/TOKEN (o DISTRIAPP_ADMIN_API_URL/TOKEN) en el backend.',
                    'month' => $month,
                    'year' => $year,
                    'modules' => $this->emptyMobileModuleStatuses(),
                    'liveTracking' => [
                        'available' => false,
                        'count' => 0,
                        'items' => [],
                        'error' => 'Integración de tracking no configurada.',
                    ],
                    'rankingPreview' => [],
                    'updatedAt' => now()->toIso8601String(),
                ],
            ]);
        }

        $journeys = $this->fetchMobileResource($mobileConfig, 'v1/app/journeys');
        $ranking = $this->fetchMobileResource($mobileConfig, 'v2/app/drivers/ranking');
        $operationControls = $this->fetchMobileResource(
            $mobileConfig,
            "v1/app/operation-controls/month/{$month}/year/{$year}"
        );
        $reminders = $this->fetchMobileResource($mobileConfig, 'v1/app/reminders');
        $complaints = $this->fetchMobileResource($mobileConfig, 'v1/app/complaints');
        $liveTracking = $this->fetchMobileResource($mobileConfig, $mobileConfig['live_endpoint']);

        $rankingPreview = [];
        $rawRankingItems = $this->extractItems($ranking['payload'] ?? null);
        foreach ($rawRankingItems as $index => $item) {
            $normalized = $this->normalizeRankingItem($item, $index);
            if (! $normalized) {
                continue;
            }
            $rankingPreview[] = $normalized;
            if (count($rankingPreview) >= 5) {
                break;
            }
        }

        $liveItems = [];
        $rawLiveItems = $this->extractItems($liveTracking['payload'] ?? null);
        foreach ($rawLiveItems as $item) {
            $normalized = $this->normalizeLiveTrackingItem($item);
            if (! $normalized) {
                continue;
            }
            $liveItems[] = $normalized;
            if (count($liveItems) >= 100) {
                break;
            }
        }

        return response()->json([
            'data' => [
                'configured' => true,
                'message' => null,
                'month' => $month,
                'year' => $year,
                'modules' => [
                    $this->buildMobileModuleStatus('journeys', 'Viajes', $journeys),
                    $this->buildMobileModuleStatus('ranking', 'Ranking', $ranking),
                    $this->buildMobileModuleStatus('operation-controls', 'Controles', $operationControls),
                    $this->buildMobileModuleStatus('reminders', 'Recordatorios', $reminders),
                    $this->buildMobileModuleStatus('complaints', 'Reclamos', $complaints),
                    $this->buildMobileModuleStatus('live-tracking', 'Ruteo en tiempo real', $liveTracking),
                ],
                'liveTracking' => [
                    'available' => $liveTracking['ok'],
                    'count' => $liveTracking['ok'] ? count($liveItems) : 0,
                    'items' => $liveItems,
                    'error' => $liveTracking['ok'] ? null : ($liveTracking['error'] ?? 'Sin conexión con tracking'),
                    'sourceEndpoint' => $mobileConfig['live_endpoint'],
                ],
                'rankingPreview' => $rankingPreview,
                'updatedAt' => now()->toIso8601String(),
            ],
        ]);
    }

    public function mobileModule(Request $request, string $module): JsonResponse
    {
        $user = $request->user();
        if (! $this->canAccessDistriapp($user?->role, $user?->permissions)) {
            return response()->json([
                'message' => 'No tenés permisos para acceder al módulo Distriapp.',
            ], 403);
        }

        $module = strtolower(trim($module));
        $allowedModules = ['urban-distribution', 'journeys', 'driver-locations'];
        if (! in_array($module, $allowedModules, true)) {
            return response()->json([
                'message' => 'Módulo no soportado.',
                'data' => [
                    'module' => $module,
                    'supported' => $allowedModules,
                ],
            ], 422);
        }

        $adminConfig = $this->adminApiConfig();
        if (! $adminConfig['configured']) {
            return response()->json([
                'data' => [
                    'configured' => false,
                    'module' => $module,
                    'count' => 0,
                    'items' => [],
                    'message' => 'Falta configurar DISTRIAPP_ADMIN_API_URL y DISTRIAPP_ADMIN_API_TOKEN.',
                    'updatedAt' => now()->toIso8601String(),
                ],
            ]);
        }

        if ($module === 'urban-distribution') {
            $month = max(1, min(12, (int) $request->query('month', now()->month)));
            $year = max(2020, min(2100, (int) $request->query('year', now()->year)));
            $resource = $this->fetchAdminResource(
                $adminConfig,
                "v1/admin/orders/type/urban-distribution/month/{$month}/year/{$year}"
            );
            if (! $resource['ok']) {
                return response()->json([
                    'data' => [
                        'configured' => true,
                        'module' => $module,
                        'count' => 0,
                        'items' => [],
                        'month' => $month,
                        'year' => $year,
                        'message' => $resource['error'] ?? 'No se pudieron cargar órdenes.',
                        'updatedAt' => now()->toIso8601String(),
                    ],
                ]);
            }

            $orders = $this->extractOrdersFromPayload($resource['payload'] ?? null);
            $items = array_values(array_filter(array_map(
                fn ($order) => $this->normalizeAdminOrderItem($order),
                $orders
            )));

            return response()->json([
                'data' => [
                    'configured' => true,
                    'module' => $module,
                    'count' => count($items),
                    'items' => $items,
                    'month' => $month,
                    'year' => $year,
                    'message' => null,
                    'updatedAt' => now()->toIso8601String(),
                ],
            ]);
        }

        if ($module === 'journeys') {
            $from = trim((string) $request->query('from', ''));
            $to = trim((string) $request->query('to', ''));

            $resource = $from !== '' && $to !== ''
                ? $this->fetchAdminResource(
                    $adminConfig,
                    'v1/admin/orders/type/journey/from/' . rawurlencode($from) . '/to/' . rawurlencode($to)
                )
                : $this->fetchAdminResource($adminConfig, 'v1/admin/orders/type/journey');

            if (! $resource['ok']) {
                return response()->json([
                    'data' => [
                        'configured' => true,
                        'module' => $module,
                        'count' => 0,
                        'items' => [],
                        'from' => $from !== '' ? $from : null,
                        'to' => $to !== '' ? $to : null,
                        'message' => $resource['error'] ?? 'No se pudieron cargar viajes.',
                        'updatedAt' => now()->toIso8601String(),
                    ],
                ]);
            }

            $orders = $this->extractOrdersFromPayload($resource['payload'] ?? null);
            $items = array_values(array_filter(array_map(
                fn ($order) => $this->normalizeAdminOrderItem($order),
                $orders
            )));

            return response()->json([
                'data' => [
                    'configured' => true,
                    'module' => $module,
                    'count' => count($items),
                    'items' => $items,
                    'from' => $from !== '' ? $from : null,
                    'to' => $to !== '' ? $to : null,
                    'message' => null,
                    'updatedAt' => now()->toIso8601String(),
                ],
            ]);
        }

        $resource = $this->fetchAdminResource($adminConfig, 'v1/admin/driver-locations');
        if (! $resource['ok']) {
            return response()->json([
                'data' => [
                    'configured' => true,
                    'module' => $module,
                    'count' => 0,
                    'items' => [],
                    'message' => $resource['error'] ?? 'No se pudieron cargar ubicaciones.',
                    'updatedAt' => now()->toIso8601String(),
                ],
            ]);
        }

        $drivers = $this->extractDriversFromPayload($resource['payload'] ?? null);
        $items = array_values(array_filter(array_map(
            fn ($driver) => $this->normalizeAdminDriverPosition($driver),
            $drivers
        )));

        return response()->json([
            'data' => [
                'configured' => true,
                'module' => $module,
                'count' => count($items),
                'items' => $items,
                'message' => null,
                'updatedAt' => now()->toIso8601String(),
            ],
        ]);
    }

    private function mobileApiConfig(): array
    {
        $baseUrl = rtrim((string) config('services.distriapp_mobile.base_url', ''), '/');
        $token = trim((string) config('services.distriapp_mobile.token', ''));
        $timeout = max(3, (int) config('services.distriapp_mobile.timeout', 12));
        $liveEndpoint = trim(
            (string) config('services.distriapp_mobile.live_endpoint', 'v1/app/driver-geopositions/live'),
            '/'
        );

        if ($baseUrl === '') {
            $fallbackBase = rtrim((string) config('services.distriapp_admin.base_url', ''), '/');
            if ($fallbackBase !== '') {
                $baseUrl = $fallbackBase;
            }
        }

        if ($token === '') {
            $fallbackToken = trim((string) config('services.distriapp_admin.token', ''));
            if ($fallbackToken !== '') {
                $token = $fallbackToken;
            }
        }

        return [
            'base_url' => $baseUrl,
            'token' => $token,
            'timeout' => $timeout,
            'live_endpoint' => $liveEndpoint,
            'configured' => $baseUrl !== '' && $token !== '',
        ];
    }

    private function adminApiConfig(): array
    {
        $baseUrl = rtrim((string) config('services.distriapp_admin.base_url', ''), '/');
        $token = trim((string) config('services.distriapp_admin.token', ''));
        $timeout = max(3, (int) config('services.distriapp_admin.timeout', 12));

        if ($baseUrl === '') {
            $fallbackBase = rtrim((string) config('services.distriapp_mobile.base_url', ''), '/');
            if ($fallbackBase !== '') {
                $baseUrl = $fallbackBase;
            }
        }

        if ($token === '') {
            $fallbackToken = trim((string) config('services.distriapp_mobile.token', ''));
            if ($fallbackToken !== '') {
                $token = $fallbackToken;
            }
        }

        return [
            'base_url' => $baseUrl,
            'token' => $token,
            'timeout' => $timeout,
            'configured' => $baseUrl !== '' && $token !== '',
        ];
    }

    private function fetchMobileResource(array $config, string $path, array $query = []): array
    {
        $url = $config['base_url'] . '/' . ltrim($path, '/');

        try {
            $response = Http::timeout((int) $config['timeout'])
                ->acceptJson()
                ->withToken($config['token'])
                ->get($url, $query);

            $payload = $response->json();
            if (! $response->ok()) {
                return [
                    'ok' => false,
                    'status' => $response->status(),
                    'error' => $this->extractResponseError($payload, $response->status()),
                    'payload' => $payload,
                ];
            }

            return [
                'ok' => true,
                'status' => $response->status(),
                'error' => null,
                'payload' => $payload,
            ];
        } catch (Throwable $exception) {
            return [
                'ok' => false,
                'status' => null,
                'error' => $exception->getMessage(),
                'payload' => null,
            ];
        }
    }

    private function fetchAdminResource(array $config, string $path, array $query = []): array
    {
        return $this->fetchMobileResource($config, $path, $query);
    }

    private function emptyMobileModuleStatuses(): array
    {
        return [
            ['key' => 'journeys', 'title' => 'Viajes', 'status' => 'not_configured', 'count' => null, 'error' => null],
            ['key' => 'ranking', 'title' => 'Ranking', 'status' => 'not_configured', 'count' => null, 'error' => null],
            ['key' => 'operation-controls', 'title' => 'Controles', 'status' => 'not_configured', 'count' => null, 'error' => null],
            ['key' => 'reminders', 'title' => 'Recordatorios', 'status' => 'not_configured', 'count' => null, 'error' => null],
            ['key' => 'complaints', 'title' => 'Reclamos', 'status' => 'not_configured', 'count' => null, 'error' => null],
            ['key' => 'live-tracking', 'title' => 'Ruteo en tiempo real', 'status' => 'not_configured', 'count' => null, 'error' => null],
        ];
    }

    private function buildMobileModuleStatus(string $key, string $title, array $resource): array
    {
        return [
            'key' => $key,
            'title' => $title,
            'status' => $resource['ok'] ? 'connected' : 'error',
            'count' => $resource['ok'] ? $this->countFromResource($resource) : null,
            'error' => $resource['ok'] ? null : ($resource['error'] ?? 'Error de conexión'),
        ];
    }

    private function countFromResource(array $resource): int
    {
        $payload = $resource['payload'] ?? null;
        if (is_array($payload)) {
            $meta = $payload['meta'] ?? null;
            if (is_array($meta)) {
                if (isset($meta['total']) && is_numeric($meta['total'])) {
                    return max(0, (int) $meta['total']);
                }
                if (isset($meta['count']) && is_numeric($meta['count'])) {
                    return max(0, (int) $meta['count']);
                }
            }
            if (isset($payload['total']) && is_numeric($payload['total'])) {
                return max(0, (int) $payload['total']);
            }
            if (isset($payload['count']) && is_numeric($payload['count'])) {
                return max(0, (int) $payload['count']);
            }
        }

        return count($this->extractItems($payload));
    }

    private function extractOrdersFromPayload($payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $orders = $payload['orders'] ?? null;
        if (is_array($orders)) {
            return $orders;
        }

        return $this->extractItems($payload);
    }

    private function extractDriversFromPayload($payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $drivers = $payload['drivers'] ?? null;
        if (is_array($drivers)) {
            return $drivers;
        }

        return $this->extractItems($payload);
    }

    private function extractItems($payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        if ($this->isListArray($payload)) {
            return $payload;
        }

        if ($this->hasCoordinates($payload)) {
            return [$payload];
        }

        foreach (['data', 'items', 'rows', 'result', 'results', 'records', 'drivers', 'positions'] as $key) {
            $candidate = $payload[$key] ?? null;
            if (! is_array($candidate)) {
                continue;
            }
            if ($this->isListArray($candidate)) {
                return $candidate;
            }
            if ($this->hasCoordinates($candidate)) {
                return [$candidate];
            }
        }

        return [];
    }

    private function normalizeAdminOrderItem($item): ?array
    {
        if (! is_array($item)) {
            return null;
        }

        $driverName = $this->readString($item, ['driver_name', 'driverName', 'full_name']);
        if (! $driverName && isset($item['driver']) && is_array($item['driver'])) {
            $driverName = $this->readString($item['driver'], ['full_name', 'name', 'nombre']);
        }

        $locationName = $this->readString($item, ['location_name', 'address', 'direccion']);
        if (! $locationName && isset($item['location']) && is_array($item['location'])) {
            $locationName = $this->readString($item['location'], ['name', 'address', 'direccion']);
        }

        $status = $this->readString($item, ['status_es', 'status_label', 'status']) ?? 'S/D';

        return [
            'id' => $item['id'] ?? null,
            'driverName' => $driverName ?: 'Sin asignar',
            'receiver' => $this->readString($item, ['receiver', 'receptor']) ?? 'S/D',
            'phone' => $this->readString($item, ['phone', 'telefono']) ?? 'S/D',
            'locationName' => $locationName ?: 'S/D',
            'status' => $status,
            'createdAt' => $this->readString($item, ['created_at', 'createdAt', 'date']) ?? null,
            'deliveredAt' => $this->readString($item, ['delivered_at', 'deliveredAt']) ?? null,
        ];
    }

    private function normalizeAdminDriverPosition($item): ?array
    {
        if (! is_array($item)) {
            return null;
        }

        $driverName = $this->readString($item, ['full_name', 'driver_name', 'name', 'nombre']);
        $driverId = $item['id'] ?? null;

        $position = null;
        if (isset($item['last_driver_geoposition']) && is_array($item['last_driver_geoposition'])) {
            $position = $item['last_driver_geoposition'];
        } elseif (isset($item['last_driver_location']) && is_array($item['last_driver_location'])) {
            $position = $item['last_driver_location'];
        } elseif ($this->hasCoordinates($item)) {
            $position = $item;
        }

        if (! is_array($position)) {
            return null;
        }

        $lat = $this->readNumber($position, ['lat', 'latitude']);
        $lng = $this->readNumber($position, ['lng', 'lon', 'longitude']);
        if ($lat === null || $lng === null) {
            return null;
        }

        return [
            'driverId' => $driverId,
            'driverName' => $driverName ?: 'Conductor',
            'lat' => $lat,
            'lng' => $lng,
            'accuracy' => $this->readNumber($position, ['accuracy']),
            'recordedAt' => $this->readString($position, ['date', 'recorded_at', 'recordedAt', 'created_at', 'updated_at']),
        ];
    }

    private function normalizeLiveTrackingItem($item): ?array
    {
        if (! is_array($item)) {
            return null;
        }

        $driverName = $this->readString($item, ['driver_name', 'driverName', 'conductor', 'driver', 'name']);
        $unitPatent = $this->readString($item, ['patent', 'plate', 'dominio', 'unidad']);
        $lat = $this->readNumber($item, ['lat', 'latitude']);
        $lng = $this->readNumber($item, ['lng', 'lon', 'longitude']);
        $recordedAt = $this->readString($item, ['recorded_at', 'recordedAt', 'created_at', 'updated_at', 'timestamp']);

        if (($lat === null || $lng === null) && isset($item['coords']) && is_array($item['coords'])) {
            $lat = $lat ?? $this->readNumber($item['coords'], ['lat', 'latitude']);
            $lng = $lng ?? $this->readNumber($item['coords'], ['lng', 'lon', 'longitude']);
        }

        if (($lat === null || $lng === null) && isset($item['position']) && is_array($item['position'])) {
            $lat = $lat ?? $this->readNumber($item['position'], ['lat', 'latitude']);
            $lng = $lng ?? $this->readNumber($item['position'], ['lng', 'lon', 'longitude']);
        }

        if ($driverName === null && isset($item['driver']) && is_array($item['driver'])) {
            $driverName = $this->readString($item['driver'], ['name', 'full_name', 'nombre']);
        }

        if ($unitPatent === null && isset($item['unit']) && is_array($item['unit'])) {
            $unitPatent = $this->readString($item['unit'], ['patent', 'plate', 'domain', 'dominio']);
        }

        if ($lat === null || $lng === null) {
            return null;
        }

        return [
            'driverName' => $driverName ?: 'Conductor',
            'unitPatent' => $unitPatent ?: 'S/D',
            'lat' => $lat,
            'lng' => $lng,
            'recordedAt' => $recordedAt,
        ];
    }

    private function normalizeRankingItem($item, int $index): ?array
    {
        if (! is_array($item)) {
            return null;
        }

        $driverName = $this->readString($item, ['driver_name', 'driverName', 'conductor', 'driver', 'name', 'nombre']);
        $score = $this->readNumber($item, ['score', 'points', 'puntaje']);
        $trips = $this->readNumber($item, ['journeys', 'trips', 'viajes']);
        $position = $this->readNumber($item, ['position', 'rank', 'puesto']);

        return [
            'position' => $position !== null ? (int) $position : ($index + 1),
            'driverName' => $driverName ?: 'Conductor',
            'score' => $score !== null ? $score : 0,
            'trips' => $trips !== null ? (int) $trips : 0,
        ];
    }

    private function extractResponseError($payload, ?int $status = null): string
    {
        if (is_array($payload)) {
            $message = $payload['message'] ?? $payload['error'] ?? null;
            if (is_string($message) && trim($message) !== '') {
                return trim($message);
            }
        }

        if ($status !== null) {
            return "HTTP {$status}";
        }

        return 'Error de conexión';
    }

    private function hasCoordinates(array $value): bool
    {
        return (
            (isset($value['lat']) || isset($value['latitude']))
            && (isset($value['lng']) || isset($value['lon']) || isset($value['longitude']))
        );
    }

    private function isListArray(array $value): bool
    {
        if (function_exists('array_is_list')) {
            return array_is_list($value);
        }

        if ($value === []) {
            return true;
        }

        return array_keys($value) === range(0, count($value) - 1);
    }

    private function readString(array $row, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $row)) {
                continue;
            }

            $value = $row[$key];
            if (! is_scalar($value)) {
                continue;
            }

            $text = trim((string) $value);
            if ($text !== '') {
                return $text;
            }
        }

        return null;
    }

    private function readNumber(array $row, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $row)) {
                continue;
            }

            $value = $row[$key];
            if (is_numeric($value)) {
                return (float) $value;
            }
        }

        return null;
    }

    private function canAccessDistriapp(?string $role, $permissions): bool
    {
        $normalizedRole = strtolower(trim((string) $role));
        if (str_contains($normalizedRole, 'admin') || $normalizedRole === 'encargado') {
            return true;
        }

        return is_array($permissions) && in_array('distriapp', $permissions, true);
    }
}
