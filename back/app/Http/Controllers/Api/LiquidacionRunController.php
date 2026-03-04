<?php

namespace App\Http\Controllers\Api;

use App\Jobs\ProcessLiquidacionPublishJob;
use App\Http\Controllers\Controller;
use App\Models\LiquidacionAuditChange;
use App\Models\LiquidacionClientIdentifierAlias;
use App\Models\LiquidacionDistribuidor;
use App\Models\LiquidacionDistribuidorLinea;
use App\Models\LiquidacionImportRun;
use App\Models\LiquidacionClientRule;
use App\Models\LiquidacionObservation;
use App\Models\LiquidacionPublishJob;
use App\Models\LiquidacionStagingRow;
use App\Models\LiquidacionValidationResult;
use App\Models\Persona;
use App\Services\Erp\ErpClient;
use App\Services\AuditLogger;
use App\Services\Liquidaciones\LiquidacionPublishProcessor;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

class LiquidacionRunController extends Controller
{
    private const PROVIDER_MATCH_PENDING = 'PENDIENTE_ASIGNACION';
    private const PROVIDER_MATCH_NONE = 'SIN_MATCH';
    private const PROVIDER_MATCH_PATENTE = 'PATENTE_OK';
    private const PROVIDER_MATCH_ALIAS = 'PATENTE_ALIAS_OK';
    private const PROVIDER_MATCH_MANUAL = 'MANUAL_CONFIRMED';
    private const PROVIDER_MATCH_RULE_CODES = ['PROVIDER_MATCH_PENDING', 'PROVIDER_MATCH_REQUIRED'];

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:120'],
            'client_code' => ['nullable', 'string', 'max:100'],
            'source_system' => ['nullable', 'string', 'max:30'],
            'period_from' => ['nullable', 'date'],
            'period_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);

        $query = LiquidacionImportRun::query()->orderByDesc('id');

        $statusFilter = $this->normalizeNullableString($validated['status'] ?? null);
        if ($statusFilter !== null) {
            $statuses = collect(explode(',', $statusFilter))
                ->map(fn ($value) => strtoupper(trim($value)))
                ->filter()
                ->unique()
                ->values()
                ->all();

            if (count($statuses) === 1) {
                $query->where('status', $statuses[0]);
            } elseif (count($statuses) > 1) {
                $query->whereIn('status', $statuses);
            }
        }

        $clientCode = $this->normalizeNullableString($validated['client_code'] ?? null);
        if ($clientCode !== null) {
            $query->where('client_code', 'like', '%' . $clientCode . '%');
        }

        $sourceSystem = $this->normalizeNullableString($validated['source_system'] ?? null);
        if ($sourceSystem !== null) {
            $query->where('source_system', $sourceSystem);
        }

        if (!empty($validated['period_from'])) {
            $query->whereDate('period_from', '>=', $validated['period_from']);
        }
        if (!empty($validated['period_to'])) {
            $query->whereDate('period_to', '<=', $validated['period_to']);
        }

        $statusCounts = (clone $query)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($value) => (int) $value)
            ->all();

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (LiquidacionImportRun $run) => $this->serializeRun($run))
                ->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'summary' => [
                'status_counts' => $statusCounts,
            ],
        ]);
    }

    public function createImportacion(Request $request)
    {
        $validated = $request->validate([
            'cliente_id' => ['required'],
            'anio' => ['required', 'integer', 'min:2000', 'max:2100'],
            'mes' => ['required', 'integer', 'min:1', 'max:12'],
            'tipo_periodo' => ['required', 'string', 'in:MENSUAL,QUINCENAL'],
            'quincena' => ['nullable', 'string', 'in:1Q,2Q'],
            'sucursal_id' => ['required', 'integer', 'min:1'],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:20480'],
        ]);

        $tipoPeriodo = strtoupper((string) $validated['tipo_periodo']);
        $quincena = $validated['quincena'] ?? null;
        if ($tipoPeriodo === 'QUINCENAL' && $quincena === null) {
            return response()->json([
                'message' => 'La quincena es obligatoria cuando tipo_periodo=QUINCENAL.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        [$periodFrom, $periodTo] = $this->buildPeriodRange(
            (int) $validated['anio'],
            (int) $validated['mes'],
            $tipoPeriodo,
            $quincena
        );

        $clientCode = strtoupper(trim((string) $validated['cliente_id']));
        $version = $this->resolveImportacionVersion(
            $clientCode,
            $periodFrom,
            $periodTo,
            $tipoPeriodo,
            $quincena,
            (int) $validated['sucursal_id']
        );

        $request->merge([
            'client_code' => $clientCode,
            'period_from' => $periodFrom->toDateString(),
            'period_to' => $periodTo->toDateString(),
            'anio' => (int) $validated['anio'],
            'mes' => (int) $validated['mes'],
            'tipo_periodo' => $tipoPeriodo,
            'quincena' => $quincena,
            'sucursal_id' => (int) $validated['sucursal_id'],
            'version' => $version,
            'status' => 'CARGADA',
        ]);
        $request->files->set('extract_file', $request->file('file'));

        $response = $this->upload($request);
        $statusCode = method_exists($response, 'status') ? $response->status() : Response::HTTP_CREATED;
        $payload = json_decode((string) $response->getContent(), true);

        if ($statusCode >= 400) {
            return $response;
        }

        $runId = (int) data_get($payload, 'data.id');
        $estado = (string) data_get($payload, 'data.status', 'PRELIQUIDACION');
        return response()->json([
            'importacion_id' => $runId,
            'estado' => $estado,
            'version' => $version,
        ], Response::HTTP_CREATED);
    }

    public function previewImportacion(LiquidacionImportRun $run)
    {
        $run->loadCount([
            'stagingRows as staging_rows_count',
            'validationResults as validation_results_count',
            'publishJobs as publish_jobs_count',
            'observations as observations_count',
        ]);
        $this->refreshRunCounters($run);
        $this->syncRunDistributorSnapshots($run);
        $run->refresh();

        $metadata = is_array($run->metadata) ? $run->metadata : [];
        $periodMeta = is_array($metadata['period'] ?? null) ? $metadata['period'] : [];
        $importMeta = is_array($metadata['importacion'] ?? null) ? $metadata['importacion'] : [];

        $distribuidores = $this->buildImportacionPreviewDistribuidores($run);
        $pendingMatchItems = $this->buildPendingMatchItems($run);
        $totalCalc = array_sum(array_map(static fn ($item) => (float) ($item['subtotal_calculado'] ?? 0), $distribuidores));
        $totalFinal = array_sum(array_map(static fn ($item) => (float) ($item['total_final'] ?? 0), $distribuidores));

        return response()->json([
            'importacion' => [
                'id' => $run->id,
                'cliente_id' => $run->client_code,
                'anio' => $importMeta['anio'] ?? ($periodMeta['anio'] ?? null),
                'mes' => $importMeta['mes'] ?? ($periodMeta['mes'] ?? null),
                'tipo_periodo' => $periodMeta['tipo_periodo'] ?? null,
                'quincena' => $periodMeta['quincena'] ?? null,
                'sucursal_id' => $periodMeta['sucursal_id'] ?? null,
                'version' => $importMeta['version'] ?? 1,
                'estado' => $run->status,
            ],
            'resumen' => [
                'filas_total' => (int) $run->rows_total,
                'distribuidores_total' => count($distribuidores),
                'criticos' => (int) $run->rows_error,
                'alertas' => (int) ($run->rows_alert + $run->rows_diff),
                'pendientes_match' => count($pendingMatchItems),
                'total_distribuidores_calculado' => round($totalCalc, 2),
                'total_distribuidores_final' => round($totalFinal, 2),
            ],
            'distribuidores' => $distribuidores,
            'pendientes_match' => $pendingMatchItems,
        ]);
    }

    public function searchProviders(Request $request)
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        if (!Schema::hasTable('personas')) {
            return response()->json([
                'query' => (string) $validated['q'],
                'data' => [],
            ]);
        }

        $term = $this->normalizeNullableString((string) $validated['q']);
        if ($term === null || strlen($term) < 2) {
            return response()->json([
                'query' => (string) $validated['q'],
                'data' => [],
            ]);
        }

        $limit = (int) ($validated['limit'] ?? 10);
        $candidates = $this->searchProviderCandidatesForManualAssign($term, $limit);

        return response()->json([
            'query' => $term,
            'data' => $candidates,
        ]);
    }

    public function assignImportacionProvider(Request $request, LiquidacionImportRun $run)
    {
        $validated = $request->validate([
            'patente_norm' => ['nullable', 'string', 'max:30'],
            'distribuidor_norm' => ['nullable', 'string', 'max:255'],
            'nombre_excel_norm' => ['nullable', 'string', 'max:255'],
            'proveedor_id' => ['required', 'integer', 'min:1'],
            'actualizar_patente_en_proveedor' => ['nullable', 'boolean'],
            'sobreescribir_patente_existente' => ['nullable', 'boolean'],
            'motivo' => ['nullable', 'string', 'max:800'],
        ]);

        if (!$this->isRunEditable($run)) {
            return response()->json([
                'message' => 'Solo se puede asignar proveedor cuando el run está en PRELIQUIDACION.',
            ], Response::HTTP_CONFLICT);
        }

        if (!Schema::hasTable('personas')) {
            return response()->json([
                'message' => 'No existe tabla personas para resolver proveedores.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $patenteNorm = $this->normalizeDomain((string) ($validated['patente_norm'] ?? ''));
        $distribuidorNorm = $this->normalizeEpsaDistributorName((string) ($validated['distribuidor_norm'] ?? ''));
        if ($patenteNorm === null && $distribuidorNorm === null) {
            return response()->json([
                'message' => 'Debés informar patente_norm o distribuidor_norm.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $provider = Persona::query()->find((int) $validated['proveedor_id']);
        if (!$provider) {
            return response()->json([
                'message' => 'Proveedor no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        $motivo = $this->normalizeNullableString($validated['motivo'] ?? null);
        $updateProviderPatente = (bool) ($validated['actualizar_patente_en_proveedor'] ?? false);
        $overwriteProviderPatente = (bool) ($validated['sobreescribir_patente_existente'] ?? false);
        if ($updateProviderPatente && $overwriteProviderPatente && $motivo === null) {
            return response()->json([
                'message' => 'El motivo es obligatorio cuando se sobreescribe una patente existente.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $nameExcelNorm = $this->normalizePersonName((string) ($validated['nombre_excel_norm'] ?? ''));
        $actorId = $request->user()?->id;
        $providerFullName = $this->buildProviderDisplayName($provider);

        $rowsQuery = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->orderBy('row_number')
            ->orderBy('id');
        if ($patenteNorm !== null) {
            $rowsQuery->where('domain_norm', $patenteNorm);
        } else {
            $rowsQuery->where('name_excel_norm', $distribuidorNorm);
        }
        $rowsToAssign = $rowsQuery->get();
        if ($rowsToAssign->isEmpty()) {
            return response()->json([
                'message' => $patenteNorm !== null
                    ? 'No hay filas con la patente indicada en este run.'
                    : 'No hay filas con el distribuidor indicado en este run.',
            ], Response::HTTP_NOT_FOUND);
        }

        $assignCode = $patenteNorm ?? $distribuidorNorm;
        $shouldUpdateProviderPatente = $updateProviderPatente && $patenteNorm !== null;

        $result = DB::transaction(function () use (
            $run,
            $patenteNorm,
            $distribuidorNorm,
            $assignCode,
            $nameExcelNorm,
            $provider,
            $providerFullName,
            $actorId,
            $shouldUpdateProviderPatente,
            $overwriteProviderPatente,
            $motivo,
            $rowsToAssign
        ) {
            foreach ($rowsToAssign as $row) {
                $row->distributor_id = $provider->id;
                $row->distributor_code = $assignCode;
                $row->distributor_name = $providerFullName;
                $row->match_provider_persona_id = $provider->id;
                $row->match_status = self::PROVIDER_MATCH_MANUAL;
                $row->name_excel_norm = $row->name_excel_norm ?: ($nameExcelNorm ?: null);
                $row->match_candidates_json = null;
                $this->clearProviderMatchValidationFailures($run->id, $row->id);
                $this->refreshStagingRowValidationStatus($run->id, $row);
            }

            $aliasSaved = false;
            if ($patenteNorm !== null) {
                $aliasSaved = $this->upsertClientIdentifierAlias(
                    (string) ($run->client_code ?? ''),
                    'PATENTE',
                    $patenteNorm,
                    (int) $provider->id,
                    $actorId
                ) || $aliasSaved;
            }
            if ($distribuidorNorm !== null) {
                $aliasSaved = $this->upsertClientIdentifierAlias(
                    (string) ($run->client_code ?? ''),
                    'DISTRIBUIDOR',
                    $distribuidorNorm,
                    (int) $provider->id,
                    $actorId
                ) || $aliasSaved;
            }

            if ($nameExcelNorm !== null) {
                $this->upsertClientIdentifierAlias(
                    (string) ($run->client_code ?? ''),
                    'NOMBRE',
                    $nameExcelNorm,
                    (int) $provider->id,
                    $actorId
                );
            }

            $patenteUpdate = [
                'updated' => false,
                'message' => null,
            ];
            if ($shouldUpdateProviderPatente) {
                $patenteUpdate = $this->tryUpdateProviderPatente(
                    $provider,
                    $patenteNorm,
                    $overwriteProviderPatente,
                    $motivo,
                    $actorId
                );
            }

            $run->refresh();
            $this->refreshRunCounters($run);
            $this->syncRunDistributorSnapshots($run);
            $this->clearOpenAutomaticObservations($run);
            $this->generateAutomaticObservations($run);

            return [
                'alias_saved' => $aliasSaved,
                'patente_updated' => (bool) ($patenteUpdate['updated'] ?? false),
                'patente_message' => $patenteUpdate['message'] ?? null,
            ];
        });

        AuditLogger::log($request, 'liquidaciones.importacion.assign_provider', 'liq_import_run', $run->id, [
            'patente_norm' => $patenteNorm,
            'distribuidor_norm' => $distribuidorNorm,
            'proveedor_id' => (int) $provider->id,
            'actualizar_patente_en_proveedor' => $updateProviderPatente,
            'sobreescribir_patente_existente' => $overwriteProviderPatente,
            'patente_actualizada' => (bool) ($result['patente_updated'] ?? false),
        ]);

        return response()->json([
            'ok' => true,
            'proveedor_id' => (int) $provider->id,
            'patente_actualizada' => (bool) ($result['patente_updated'] ?? false),
            'alias_guardado' => (bool) ($result['alias_saved'] ?? false),
            'message' => $result['patente_message'] ?? null,
            'run' => $this->serializeRun($run->fresh()),
        ]);
    }

    public function approveImportacion(Request $request, LiquidacionImportRun $run)
    {
        return $this->approve($request, $run);
    }

    public function publishImportacion(Request $request, LiquidacionImportRun $run)
    {
        if (strtoupper((string) $run->status) !== 'APROBADA') {
            return response()->json([
                'message' => 'La importación debe estar APROBADA para publicar.',
            ], Response::HTTP_CONFLICT);
        }

        $request->merge([
            'dry_run' => false,
            'force' => false,
        ]);

        return $this->publishToErp($request, $run);
    }

    public function showDistribuidor(LiquidacionDistribuidor $distribuidor)
    {
        $run = $distribuidor->run()->first();
        if (!$run) {
            return response()->json([
                'message' => 'No se encontró el run asociado al distribuidor.',
            ], Response::HTTP_NOT_FOUND);
        }

        $this->syncRunDistributorSnapshots($run);
        $distribuidor = $distribuidor->fresh();
        if (!$distribuidor) {
            return response()->json([
                'message' => 'No se encontró el distribuidor.',
            ], Response::HTTP_NOT_FOUND);
        }

        $distribuidor->load([
            'lines' => fn ($query) => $query->orderBy('row_number')->orderBy('id'),
        ]);

        return response()->json($this->serializeDistribuidorDetail($distribuidor));
    }

    public function updateLinea(Request $request, LiquidacionDistribuidorLinea $linea)
    {
        $validated = $request->validate([
            'importe_override' => ['nullable', 'numeric'],
            'plus_override' => ['nullable', 'numeric'],
            'tarifa_override' => ['nullable', 'numeric'],
            'motivo' => ['required', 'string', 'max:800'],
        ]);

        $linea->load('distributor.run');
        $distribuidor = $linea->distributor;
        $run = $distribuidor?->run;
        if (!$run || !$distribuidor) {
            return response()->json([
                'message' => 'No se encontró el contexto de la línea a editar.',
            ], Response::HTTP_NOT_FOUND);
        }
        if (!$this->isRunEditable($run)) {
            return response()->json([
                'message' => 'Solo se puede editar cuando el run está en PRELIQUIDACION.',
            ], Response::HTTP_CONFLICT);
        }

        $reason = trim((string) $validated['motivo']);
        if ($reason === '') {
            return response()->json([
                'message' => 'El motivo de edición es obligatorio.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $actorId = $request->user()?->id;
        $old = [
            'importe_override' => $linea->importe_override,
            'plus_override' => $linea->plus_override,
            'tarifa_override' => $linea->tarifa_override,
            'importe_final' => $linea->importe_final,
        ];

        $linea->importe_override = $this->parseFloatOrNull($validated['importe_override'] ?? null);
        $linea->plus_override = $this->parseFloatOrNull($validated['plus_override'] ?? null);
        $linea->tarifa_override = $this->parseFloatOrNull($validated['tarifa_override'] ?? null);
        $linea->motivo_override = $reason;
        $this->recalculateLineaFinal($linea);
        $linea->save();

        $distribuidor->refresh();
        $this->recalculateDistribuidorTotals($distribuidor);
        $distribuidor->refresh();

        $new = [
            'importe_override' => $linea->importe_override,
            'plus_override' => $linea->plus_override,
            'tarifa_override' => $linea->tarifa_override,
            'importe_final' => $linea->importe_final,
        ];
        $this->recordAuditChangesForEntity('LINEA', $linea->id, $old, $new, $actorId, $reason);

        AuditLogger::log($request, 'liquidaciones.linea.override', 'liq_distributor_line', $linea->id, [
            'run_id' => $run->id,
            'distributor_id' => $distribuidor->id,
        ]);

        return response()->json([
            'linea_id' => $linea->id,
            'importe_calculado' => $linea->importe_calculado,
            'importe_override' => $linea->importe_override,
            'importe_final' => $linea->importe_final,
        ]);
    }

    public function updateDistribuidor(Request $request, LiquidacionDistribuidor $distribuidor)
    {
        $validated = $request->validate([
            'gastos_admin_override' => ['nullable', 'numeric'],
            'ajuste_manual' => ['nullable', 'numeric'],
            'motivo' => ['required', 'string', 'max:800'],
        ]);

        $run = $distribuidor->run()->first();
        if (!$run) {
            return response()->json([
                'message' => 'No se encontró el run asociado al distribuidor.',
            ], Response::HTTP_NOT_FOUND);
        }
        if (!$this->isRunEditable($run)) {
            return response()->json([
                'message' => 'Solo se puede editar cuando el run está en PRELIQUIDACION.',
            ], Response::HTTP_CONFLICT);
        }

        $reason = trim((string) $validated['motivo']);
        if ($reason === '') {
            return response()->json([
                'message' => 'El motivo de edición es obligatorio.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $old = [
            'gastos_admin_override' => $distribuidor->gastos_admin_override,
            'ajuste_manual' => $distribuidor->ajuste_manual,
            'total_final' => $distribuidor->total_final,
        ];

        $distribuidor->gastos_admin_override = $this->parseFloatOrNull($validated['gastos_admin_override'] ?? null);
        if (array_key_exists('ajuste_manual', $validated)) {
            $distribuidor->ajuste_manual = $this->parseFloatOrNull($validated['ajuste_manual']);
        }
        $this->recalculateDistribuidorTotals($distribuidor);
        $distribuidor->save();

        $new = [
            'gastos_admin_override' => $distribuidor->gastos_admin_override,
            'ajuste_manual' => $distribuidor->ajuste_manual,
            'total_final' => $distribuidor->total_final,
        ];
        $this->recordAuditChangesForEntity('DISTRIBUIDOR', $distribuidor->id, $old, $new, $request->user()?->id, $reason);

        AuditLogger::log($request, 'liquidaciones.distribuidor.override', 'liq_distributor', $distribuidor->id, [
            'run_id' => $run->id,
        ]);

        return response()->json([
            'liquidacion_distribuidor_id' => $distribuidor->id,
            'gastos_admin_default' => $distribuidor->gastos_admin_default,
            'gastos_admin_override' => $distribuidor->gastos_admin_override,
            'gastos_admin_final' => $distribuidor->gastos_admin_final,
            'total_final' => $distribuidor->total_final,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'source_system' => ['nullable', 'string', 'max:30'],
            'client_code' => ['required', 'string', 'max:100'],
            'period_from' => ['nullable', 'date'],
            'period_to' => ['nullable', 'date'],
            'source_file_name' => ['nullable', 'string', 'max:255'],
            'source_file_url' => ['nullable', 'string', 'max:2048'],
            'source_file_hash' => ['nullable', 'string', 'max:128'],
            'status' => ['nullable', 'string', 'max:30'],
            'metadata' => ['nullable', 'array'],
            'auto_observations' => ['nullable', 'boolean'],
            'staging_rows' => ['nullable', 'array'],
            'staging_rows.*.row_number' => ['nullable', 'integer', 'min:1'],
            'staging_rows.*.external_row_id' => ['nullable', 'string', 'max:120'],
            'staging_rows.*.domain_norm' => ['nullable', 'string', 'max:20'],
            'staging_rows.*.occurred_at' => ['nullable'],
            'staging_rows.*.station' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.product' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.invoice_number' => ['nullable', 'string', 'max:120'],
            'staging_rows.*.conductor' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.name_excel_raw' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.name_excel_norm' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.distributor_id' => ['nullable', 'integer'],
            'staging_rows.*.distributor_code' => ['nullable', 'string', 'max:120'],
            'staging_rows.*.distributor_name' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.liters' => ['nullable', 'numeric'],
            'staging_rows.*.amount' => ['nullable', 'numeric'],
            'staging_rows.*.price_per_liter' => ['nullable', 'numeric'],
            'staging_rows.*.tariff_expected' => ['nullable', 'numeric'],
            'staging_rows.*.amount_expected' => ['nullable', 'numeric'],
            'staging_rows.*.validation_status' => ['nullable', 'string', 'max:30'],
            'staging_rows.*.validation_score' => ['nullable', 'numeric'],
            'staging_rows.*.severity_max' => ['nullable', 'string', 'max:20'],
            'staging_rows.*.match_status' => ['nullable', 'string', 'max:40'],
            'staging_rows.*.match_provider_persona_id' => ['nullable', 'integer'],
            'staging_rows.*.is_duplicate' => ['nullable', 'boolean'],
            'staging_rows.*.duplicate_group_key' => ['nullable', 'string', 'max:190'],
            'staging_rows.*.observations_auto' => ['nullable', 'string'],
            'staging_rows.*.raw_payload_json' => ['nullable', 'array'],
            'staging_rows.*.match_candidates_json' => ['nullable', 'array'],
            'validation_results' => ['nullable', 'array'],
            'validation_results.*.staging_row_id' => ['nullable', 'integer'],
            'validation_results.*.row_number' => ['nullable', 'integer', 'min:1'],
            'validation_results.*.rule_code' => ['required', 'string', 'max:80'],
            'validation_results.*.severity' => ['required', 'string', 'max:20'],
            'validation_results.*.result' => ['required', 'string', 'max:20'],
            'validation_results.*.expected_value' => ['nullable', 'string', 'max:255'],
            'validation_results.*.actual_value' => ['nullable', 'string', 'max:255'],
            'validation_results.*.message' => ['nullable', 'string'],
        ]);

        $autoObservations = array_key_exists('auto_observations', $validated)
            ? (bool) $validated['auto_observations']
            : true;

        $run = DB::transaction(function () use ($validated, $request, $autoObservations) {
            $run = LiquidacionImportRun::query()->create([
                'source_system' => $validated['source_system'] ?? 'powerbi',
                'client_code' => $validated['client_code'],
                'period_from' => $validated['period_from'] ?? null,
                'period_to' => $validated['period_to'] ?? null,
                'source_file_name' => $validated['source_file_name'] ?? null,
                'source_file_url' => $validated['source_file_url'] ?? null,
                'source_file_hash' => $validated['source_file_hash'] ?? null,
                'status' => $this->normalizeRunStatus($validated['status'] ?? 'CARGADA'),
                'metadata' => $validated['metadata'] ?? null,
                'created_by' => $request->user()?->id,
            ]);

            $stagingRows = $validated['staging_rows'] ?? [];
            $createdRowsByNumber = [];
            $createdRowsById = [];

            foreach ($stagingRows as $index => $row) {
                $rowNumber = isset($row['row_number']) ? (int) $row['row_number'] : ($index + 1);
                $validationStatus = $this->normalizeValidationStatus($row['validation_status'] ?? null);
                $severityMax = $this->normalizeSeverity($row['severity_max'] ?? $this->severityFromStatus($validationStatus));

                $created = LiquidacionStagingRow::query()->create([
                    'run_id' => $run->id,
                    'row_number' => $rowNumber,
                    'external_row_id' => $this->normalizeNullableString($row['external_row_id'] ?? null),
                    'domain_norm' => $this->normalizeDomain($row['domain_norm'] ?? null),
                    'occurred_at' => $this->parseDateTimeOrNull($row['occurred_at'] ?? null),
                    'station' => $this->normalizeNullableString($row['station'] ?? null),
                    'product' => $this->normalizeNullableString($row['product'] ?? null),
                    'invoice_number' => $this->normalizeNullableString($row['invoice_number'] ?? null),
                    'conductor' => $this->normalizeNullableString($row['conductor'] ?? null),
                    'name_excel_raw' => $this->normalizeNullableString($row['name_excel_raw'] ?? null),
                    'name_excel_norm' => $this->normalizeNullableString($row['name_excel_norm'] ?? null),
                    'distributor_id' => isset($row['distributor_id']) ? (int) $row['distributor_id'] : null,
                    'distributor_code' => $this->normalizeNullableString($row['distributor_code'] ?? null),
                    'distributor_name' => $this->normalizeNullableString($row['distributor_name'] ?? null),
                    'liters' => $this->parseFloatOrNull($row['liters'] ?? null),
                    'amount' => $this->parseFloatOrNull($row['amount'] ?? null),
                    'price_per_liter' => $this->parseFloatOrNull($row['price_per_liter'] ?? null),
                    'tariff_expected' => $this->parseFloatOrNull($row['tariff_expected'] ?? null),
                    'amount_expected' => $this->parseFloatOrNull($row['amount_expected'] ?? null),
                    'validation_status' => $validationStatus,
                    'validation_score' => $this->parseFloatOrNull($row['validation_score'] ?? null),
                    'severity_max' => $severityMax,
                    'match_status' => $this->normalizeNullableString($row['match_status'] ?? null),
                    'match_provider_persona_id' => isset($row['match_provider_persona_id']) ? (int) $row['match_provider_persona_id'] : null,
                    'is_duplicate' => (bool) ($row['is_duplicate'] ?? false),
                    'duplicate_group_key' => $this->normalizeNullableString($row['duplicate_group_key'] ?? null),
                    'observations_auto' => $this->normalizeNullableString($row['observations_auto'] ?? null),
                    'raw_payload_json' => is_array($row['raw_payload_json'] ?? null) ? $row['raw_payload_json'] : null,
                    'match_candidates_json' => is_array($row['match_candidates_json'] ?? null) ? $row['match_candidates_json'] : null,
                ]);

                $createdRowsById[$created->id] = $created->id;
                if (!isset($createdRowsByNumber[$rowNumber])) {
                    $createdRowsByNumber[$rowNumber] = $created->id;
                }
            }

            $validationRows = $validated['validation_results'] ?? [];
            foreach ($validationRows as $validationRow) {
                $stagingRowId = isset($validationRow['staging_row_id'])
                    ? (int) $validationRow['staging_row_id']
                    : ($createdRowsByNumber[(int) ($validationRow['row_number'] ?? 0)] ?? null);

                if ($stagingRowId !== null && !isset($createdRowsById[$stagingRowId])) {
                    $belongsToRun = LiquidacionStagingRow::query()
                        ->where('id', $stagingRowId)
                        ->where('run_id', $run->id)
                        ->exists();
                    if (!$belongsToRun) {
                        $stagingRowId = null;
                    }
                }

                LiquidacionValidationResult::query()->create([
                    'run_id' => $run->id,
                    'staging_row_id' => $stagingRowId,
                    'rule_code' => strtoupper(trim((string) $validationRow['rule_code'])),
                    'severity' => $this->normalizeSeverity($validationRow['severity']),
                    'result' => strtoupper(trim((string) $validationRow['result'])),
                    'expected_value' => $this->normalizeNullableString($validationRow['expected_value'] ?? null),
                    'actual_value' => $this->normalizeNullableString($validationRow['actual_value'] ?? null),
                    'message' => $this->normalizeNullableString($validationRow['message'] ?? null),
                ]);
            }

            $this->refreshRunCounters($run);
            $this->syncRunDistributorSnapshots($run);
            if (in_array($run->status, ['RECEIVED', 'CARGADA', 'PROCESADA', 'VALIDATED'], true) && $run->rows_total > 0) {
                $run->status = 'PRELIQUIDACION';
                $run->save();
            }

            if ($autoObservations) {
                $this->generateAutomaticObservations($run);
            }

            AuditLogger::log($request, 'liquidaciones.run.create', 'liq_import_run', $run->id, [
                'client_code' => $run->client_code,
                'source_file_name' => $run->source_file_name,
                'rows_total' => $run->rows_total,
                'rows_ok' => $run->rows_ok,
                'rows_error' => $run->rows_error,
                'rows_alert' => $run->rows_alert,
                'rows_diff' => $run->rows_diff,
            ]);

            return $run->fresh();
        });

        return response()->json([
            'data' => $this->serializeRun($run),
        ], Response::HTTP_CREATED);
    }

    public function upload(Request $request)
    {
        $validated = $request->validate([
            'source_system' => ['nullable', 'string', 'max:30'],
            'client_code' => ['required', 'string', 'max:100'],
            'period_from' => ['nullable', 'date'],
            'period_to' => ['nullable', 'date'],
            'anio' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'tipo_periodo' => ['nullable', 'string', 'in:MENSUAL,QUINCENAL'],
            'quincena' => ['nullable', 'string', 'in:1Q,2Q'],
            'sucursal_id' => ['nullable', 'integer', 'min:1'],
            'version' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'string', 'max:30'],
            'sheet' => ['nullable', 'string', 'max:120'],
            'format' => ['nullable', 'string', 'max:60'],
            'auto_observations' => ['nullable', 'boolean'],
            'extract_file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:20480'],
        ]);

        $file = $request->file('extract_file');
        if (!$file) {
            return response()->json([
                'message' => 'No se recibió el archivo de extracto.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $extension = strtolower((string) ($file->getClientOriginalExtension() ?: 'bin'));
        if ($extension === 'xls') {
            return response()->json([
                'message' => 'El formato .xls no es compatible. Usá .xlsx o .csv.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $storedName = now()->format('Ymd_His') . '_' . Str::random(10) . '.' . $extension;
        $storedPath = $file->storeAs('liquidaciones/extractos/' . now()->format('Y/m'), $storedName, 'local');
        $storedAbsolutePath = Storage::disk('local')->path($storedPath);

        $sheet = $this->normalizeNullableString($validated['sheet'] ?? null);
        $format = $this->normalizeNullableString($validated['format'] ?? null);
        $isEpsaMode = $this->isEpsaUploadMode($validated['client_code'] ?? null, $format);
        if ($isEpsaMode && $extension !== 'csv') {
            $sheet = 'Table';
        }
        $autoObservations = array_key_exists('auto_observations', $validated)
            ? (bool) $validated['auto_observations']
            : true;

        [$columns, $rawRows, $rowCount, $parseMeta] = $extension === 'csv'
            ? $this->parseUploadCsv($storedAbsolutePath)
            : $this->parseUploadXlsx($storedAbsolutePath, $sheet, $isEpsaMode);

        if ($isEpsaMode && (bool) ($parseMeta['sheet_not_found'] ?? false)) {
            return response()->json([
                'message' => sprintf(
                    'Para EPSA la hoja obligatoria es "%s". No fue encontrada en el archivo.',
                    (string) ($parseMeta['requested_sheet'] ?? 'Table')
                ),
                'availableSheets' => array_values((array) ($parseMeta['available_sheets'] ?? [])),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $mapping = $isEpsaMode
            ? $this->mapEpsaUploadRows($columns, $rawRows)
            : $this->mapUploadRows($columns, $rawRows, $format);
        if (!$mapping['mapped']) {
            return response()->json([
                'message' => $isEpsaMode
                    ? 'No se pudieron mapear columnas requeridas para EPSA.'
                    : 'No se pudieron mapear columnas al formato general.',
                'unmappedColumns' => $mapping['unmappedColumns'],
                'missingColumns' => $mapping['missingColumns'] ?? [],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $prepared = $isEpsaMode
            ? $this->prepareEpsaUploadStagingAndValidations($mapping['columns'], $mapping['rows'], [
                'client_code' => $validated['client_code'] ?? null,
                'period_from' => $validated['period_from'] ?? null,
                'period_to' => $validated['period_to'] ?? null,
                'mapped_fields' => $mapping['mappedFields'] ?? [],
                'format' => $mapping['format'] ?? null,
            ])
            : $this->prepareUploadStagingAndValidations($mapping['columns'], $mapping['rows'], [
                'client_code' => $validated['client_code'] ?? null,
                'period_from' => $validated['period_from'] ?? null,
                'period_to' => $validated['period_to'] ?? null,
                'mapped_fields' => $mapping['mappedFields'] ?? [],
                'format' => $mapping['format'] ?? null,
            ]);

        $run = DB::transaction(function () use (
            $validated,
            $request,
            $file,
            $storedPath,
            $storedAbsolutePath,
            $rowCount,
            $mapping,
            $prepared,
            $parseMeta,
            $autoObservations,
            $isEpsaMode
        ) {
            $run = LiquidacionImportRun::query()->create([
                'source_system' => $validated['source_system'] ?? 'powerbi',
                'client_code' => $validated['client_code'],
                'period_from' => $validated['period_from'] ?? null,
                'period_to' => $validated['period_to'] ?? null,
                'source_file_name' => $file->getClientOriginalName(),
                'source_file_url' => $storedPath,
                'source_file_hash' => hash_file('sha256', $storedAbsolutePath),
                'status' => $this->normalizeRunStatus($validated['status'] ?? 'CARGADA'),
                'metadata' => [
                    'upload' => [
                        'disk' => 'local',
                        'path' => $storedPath,
                        'mime' => $file->getMimeType(),
                        'sizeBytes' => $file->getSize(),
                        'rowCount' => $rowCount,
                    ],
                    'mapping' => [
                        'mapped' => true,
                        'unmappedColumns' => $mapping['unmappedColumns'],
                        'format' => $mapping['format'],
                        'mode' => $isEpsaMode ? 'EPSA_TABLE' : 'GENERIC',
                        'productColumn' => $mapping['productColumn'] ?? null,
                        'sheet' => $parseMeta['sheet'] ?? null,
                        'sheetName' => $parseMeta['sheet_name'] ?? null,
                        'missingColumns' => $mapping['missingColumns'] ?? [],
                    ],
                    'rules' => [
                        'clientCode' => $validated['client_code'] ?? null,
                        'source' => $prepared['rules_source'] ?? 'default',
                        'blockingRules' => $prepared['rules']['blocking_rules'] ?? [],
                        'tolerances' => $prepared['rules']['tolerances'] ?? [],
                        'tariffsCount' => count($prepared['rules']['tariffs'] ?? []),
                    ],
                    'period' => [
                        'anio' => $validated['anio'] ?? (isset($validated['period_from']) ? (int) Carbon::parse($validated['period_from'])->format('Y') : null),
                        'mes' => $validated['mes'] ?? (isset($validated['period_from']) ? (int) Carbon::parse($validated['period_from'])->format('n') : null),
                        'tipo_periodo' => $validated['tipo_periodo'] ?? null,
                        'quincena' => $validated['quincena'] ?? null,
                        'sucursal_id' => $validated['sucursal_id'] ?? null,
                    ],
                    'importacion' => [
                        'version' => $validated['version'] ?? 1,
                        'anio' => $validated['anio'] ?? null,
                        'mes' => $validated['mes'] ?? null,
                    ],
                    'epsa' => $isEpsaMode
                        ? [
                            'input_rows_count' => (int) ($prepared['stats']['input_rows_count'] ?? 0),
                            'imported_rows_count' => (int) ($prepared['stats']['imported_rows_count'] ?? 0),
                            'ignored_rows_count' => (int) ($prepared['stats']['ignored_rows_count'] ?? 0),
                            'sheet' => $parseMeta['sheet_name'] ?? ($parseMeta['sheet'] ?? null),
                        ]
                        : null,
                ],
                'created_by' => $request->user()?->id,
            ]);

            $this->persistPreparedRows($run, $prepared);
            $this->refreshRunCounters($run);
            $this->syncRunDistributorSnapshots($run);

            $run = $run->fresh();
            if ($run && in_array($run->status, ['RECEIVED', 'CARGADA', 'PROCESADA', 'VALIDATED'], true) && $run->rows_total > 0) {
                $run->status = 'PRELIQUIDACION';
                $run->save();
            }

            if ($run && $autoObservations) {
                $this->clearOpenAutomaticObservations($run);
                $this->generateAutomaticObservations($run);
            }

            return $run ? $run->fresh() : null;
        });

        if (!$run) {
            return response()->json([
                'message' => 'No se pudo crear el run de importación.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        AuditLogger::log($request, 'liquidaciones.run.upload', 'liq_import_run', $run->id, [
            'client_code' => $run->client_code,
            'source_file_name' => $run->source_file_name,
            'source_file_path' => $storedPath,
            'size_bytes' => $file->getSize(),
            'rows_total' => $run->rows_total,
            'rows_ok' => $run->rows_ok,
            'rows_error' => $run->rows_error,
            'rows_alert' => $run->rows_alert,
            'rows_diff' => $run->rows_diff,
        ]);

        return response()->json([
            'message' => 'Archivo procesado y run creado.',
            'data' => $this->serializeRun($run->fresh()),
        ], Response::HTTP_CREATED);
    }

    public function uploadPreview(Request $request)
    {
        $validated = $request->validate([
            'client_code' => ['nullable', 'string', 'max:100'],
            'period_from' => ['nullable', 'date'],
            'period_to' => ['nullable', 'date'],
            'sheet' => ['nullable', 'string', 'max:120'],
            'format' => ['nullable', 'string', 'max:60'],
            'extract_file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:20480'],
        ]);

        $file = $request->file('extract_file');
        if (!$file) {
            return response()->json([
                'message' => 'No se recibió el archivo de extracto.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $extension = strtolower((string) ($file->getClientOriginalExtension() ?: 'bin'));
        if ($extension === 'xls') {
            return response()->json([
                'message' => 'El formato .xls no es compatible. Usá .xlsx o .csv.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $path = $file->getRealPath();
        if (!is_string($path) || $path === '') {
            return response()->json([
                'message' => 'No se pudo leer el archivo.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $sheet = $this->normalizeNullableString($validated['sheet'] ?? null);
        $format = $this->normalizeNullableString($validated['format'] ?? null) ?? 'custom';
        $isEpsaMode = $this->isEpsaUploadMode($validated['client_code'] ?? null, $format);
        if ($isEpsaMode && $extension !== 'csv') {
            $sheet = 'Table';
        }

        [$columns, $rawRows, $rowCount, $parseMeta] = $extension === 'csv'
            ? $this->parseUploadCsv($path)
            : $this->parseUploadXlsx($path, $sheet, $isEpsaMode);

        if ($isEpsaMode && (bool) ($parseMeta['sheet_not_found'] ?? false)) {
            return response()->json([
                'mapped' => false,
                'message' => sprintf(
                    'Para EPSA la hoja obligatoria es "%s".',
                    (string) ($parseMeta['requested_sheet'] ?? 'Table')
                ),
                'sheetNotFound' => true,
                'requestedSheet' => (string) ($parseMeta['requested_sheet'] ?? 'Table'),
                'availableSheets' => array_values((array) ($parseMeta['available_sheets'] ?? [])),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $mapping = $isEpsaMode
            ? $this->mapEpsaUploadRows($columns, $rawRows)
            : $this->mapUploadRows($columns, $rawRows, $format);
        if (!$mapping['mapped']) {
            return response()->json([
                'mapped' => false,
                'rowCount' => $rowCount,
                'detectedColumns' => array_values(array_filter(
                    array_map(static fn ($column) => trim((string) $column), $columns),
                    static fn ($column) => $column !== ''
                )),
                'unmappedColumns' => $mapping['unmappedColumns'] ?? [],
                'missingColumns' => $mapping['missingColumns'] ?? [],
                'productColumn' => null,
                'sampleRows' => [],
            ]);
        }

        $prepared = $isEpsaMode
            ? $this->prepareEpsaUploadStagingAndValidations($mapping['columns'], $mapping['rows'], [
                'client_code' => $validated['client_code'] ?? null,
                'period_from' => $validated['period_from'] ?? null,
                'period_to' => $validated['period_to'] ?? null,
                'mapped_fields' => $mapping['mappedFields'] ?? [],
                'format' => $mapping['format'] ?? null,
            ])
            : $this->prepareUploadStagingAndValidations($mapping['columns'], $mapping['rows'], [
                'client_code' => $validated['client_code'] ?? null,
                'period_from' => $validated['period_from'] ?? null,
                'period_to' => $validated['period_to'] ?? null,
                'mapped_fields' => $mapping['mappedFields'] ?? [],
                'format' => $mapping['format'] ?? null,
            ]);
        $rowsByStatus = [
            'ok' => 0,
            'error' => 0,
            'alert' => 0,
            'diff' => 0,
        ];
        foreach ($prepared['staging_rows'] as $row) {
            $status = strtoupper((string) ($row['validation_status'] ?? ''));
            if ($status === 'OK') {
                $rowsByStatus['ok'] += 1;
            } elseif ($status === 'ERROR_CRITICO') {
                $rowsByStatus['error'] += 1;
            } elseif ($status === 'DIFERENCIA') {
                $rowsByStatus['diff'] += 1;
            } else {
                $rowsByStatus['alert'] += 1;
            }
        }

        $sampleRows = [];
        if ($isEpsaMode) {
            $sampleRows = array_slice($prepared['sample_rows'] ?? [], 0, 5);
        } else {
            foreach (array_slice($mapping['rows'], 0, 5) as $row) {
                $sampleRows[] = [
                    'fecha' => (string) ($row[0] ?? ''),
                    'estacion' => (string) ($row[1] ?? ''),
                    'dominio' => (string) ($row[2] ?? ''),
                    'producto' => (string) ($row[3] ?? ''),
                    'litros' => (string) ($row[6] ?? ''),
                    'importe' => (string) ($row[7] ?? ''),
                ];
            }
        }

        return response()->json([
            'mapped' => true,
            'rowCount' => $rowCount,
            'previewCount' => count($sampleRows),
            'mode' => $isEpsaMode ? 'EPSA_TABLE' : 'GENERIC',
            'sheet' => $parseMeta['sheet'] ?? null,
            'sheetName' => $parseMeta['sheet_name'] ?? null,
            'detectedColumns' => array_values(array_filter(
                array_map(static fn ($column) => trim((string) $column), $columns),
                static fn ($column) => $column !== ''
            )),
            'mappedColumns' => $mapping['columns'],
            'unmappedColumns' => $mapping['unmappedColumns'] ?? [],
            'missingColumns' => $mapping['missingColumns'] ?? [],
            'productColumn' => $mapping['productColumn'] ?? null,
            'productColumnMessage' => ($mapping['productColumn'] ?? null) === 'V'
                ? 'Concepto tomado desde columna V.'
                : ($isEpsaMode ? 'Importación EPSA desde hoja Table.' : 'Concepto tomado por encabezado detectado.'),
            'rowsByStatus' => $rowsByStatus,
            'sampleRows' => $sampleRows,
            'epsaSummary' => $isEpsaMode ? ($prepared['stats'] ?? null) : null,
            'rules' => [
                'source' => $prepared['rules_source'] ?? 'default',
                'blockingRules' => $prepared['rules']['blocking_rules'] ?? [],
                'tolerances' => $prepared['rules']['tolerances'] ?? [],
                'tariffsCount' => count($prepared['rules']['tariffs'] ?? []),
            ],
        ]);
    }

    public function show(LiquidacionImportRun $run)
    {
        $run->loadCount([
            'stagingRows as staging_rows_count',
            'validationResults as validation_results_count',
            'publishJobs as publish_jobs_count',
            'observations as observations_count',
        ]);

        $observationsByStatus = LiquidacionObservation::query()
            ->where('run_id', $run->id)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $latestPublishJob = LiquidacionPublishJob::query()
            ->where('run_id', $run->id)
            ->latest('id')
            ->first();

        return response()->json([
            'data' => $this->serializeRun($run),
            'summary' => [
                'staging_rows_count' => (int) ($run->staging_rows_count ?? 0),
                'validation_results_count' => (int) ($run->validation_results_count ?? 0),
                'publish_jobs_count' => (int) ($run->publish_jobs_count ?? 0),
                'observations_count' => (int) ($run->observations_count ?? 0),
                'observations_by_status' => $observationsByStatus,
            ],
            'latest_publish_job' => $latestPublishJob ? $this->serializePublishJob($latestPublishJob) : null,
        ]);
    }

    public function upsert(Request $request, LiquidacionImportRun $run)
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'force_edit' => ['nullable', 'boolean'],
            'source_file_name' => ['nullable', 'string', 'max:255'],
            'source_file_url' => ['nullable', 'string', 'max:2048'],
            'source_file_hash' => ['nullable', 'string', 'max:128'],
            'metadata' => ['nullable', 'array'],
            'auto_observations' => ['nullable', 'boolean'],
            'replace_validation_results' => ['nullable', 'boolean'],
            'staging_rows' => ['nullable', 'array'],
            'staging_rows.*.staging_row_id' => ['nullable', 'integer', 'min:1'],
            'staging_rows.*.row_number' => ['nullable', 'integer', 'min:1'],
            'staging_rows.*.external_row_id' => ['nullable', 'string', 'max:120'],
            'staging_rows.*.domain_norm' => ['nullable', 'string', 'max:20'],
            'staging_rows.*.occurred_at' => ['nullable'],
            'staging_rows.*.station' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.product' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.invoice_number' => ['nullable', 'string', 'max:120'],
            'staging_rows.*.conductor' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.name_excel_raw' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.name_excel_norm' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.distributor_id' => ['nullable', 'integer'],
            'staging_rows.*.distributor_code' => ['nullable', 'string', 'max:120'],
            'staging_rows.*.distributor_name' => ['nullable', 'string', 'max:255'],
            'staging_rows.*.liters' => ['nullable', 'numeric'],
            'staging_rows.*.amount' => ['nullable', 'numeric'],
            'staging_rows.*.price_per_liter' => ['nullable', 'numeric'],
            'staging_rows.*.tariff_expected' => ['nullable', 'numeric'],
            'staging_rows.*.amount_expected' => ['nullable', 'numeric'],
            'staging_rows.*.validation_status' => ['nullable', 'string', 'max:30'],
            'staging_rows.*.validation_score' => ['nullable', 'numeric'],
            'staging_rows.*.severity_max' => ['nullable', 'string', 'max:20'],
            'staging_rows.*.match_status' => ['nullable', 'string', 'max:40'],
            'staging_rows.*.match_provider_persona_id' => ['nullable', 'integer'],
            'staging_rows.*.is_duplicate' => ['nullable', 'boolean'],
            'staging_rows.*.duplicate_group_key' => ['nullable', 'string', 'max:190'],
            'staging_rows.*.observations_auto' => ['nullable', 'string'],
            'staging_rows.*.raw_payload_json' => ['nullable', 'array'],
            'staging_rows.*.match_candidates_json' => ['nullable', 'array'],
            'validation_results' => ['nullable', 'array'],
            'validation_results.*.staging_row_id' => ['nullable', 'integer'],
            'validation_results.*.row_number' => ['nullable', 'integer', 'min:1'],
            'validation_results.*.external_row_id' => ['nullable', 'string', 'max:120'],
            'validation_results.*.rule_code' => ['required', 'string', 'max:80'],
            'validation_results.*.severity' => ['required', 'string', 'max:20'],
            'validation_results.*.result' => ['required', 'string', 'max:20'],
            'validation_results.*.expected_value' => ['nullable', 'string', 'max:255'],
            'validation_results.*.actual_value' => ['nullable', 'string', 'max:255'],
            'validation_results.*.message' => ['nullable', 'string'],
        ]);

        $autoObservations = array_key_exists('auto_observations', $validated)
            ? (bool) $validated['auto_observations']
            : true;
        $replaceValidationResults = (bool) ($validated['replace_validation_results'] ?? false);
        $forceEdit = (bool) ($validated['force_edit'] ?? false);

        $run = DB::transaction(function () use ($request, $run, $validated, $autoObservations, $replaceValidationResults, $forceEdit) {
            $run = $run->fresh();
            if (!$run) {
                abort(Response::HTTP_NOT_FOUND, 'Run no encontrado.');
            }
            if (!$forceEdit && !in_array(strtoupper((string) $run->status), ['PRELIQUIDACION', 'CARGADA'], true)) {
                abort(Response::HTTP_CONFLICT, 'Solo se puede editar cuando el run está en PRELIQUIDACION.');
            }

            $runDirty = false;
            if (array_key_exists('status', $validated)) {
                $run->status = $this->normalizeRunStatus($validated['status']);
                $runDirty = true;
            }
            if (array_key_exists('source_file_name', $validated)) {
                $run->source_file_name = $this->normalizeNullableString($validated['source_file_name']);
                $runDirty = true;
            }
            if (array_key_exists('source_file_url', $validated)) {
                $run->source_file_url = $this->normalizeNullableString($validated['source_file_url']);
                $runDirty = true;
            }
            if (array_key_exists('source_file_hash', $validated)) {
                $run->source_file_hash = $this->normalizeNullableString($validated['source_file_hash']);
                $runDirty = true;
            }
            if (array_key_exists('metadata', $validated)) {
                $run->metadata = $validated['metadata'];
                $runDirty = true;
            }
            if ($runDirty) {
                $run->save();
            }

            $stagingRows = $validated['staging_rows'] ?? [];
            $stagingIdsByRowNumber = [];
            $stagingIdsByExternal = [];

            foreach ($stagingRows as $index => $row) {
                $rowNumber = isset($row['row_number']) ? (int) $row['row_number'] : ($index + 1);
                $externalRowId = $this->normalizeNullableString($row['external_row_id'] ?? null);

                $staging = null;
                if (isset($row['staging_row_id'])) {
                    $staging = LiquidacionStagingRow::query()
                        ->where('run_id', $run->id)
                        ->where('id', (int) $row['staging_row_id'])
                        ->first();
                }
                if (!$staging && $externalRowId !== null) {
                    $staging = LiquidacionStagingRow::query()
                        ->where('run_id', $run->id)
                        ->where('external_row_id', $externalRowId)
                        ->first();
                }
                if (!$staging && isset($row['row_number'])) {
                    $staging = LiquidacionStagingRow::query()
                        ->where('run_id', $run->id)
                        ->where('row_number', $rowNumber)
                        ->first();
                }
                if (!$staging) {
                    $staging = new LiquidacionStagingRow();
                    $staging->run_id = $run->id;
                }

                $staging->row_number = array_key_exists('row_number', $row)
                    ? $rowNumber
                    : ($staging->row_number ?? $rowNumber);

                if (array_key_exists('external_row_id', $row)) {
                    $staging->external_row_id = $externalRowId;
                }
                if (array_key_exists('domain_norm', $row)) {
                    $staging->domain_norm = $this->normalizeDomain($row['domain_norm']);
                }
                if (array_key_exists('occurred_at', $row)) {
                    $staging->occurred_at = $this->parseDateTimeOrNull($row['occurred_at']);
                }
                if (array_key_exists('station', $row)) {
                    $staging->station = $this->normalizeNullableString($row['station']);
                }
                if (array_key_exists('product', $row)) {
                    $staging->product = $this->normalizeNullableString($row['product']);
                }
                if (array_key_exists('invoice_number', $row)) {
                    $staging->invoice_number = $this->normalizeNullableString($row['invoice_number']);
                }
                if (array_key_exists('conductor', $row)) {
                    $staging->conductor = $this->normalizeNullableString($row['conductor']);
                }
                if (array_key_exists('name_excel_raw', $row)) {
                    $staging->name_excel_raw = $this->normalizeNullableString($row['name_excel_raw']);
                }
                if (array_key_exists('name_excel_norm', $row)) {
                    $staging->name_excel_norm = $this->normalizeNullableString($row['name_excel_norm']);
                }
                if (array_key_exists('distributor_id', $row)) {
                    $staging->distributor_id = isset($row['distributor_id']) ? (int) $row['distributor_id'] : null;
                }
                if (array_key_exists('distributor_code', $row)) {
                    $staging->distributor_code = $this->normalizeNullableString($row['distributor_code']);
                }
                if (array_key_exists('distributor_name', $row)) {
                    $staging->distributor_name = $this->normalizeNullableString($row['distributor_name']);
                }
                if (array_key_exists('liters', $row)) {
                    $staging->liters = $this->parseFloatOrNull($row['liters']);
                }
                if (array_key_exists('amount', $row)) {
                    $staging->amount = $this->parseFloatOrNull($row['amount']);
                }
                if (array_key_exists('price_per_liter', $row)) {
                    $staging->price_per_liter = $this->parseFloatOrNull($row['price_per_liter']);
                }
                if (array_key_exists('tariff_expected', $row)) {
                    $staging->tariff_expected = $this->parseFloatOrNull($row['tariff_expected']);
                }
                if (array_key_exists('amount_expected', $row)) {
                    $staging->amount_expected = $this->parseFloatOrNull($row['amount_expected']);
                }
                if (array_key_exists('validation_status', $row)) {
                    $normalizedStatus = $this->normalizeValidationStatus($row['validation_status']);
                    $staging->validation_status = $normalizedStatus;
                    if (!array_key_exists('severity_max', $row)) {
                        $staging->severity_max = $this->normalizeSeverity($this->severityFromStatus($normalizedStatus));
                    }
                } elseif (!$staging->validation_status) {
                    $staging->validation_status = 'ALERTA';
                }
                if (array_key_exists('validation_score', $row)) {
                    $staging->validation_score = $this->parseFloatOrNull($row['validation_score']);
                }
                if (array_key_exists('severity_max', $row)) {
                    $staging->severity_max = $this->normalizeSeverity($row['severity_max']);
                } elseif (!$staging->severity_max) {
                    $staging->severity_max = $this->normalizeSeverity($this->severityFromStatus((string) $staging->validation_status));
                }
                if (array_key_exists('match_status', $row)) {
                    $staging->match_status = $this->normalizeNullableString($row['match_status']);
                }
                if (array_key_exists('match_provider_persona_id', $row)) {
                    $staging->match_provider_persona_id = isset($row['match_provider_persona_id']) ? (int) $row['match_provider_persona_id'] : null;
                }
                if (array_key_exists('is_duplicate', $row)) {
                    $staging->is_duplicate = (bool) $row['is_duplicate'];
                }
                if (array_key_exists('duplicate_group_key', $row)) {
                    $staging->duplicate_group_key = $this->normalizeNullableString($row['duplicate_group_key']);
                }
                if (array_key_exists('observations_auto', $row)) {
                    $staging->observations_auto = $this->normalizeNullableString($row['observations_auto']);
                }
                if (array_key_exists('raw_payload_json', $row)) {
                    $staging->raw_payload_json = is_array($row['raw_payload_json'] ?? null) ? $row['raw_payload_json'] : null;
                }
                if (array_key_exists('match_candidates_json', $row)) {
                    $staging->match_candidates_json = is_array($row['match_candidates_json'] ?? null) ? $row['match_candidates_json'] : null;
                }

                $staging->save();

                $stagingIdsByRowNumber[(int) $staging->row_number] = $staging->id;
                if ($staging->external_row_id) {
                    $stagingIdsByExternal[$staging->external_row_id] = $staging->id;
                }
            }

            if ($replaceValidationResults) {
                LiquidacionValidationResult::query()->where('run_id', $run->id)->delete();
            }

            $validationRows = $validated['validation_results'] ?? [];
            foreach ($validationRows as $validationRow) {
                $ruleCode = strtoupper(trim((string) $validationRow['rule_code']));

                $stagingRowId = null;
                if (isset($validationRow['staging_row_id'])) {
                    $candidate = (int) $validationRow['staging_row_id'];
                    $belongs = LiquidacionStagingRow::query()
                        ->where('run_id', $run->id)
                        ->where('id', $candidate)
                        ->exists();
                    if ($belongs) {
                        $stagingRowId = $candidate;
                    }
                }

                if ($stagingRowId === null && isset($validationRow['external_row_id'])) {
                    $external = $this->normalizeNullableString($validationRow['external_row_id']);
                    if ($external !== null && isset($stagingIdsByExternal[$external])) {
                        $stagingRowId = $stagingIdsByExternal[$external];
                    } elseif ($external !== null) {
                        $stagingRowId = LiquidacionStagingRow::query()
                            ->where('run_id', $run->id)
                            ->where('external_row_id', $external)
                            ->value('id');
                    }
                }

                if ($stagingRowId === null && isset($validationRow['row_number'])) {
                    $rowNumber = (int) $validationRow['row_number'];
                    if (isset($stagingIdsByRowNumber[$rowNumber])) {
                        $stagingRowId = $stagingIdsByRowNumber[$rowNumber];
                    } else {
                        $stagingRowId = LiquidacionStagingRow::query()
                            ->where('run_id', $run->id)
                            ->where('row_number', $rowNumber)
                            ->value('id');
                    }
                }

                $record = null;
                if (!$replaceValidationResults && $stagingRowId !== null) {
                    $record = LiquidacionValidationResult::query()
                        ->where('run_id', $run->id)
                        ->where('staging_row_id', $stagingRowId)
                        ->where('rule_code', $ruleCode)
                        ->first();
                }

                if (!$record) {
                    $record = new LiquidacionValidationResult();
                    $record->run_id = $run->id;
                    $record->staging_row_id = $stagingRowId;
                    $record->rule_code = $ruleCode;
                }

                $record->severity = $this->normalizeSeverity($validationRow['severity']);
                $record->result = strtoupper(trim((string) $validationRow['result']));
                $record->expected_value = $this->normalizeNullableString($validationRow['expected_value'] ?? null);
                $record->actual_value = $this->normalizeNullableString($validationRow['actual_value'] ?? null);
                $record->message = $this->normalizeNullableString($validationRow['message'] ?? null);
                $record->save();
            }

            $this->refreshRunCounters($run);
            $this->syncRunDistributorSnapshots($run);
            if (in_array($run->status, ['RECEIVED', 'CARGADA', 'NORMALIZED', 'PROCESADA', 'VALIDATED', 'FAILED', 'PARTIAL'], true) && $run->rows_total > 0) {
                $run->status = 'PRELIQUIDACION';
                $run->save();
            }

            if ($autoObservations) {
                $this->clearOpenAutomaticObservations($run);
                $this->generateAutomaticObservations($run);
            }

            AuditLogger::log($request, 'liquidaciones.run.upsert', 'liq_import_run', $run->id, [
                'rows_total' => $run->rows_total,
                'rows_ok' => $run->rows_ok,
                'rows_error' => $run->rows_error,
                'rows_alert' => $run->rows_alert,
                'rows_diff' => $run->rows_diff,
                'replace_validation_results' => $replaceValidationResults,
                'updated_staging_rows' => count($stagingRows),
                'updated_validation_results' => count($validationRows),
            ]);

            return $run->fresh();
        });

        return response()->json([
            'data' => $this->serializeRun($run),
        ]);
    }

    public function approve(Request $request, LiquidacionImportRun $run)
    {
        $validated = $request->validate([
            'force' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $force = (bool) ($validated['force'] ?? false);
        $note = $this->normalizeNullableString($validated['note'] ?? null);

        $run->refresh();
        $this->refreshRunCounters($run);
        $run->refresh();

        if (in_array(strtoupper((string) $run->status), ['PUBLISHED', 'PUBLICADA'], true) && !$force) {
            return response()->json([
                'message' => 'El run ya fue publicado y no puede aprobarse nuevamente sin force=true.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $hasCriticalStatusRows = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->where('validation_status', 'ERROR_CRITICO')
            ->exists();

        $hasCriticalValidationFails = LiquidacionValidationResult::query()
            ->where('run_id', $run->id)
            ->where('severity', 'CRITICAL')
            ->where('result', 'FAIL')
            ->exists();

        if (($hasCriticalStatusRows || $hasCriticalValidationFails) && !$force) {
            return response()->json([
                'message' => 'No se puede aprobar: hay errores críticos pendientes. Usa force=true para sobrescribir.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $hasPendingProviderMatch = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->whereIn('match_status', [self::PROVIDER_MATCH_PENDING, self::PROVIDER_MATCH_NONE])
            ->exists();
        if ($hasPendingProviderMatch && !$force) {
            return response()->json([
                'message' => 'No se puede aprobar: hay filas con proveedor pendiente de asignación.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($run->rows_total === 0 && !$force) {
            return response()->json([
                'message' => 'No se puede aprobar un run sin filas.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($run->rows_ok === 0 && !$force) {
            return response()->json([
                'message' => 'No hay filas OK para aprobar. Usa force=true solo si es intencional.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $metadata = is_array($run->metadata) ? $run->metadata : [];
        $metadata['approval'] = [
            'by' => $request->user()?->id,
            'at' => now()->toIso8601String(),
            'force' => $force,
            'note' => $note,
            'rows_total' => (int) $run->rows_total,
            'rows_ok' => (int) $run->rows_ok,
            'rows_error' => (int) $run->rows_error,
            'rows_alert' => (int) $run->rows_alert,
            'rows_diff' => (int) $run->rows_diff,
        ];

        $run->status = 'APROBADA';
        $run->approved_by = $request->user()?->id;
        $run->approved_at = now();
        $run->metadata = $metadata;
        $run->save();

        AuditLogger::log($request, 'liquidaciones.run.approve', 'liq_import_run', $run->id, [
            'force' => $force,
            'note' => $note,
            'rows_total' => $run->rows_total,
            'rows_ok' => $run->rows_ok,
            'rows_error' => $run->rows_error,
            'rows_alert' => $run->rows_alert,
            'rows_diff' => $run->rows_diff,
        ]);

        return response()->json([
            'message' => 'Run aprobado correctamente.',
            'data' => $this->serializeRun($run->fresh()),
        ]);
    }

    public function publishToErp(Request $request, LiquidacionImportRun $run)
    {
        $validated = $request->validate([
            'dry_run' => ['nullable', 'boolean'],
            'force' => ['nullable', 'boolean'],
            'queue' => ['nullable', 'boolean'],
            'only_distributor_code' => ['nullable', 'string', 'max:120'],
            'liquidacion_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $dryRun = (bool) ($validated['dry_run'] ?? false);
        $force = (bool) ($validated['force'] ?? false);
        $queuePublish = array_key_exists('queue', $validated)
            ? (bool) $validated['queue']
            : (bool) config('services.erp.queue_enabled', true);
        $onlyDistributorCode = $this->normalizeNullableString($validated['only_distributor_code'] ?? null);

        if (!$force && !in_array(strtoupper((string) $run->status), ['APROBADA', 'APPROVED', 'PRELIQUIDACION', 'VALIDATED'], true)) {
            return response()->json([
                'message' => 'El run debe estar en estado APROBADA/PRELIQUIDACION para publicar.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $hasCriticalFails = LiquidacionValidationResult::query()
            ->where('run_id', $run->id)
            ->where('severity', 'CRITICAL')
            ->where('result', 'FAIL')
            ->exists();

        if ($hasCriticalFails && !$force) {
            return response()->json([
                'message' => 'Existen validaciones críticas fallidas. Corregí o publica con force=true.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $okRowsQuery = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->where('validation_status', 'OK');

        if ($onlyDistributorCode !== null) {
            $okRowsQuery->where('distributor_code', $onlyDistributorCode);
        }

        $okRows = $okRowsQuery->orderBy('row_number')->get();
        if ($okRows->isEmpty()) {
            return response()->json([
                'message' => 'No hay filas OK para publicar.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $distributorPayloads = $this->buildDistributorPayloads($run, $okRows);
        $facturacionPayload = $this->buildFacturacionPayload($run, $okRows, $validated['liquidacion_id'] ?? null);

        $publishJob = LiquidacionPublishJob::query()->create([
            'run_id' => $run->id,
            'status' => 'PENDING',
            'request_payload' => json_encode([
                'distributor_payloads' => $distributorPayloads,
                'facturacion_payload' => $facturacionPayload,
            ], JSON_UNESCAPED_UNICODE),
            'created_by' => $request->user()?->id,
        ]);

        if ($dryRun) {
            $publishJob->update([
                'status' => 'DRY_RUN',
                'response_payload' => json_encode([
                    'message' => 'Dry run ejecutado. No se enviaron datos al ERP.',
                    'distributor_payloads' => $distributorPayloads,
                    'facturacion_payload' => $facturacionPayload,
                ], JSON_UNESCAPED_UNICODE),
            ]);

            AuditLogger::log($request, 'liquidaciones.run.publish_erp.dry_run', 'liq_import_run', $run->id, [
                'publish_job_id' => $publishJob->id,
                'rows_published_candidate' => $okRows->count(),
                'distributors' => count($distributorPayloads),
            ]);

            return response()->json([
                'data' => $this->serializePublishJob($publishJob->fresh()),
                'dry_run' => true,
            ]);
        }

        $erpClient = app(ErpClient::class);
        if (!$erpClient->canPublish()) {
            $publishJob->update([
                'status' => 'FAILED',
                'error_message' => 'Integración ERP deshabilitada o sin base_url configurada.',
            ]);

            return response()->json([
                'message' => 'Integración ERP deshabilitada o sin configuración.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($queuePublish) {
            $publishJob->update(['status' => 'QUEUED']);
            ProcessLiquidacionPublishJob::dispatch($publishJob->id, $request->user()?->id);

            AuditLogger::log($request, 'liquidaciones.run.publish_erp.queued', 'liq_import_run', $run->id, [
                'publish_job_id' => $publishJob->id,
                'rows_ok' => $okRows->count(),
                'distributor_payloads' => count($distributorPayloads),
            ]);

            return response()->json([
                'message' => 'Publicación ERP encolada.',
                'queued' => true,
                'data' => $this->serializePublishJob($publishJob->fresh()),
                'run' => $this->serializeRun($run->fresh()),
            ], Response::HTTP_ACCEPTED);
        }

        $result = app(LiquidacionPublishProcessor::class)->process($publishJob, $request->user()?->id);
        /** @var LiquidacionPublishJob $publishJob */
        $publishJob = $result['publish_job'] ?? $publishJob->fresh();
        /** @var LiquidacionImportRun $run */
        $run = $result['run'] ?? $run->fresh();

        AuditLogger::log($request, 'liquidaciones.run.publish_erp', 'liq_import_run', $run->id, [
            'publish_job_id' => $publishJob->id,
            'status' => $publishJob->status,
            'rows_ok' => $okRows->count(),
            'distributor_payloads' => count($distributorPayloads),
            'mode' => 'sync',
        ]);

        return response()->json([
            'queued' => false,
            'data' => $this->serializePublishJob($publishJob),
            'run' => $this->serializeRun($run),
        ]);
    }

    public function rulesTemplate()
    {
        $path = resource_path('liquidaciones/rules-template.json');
        if (!is_file($path)) {
            return response()->json([
                'message' => 'No se encontró la plantilla de reglas.',
            ], Response::HTTP_NOT_FOUND);
        }

        $raw = file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return response()->json([
                'message' => 'La plantilla de reglas está vacía.',
            ], Response::HTTP_NOT_FOUND);
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return response()->json([
                'message' => 'La plantilla de reglas no es un JSON válido.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json($decoded);
    }

    public function showClientRules(string $clientCode)
    {
        $normalizedClientCode = $this->normalizeClientCode($clientCode);
        $exactRule = LiquidacionClientRule::query()
            ->where('client_code', $normalizedClientCode)
            ->first();
        $effectiveRule = $this->resolveActiveClientRuleRecord($normalizedClientCode);

        $resolved = $this->resolveClientRuleSet($normalizedClientCode);
        $source = (string) ($resolved['source'] ?? 'default');
        $resolvedRule = $source === 'client_fallback'
            ? $effectiveRule
            : ($source === 'client' ? $effectiveRule : null);
        $recordForResponse = $resolvedRule ?? $exactRule;
        $exists = $recordForResponse !== null;

        return response()->json([
            'data' => [
                'clientCode' => $normalizedClientCode,
                'exists' => $exists,
                'active' => $recordForResponse?->active ?? false,
                'rules' => $recordForResponse?->rules_json ?? null,
                'resolvedRules' => $resolved['rules'],
                'source' => $source,
                'matchedClientCode' => $recordForResponse?->client_code,
                'updatedAt' => $recordForResponse?->updated_at?->toIso8601String(),
            ],
        ]);
    }

    public function upsertClientRules(Request $request, string $clientCode)
    {
        $validated = $request->validate([
            'active' => ['nullable', 'boolean'],
            'rules' => ['required', 'array'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $normalizedClientCode = $this->normalizeClientCode($clientCode);
        $active = array_key_exists('active', $validated) ? (bool) $validated['active'] : true;
        $note = $this->normalizeNullableString($validated['note'] ?? null);
        $rules = is_array($validated['rules']) ? $validated['rules'] : [];

        $record = LiquidacionClientRule::query()->updateOrCreate(
            ['client_code' => $normalizedClientCode],
            [
                'active' => $active,
                'rules_json' => $rules,
                'note' => $note,
                'updated_by' => $request->user()?->id,
            ]
        );

        $resolved = $this->resolveClientRuleSet($normalizedClientCode);
        AuditLogger::log($request, 'liquidaciones.client_rules.upsert', 'liq_client_rules', $record->id, [
            'client_code' => $normalizedClientCode,
            'active' => $record->active,
            'source' => $resolved['source'],
            'tariffs_count' => count($resolved['rules']['tariffs'] ?? []),
        ]);

        return response()->json([
            'message' => 'Reglas de cliente guardadas correctamente.',
            'data' => [
                'id' => $record->id,
                'clientCode' => $normalizedClientCode,
                'active' => $record->active,
                'rules' => $record->rules_json ?? [],
                'resolvedRules' => $resolved['rules'],
                'source' => $resolved['source'],
                'updatedAt' => $record->updated_at?->toIso8601String(),
            ],
        ]);
    }

    private function buildDistributorPayloads(LiquidacionImportRun $run, $rows): array
    {
        $groups = [];
        foreach ($rows as $row) {
            $code = $this->normalizeNullableString($row->distributor_code) ?? 'SIN-CODIGO';
            $name = $this->normalizeNullableString($row->distributor_name) ?? 'Sin distribuidor';
            if (!isset($groups[$code])) {
                $groups[$code] = [
                    'runId' => $run->id,
                    'cliente' => ['codigo' => $run->client_code],
                    'periodo' => [
                        'desde' => optional($run->period_from)->format('Y-m-d'),
                        'hasta' => optional($run->period_to)->format('Y-m-d'),
                    ],
                    'distribuidor' => [
                        'codigo' => $code,
                        'nombre' => $name,
                    ],
                    'totales' => [
                        'litros' => 0.0,
                        'importe' => 0.0,
                        'totalLiquidar' => 0.0,
                    ],
                    'items' => [],
                ];
            }

            $liters = (float) ($row->liters ?? 0);
            $amount = (float) ($row->amount ?? 0);
            $groups[$code]['totales']['litros'] += $liters;
            $groups[$code]['totales']['importe'] += $amount;
            $groups[$code]['totales']['totalLiquidar'] += $amount;

            $groups[$code]['items'][] = [
                'rowId' => $row->id,
                'rowNumber' => $row->row_number,
                'fecha' => $row->occurred_at ? $row->occurred_at->toIso8601String() : null,
                'dominio' => $row->domain_norm,
                'estacion' => $row->station,
                'producto' => $row->product,
                'litros' => $liters,
                'importe' => $amount,
                'precioLitro' => (float) ($row->price_per_liter ?? 0),
                'comprobante' => $row->invoice_number,
                'conductor' => $row->conductor,
            ];
        }

        return array_values($groups);
    }

    private function buildFacturacionPayload(LiquidacionImportRun $run, $rows, ?int $liquidacionId): array
    {
        $baseFacturar = 0.0;
        $liters = 0.0;
        foreach ($rows as $row) {
            $baseFacturar += (float) ($row->amount ?? 0);
            $liters += (float) ($row->liters ?? 0);
        }

        return [
            'runId' => $run->id,
            'cliente' => ['codigo' => $run->client_code],
            'periodo' => [
                'desde' => optional($run->period_from)->format('Y-m-d'),
                'hasta' => optional($run->period_to)->format('Y-m-d'),
            ],
            'baseFacturar' => round($baseFacturar, 2),
            'descuentosCombustible' => round($baseFacturar, 2),
            'netoFacturar' => 0.0,
            'totales' => [
                'litros' => round($liters, 3),
                'importe' => round($baseFacturar, 2),
            ],
            'referencias' => [
                'liquidacionDocumentoId' => $liquidacionId,
                'runStatus' => $run->status,
            ],
        ];
    }

    private function persistPreparedRows(LiquidacionImportRun $run, array $prepared): void
    {
        $stagingRowIdsByNumber = [];

        foreach ($prepared['staging_rows'] ?? [] as $row) {
            $created = LiquidacionStagingRow::query()->create([
                'run_id' => $run->id,
                'row_number' => isset($row['row_number']) ? (int) $row['row_number'] : null,
                'external_row_id' => $this->normalizeNullableString($row['external_row_id'] ?? null),
                'domain_norm' => $this->normalizeDomain($row['domain_norm'] ?? null),
                'occurred_at' => $this->parseDateTimeOrNull($row['occurred_at'] ?? null),
                'station' => $this->normalizeNullableString($row['station'] ?? null),
                'product' => $this->normalizeNullableString($row['product'] ?? null),
                'invoice_number' => $this->normalizeNullableString($row['invoice_number'] ?? null),
                'conductor' => $this->normalizeNullableString($row['conductor'] ?? null),
                'name_excel_raw' => $this->normalizeNullableString($row['name_excel_raw'] ?? null),
                'name_excel_norm' => $this->normalizeNullableString($row['name_excel_norm'] ?? null),
                'distributor_id' => isset($row['distributor_id']) ? (int) $row['distributor_id'] : null,
                'distributor_code' => $this->normalizeNullableString($row['distributor_code'] ?? null),
                'distributor_name' => $this->normalizeNullableString($row['distributor_name'] ?? null),
                'liters' => $this->parseFloatOrNull($row['liters'] ?? null),
                'amount' => $this->parseFloatOrNull($row['amount'] ?? null),
                'price_per_liter' => $this->parseFloatOrNull($row['price_per_liter'] ?? null),
                'tariff_expected' => $this->parseFloatOrNull($row['tariff_expected'] ?? null),
                'amount_expected' => $this->parseFloatOrNull($row['amount_expected'] ?? null),
                'validation_status' => $this->normalizeValidationStatus($row['validation_status'] ?? null),
                'validation_score' => $this->parseFloatOrNull($row['validation_score'] ?? null),
                'severity_max' => $this->normalizeSeverity($row['severity_max'] ?? null),
                'match_status' => $this->normalizeNullableString($row['match_status'] ?? null),
                'match_provider_persona_id' => isset($row['match_provider_persona_id']) ? (int) $row['match_provider_persona_id'] : null,
                'is_duplicate' => (bool) ($row['is_duplicate'] ?? false),
                'duplicate_group_key' => $this->normalizeNullableString($row['duplicate_group_key'] ?? null),
                'observations_auto' => $this->normalizeNullableString($row['observations_auto'] ?? null),
                'raw_payload_json' => is_array($row['raw_payload_json'] ?? null) ? $row['raw_payload_json'] : null,
                'match_candidates_json' => is_array($row['match_candidates_json'] ?? null) ? $row['match_candidates_json'] : null,
            ]);

            if ($created->row_number !== null) {
                $stagingRowIdsByNumber[(int) $created->row_number] = $created->id;
            }
        }

        foreach ($prepared['validation_results'] ?? [] as $validation) {
            $rowNumber = isset($validation['row_number']) ? (int) $validation['row_number'] : null;
            $stagingRowId = $rowNumber !== null ? ($stagingRowIdsByNumber[$rowNumber] ?? null) : null;

            LiquidacionValidationResult::query()->create([
                'run_id' => $run->id,
                'staging_row_id' => $stagingRowId,
                'rule_code' => strtoupper(trim((string) ($validation['rule_code'] ?? 'RULE'))),
                'severity' => $this->normalizeSeverity($validation['severity'] ?? null),
                'result' => strtoupper(trim((string) ($validation['result'] ?? 'FAIL'))),
                'expected_value' => $this->normalizeNullableString($validation['expected_value'] ?? null),
                'actual_value' => $this->normalizeNullableString($validation['actual_value'] ?? null),
                'message' => $this->normalizeNullableString($validation['message'] ?? null),
            ]);
        }
    }

    private function prepareUploadStagingAndValidations(array $columns, array $rows, array $context = []): array
    {
        $normalizedClientCode = $this->normalizeClientCode($context['client_code'] ?? null);
        $rulesPayload = $this->resolveClientRuleSet($normalizedClientCode);
        $rules = $rulesPayload['rules'];
        $periodFrom = $this->parseDateOnlyOrNull($context['period_from'] ?? null);
        $periodTo = $this->parseDateOnlyOrNull($context['period_to'] ?? null);
        $mappedFields = collect(is_array($context['mapped_fields'] ?? null) ? $context['mapped_fields'] : [])
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => $value !== '')
            ->values()
            ->all();
        $hasDateColumn = in_array('Fecha', $mappedFields, true);
        $hasLitersColumn = in_array('Litros', $mappedFields, true);

        $columnIndexes = [];
        foreach ($columns as $index => $name) {
            $columnIndexes[$name] = $index;
        }

        $preferredDateOrder = $this->resolvePreferredUploadDateOrder($rows, $columnIndexes);
        $totalRows = max(1, count($rows));
        $dateValueCount = 0;
        $dateParseableCount = 0;
        $litersValueCount = 0;
        $litersNumericCount = 0;
        foreach ($rows as $rowForCoverage) {
            $dateRawCoverage = $this->getUploadRowValue($rowForCoverage, $columnIndexes, 'Fecha');
            if ($dateRawCoverage !== '') {
                $dateValueCount += 1;
                if ($this->parseUploadDate($dateRawCoverage, $preferredDateOrder) !== null) {
                    $dateParseableCount += 1;
                }
            }

            $litersRawCoverage = $this->getUploadRowValue($rowForCoverage, $columnIndexes, 'Litros');
            if ($litersRawCoverage !== '') {
                $litersValueCount += 1;
                if ($this->parseFloatOrNull($litersRawCoverage) !== null) {
                    $litersNumericCount += 1;
                }
            }
        }
        $dateCoverage = $dateValueCount / $totalRows;
        $dateParseCoverage = $dateParseableCount / $totalRows;
        $litersCoverage = $litersValueCount / $totalRows;
        $litersNumericCoverage = $litersNumericCount / $totalRows;
        $requireDateValidation = $hasDateColumn && $dateCoverage >= 0.60 && $dateParseCoverage >= 0.40;
        $requireLitersValidation = $hasLitersColumn && $litersCoverage >= 0.60 && $litersNumericCoverage >= 0.40;
        $enforcePeriodValidation = ($periodFrom !== null || $periodTo !== null) && $hasDateColumn;
        if ($enforcePeriodValidation && $dateParseableCount > 0) {
            $datesWithinPeriod = 0;
            foreach ($rows as $rowForPeriod) {
                $parsedDate = $this->parseUploadDate(
                    $this->getUploadRowValue($rowForPeriod, $columnIndexes, 'Fecha'),
                    $preferredDateOrder
                );
                if ($parsedDate === null) {
                    continue;
                }

                $isOutsideFrom = $periodFrom !== null && $parsedDate->copy()->startOfDay()->lt($periodFrom->copy()->startOfDay());
                $isOutsideTo = $periodTo !== null && $parsedDate->copy()->startOfDay()->gt($periodTo->copy()->startOfDay());
                if (!$isOutsideFrom && !$isOutsideTo) {
                    $datesWithinPeriod += 1;
                }
            }

            $withinCoverage = $datesWithinPeriod / max(1, $dateParseableCount);
            if ($withinCoverage < 0.35) {
                $requireDateValidation = false;
                $enforcePeriodValidation = false;
            }
        }
        $allowNegativeAmount = !$requireLitersValidation;

        $seenDuplicates = [];
        $stagingRows = [];
        $validationResults = [];

        foreach ($rows as $index => $row) {
            $rowNumber = $index + 1;

            $dateRaw = $this->getUploadRowValue($row, $columnIndexes, 'Fecha');
            $station = $this->getUploadRowValue($row, $columnIndexes, 'Estación');
            $domainRaw = $this->getUploadRowValue($row, $columnIndexes, 'Dominio');
            $product = $this->getUploadRowValue($row, $columnIndexes, 'Producto');
            $invoice = $this->getUploadRowValue($row, $columnIndexes, 'Nro. Factura');
            $conductor = $this->getUploadRowValue($row, $columnIndexes, 'Conductor');
            $litersRaw = $this->getUploadRowValue($row, $columnIndexes, 'Litros');
            $amountRaw = $this->getUploadRowValue($row, $columnIndexes, 'Importe');
            $priceRaw = $this->getUploadRowValue($row, $columnIndexes, 'Precio/Litro');

            $domainNorm = $this->normalizeDomain($domainRaw);
            $occurredAt = $this->parseUploadDate($dateRaw, $preferredDateOrder);
            $liters = $this->parseFloatOrNull($litersRaw);
            $amount = $this->parseFloatOrNull($amountRaw);
            $price = $this->parseFloatOrNull($priceRaw);
            $nameExcelRaw = $this->normalizeNullableString($conductor);
            $nameExcelNorm = $this->normalizePersonName((string) $conductor);
            if ($liters !== null && $amount !== null) {
                $liters = $this->normalizeUploadLiters($liters, $price, $amount);
            }
            if ($amount === null && $price !== null && $liters !== null && $liters > 0) {
                $amount = round($price * $liters, 2);
            }

            if ($this->isUploadSummaryLikeRow(
                $domainRaw,
                $station,
                $product,
                $invoice,
                $conductor,
                $liters,
                $amount
            )) {
                continue;
            }

            $criticalIssues = [];
            $warningIssues = [];
            $hasDifference = false;

            $providerMatch = $this->resolveProviderMatch(
                $normalizedClientCode,
                $domainNorm,
                $nameExcelNorm
            );
            $matchStatus = (string) ($providerMatch['status'] ?? self::PROVIDER_MATCH_NONE);
            $providerId = isset($providerMatch['provider_id']) ? (int) $providerMatch['provider_id'] : null;
            $providerName = $this->normalizeNullableString((string) ($providerMatch['provider_name'] ?? ''));
            $matchCandidates = is_array($providerMatch['candidates'] ?? null) ? $providerMatch['candidates'] : [];

            if ($matchStatus === self::PROVIDER_MATCH_PENDING) {
                $warningIssues[] = 'Proveedor pendiente de asignación manual.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'PROVIDER_MATCH_PENDING',
                    'WARNING',
                    'Proveedor identificado',
                    $nameExcelRaw ?? $domainRaw,
                    'No se pudo resolver proveedor por patente. Requiere asignación manual por nombre.'
                );
            } elseif ($matchStatus === self::PROVIDER_MATCH_NONE) {
                $criticalIssues[] = 'Proveedor sin match por patente ni nombre.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'PROVIDER_MATCH_REQUIRED',
                    'CRITICAL',
                    'Proveedor identificado',
                    $nameExcelRaw ?? $domainRaw,
                    'Sin match de proveedor por patente y sin candidatos válidos por nombre.'
                );
            }

            if ($domainNorm === null) {
                $criticalIssues[] = 'Dominio vacío o inválido';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'DOMAIN_REQUIRED',
                    'CRITICAL',
                    'Dominio no vacío',
                    $domainRaw,
                    'Dominio vacío o inválido'
                );
            }
            if ($requireDateValidation && $occurredAt === null) {
                $criticalIssues[] = 'Fecha inválida';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'DATE_VALID',
                    'CRITICAL',
                    'Fecha válida',
                    $dateRaw,
                    'Fecha inválida o no reconocida'
                );
            }
            if ($requireLitersValidation && ($liters === null || $liters <= 0)) {
                $criticalIssues[] = 'Litros inválidos';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'LITERS_VALID',
                    'CRITICAL',
                    'Litros > 0',
                    $litersRaw,
                    'Litros inválidos'
                );
            }
            if ($amount === null || (!$allowNegativeAmount && $amount < 0)) {
                $criticalIssues[] = 'Importe inválido';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'AMOUNT_VALID',
                    'CRITICAL',
                    $allowNegativeAmount ? 'Importe numérico' : 'Importe >= 0',
                    $amountRaw,
                    'Importe inválido'
                );
            }

            $outsidePeriodBlocking = (bool) ($rules['blocking_rules']['outside_period'] ?? true);
            if ($enforcePeriodValidation && $occurredAt !== null) {
                $isOutsideFrom = $periodFrom !== null && $occurredAt->copy()->startOfDay()->lt($periodFrom->copy()->startOfDay());
                $isOutsideTo = $periodTo !== null && $occurredAt->copy()->startOfDay()->gt($periodTo->copy()->startOfDay());
                if ($isOutsideFrom || $isOutsideTo) {
                    $message = 'Fecha fuera del período del run.';
                    if ($outsidePeriodBlocking) {
                        $criticalIssues[] = $message;
                    } else {
                        $warningIssues[] = $message;
                    }

                    $this->addUploadValidationFail(
                        $validationResults,
                        $rowNumber,
                        'PERIOD_RANGE',
                        $outsidePeriodBlocking ? 'CRITICAL' : 'WARNING',
                        trim(implode(' - ', array_filter([
                            $periodFrom?->toDateString(),
                            $periodTo?->toDateString(),
                        ]))),
                        $occurredAt->toDateString(),
                        $message
                    );
                }
            }

            $duplicateKey = $this->buildUploadDuplicateKey($domainNorm ?? '', $occurredAt, $amount, $liters, $station);
            $isDuplicate = $duplicateKey !== '' && isset($seenDuplicates[$duplicateKey]);
            if ($duplicateKey !== '') {
                $seenDuplicates[$duplicateKey] = true;
            }

            $duplicateBlocking = (bool) ($rules['blocking_rules']['duplicate_row'] ?? false);
            if ($isDuplicate) {
                $message = 'Fila duplicada dentro del extracto';
                if ($duplicateBlocking) {
                    $criticalIssues[] = $message;
                } else {
                    $warningIssues[] = $message;
                    $hasDifference = true;
                }

                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'DUPLICATE_ROW',
                    $duplicateBlocking ? 'CRITICAL' : 'WARNING',
                    'Fila única por dominio/fecha/importe/litros/estación',
                    $duplicateKey,
                    $message
                );
            }

            $expectedTariff = $this->resolveExpectedTariff($rules, $product, $occurredAt);
            $tariffExpectedValue = $expectedTariff['price_per_liter'] ?? null;
            $tariffTolerancePercent = $expectedTariff['tolerance_percent'] ?? ($rules['tolerances']['price_per_liter_percent'] ?? 0.0);
            $tariffToleranceAmount = $expectedTariff['tolerance_amount'] ?? ($rules['tolerances']['price_per_liter_amount'] ?? 0.0);
            $actualPrice = $this->resolveActualPricePerLiter($price, $amount, $liters);
            $amountExpected = ($tariffExpectedValue !== null && $liters !== null)
                ? round($tariffExpectedValue * $liters, 2)
                : null;

            $tariffMismatchBlocking = (bool) ($rules['blocking_rules']['tariff_mismatch'] ?? false);
            if ($tariffExpectedValue !== null && $actualPrice !== null) {
                $maxAllowedDiff = max(
                    (abs($tariffExpectedValue) * ((float) $tariffTolerancePercent / 100)),
                    (float) $tariffToleranceAmount
                );
                $actualDiff = abs($actualPrice - $tariffExpectedValue);
                if ($actualDiff > $maxAllowedDiff) {
                    $message = sprintf(
                        'Tarifa fuera de tolerancia. Esperado %.4f, actual %.4f.',
                        $tariffExpectedValue,
                        $actualPrice
                    );
                    if ($tariffMismatchBlocking) {
                        $criticalIssues[] = $message;
                    } else {
                        $warningIssues[] = $message;
                        $hasDifference = true;
                    }
                    $this->addUploadValidationFail(
                        $validationResults,
                        $rowNumber,
                        'TARIFF_CLIENT',
                        $tariffMismatchBlocking ? 'CRITICAL' : 'WARNING',
                        (string) $tariffExpectedValue,
                        (string) $actualPrice,
                        $message
                    );
                }
            }

            if (!empty($criticalIssues)) {
                $validationStatus = 'ERROR_CRITICO';
            } elseif (!empty($warningIssues)) {
                $validationStatus = $hasDifference ? 'DIFERENCIA' : 'ALERTA';
            } else {
                $validationStatus = 'OK';
            }

            $severityMax = $validationStatus === 'ERROR_CRITICO' ? 'CRITICAL'
                : ($validationStatus === 'OK' ? 'INFO' : 'WARNING');

            $observations = array_merge($criticalIssues, $warningIssues);
            $validationScore = $validationStatus === 'OK' ? 100.0
                : ($validationStatus === 'ERROR_CRITICO' ? 0.0 : 75.0);

            $stagingRows[] = [
                'row_number' => $rowNumber,
                'domain_norm' => $domainNorm,
                'occurred_at' => $occurredAt?->toIso8601String(),
                'station' => $this->normalizeNullableString($station),
                'product' => $this->normalizeNullableString($product),
                'invoice_number' => $this->normalizeNullableString($invoice),
                'conductor' => $this->normalizeNullableString($conductor),
                'name_excel_raw' => $nameExcelRaw,
                'name_excel_norm' => $nameExcelNorm,
                'distributor_id' => $providerId,
                'distributor_code' => $providerId !== null ? ($domainNorm ?? ('PERS-' . $providerId)) : null,
                'distributor_name' => $providerName,
                'liters' => $liters,
                'amount' => $amount,
                'price_per_liter' => $price,
                'tariff_expected' => $tariffExpectedValue,
                'amount_expected' => $amountExpected,
                'validation_status' => $validationStatus,
                'validation_score' => $validationScore,
                'severity_max' => $severityMax,
                'match_status' => $matchStatus,
                'match_provider_persona_id' => $providerId,
                'is_duplicate' => $isDuplicate,
                'duplicate_group_key' => $isDuplicate ? $duplicateKey : null,
                'observations_auto' => !empty($observations) ? implode('; ', $observations) : null,
                'raw_payload_json' => [
                    'mapped' => [
                        'Fecha' => $dateRaw,
                        'Estación' => $station,
                        'Dominio' => $domainRaw,
                        'Producto' => $product,
                        'Nro. Factura' => $invoice,
                        'Conductor' => $conductor,
                        'Litros' => $litersRaw,
                        'Importe' => $amountRaw,
                        'Precio/Litro' => $priceRaw,
                    ],
                    'rules' => [
                        'clientCode' => $normalizedClientCode,
                        'tariffExpected' => $tariffExpectedValue,
                        'actualPricePerLiter' => $actualPrice,
                        'tariffTolerancePercent' => $tariffTolerancePercent,
                        'tariffToleranceAmount' => $tariffToleranceAmount,
                    ],
                ],
                'match_candidates_json' => $matchCandidates,
            ];
        }

        return [
            'staging_rows' => $stagingRows,
            'validation_results' => $validationResults,
            'rules' => $rules,
            'rules_source' => $rulesPayload['source'] ?? 'default',
        ];
    }

    private function buildPendingMatchItems(LiquidacionImportRun $run): array
    {
        $rows = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->whereIn('match_status', [self::PROVIDER_MATCH_PENDING, self::PROVIDER_MATCH_NONE])
            ->orderBy('row_number')
            ->orderBy('id')
            ->get();

        $items = [];
        foreach ($rows as $row) {
            $key = ($row->domain_norm ?? '') . '|' . ($row->name_excel_norm ?? '');
            if (isset($items[$key])) {
                continue;
            }
            $items[$key] = [
                'row_id' => $row->id,
                'row_number' => $row->row_number,
                'patente_norm' => $row->domain_norm,
                'nombre_excel_raw' => $row->name_excel_raw,
                'nombre_excel_norm' => $row->name_excel_norm,
                'match_status' => $row->match_status,
                'candidatos' => is_array($row->match_candidates_json) ? $row->match_candidates_json : [],
            ];
        }

        return array_values($items);
    }

    private function resolveProviderMatch(?string $clientCode, ?string $patenteNorm, ?string $nameExcelNorm): array
    {
        if (!Schema::hasTable('personas')) {
            return [
                'status' => self::PROVIDER_MATCH_PATENTE,
                'provider_id' => null,
                'provider_name' => null,
                'candidates' => [],
            ];
        }

        if ($patenteNorm !== null) {
            $providerByPatente = $this->findProviderByPatenteNorm($patenteNorm);
            if ($providerByPatente) {
                return [
                    'status' => self::PROVIDER_MATCH_PATENTE,
                    'provider_id' => $providerByPatente->id,
                    'provider_name' => $this->buildProviderDisplayName($providerByPatente),
                    'candidates' => [],
                ];
            }

            $providerByAlias = $this->findProviderByAlias($clientCode, 'PATENTE', $patenteNorm);
            if ($providerByAlias) {
                return [
                    'status' => self::PROVIDER_MATCH_ALIAS,
                    'provider_id' => $providerByAlias->id,
                    'provider_name' => $this->buildProviderDisplayName($providerByAlias),
                    'candidates' => [],
                ];
            }
        }

        if ($nameExcelNorm === null) {
            return [
                'status' => self::PROVIDER_MATCH_NONE,
                'provider_id' => null,
                'provider_name' => null,
                'candidates' => [],
            ];
        }

        $candidates = $this->findProviderCandidatesByName($nameExcelNorm, 10);
        if (!empty($candidates)) {
            return [
                'status' => self::PROVIDER_MATCH_PENDING,
                'provider_id' => null,
                'provider_name' => null,
                'candidates' => $candidates,
            ];
        }

        return [
            'status' => self::PROVIDER_MATCH_NONE,
            'provider_id' => null,
            'provider_name' => null,
            'candidates' => [],
        ];
    }

    private function resolveEpsaProviderMatch(?string $clientCode, ?string $distribuidorNorm): array
    {
        if (!Schema::hasTable('personas') || $distribuidorNorm === null) {
            return [
                'status' => self::PROVIDER_MATCH_NONE,
                'provider_id' => null,
                'provider_name' => null,
                'candidates' => [],
            ];
        }

        $providerByAlias = $this->findProviderByAlias($clientCode, 'DISTRIBUIDOR', $distribuidorNorm);
        if ($providerByAlias) {
            return [
                'status' => 'DISTRIBUIDOR_ALIAS_OK',
                'provider_id' => $providerByAlias->id,
                'provider_name' => $this->buildProviderDisplayName($providerByAlias),
                'candidates' => [],
            ];
        }

        $providerByExactName = $this->findProviderByExactNormalizedName($distribuidorNorm);
        if ($providerByExactName) {
            return [
                'status' => 'DISTRIBUIDOR_OK',
                'provider_id' => $providerByExactName->id,
                'provider_name' => $this->buildProviderDisplayName($providerByExactName),
                'candidates' => [],
            ];
        }

        $candidates = $this->findProviderCandidatesByName($distribuidorNorm, 10);
        if (!empty($candidates)) {
            return [
                'status' => self::PROVIDER_MATCH_PENDING,
                'provider_id' => null,
                'provider_name' => null,
                'candidates' => $candidates,
            ];
        }

        return [
            'status' => self::PROVIDER_MATCH_NONE,
            'provider_id' => null,
            'provider_name' => null,
            'candidates' => [],
        ];
    }

    private function findProviderByPatenteNorm(string $patenteNorm): ?Persona
    {
        return Persona::query()
            ->whereRaw($this->sqlNormalizePlateExpression('patente') . ' = ?', [$patenteNorm])
            ->orderBy('id')
            ->first();
    }

    private function findProviderByExactNormalizedName(string $targetNameNorm): ?Persona
    {
        $tokens = $this->tokenizeNormalizedName($targetNameNorm);
        if (empty($tokens)) {
            return null;
        }

        $query = Persona::query()
            ->select(['id', 'nombres', 'apellidos', 'cuil', 'patente'])
            ->where(function ($subQuery) use ($tokens) {
                foreach ($tokens as $token) {
                    $like = '%' . $token . '%';
                    $subQuery->orWhere('nombres', 'like', $like)
                        ->orWhere('apellidos', 'like', $like);
                }
            })
            ->limit(500);

        foreach ($query->get() as $persona) {
            $providerNameNorm = $this->normalizePersonName($this->buildProviderDisplayName($persona));
            if ($providerNameNorm === $targetNameNorm) {
                return $persona;
            }
        }

        return null;
    }

    private function findProviderByAlias(?string $clientCode, string $aliasType, string $aliasNorm): ?Persona
    {
        if (!Schema::hasTable('liq_client_identifier_aliases')) {
            return null;
        }

        $normalizedClientCode = $this->normalizeClientCode($clientCode);
        if ($normalizedClientCode === null) {
            return null;
        }

        $lookupCodes = $this->buildClientRuleLookupCodes($normalizedClientCode);
        if (empty($lookupCodes)) {
            return null;
        }

        $aliasRecords = LiquidacionClientIdentifierAlias::query()
            ->whereIn('client_code', $lookupCodes)
            ->where('alias_type', strtoupper(trim($aliasType)))
            ->where('alias_norm', $aliasNorm)
            ->where('active', true)
            ->get();
        if ($aliasRecords->isEmpty()) {
            return null;
        }

        $byClient = [];
        foreach ($aliasRecords as $aliasRecord) {
            $code = $this->normalizeClientCode($aliasRecord->client_code);
            if ($code === null || isset($byClient[$code])) {
                continue;
            }
            $byClient[$code] = $aliasRecord;
        }

        $alias = null;
        foreach ($lookupCodes as $lookupCode) {
            if (isset($byClient[$lookupCode])) {
                $alias = $byClient[$lookupCode];
                break;
            }
        }
        if (!$alias) {
            return null;
        }

        $alias->last_used_at = now();
        $alias->save();

        return Persona::query()->find($alias->provider_persona_id);
    }

    private function findProviderCandidatesByName(string $nameExcelNorm, int $limit = 10): array
    {
        if (!Schema::hasTable('personas')) {
            return [];
        }

        $tokens = $this->tokenizeNormalizedName($nameExcelNorm);
        if (empty($tokens)) {
            return [];
        }

        $query = Persona::query()
            ->select(['id', 'nombres', 'apellidos', 'cuil', 'patente'])
            ->where(function ($subQuery) use ($tokens) {
                foreach ($tokens as $token) {
                    $like = '%' . $token . '%';
                    $subQuery->orWhere('nombres', 'like', $like)
                        ->orWhere('apellidos', 'like', $like);
                }
            })
            ->limit(500);

        $candidates = [];
        foreach ($query->get() as $persona) {
            $providerNameNorm = $this->normalizePersonName($this->buildProviderDisplayName($persona));
            if ($providerNameNorm === null) {
                continue;
            }
            $score = $this->calculateNameMatchScore($nameExcelNorm, $providerNameNorm);
            if ($score < 35) {
                continue;
            }

            $candidates[] = [
                'id' => $persona->id,
                'nombre' => $this->buildProviderDisplayName($persona),
                'cuil' => $this->normalizeNullableString((string) ($persona->cuil ?? '')),
                'patente' => $this->normalizeNullableString((string) ($persona->patente ?? '')),
                'score' => $score,
            ];
        }

        usort($candidates, static function (array $a, array $b) {
            $scoreA = (float) ($a['score'] ?? 0);
            $scoreB = (float) ($b['score'] ?? 0);
            if ($scoreA === $scoreB) {
                return (int) ($a['id'] ?? 0) <=> (int) ($b['id'] ?? 0);
            }

            return $scoreA > $scoreB ? -1 : 1;
        });

        return array_slice($candidates, 0, max(1, $limit));
    }

    private function searchProviderCandidatesForManualAssign(string $term, int $limit = 10): array
    {
        if (!Schema::hasTable('personas')) {
            return [];
        }

        $normalizedName = $this->normalizePersonName($term);
        $plateNorm = $this->normalizeDomain($term);
        $digits = preg_replace('/\D+/', '', $term) ?? '';
        $tokens = $normalizedName ? $this->tokenizeNormalizedName($normalizedName) : [];
        $termLike = '%' . $term . '%';

        $query = Persona::query()
            ->select(['id', 'nombres', 'apellidos', 'cuil', 'patente'])
            ->where(function ($subQuery) use ($tokens, $digits, $plateNorm, $termLike) {
                $subQuery->orWhere('nombres', 'like', $termLike)
                    ->orWhere('apellidos', 'like', $termLike)
                    ->orWhereRaw("CONCAT(COALESCE(apellidos,''), ' ', COALESCE(nombres,'')) like ?", [$termLike]);

                foreach ($tokens as $token) {
                    $like = '%' . $token . '%';
                    $subQuery->orWhere('nombres', 'like', $like)
                        ->orWhere('apellidos', 'like', $like);
                }

                if ($digits !== '') {
                    $subQuery->orWhereRaw(
                        "REPLACE(REPLACE(COALESCE(cuil,''),'-',''),' ','') like ?",
                        ['%' . $digits . '%']
                    );
                }

                if ($plateNorm !== null) {
                    $subQuery->orWhereRaw($this->sqlNormalizePlateExpression('patente') . ' = ?', [$plateNorm]);
                }
            })
            ->orderBy('id')
            ->limit(500);

        $candidates = [];
        foreach ($query->get() as $persona) {
            $score = 0.0;
            $providerName = $this->buildProviderDisplayName($persona);
            $providerNameNorm = $this->normalizePersonName($providerName);
            $providerPatenteNorm = $this->normalizeDomain((string) ($persona->patente ?? ''));
            $providerCuilDigits = preg_replace('/\D+/', '', (string) ($persona->cuil ?? '')) ?? '';

            if ($plateNorm !== null && $providerPatenteNorm === $plateNorm) {
                $score = max($score, 100.0);
            }

            if ($digits !== '' && $providerCuilDigits !== '') {
                if ($providerCuilDigits === $digits) {
                    $score = max($score, 96.0);
                } elseif (str_contains($providerCuilDigits, $digits)) {
                    $score = max($score, 82.0);
                }
            }

            if ($normalizedName !== null && $providerNameNorm !== null) {
                $score = max($score, $this->calculateNameMatchScore($normalizedName, $providerNameNorm));
            } elseif (
                stripos((string) ($persona->nombres ?? ''), $term) !== false
                || stripos((string) ($persona->apellidos ?? ''), $term) !== false
            ) {
                $score = max($score, 45.0);
            }

            if ($score < 30) {
                continue;
            }

            $candidates[] = [
                'id' => $persona->id,
                'nombre' => $providerName,
                'cuil' => $this->normalizeNullableString((string) ($persona->cuil ?? '')),
                'patente' => $this->normalizeNullableString((string) ($persona->patente ?? '')),
                'score' => round($score, 2),
            ];
        }

        usort($candidates, static function (array $a, array $b) {
            $scoreA = (float) ($a['score'] ?? 0);
            $scoreB = (float) ($b['score'] ?? 0);
            if ($scoreA === $scoreB) {
                return (int) ($a['id'] ?? 0) <=> (int) ($b['id'] ?? 0);
            }

            return $scoreA > $scoreB ? -1 : 1;
        });

        return array_slice($candidates, 0, max(1, $limit));
    }

    private function calculateNameMatchScore(string $left, string $right): float
    {
        if ($left === '' || $right === '') {
            return 0.0;
        }
        if ($left === $right) {
            return 100.0;
        }

        $leftTokens = $this->tokenizeNormalizedName($left);
        $rightTokens = $this->tokenizeNormalizedName($right);
        if (empty($leftTokens) || empty($rightTokens)) {
            return 0.0;
        }

        $common = array_intersect($leftTokens, $rightTokens);
        $commonCount = count($common);
        if ($commonCount === 0) {
            return 0.0;
        }

        $ratioA = $commonCount / max(1, count($leftTokens));
        $ratioB = $commonCount / max(1, count($rightTokens));
        $score = (($ratioA * 70) + ($ratioB * 30)) * 100 / 100;

        if (str_contains($right, $left) || str_contains($left, $right)) {
            $score += 10;
        }

        return round(min(100, $score), 2);
    }

    private function tokenizeNormalizedName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        return array_values(array_unique(array_filter($parts, static fn ($token) => strlen((string) $token) >= 2)));
    }

    private function buildProviderDisplayName(Persona $provider): string
    {
        $lastName = $this->normalizeNullableString((string) ($provider->apellidos ?? ''));
        $firstName = $this->normalizeNullableString((string) ($provider->nombres ?? ''));

        return trim(implode(' ', array_filter([$lastName, $firstName])));
    }

    private function normalizePersonName(string $value): ?string
    {
        $normalized = strtoupper(trim($value));
        if ($normalized === '') {
            return null;
        }

        $normalized = strtr($normalized, [
            'Á' => 'A',
            'É' => 'E',
            'Í' => 'I',
            'Ó' => 'O',
            'Ú' => 'U',
            'Ü' => 'U',
            'Ñ' => 'N',
        ]);
        $normalized = preg_replace('/[^A-Z0-9 ]+/u', ' ', $normalized);
        $normalized = preg_replace('/\s+/u', ' ', (string) $normalized);
        $normalized = trim((string) $normalized);
        if ($normalized === '') {
            return null;
        }

        $stopwords = ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'SRL', 'SA', 'S', 'A'];
        $tokens = array_values(array_filter(
            explode(' ', $normalized),
            static fn ($token) => $token !== '' && !in_array($token, $stopwords, true)
        ));

        if (empty($tokens)) {
            return null;
        }

        return implode(' ', $tokens);
    }

    private function upsertClientIdentifierAlias(
        string $clientCode,
        string $aliasType,
        string $aliasNorm,
        int $providerId,
        ?int $actorId
    ): bool {
        if (!Schema::hasTable('liq_client_identifier_aliases')) {
            return false;
        }

        $normalizedClientCode = $this->normalizeClientCode($clientCode);
        if ($normalizedClientCode === null) {
            return false;
        }

        LiquidacionClientIdentifierAlias::query()->updateOrCreate(
            [
                'client_code' => $normalizedClientCode,
                'alias_type' => strtoupper(trim($aliasType)),
                'alias_norm' => $aliasNorm,
            ],
            [
                'provider_persona_id' => $providerId,
                'active' => true,
                'created_by' => $actorId,
                'last_used_at' => now(),
            ]
        );

        return true;
    }

    private function tryUpdateProviderPatente(
        Persona $provider,
        string $newPatenteNorm,
        bool $overwriteExistingPatente,
        ?string $reason,
        ?int $actorId
    ): array {
        if (!preg_match('/^[A-Z0-9]{6,7}$/', $newPatenteNorm)) {
            return [
                'updated' => false,
                'message' => 'Patente inválida. Se guardó alias pero no se actualizó Proveedores.',
            ];
        }

        $conflict = Persona::query()
            ->where('id', '!=', $provider->id)
            ->whereRaw($this->sqlNormalizePlateExpression('patente') . ' = ?', [$newPatenteNorm])
            ->first();
        if ($conflict) {
            return [
                'updated' => false,
                'message' => sprintf(
                    'Patente ya asignada a proveedor #%d. Se guardó alias sin actualizar Proveedores.',
                    (int) $conflict->id
                ),
            ];
        }

        $currentPatenteRaw = $this->normalizeNullableString((string) ($provider->patente ?? ''));
        $currentPatenteNorm = $this->normalizeDomain((string) ($provider->patente ?? ''));
        if ($currentPatenteNorm !== null && $currentPatenteNorm !== $newPatenteNorm && !$overwriteExistingPatente) {
            return [
                'updated' => false,
                'message' => 'El proveedor ya tiene otra patente. Se guardó alias sin sobreescribir Proveedores.',
            ];
        }

        if ($currentPatenteNorm === $newPatenteNorm) {
            return [
                'updated' => false,
                'message' => 'La patente del proveedor ya coincide. No fue necesario actualizar.',
            ];
        }

        $provider->patente = $newPatenteNorm;
        $provider->save();

        $auditReason = $reason
            ?? 'Match manual por nombre: se actualiza patente para próximos runs.';
        $this->recordAuditChangesForEntity(
            'PROVEEDOR',
            (int) $provider->id,
            ['patente' => $currentPatenteRaw],
            ['patente' => $provider->patente],
            $actorId,
            $auditReason
        );

        return [
            'updated' => true,
            'message' => null,
        ];
    }

    private function clearProviderMatchValidationFailures(int $runId, int $stagingRowId): void
    {
        LiquidacionValidationResult::query()
            ->where('run_id', $runId)
            ->where('staging_row_id', $stagingRowId)
            ->whereIn('rule_code', self::PROVIDER_MATCH_RULE_CODES)
            ->delete();
    }

    private function refreshStagingRowValidationStatus(int $runId, LiquidacionStagingRow $row): void
    {
        $fails = LiquidacionValidationResult::query()
            ->where('run_id', $runId)
            ->where('staging_row_id', $row->id)
            ->where('result', 'FAIL')
            ->get(['severity', 'message']);

        $hasCritical = $fails->contains(fn ($item) => strtoupper((string) $item->severity) === 'CRITICAL');
        $hasWarning = $fails->contains(fn ($item) => strtoupper((string) $item->severity) === 'WARNING');

        if ($hasCritical) {
            $row->validation_status = 'ERROR_CRITICO';
            $row->severity_max = 'CRITICAL';
        } elseif ($hasWarning) {
            $row->validation_status = $row->validation_status === 'DIFERENCIA' ? 'DIFERENCIA' : 'ALERTA';
            $row->severity_max = 'WARNING';
        } else {
            $row->validation_status = 'OK';
            $row->severity_max = 'INFO';
        }

        $messages = $fails
            ->map(fn ($item) => $this->normalizeNullableString((string) ($item->message ?? '')))
            ->filter()
            ->values()
            ->all();
        $row->observations_auto = !empty($messages) ? implode('; ', $messages) : null;
        $row->save();
    }

    private function sqlNormalizePlateExpression(string $column): string
    {
        return "REPLACE(REPLACE(REPLACE(UPPER(COALESCE({$column}, '')), ' ', ''), '-', ''), '.', '')";
    }

    private function isUploadSummaryLikeRow(
        string $domainRaw,
        string $station,
        string $product,
        string $invoice,
        string $conductor,
        ?float $liters,
        ?float $amount
    ): bool {
        if ($this->normalizeDomain($domainRaw) !== null) {
            return false;
        }

        $stationValue = $this->normalizeNullableString($station);
        $productValue = $this->normalizeNullableString($product);
        $invoiceValue = $this->normalizeNullableString($invoice);
        $conductorValue = $this->normalizeNullableString($conductor);
        $litersValue = $liters ?? 0.0;

        return $amount !== null
            && $stationValue === null
            && $productValue === null
            && $invoiceValue === null
            && $conductorValue === null
            && abs($litersValue) < 0.000001;
    }

    private function addUploadValidationFail(
        array &$validationResults,
        int $rowNumber,
        string $ruleCode,
        string $severity,
        ?string $expectedValue,
        ?string $actualValue,
        string $message
    ): void {
        $validationResults[] = [
            'row_number' => $rowNumber,
            'rule_code' => $ruleCode,
            'severity' => $severity,
            'result' => 'FAIL',
            'expected_value' => $expectedValue,
            'actual_value' => $actualValue,
            'message' => $message,
        ];
    }

    private function resolveClientRuleSet(?string $clientCode): array
    {
        $defaults = $this->defaultClientRuleSet();
        $normalizedClientCode = $this->normalizeClientCode($clientCode);
        $intermedioDefaults = $this->defaultIntermedioClientRuleSet();
        $epsaDefaults = $this->defaultEpsaClientRuleSet();
        if ($normalizedClientCode === null) {
            return [
                'rules' => $defaults,
                'source' => 'default',
            ];
        }

        $record = $this->resolveActiveClientRuleRecord($normalizedClientCode);
        if (!$record || !is_array($record->rules_json)) {
            if ($this->isIntermedioClientCode($normalizedClientCode)) {
                return [
                    'rules' => $intermedioDefaults,
                    'source' => 'default_intermedio',
                ];
            }
            if ($this->isEpsaClientCode($normalizedClientCode)) {
                return [
                    'rules' => $epsaDefaults,
                    'source' => 'default_epsa',
                ];
            }
            return [
                'rules' => $defaults,
                'source' => 'default',
            ];
        }

        $rules = $defaults;
        $payload = $record->rules_json;
        if (isset($payload['blocking_rules']) && is_array($payload['blocking_rules'])) {
            $rules['blocking_rules'] = array_merge($rules['blocking_rules'], $payload['blocking_rules']);
        }
        if (isset($payload['tolerances']) && is_array($payload['tolerances'])) {
            $rules['tolerances'] = array_merge($rules['tolerances'], $payload['tolerances']);
        }
        if (isset($payload['tariffs']) && is_array($payload['tariffs'])) {
            $rules['tariffs'] = array_values(array_filter($payload['tariffs'], fn ($row) => is_array($row)));
        }
        if (isset($payload['epsa']) && is_array($payload['epsa'])) {
            $rules['epsa'] = array_replace_recursive(
                is_array($rules['epsa'] ?? null) ? $rules['epsa'] : [],
                $payload['epsa']
            );
        }

        if ($this->isIntermedioClientCode($normalizedClientCode)) {
            $rules = $this->mergeIntermedioTariffDefaults($rules, $intermedioDefaults);
        }
        if ($this->isEpsaClientCode($normalizedClientCode)) {
            $rules = $this->mergeEpsaDefaults($rules, $epsaDefaults);
        }

        $recordClientCode = $this->normalizeClientCode($record->client_code ?? null);
        $source = $recordClientCode !== null && $recordClientCode !== $normalizedClientCode
            ? 'client_fallback'
            : 'client';

        return [
            'rules' => $rules,
            'source' => $source,
        ];
    }

    private function resolveActiveClientRuleRecord(?string $normalizedClientCode): ?LiquidacionClientRule
    {
        if ($normalizedClientCode === null) {
            return null;
        }

        $lookupCodes = $this->buildClientRuleLookupCodes($normalizedClientCode);
        if (empty($lookupCodes)) {
            return null;
        }

        $records = LiquidacionClientRule::query()
            ->whereIn('client_code', $lookupCodes)
            ->where('active', true)
            ->get();
        if ($records->isEmpty()) {
            return null;
        }

        $recordsByCode = [];
        foreach ($records as $record) {
            $code = $this->normalizeClientCode($record->client_code ?? null);
            if ($code === null || isset($recordsByCode[$code])) {
                continue;
            }
            $recordsByCode[$code] = $record;
        }

        foreach ($lookupCodes as $lookupCode) {
            if (isset($recordsByCode[$lookupCode])) {
                return $recordsByCode[$lookupCode];
            }
        }

        return null;
    }

    private function buildClientRuleLookupCodes(?string $normalizedClientCode): array
    {
        if ($normalizedClientCode === null) {
            return [];
        }

        $codes = [];
        $addCode = static function (?string $value) use (&$codes): void {
            if (!is_string($value)) {
                return;
            }
            $normalized = strtoupper(trim($value));
            if ($normalized === '' || in_array($normalized, $codes, true)) {
                return;
            }
            $codes[] = $normalized;
        };

        $addCode($normalizedClientCode);
        $compact = preg_replace('/[\s\-_]+/', '', $normalizedClientCode);
        if (is_string($compact) && $compact !== '') {
            $addCode($compact);
        }

        if ($this->isIntermedioClientCode($normalizedClientCode)) {
            $addCode('INTERMEDIO');
            $addCode('INT');
        }

        if ($this->isEpsaClientCode($normalizedClientCode)) {
            $addCode('EPSA');
        }

        return $codes;
    }

    private function defaultClientRuleSet(): array
    {
        return [
            'blocking_rules' => [
                'duplicate_row' => false,
                'outside_period' => true,
                'tariff_mismatch' => false,
            ],
            'tolerances' => [
                'price_per_liter_percent' => 3.0,
                'price_per_liter_amount' => 0.0,
            ],
            'tariffs' => [],
        ];
    }

    private function isIntermedioClientCode(?string $clientCode): bool
    {
        if ($clientCode === null) {
            return false;
        }

        $normalized = strtoupper(trim($clientCode));
        return str_contains($normalized, 'INTERMEDIO') || preg_match('/^INT\d*$/', $normalized) === 1;
    }

    private function isEpsaClientCode(?string $clientCode): bool
    {
        if ($clientCode === null) {
            return false;
        }

        $normalized = strtoupper(trim($clientCode));
        return str_contains($normalized, 'EPSA');
    }

    private function defaultIntermedioClientRuleSet(): array
    {
        $rules = $this->defaultClientRuleSet();
        $rules['plus_by_patente'] = [
            'AH636RD' => [
                'plus_media' => 5000,
                'plus_completa' => 10000,
            ],
        ];
        $rules['tariffs'] = [
            ['product' => 'corto am', 'price_per_liter' => 96900],
            ['product' => 'corto pm', 'price_per_liter' => 72250],
            ['product' => 'corto pm sc21', 'price_per_liter' => 76250],
            ['product' => 'mediano', 'price_per_liter' => 170000],
            ['product' => 'largo', 'price_per_liter' => 200000],
            ['product' => 'largo +2018', 'price_per_liter' => 220000],
        ];
        $rules['tariff_matrix'] = [
            'default_zone' => 'AMBA',
            'zones' => [
                'AMBA' => [
                    'CORTO_AM' => ['label' => 'Ut. Corto AM', 'original' => 114000, 'liquidacion' => 96900],
                    'CORTO_PM' => ['label' => 'Ut. Corto PM', 'original' => 85000, 'liquidacion' => 72250],
                    'CORTO_PM_SC21' => ['label' => 'Ut. Corto PM SC21', 'original' => 90000, 'liquidacion' => 76250],
                    'MEDIANO' => ['label' => 'Ut. Mediano', 'original' => 193000, 'liquidacion' => 170000, 'special' => true],
                    'LARGO' => ['label' => 'Ut. Largo (2015/2017)', 'original' => 228000, 'liquidacion' => 200000, 'special' => true],
                    'LARGO_2018' => ['label' => 'Ut. Largo NEW (2018)', 'original' => 250000, 'liquidacion' => 220000, 'special' => true],
                    'CHASIS' => ['label' => 'Chasis', 'original' => 296000, 'liquidacion' => 296000],
                ],
                'MDQ' => [
                    'CORTO' => ['label' => 'Ut. Corto', 'original' => 118000, 'liquidacion' => 118000],
                    'LARGO' => ['label' => 'Ut. Largo', 'original' => 210000, 'liquidacion' => 210000],
                ],
                'ROSARIO' => [
                    'CORTO' => ['label' => 'Ut. Corto', 'original' => 101000, 'liquidacion' => 101000],
                    'MEDIANO' => ['label' => 'Ut. Mediano', 'original' => 156000, 'liquidacion' => 156000],
                    'LARGO' => ['label' => 'Ut. Largo NEW (2015)', 'original' => 228000, 'liquidacion' => 228000],
                    'CHASIS' => ['label' => 'Chasis', 'original' => 265000, 'liquidacion' => 265000],
                ],
                'SANTA_FE' => [
                    'CORTO' => ['label' => 'Ut. Corto', 'original' => 90000, 'liquidacion' => 90000],
                    'LARGO' => ['label' => 'Ut. Largo', 'original' => 205000, 'liquidacion' => 205000],
                ],
                'NEUQUEN' => [
                    'CORTO_AM' => ['label' => 'Ut. Corto AM', 'original' => 117000, 'liquidacion' => 117000],
                    'CORTO_PM' => ['label' => 'Ut. Corto PM', 'original' => 98000, 'liquidacion' => 98000],
                    'LARGO' => ['label' => 'Ut. Largo', 'original' => 210000, 'liquidacion' => 210000],
                ],
                'BARILOCHE' => [
                    'CORTO' => ['label' => 'Ut. Corto', 'original' => 105000, 'liquidacion' => 105000],
                    'LARGO' => ['label' => 'Ut. Largo', 'original' => 220000, 'liquidacion' => 220000],
                ],
            ],
        ];

        return $rules;
    }

    private function mergeIntermedioTariffDefaults(array $rules, array $defaults): array
    {
        $incomingTariffs = is_array($rules['tariffs'] ?? null) ? $rules['tariffs'] : [];
        if (count($incomingTariffs) === 0) {
            $rules['tariffs'] = $defaults['tariffs'];
        } else {
            $keys = [];
            foreach ($incomingTariffs as $tariff) {
                if (!is_array($tariff)) {
                    continue;
                }
                $key = $this->resolveTariffRuleServiceKey((string) ($tariff['product'] ?? ''));
                if ($key !== null) {
                    $keys[$key] = true;
                }
            }

            foreach ($defaults['tariffs'] as $defaultTariff) {
                $key = $this->resolveTariffRuleServiceKey((string) ($defaultTariff['product'] ?? ''));
                if ($key === null || isset($keys[$key])) {
                    continue;
                }
                $incomingTariffs[] = $defaultTariff;
            }

            $rules['tariffs'] = array_values($incomingTariffs);
        }

        if (!isset($rules['tariff_matrix']) || !is_array($rules['tariff_matrix'])) {
            $rules['tariff_matrix'] = $defaults['tariff_matrix'] ?? [];
        } else {
            $matrix = $rules['tariff_matrix'];
            $defaultMatrix = is_array($defaults['tariff_matrix'] ?? null) ? $defaults['tariff_matrix'] : [];
            $matrix['default_zone'] = $matrix['default_zone'] ?? ($defaultMatrix['default_zone'] ?? 'AMBA');
            $matrixZones = is_array($matrix['zones'] ?? null) ? $matrix['zones'] : [];
            $defaultZones = is_array($defaultMatrix['zones'] ?? null) ? $defaultMatrix['zones'] : [];
            foreach ($defaultZones as $zoneKey => $zoneRows) {
                if (!isset($matrixZones[$zoneKey]) || !is_array($matrixZones[$zoneKey])) {
                    $matrixZones[$zoneKey] = $zoneRows;
                    continue;
                }
                foreach ((array) $zoneRows as $rowKey => $rowRule) {
                    if (!isset($matrixZones[$zoneKey][$rowKey]) || !is_array($matrixZones[$zoneKey][$rowKey])) {
                        $matrixZones[$zoneKey][$rowKey] = $rowRule;
                    }
                }
            }
            $matrix['zones'] = $matrixZones;
            $rules['tariff_matrix'] = $matrix;
        }
        return $rules;
    }

    private function defaultEpsaClientRuleSet(): array
    {
        $rules = $this->defaultClientRuleSet();
        $rules['blocking_rules'] = array_merge($rules['blocking_rules'], [
            'duplicate_row' => true,
            'outside_period' => false,
            'tariff_mismatch' => false,
        ]);
        $rules['epsa'] = [
            'sheet_name' => 'Table',
            'tipo_unidad' => 'UT_CHICO',
            'match_alias_type' => 'DISTRIBUIDOR',
            'tarifario_ut_chico' => [
                ['km_desde' => 0, 'km_hasta' => 90, 'la_jornada' => 92636.70],
                ['km_desde' => 90.00001, 'km_hasta' => 120, 'la_jornada' => 104216.29],
                ['km_desde' => 120.00001, 'km_hasta' => 150, 'la_jornada' => 115795.88],
                ['km_desde' => 150.00001, 'km_hasta' => 170, 'la_jornada' => 127375.47],
                ['km_desde' => 170.00001, 'km_hasta' => 200, 'la_jornada' => 127375.47],
            ],
        ];

        return $rules;
    }

    private function mergeEpsaDefaults(array $rules, array $defaults): array
    {
        $base = is_array($rules['epsa'] ?? null) ? $rules['epsa'] : [];
        $defaultEpsa = is_array($defaults['epsa'] ?? null) ? $defaults['epsa'] : [];
        $rules['epsa'] = array_replace_recursive($defaultEpsa, $base);

        return $rules;
    }

    private function resolveExpectedTariff(array $rules, string $product, ?Carbon $occurredAt): ?array
    {
        $tariffs = $rules['tariffs'] ?? [];
        if (!is_array($tariffs) || empty($tariffs)) {
            return null;
        }

        $normalizedProduct = $this->normalizeRuleProduct($product);
        foreach ($tariffs as $tariff) {
            if (!is_array($tariff)) {
                continue;
            }

            $tariffProduct = $this->normalizeRuleProduct((string) ($tariff['product'] ?? ''));
            if ($tariffProduct === '' || $normalizedProduct === '' || $tariffProduct !== $normalizedProduct) {
                continue;
            }

            $effectiveFrom = $this->parseDateOnlyOrNull($tariff['effective_from'] ?? null);
            $effectiveTo = $this->parseDateOnlyOrNull($tariff['effective_to'] ?? null);
            if ($occurredAt !== null) {
                if ($effectiveFrom && $occurredAt->copy()->startOfDay()->lt($effectiveFrom->copy()->startOfDay())) {
                    continue;
                }
                if ($effectiveTo && $occurredAt->copy()->startOfDay()->gt($effectiveTo->copy()->startOfDay())) {
                    continue;
                }
            }

            $pricePerLiter = $this->parseFloatOrNull($tariff['price_per_liter'] ?? null);
            if ($pricePerLiter === null || $pricePerLiter <= 0) {
                continue;
            }

            return [
                'product' => (string) ($tariff['product'] ?? ''),
                'price_per_liter' => $pricePerLiter,
                'tolerance_percent' => $this->parseFloatOrNull($tariff['tolerance_percent'] ?? null),
                'tolerance_amount' => $this->parseFloatOrNull($tariff['tolerance_amount'] ?? null),
                'effective_from' => $effectiveFrom?->toDateString(),
                'effective_to' => $effectiveTo?->toDateString(),
            ];
        }

        return null;
    }

    private function normalizeRuleProduct(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = strtr($normalized, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ü' => 'u',
            'ñ' => 'n',
        ]);
        $normalized = preg_replace('/[^a-z0-9]+/u', ' ', $normalized);
        return trim((string) $normalized);
    }

    private function resolveActualPricePerLiter(?float $price, ?float $amount, ?float $liters): ?float
    {
        if ($price !== null && $price > 0) {
            return $price;
        }

        if ($amount !== null && $liters !== null && $liters > 0) {
            return round($amount / $liters, 6);
        }

        return null;
    }

    private function parseUploadCsv(string $path): array
    {
        $rawRows = [];
        $handle = fopen($path, 'r');
        if (!$handle) {
            return [[], [], 0, []];
        }

        while (($data = fgetcsv($handle)) !== false) {
            $rawRows[] = $this->expandUploadDelimitedRow($data);
        }

        fclose($handle);

        $headerIndex = $this->detectUploadHeaderRow($rawRows);
        if ($headerIndex !== null) {
            $columns = array_map(
                static fn ($value) => trim((string) $value),
                $rawRows[$headerIndex]
            );
            $dataRows = array_slice($rawRows, $headerIndex + 1);
        } else {
            $columns = [];
            $dataRows = $rawRows;
        }

        $rows = [];
        foreach ($dataRows as $row) {
            if ($this->isUploadRowEmpty($row)) {
                continue;
            }
            $rows[] = $this->fillUploadRow($columns, $row);
        }

        if (empty($columns)) {
            $columns = $this->fallbackUploadColumnsFromRows($rows);
        }

        return [$columns, $rows, count($rows), [
            'headerIndex' => $headerIndex,
            'sheet' => 'csv',
        ]];
    }

    private function parseUploadXlsx(string $path, ?string $preferredSheet = null, bool $strictPreferred = false): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return [[], [], 0, []];
        }

        $sharedStrings = $this->readUploadSharedStrings($zip);
        $sheetEntries = $this->listUploadWorksheetFiles($zip);
        if (empty($sheetEntries)) {
            $zip->close();
            return [[], [], 0, []];
        }

        $resolvedPreferredSheet = $this->resolveUploadPreferredSheet($preferredSheet, $sheetEntries);
        if ($strictPreferred && $preferredSheet !== null && $resolvedPreferredSheet === null) {
            $availableSheets = array_values(array_filter(
                array_map(static fn ($entry) => (string) ($entry['name'] ?? ''), $sheetEntries),
                static fn ($sheetName) => $sheetName !== ''
            ));
            $zip->close();
            return [[], [], 0, [
                'sheet' => null,
                'sheet_name' => null,
                'sheet_not_found' => true,
                'requested_sheet' => $preferredSheet,
                'available_sheets' => $availableSheets,
            ]];
        }

        $sheetPath = $resolvedPreferredSheet ?? $sheetEntries[0]['path'];
        $sheetName = basename($sheetPath, '.xml');
        foreach ($sheetEntries as $sheetEntry) {
            if (($sheetEntry['path'] ?? null) !== $sheetPath) {
                continue;
            }
            $sheetName = (string) ($sheetEntry['name'] ?? $sheetName);
            break;
        }

        $sheetXml = $zip->getFromName($sheetPath);
        $zip->close();
        if (!$sheetXml) {
            return [[], [], 0, []];
        }

        [$rawRows] = $this->extractUploadSheetRows($sheetXml, $sharedStrings, 200000);

        $headerIndex = $this->detectUploadHeaderRow($rawRows);
        if ($headerIndex !== null) {
            $columns = array_map(
                static fn ($value) => trim((string) $value),
                $rawRows[$headerIndex]
            );
            $dataRows = array_slice($rawRows, $headerIndex + 1);
        } else {
            $columns = [];
            $dataRows = $rawRows;
        }

        $rows = [];
        foreach ($dataRows as $row) {
            if ($this->isUploadRowEmpty($row)) {
                continue;
            }
            $rows[] = $this->fillUploadRow($columns, $row);
        }

        if (empty($columns)) {
            $columns = $this->fallbackUploadColumnsFromRows($rows);
        }

        return [$columns, $rows, count($rows), [
            'headerIndex' => $headerIndex,
            'sheet' => $sheetPath,
            'sheet_name' => $sheetName,
            'sheet_not_found' => false,
            'requested_sheet' => $preferredSheet,
            'available_sheets' => array_values(array_filter(
                array_map(static fn ($entry) => (string) ($entry['name'] ?? ''), $sheetEntries),
                static fn ($sheetName) => $sheetName !== ''
            )),
        ]];
    }

    private function mapUploadRows(array $columns, array $rows, ?string $format = null): array
    {
        $standardColumns = ['Fecha', 'Estación', 'Dominio', 'Producto', 'Nro. Factura', 'Conductor', 'Litros', 'Importe', 'Precio/Litro'];
        $candidates = [];
        $unmapped = [];

        foreach ($columns as $index => $header) {
            $mapped = $this->mapUploadHeaderToStandard((string) $header);
            if ($mapped !== null) {
                $candidates[$mapped][] = [
                    'index' => $index,
                    'header' => (string) $header,
                ];
            } elseif (trim((string) $header) !== '') {
                $unmapped[] = (string) $header;
            }
        }

        $indexMap = $this->selectBestUploadColumnIndexes($candidates, $rows);
        [$indexMap, $productColumn] = $this->applyUploadFormatColumnOverrides($columns, $rows, $indexMap, $format);

        if (empty($indexMap)) {
            return [
                'mapped' => false,
                'columns' => $columns,
                'rows' => $rows,
                'unmappedColumns' => $unmapped,
                'format' => strtolower(trim((string) ($format ?? 'custom'))),
                'productColumn' => null,
            ];
        }

        $mappedRows = [];
        foreach ($rows as $row) {
            $mapped = [];
            foreach ($standardColumns as $standardColumn) {
                $sourceIndex = $indexMap[$standardColumn] ?? null;
                $mapped[] = $sourceIndex !== null && array_key_exists($sourceIndex, $row)
                    ? (string) $row[$sourceIndex]
                    : '';
            }
            $mappedRows[] = $mapped;
        }

        return [
            'mapped' => true,
            'columns' => $standardColumns,
            'rows' => $mappedRows,
            'mappedFields' => array_values(array_keys($indexMap)),
            'unmappedColumns' => $unmapped,
            'format' => strtolower(trim((string) ($format ?? 'custom'))),
            'productColumn' => $productColumn,
        ];
    }

    private function mapEpsaUploadRows(array $columns, array $rows): array
    {
        $standardColumns = [
            'NRO.PLANILLA',
            'FECHA PLANILLA',
            'DISTRIBUIDOR',
            'ZONA RECORRIDO',
            'KMS',
            'Tarifa (EPSA)',
            'LOGISTICA ARG (EPSA)',
            'VEHICULO',
            'TURNO',
            'SUCURSAL',
        ];

        $requiredColumns = ['NRO.PLANILLA', 'FECHA PLANILLA', 'DISTRIBUIDOR', 'ZONA RECORRIDO', 'KMS'];
        $indexMap = $this->buildEpsaIndexMapFromColumns($columns);
        $missing = $this->resolveEpsaMissingRequiredColumns($indexMap, $requiredColumns);
        if (!empty($missing) && !empty($rows)) {
            $firstRow = array_values(array_map(
                static fn ($value) => trim((string) $value),
                $rows[0]
            ));
            $firstRowIndexMap = $this->buildEpsaIndexMapFromColumns($firstRow);
            $firstRowMissing = $this->resolveEpsaMissingRequiredColumns($firstRowIndexMap, $requiredColumns);
            if (empty($firstRowMissing)) {
                $columns = $firstRow;
                $rows = array_slice($rows, 1);
                $indexMap = $firstRowIndexMap;
                $missing = [];
            }
        }

        $usedIndexes = [];
        foreach ($indexMap as $index) {
            if ($index !== null) {
                $usedIndexes[(int) $index] = true;
            }
        }

        $unmapped = [];
        foreach ($columns as $index => $header) {
            if (isset($usedIndexes[(int) $index])) {
                continue;
            }

            $normalizedHeader = $this->normalizeNullableString((string) $header);
            if ($normalizedHeader !== null) {
                $unmapped[] = $normalizedHeader;
            }
        }

        if (!empty($missing)) {
            return [
                'mapped' => false,
                'columns' => $columns,
                'rows' => $rows,
                'mappedFields' => [],
                'unmappedColumns' => array_values(array_unique($unmapped)),
                'missingColumns' => $missing,
                'format' => 'epsa',
                'productColumn' => null,
            ];
        }

        $mappedRows = [];
        foreach ($rows as $row) {
            $mapped = [];
            foreach ($standardColumns as $standardColumn) {
                $sourceIndex = $indexMap[$standardColumn] ?? null;
                $mapped[] = $sourceIndex !== null && array_key_exists($sourceIndex, $row)
                    ? (string) $row[$sourceIndex]
                    : '';
            }
            $mappedRows[] = $mapped;
        }

        return [
            'mapped' => true,
            'columns' => $standardColumns,
            'rows' => $mappedRows,
            'mappedFields' => array_values(array_keys(array_filter($indexMap, static fn ($idx) => $idx !== null))),
            'unmappedColumns' => array_values(array_unique($unmapped)),
            'missingColumns' => [],
            'format' => 'epsa',
            'productColumn' => null,
        ];
    }

    private function buildEpsaIndexMapFromColumns(array $columns): array
    {
        return [
            'NRO.PLANILLA' => $this->resolveUploadHeaderIndexByAliases($columns, ['nro planilla', 'nro planillas', 'planilla nro', 'planilla numero']),
            'FECHA PLANILLA' => $this->resolveUploadHeaderIndexByAliases($columns, ['fecha planilla', 'fecha']),
            'DISTRIBUIDOR' => $this->resolveUploadHeaderIndexByAliases($columns, ['distribuidor']),
            'ZONA RECORRIDO' => $this->resolveUploadHeaderIndexByAliases($columns, ['zona recorrido', 'zona de recorrido', 'recorrido', 'zona']),
            'KMS' => $this->resolveUploadHeaderIndexByAliases($columns, ['kms', 'km', 'kilometros', 'kilometraje']),
            'Tarifa (EPSA)' => $this->resolveUploadHeaderIndexByAliases($columns, ['tarifa', 'tarifa epsa']),
            'LOGISTICA ARG (EPSA)' => $this->resolveUploadHeaderIndexByAliases($columns, ['logistica arg', 'logistica argentina', 'logistica']),
            'VEHICULO' => $this->resolveUploadHeaderIndexByAliases($columns, ['vehiculo', 'unidad', 'tipo unidad']),
            'TURNO' => $this->resolveUploadHeaderIndexByAliases($columns, ['turno']),
            'SUCURSAL' => $this->resolveUploadHeaderIndexByAliases($columns, ['sucursal']),
        ];
    }

    private function resolveEpsaMissingRequiredColumns(array $indexMap, array $requiredColumns): array
    {
        $missing = [];
        foreach ($requiredColumns as $requiredColumn) {
            if (($indexMap[$requiredColumn] ?? null) === null) {
                $missing[] = $requiredColumn;
            }
        }

        return $missing;
    }

    private function prepareEpsaUploadStagingAndValidations(array $columns, array $rows, array $context = []): array
    {
        $normalizedClientCode = $this->normalizeClientCode($context['client_code'] ?? null);
        $rulesPayload = $this->resolveClientRuleSet($normalizedClientCode);
        $rules = $rulesPayload['rules'];
        $periodFrom = $this->parseDateOnlyOrNull($context['period_from'] ?? null);
        $periodTo = $this->parseDateOnlyOrNull($context['period_to'] ?? null);

        $columnIndexes = [];
        foreach ($columns as $index => $name) {
            $columnIndexes[$name] = $index;
        }

        $stagingRows = [];
        $validationResults = [];
        $sampleRows = [];
        $seenPlanillas = [];
        $ignoredRowsCount = 0;
        $importedRowsCount = 0;
        $totalLaEstimado = 0.0;
        $uniqueDistributorCodes = [];

        foreach ($rows as $index => $row) {
            $rowNumber = $index + 1;

            $nroPlanillaRaw = $this->getUploadRowValue($row, $columnIndexes, 'NRO.PLANILLA');
            $nroPlanilla = $this->normalizeEpsaPlanillaNumber($nroPlanillaRaw);
            if ($nroPlanilla === null) {
                $ignoredRowsCount += 1;
                continue;
            }

            $importedRowsCount += 1;

            $fechaRaw = $this->getUploadRowValue($row, $columnIndexes, 'FECHA PLANILLA');
            $distribuidorRaw = $this->getUploadRowValue($row, $columnIndexes, 'DISTRIBUIDOR');
            $zonaRecorridoRaw = $this->getUploadRowValue($row, $columnIndexes, 'ZONA RECORRIDO');
            $kmsRaw = $this->getUploadRowValue($row, $columnIndexes, 'KMS');
            $tarifaEpsaRaw = $this->getUploadRowValue($row, $columnIndexes, 'Tarifa (EPSA)');
            $logisticaArgRaw = $this->getUploadRowValue($row, $columnIndexes, 'LOGISTICA ARG (EPSA)');
            $vehiculoRaw = $this->getUploadRowValue($row, $columnIndexes, 'VEHICULO');
            $turnoRaw = $this->getUploadRowValue($row, $columnIndexes, 'TURNO');
            $sucursalRaw = $this->getUploadRowValue($row, $columnIndexes, 'SUCURSAL');

            $fecha = $this->parseUploadDate($fechaRaw, 'dmy');
            $kms = $this->parseFloatOrNull($kmsRaw);
            $tarifaEpsa = $this->parseFloatOrNull($tarifaEpsaRaw);
            $logisticaArg = $this->parseFloatOrNull($logisticaArgRaw);
            $distribuidorNorm = $this->normalizeEpsaDistributorName($distribuidorRaw);
            $factorResult = $this->resolveEpsaFactorJornada($zonaRecorridoRaw);
            $factorJornada = (float) ($factorResult['factor'] ?? 1.0);
            $motivoFactor = (string) ($factorResult['motivo'] ?? 'NORMAL');
            $tarifaLookup = $this->resolveEpsaTarifaByKms($rules, $kms);
            $laJornadaBase = $tarifaLookup['la_jornada'] ?? null;
            $importeLa = $laJornadaBase !== null ? round(((float) $laJornadaBase) * $factorJornada, 2) : null;

            $providerMatch = $this->resolveEpsaProviderMatch($normalizedClientCode, $distribuidorNorm);
            $matchStatus = (string) ($providerMatch['status'] ?? self::PROVIDER_MATCH_NONE);
            $providerId = isset($providerMatch['provider_id']) ? (int) $providerMatch['provider_id'] : null;
            $providerName = $this->normalizeNullableString((string) ($providerMatch['provider_name'] ?? ''));
            $matchCandidates = is_array($providerMatch['candidates'] ?? null) ? $providerMatch['candidates'] : [];

            $criticalIssues = [];
            $warningIssues = [];
            $hasDifference = false;

            if ($distribuidorNorm === null) {
                $criticalIssues[] = 'Distribuidor vacío o inválido.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_DISTRIBUIDOR_REQUIRED',
                    'CRITICAL',
                    'Distribuidor no vacío',
                    $distribuidorRaw,
                    'El distribuidor es obligatorio para vincular proveedor.'
                );
            } elseif ($matchStatus === self::PROVIDER_MATCH_PENDING) {
                $warningIssues[] = 'Distribuidor pendiente de asignación manual.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'PROVIDER_MATCH_PENDING',
                    'WARNING',
                    'Proveedor identificado',
                    $distribuidorRaw,
                    'No se pudo resolver proveedor exacto por distribuidor. Requiere asignación manual.'
                );
            } elseif ($matchStatus === self::PROVIDER_MATCH_NONE) {
                $warningIssues[] = 'Distribuidor sin proveedor vinculado.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'PROVIDER_MATCH_REQUIRED',
                    'WARNING',
                    'Proveedor identificado',
                    $distribuidorRaw,
                    'Sin match por distribuidor ni candidatos válidos.'
                );
            }

            if ($fecha === null) {
                $criticalIssues[] = 'Fecha inválida';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_FECHA_PLANILLA_VALID',
                    'CRITICAL',
                    'Fecha planilla válida',
                    $fechaRaw,
                    'Fecha planilla inválida o no reconocida.'
                );
            }

            if ($kms === null || $kms <= 0) {
                $criticalIssues[] = 'Kms inválidos';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_KM_VALID',
                    'CRITICAL',
                    'Kms > 0',
                    $kmsRaw,
                    'Kms inválidos para aplicar tarifario.'
                );
            }

            if (($tarifaLookup['error'] ?? null) !== null) {
                $criticalIssues[] = (string) $tarifaLookup['error'];
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_KM_RANGE',
                    'CRITICAL',
                    'Kms dentro de rango tarifario UT.Chico',
                    $kmsRaw,
                    (string) $tarifaLookup['error']
                );
            }

            if ($fecha !== null) {
                $outsidePeriodBlocking = (bool) ($rules['blocking_rules']['outside_period'] ?? true);
                $isOutsideFrom = $periodFrom !== null && $fecha->copy()->startOfDay()->lt($periodFrom->copy()->startOfDay());
                $isOutsideTo = $periodTo !== null && $fecha->copy()->startOfDay()->gt($periodTo->copy()->startOfDay());
                if ($isOutsideFrom || $isOutsideTo) {
                    $message = 'Fecha fuera del período del run.';
                    if ($outsidePeriodBlocking) {
                        $criticalIssues[] = $message;
                    } else {
                        $warningIssues[] = $message;
                    }

                    $this->addUploadValidationFail(
                        $validationResults,
                        $rowNumber,
                        'PERIOD_RANGE',
                        $outsidePeriodBlocking ? 'CRITICAL' : 'WARNING',
                        trim(implode(' - ', array_filter([
                            $periodFrom?->toDateString(),
                            $periodTo?->toDateString(),
                        ]))),
                        $fecha->toDateString(),
                        $message
                    );
                }
            }

            $duplicateKey = 'PLANILLA|' . $nroPlanilla;
            $isDuplicate = isset($seenPlanillas[$duplicateKey]);
            $seenPlanillas[$duplicateKey] = true;
            if ($isDuplicate) {
                $criticalIssues[] = 'NRO.PLANILLA duplicado dentro del archivo.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_DUPLICATE_PLANILLA',
                    'CRITICAL',
                    'NRO.PLANILLA único en importación',
                    $nroPlanilla,
                    'NRO.PLANILLA duplicado dentro del archivo.'
                );
            }

            if ($importeLa !== null && $logisticaArg !== null && abs($importeLa - $logisticaArg) > 0.01) {
                $warningIssues[] = 'Diferencia informativa entre importe LA y LOGISTICA ARG.';
                $hasDifference = true;
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_LOGISTICA_ARG_DIFF',
                    'WARNING',
                    (string) $importeLa,
                    (string) $logisticaArg,
                    'LOGISTICA ARG es informativo y difiere de importe LA calculado.'
                );
            }

            $missingInformativeFields = [];
            if ($this->normalizeNullableString($tarifaEpsaRaw) === null) {
                $missingInformativeFields[] = 'Tarifa';
            }
            if ($this->normalizeNullableString($logisticaArgRaw) === null) {
                $missingInformativeFields[] = 'LOGISTICA ARG';
            }
            if ($this->normalizeNullableString($vehiculoRaw) === null) {
                $missingInformativeFields[] = 'VEHICULO';
            }
            if (!empty($missingInformativeFields)) {
                $warningIssues[] = 'Faltan campos informativos: ' . implode(', ', $missingInformativeFields) . '.';
                $this->addUploadValidationFail(
                    $validationResults,
                    $rowNumber,
                    'EPSA_INFO_MISSING',
                    'WARNING',
                    'Tarifa, LOGISTICA ARG y VEHICULO informativos',
                    implode(', ', $missingInformativeFields),
                    'Faltan campos informativos (no bloqueante).'
                );
            }

            if (!empty($criticalIssues)) {
                $validationStatus = 'ERROR_CRITICO';
            } elseif (!empty($warningIssues)) {
                $validationStatus = $hasDifference ? 'DIFERENCIA' : 'ALERTA';
            } else {
                $validationStatus = 'OK';
            }

            $severityMax = $validationStatus === 'ERROR_CRITICO' ? 'CRITICAL'
                : ($validationStatus === 'OK' ? 'INFO' : 'WARNING');
            $validationScore = $validationStatus === 'OK' ? 100.0
                : ($validationStatus === 'ERROR_CRITICO' ? 0.0 : 75.0);

            $distributorCode = $providerId !== null
                ? ('PROV-' . $providerId)
                : ($distribuidorNorm ?? ('EPSA-DIST-' . $rowNumber));
            $observations = array_merge($criticalIssues, $warningIssues);

            $stagingRows[] = [
                'row_number' => $rowNumber,
                'external_row_id' => $nroPlanilla,
                'domain_norm' => null,
                'occurred_at' => $fecha?->toIso8601String(),
                'station' => $this->normalizeNullableString($zonaRecorridoRaw),
                'product' => 'CAMIONETAS',
                'invoice_number' => $nroPlanilla,
                'conductor' => $this->normalizeNullableString($distribuidorRaw),
                'name_excel_raw' => $this->normalizeNullableString($distribuidorRaw),
                'name_excel_norm' => $distribuidorNorm,
                'distributor_id' => $providerId,
                'distributor_code' => $distributorCode,
                'distributor_name' => $providerName ?? $this->normalizeNullableString($distribuidorRaw),
                'liters' => $kms,
                'amount' => $importeLa,
                'price_per_liter' => $laJornadaBase,
                'tariff_expected' => $laJornadaBase,
                'amount_expected' => $importeLa,
                'validation_status' => $validationStatus,
                'validation_score' => $validationScore,
                'severity_max' => $severityMax,
                'match_status' => $matchStatus,
                'match_provider_persona_id' => $providerId,
                'is_duplicate' => $isDuplicate,
                'duplicate_group_key' => $isDuplicate ? $duplicateKey : null,
                'observations_auto' => !empty($observations) ? implode('; ', $observations) : null,
                'raw_payload_json' => [
                    'mapped' => [
                        'NRO.PLANILLA' => $nroPlanillaRaw,
                        'FECHA PLANILLA' => $fechaRaw,
                        'DISTRIBUIDOR' => $distribuidorRaw,
                        'ZONA RECORRIDO' => $zonaRecorridoRaw,
                        'Kms' => $kmsRaw,
                        'Tarifa (EPSA)' => $tarifaEpsaRaw,
                        'LOGISTICA ARG (EPSA)' => $logisticaArgRaw,
                        'VEHICULO' => $vehiculoRaw,
                        'TURNO' => $turnoRaw,
                        'SUCURSAL' => $sucursalRaw,
                    ],
                    'epsa' => [
                        'nro_planilla' => $nroPlanilla,
                        'distribuidor_norm' => $distribuidorNorm,
                        'zona_recorrido_norm' => $this->normalizeRuleProduct($zonaRecorridoRaw),
                        'kms' => $kms,
                        'la_jornada_base' => $laJornadaBase,
                        'factor_jornada' => $factorJornada,
                        'motivo_factor' => $motivoFactor,
                        'importe_la' => $importeLa,
                        'tarifa_epsa' => $tarifaEpsa,
                        'logistica_arg' => $logisticaArg,
                        'tipo_unidad' => 'UT_CHICO',
                    ],
                ],
                'match_candidates_json' => $matchCandidates,
            ];

            if ($importeLa !== null) {
                $totalLaEstimado += $importeLa;
            }
            $uniqueDistributorCodes[$distributorCode] = true;

            if (count($sampleRows) < 5) {
                $sampleRows[] = [
                    'nro_planilla' => $nroPlanilla,
                    'fecha_planilla' => $fecha?->toDateString(),
                    'distribuidor' => $this->normalizeNullableString($distribuidorRaw),
                    'zona_recorrido' => $this->normalizeNullableString($zonaRecorridoRaw),
                    'kms' => $kms,
                    'la_jornada_base' => $laJornadaBase,
                    'factor_jornada' => $factorJornada,
                    'importe_la' => $importeLa,
                    'match_status' => $matchStatus,
                ];
            }
        }

        return [
            'staging_rows' => $stagingRows,
            'validation_results' => $validationResults,
            'rules' => $rules,
            'rules_source' => $rulesPayload['source'] ?? 'default',
            'sample_rows' => $sampleRows,
            'stats' => [
                'input_rows_count' => count($rows),
                'imported_rows_count' => $importedRowsCount,
                'ignored_rows_count' => $ignoredRowsCount,
                'distributors_count' => count($uniqueDistributorCodes),
                'total_la_estimado' => round($totalLaEstimado, 2),
            ],
        ];
    }

    private function resolveUploadHeaderIndexByAliases(array $columns, array $aliases): ?int
    {
        $normalizedAliases = array_values(array_filter(array_map(
            fn ($alias) => $this->normalizeUploadHeader((string) $alias),
            $aliases
        )));
        if (empty($normalizedAliases)) {
            return null;
        }

        foreach ($columns as $index => $header) {
            $normalizedHeader = $this->normalizeUploadHeader((string) $header);
            if ($normalizedHeader === '') {
                continue;
            }
            if (in_array($normalizedHeader, $normalizedAliases, true)) {
                return (int) $index;
            }
        }

        return null;
    }

    private function selectBestUploadColumnIndexes(array $candidates, array $rows): array
    {
        $selected = [];

        foreach ($candidates as $standardColumn => $candidateList) {
            if (!is_array($candidateList) || empty($candidateList)) {
                continue;
            }

            $bestIndex = null;
            $bestScore = null;

            foreach ($candidateList as $candidate) {
                $index = isset($candidate['index']) ? (int) $candidate['index'] : -1;
                if ($index < 0) {
                    continue;
                }
                $header = (string) ($candidate['header'] ?? '');
                $score = $this->uploadColumnSelectionScore($standardColumn, $header, $rows, $index);

                if ($bestScore === null || $score > $bestScore) {
                    $bestScore = $score;
                    $bestIndex = $index;
                }
            }

            if ($bestIndex !== null) {
                $selected[$standardColumn] = $bestIndex;
            }
        }

        return $selected;
    }

    private function uploadColumnSelectionScore(string $standardColumn, string $header, array $rows, int $columnIndex): int
    {
        $nonEmpty = $this->uploadColumnNonEmptyCount($rows, $columnIndex);
        $score = $nonEmpty * 10;
        $normalizedHeader = $this->normalizeUploadHeader($header);
        $compactHeader = str_replace(' ', '', $normalizedHeader);

        if ($standardColumn === 'Importe') {
            [$numericCount, $nonZeroCount] = $this->uploadColumnNumericStats($rows, $columnIndex);
            $score += ($numericCount * 15) + ($nonZeroCount * 35);

            if (strpos($normalizedHeader, 'importe') !== false) {
                $score += 180;
            }
            if (strpos($normalizedHeader, 'monto') !== false) {
                $score += 80;
            }
            if (strpos($normalizedHeader, 'total') !== false || strpos($normalizedHeader, 'valor') !== false) {
                $score += 30;
            }
            if (strpos($normalizedHeader, 'tarifa') !== false && strpos($normalizedHeader, 'final') !== false) {
                $score += 220;
            }
        } elseif ($standardColumn === 'Litros') {
            if (strpos($normalizedHeader, 'litro') !== false || strpos($normalizedHeader, 'volumen') !== false) {
                $score += 600;
            }
            if (strpos($normalizedHeader, 'cantidad') !== false) {
                $score += 120;
            }
        } elseif ($standardColumn === 'Precio/Litro') {
            if (strpos($compactHeader, 'preciolitro') !== false) {
                $score += 700;
            } elseif (strpos($normalizedHeader, 'precio') !== false && strpos($normalizedHeader, 'litro') !== false) {
                $score += 500;
            }
        } elseif ($standardColumn === 'Dominio') {
            if (strpos($normalizedHeader, 'patente') !== false || strpos($normalizedHeader, 'dominio') !== false) {
                $score += 500;
            }
        } elseif ($standardColumn === 'Producto') {
            if (strpos($normalizedHeader, 'producto') !== false || strpos($normalizedHeader, 'combustible') !== false) {
                $score += 500;
            }
        }

        return $score;
    }

    private function uploadColumnNumericStats(array $rows, int $columnIndex): array
    {
        if ($columnIndex < 0) {
            return [0, 0];
        }

        $numericCount = 0;
        $nonZeroCount = 0;
        foreach ($rows as $row) {
            if (!array_key_exists($columnIndex, $row)) {
                continue;
            }

            $parsed = $this->parseFloatOrNull((string) $row[$columnIndex]);
            if ($parsed === null) {
                continue;
            }

            $numericCount += 1;
            if (abs($parsed) > 0.000001) {
                $nonZeroCount += 1;
            }
        }

        return [$numericCount, $nonZeroCount];
    }

    private function uploadColumnNonEmptyCount(array $rows, int $columnIndex): int
    {
        if ($columnIndex < 0) {
            return 0;
        }

        $count = 0;
        foreach ($rows as $row) {
            if (!array_key_exists($columnIndex, $row)) {
                continue;
            }
            if (trim((string) $row[$columnIndex]) !== '') {
                $count += 1;
            }
        }

        return $count;
    }

    private function applyUploadFormatColumnOverrides(array $columns, array $rows, array $indexMap, ?string $format): array
    {
        $normalizedFormat = strtolower(trim((string) $format));
        $forceProductFromColumnV = $normalizedFormat === '' || $normalizedFormat === 'custom' || $normalizedFormat === 'extractos';
        if (!$forceProductFromColumnV) {
            return [$indexMap, null];
        }

        $currentProductIndex = $indexMap['Producto'] ?? null;
        if ($currentProductIndex !== null && array_key_exists($currentProductIndex, $columns)) {
            $currentProductHeader = $this->normalizeUploadHeader((string) $columns[$currentProductIndex]);
            if (
                $currentProductHeader !== ''
                && (
                    str_contains($currentProductHeader, 'unidad')
                    || str_contains($currentProductHeader, 'tipo unidad')
                )
            ) {
                return [$indexMap, null];
            }
        }

        $productColumnIndex = $this->columnLettersToZeroIndex('V');
        $maxColumns = max(count($columns), $this->maxUploadRowWidth($rows));
        if (
            $productColumnIndex >= 0
            && $productColumnIndex < $maxColumns
            && $this->uploadColumnHasAnyValue($rows, $productColumnIndex)
            && $this->uploadColumnLooksLikeProduct($rows, $productColumnIndex)
        ) {
            $indexMap['Producto'] = $productColumnIndex;
            return [$indexMap, 'V'];
        }

        return [$indexMap, null];
    }

    private function maxUploadRowWidth(array $rows): int
    {
        $max = 0;
        foreach ($rows as $row) {
            $max = max($max, count($row));
        }

        return $max;
    }

    private function uploadColumnHasAnyValue(array $rows, int $columnIndex): bool
    {
        if ($columnIndex < 0) {
            return false;
        }

        foreach ($rows as $row) {
            if (!array_key_exists($columnIndex, $row)) {
                continue;
            }
            if (trim((string) $row[$columnIndex]) !== '') {
                return true;
            }
        }

        return false;
    }

    private function uploadColumnLooksLikeProduct(array $rows, int $columnIndex): bool
    {
        if ($columnIndex < 0) {
            return false;
        }

        $nonEmpty = 0;
        $numeric = 0;
        $withLetters = 0;

        foreach ($rows as $row) {
            if (!array_key_exists($columnIndex, $row)) {
                continue;
            }
            $value = trim((string) $row[$columnIndex]);
            if ($value === '') {
                continue;
            }
            $nonEmpty += 1;
            if ($this->parseFloatOrNull($value) !== null) {
                $numeric += 1;
            }
            if (preg_match('/[A-Za-zÁÉÍÓÚáéíóúÑñ]/u', $value)) {
                $withLetters += 1;
            }
        }

        if ($nonEmpty === 0) {
            return false;
        }

        $numericRatio = $numeric / $nonEmpty;
        $lettersRatio = $withLetters / $nonEmpty;

        return $lettersRatio >= 0.30 && $numericRatio <= 0.70;
    }

    private function columnLettersToZeroIndex(string $letters): int
    {
        $normalized = strtoupper(trim($letters));
        if ($normalized === '' || preg_match('/[^A-Z]/', $normalized)) {
            return -1;
        }

        $index = 0;
        for ($i = 0, $len = strlen($normalized); $i < $len; $i++) {
            $index = $index * 26 + (ord($normalized[$i]) - 64);
        }

        return $index - 1;
    }

    private function mapUploadHeaderToStandard(string $header): ?string
    {
        $normalized = $this->normalizeUploadHeader($header);
        if ($normalized === '') {
            return null;
        }

        $compact = str_replace(' ', '', $normalized);
        if (
            strpos($compact, 'preciolitro') !== false ||
            (strpos($normalized, 'precio') !== false && strpos($normalized, 'litro') !== false)
        ) {
            return 'Precio/Litro';
        }
        if (strpos($normalized, 'fecha') !== false) {
            return 'Fecha';
        }
        if (strpos($normalized, 'estacion') !== false || strpos($normalized, 'establecimiento') !== false) {
            return 'Estación';
        }
        if (
            strpos($normalized, 'dominio') !== false ||
            strpos($normalized, 'patente') !== false ||
            strpos($normalized, 'placa') !== false
        ) {
            return 'Dominio';
        }
        if (
            strpos($normalized, 'producto') !== false
            || strpos($normalized, 'combustible') !== false
            || strpos($normalized, 'unidad') !== false
            || strpos($normalized, 'tipo unidad') !== false
        ) {
            return 'Producto';
        }
        if (strpos($normalized, 'factura') !== false || strpos($normalized, 'comprobante') !== false || strpos($normalized, 'ticket') !== false) {
            return 'Nro. Factura';
        }
        if (
            strpos($normalized, 'conductor') !== false
            || strpos($normalized, 'chofer') !== false
            || strpos($normalized, 'nombre y apellido') !== false
            || strpos($normalized, 'apellido y nombre') !== false
            || strpos($normalized, 'nombre apellido') !== false
        ) {
            return 'Conductor';
        }
        if (strpos($normalized, 'litro') !== false || strpos($normalized, 'cantidad') !== false || strpos($normalized, 'volumen') !== false) {
            return 'Litros';
        }
        if (
            strpos($normalized, 'importe') !== false ||
            strpos($normalized, 'monto') !== false ||
            strpos($normalized, 'total') !== false ||
            strpos($normalized, 'valor') !== false ||
            (strpos($normalized, 'tarifa') !== false && strpos($normalized, 'final') !== false)
        ) {
            return 'Importe';
        }

        return null;
    }

    private function normalizeUploadHeader(string $header): string
    {
        $value = trim($header);
        $value = strtr($value, [
            'Á' => 'A',
            'É' => 'E',
            'Í' => 'I',
            'Ó' => 'O',
            'Ú' => 'U',
            'Ü' => 'U',
            'Ñ' => 'N',
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ü' => 'u',
            'ñ' => 'n',
        ]);
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/u', ' ', $value);

        return trim($value ?? '');
    }

    private function detectUploadHeaderRow(array $rows): ?int
    {
        [$index, $score] = $this->detectUploadHeaderRowWithScore($rows);
        return $score >= 2 ? $index : null;
    }

    private function detectUploadHeaderRowWithScore(array $rows): array
    {
        if (empty($rows)) {
            return [null, 0];
        }

        $bestIndex = null;
        $bestScore = 0;
        foreach ($rows as $index => $row) {
            $score = 0;
            foreach ($row as $cell) {
                if ($this->mapUploadHeaderToStandard((string) $cell) !== null) {
                    $score += 1;
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestIndex = $index;
            }
        }

        return [$bestIndex, $bestScore];
    }

    private function getUploadRowValue(array $row, array $indexes, string $column): string
    {
        $index = $indexes[$column] ?? null;
        if ($index === null) {
            return '';
        }

        return (string) ($row[$index] ?? '');
    }

    private function resolvePreferredUploadDateOrder(array $rows, array $columnIndexes): string
    {
        $dateIndex = $columnIndexes['Fecha'] ?? null;
        if ($dateIndex === null) {
            return 'dmy';
        }

        $dmy = 0;
        $mdy = 0;
        foreach ($rows as $row) {
            $signal = $this->inferUploadDateOrderFromRaw((string) ($row[$dateIndex] ?? ''));
            if ($signal === 'dmy') {
                $dmy++;
            } elseif ($signal === 'mdy') {
                $mdy++;
            }
        }

        return $mdy > $dmy ? 'mdy' : 'dmy';
    }

    private function inferUploadDateOrderFromRaw(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (!preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\D|$)/', $trimmed, $matches)) {
            return null;
        }

        $first = (int) $matches[1];
        $second = (int) $matches[2];
        if ($first > 12 && $second <= 12) {
            return 'dmy';
        }
        if ($second > 12 && $first <= 12) {
            return 'mdy';
        }

        return null;
    }

    private function parseUploadDate(string $value, string $preferredOrder = 'dmy'): ?Carbon
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (is_numeric($trimmed)) {
            $serial = (float) $trimmed;
            if ($serial < 1 || $serial > 80000) {
                return null;
            }
            $base = Carbon::create(1899, 12, 30, 0, 0, 0, 'UTC');
            $days = (int) floor($serial);
            $seconds = (int) round(($serial - $days) * 86400);
            return $base->copy()->addDays($days)->addSeconds($seconds);
        }

        $dmyFormats = ['!d/m/Y H:i:s', '!d/m/Y H:i', '!d/m/Y', '!d-m-Y H:i:s', '!d-m-Y H:i', '!d-m-Y'];
        $mdyFormats = ['!m/d/Y H:i:s', '!m/d/Y H:i', '!m/d/Y', '!m-d-Y H:i:s', '!m-d-Y H:i', '!m-d-Y'];
        $isoFormats = ['!Y-m-d H:i:s', '!Y-m-d H:i', '!Y-m-d'];
        $formats = $preferredOrder === 'mdy'
            ? array_merge($mdyFormats, $dmyFormats, $isoFormats)
            : array_merge($dmyFormats, $mdyFormats, $isoFormats);

        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $trimmed);
            if (!$date) {
                continue;
            }
            $errors = \DateTime::getLastErrors();
            if (is_array($errors) && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0)) {
                continue;
            }
            $normalizedFormat = ltrim($format, '!');
            if ($date->format($normalizedFormat) === $trimmed) {
                return Carbon::instance($date);
            }
        }

        if (preg_match('/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/', $trimmed)) {
            return null;
        }
        if (!preg_match('/[\/\-\:T]/', $trimmed)) {
            return null;
        }

        try {
            return Carbon::parse($trimmed);
        } catch (\Throwable) {
            return null;
        }
    }

    private function buildUploadDuplicateKey(
        string $domainNorm,
        ?Carbon $occurredAt,
        ?float $amount,
        ?float $liters,
        ?string $station
    ): string {
        if ($domainNorm === '' || $occurredAt === null || $amount === null || $liters === null) {
            return '';
        }

        return strtolower(implode('|', [
            $domainNorm,
            $occurredAt->format('Y-m-d H:i:s'),
            number_format(round($amount, 2), 2, '.', ''),
            number_format(round($liters, 3), 3, '.', ''),
            $this->normalizeUploadStation($station ?? ''),
        ]));
    }

    private function normalizeUploadStation(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/\s+/', ' ', $normalized);

        return $normalized ?? '';
    }

    private function normalizeUploadLiters(float $liters, ?float $price, ?float $amount): float
    {
        if ($price === null || $amount === null || $price <= 0 || $amount <= 0 || $liters <= 0) {
            return $liters;
        }

        $expected = $liters * $price;
        if ($expected > ($amount * 10) && $liters >= 100) {
            return $liters / 100;
        }

        return $liters;
    }

    private function listUploadWorksheetFiles(ZipArchive $zip): array
    {
        $fromWorkbook = $this->readUploadWorkbookSheets($zip);
        if (!empty($fromWorkbook)) {
            return $fromWorkbook;
        }

        $files = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (is_string($name) && preg_match('/^xl\/worksheets\/[^\/]+\.xml$/', $name)) {
                $files[] = [
                    'name' => basename($name, '.xml'),
                    'path' => $name,
                ];
            }
        }

        usort($files, fn ($a, $b) => strcmp($a['path'], $b['path']));
        return $files;
    }

    private function resolveUploadPreferredSheet(?string $preferred, array $sheetEntries): ?string
    {
        if (!is_string($preferred) || trim($preferred) === '') {
            return null;
        }

        $normalized = strtolower(trim($preferred));
        foreach ($sheetEntries as $sheetEntry) {
            if (strtolower($sheetEntry['path']) === $normalized) {
                return $sheetEntry['path'];
            }
            if (strtolower($sheetEntry['name']) === $normalized) {
                return $sheetEntry['path'];
            }
        }

        if (preg_match('/^sheet(\d+)$/', $normalized, $matches)) {
            $target = 'xl/worksheets/sheet' . $matches[1] . '.xml';
            foreach ($sheetEntries as $sheetEntry) {
                if ($sheetEntry['path'] === $target) {
                    return $target;
                }
            }
        }

        if (ctype_digit($normalized)) {
            $target = 'xl/worksheets/sheet' . $normalized . '.xml';
            foreach ($sheetEntries as $sheetEntry) {
                if ($sheetEntry['path'] === $target) {
                    return $target;
                }
            }
        }

        return null;
    }

    private function readUploadWorkbookSheets(ZipArchive $zip): array
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if (!$workbookXml || !$relsXml) {
            return [];
        }

        $workbook = simplexml_load_string($workbookXml);
        $rels = simplexml_load_string($relsXml);
        if (!$workbook || !$rels) {
            return [];
        }

        $relsMap = [];
        foreach ($rels->Relationship as $relationship) {
            $id = (string) $relationship['Id'];
            $target = (string) $relationship['Target'];
            if ($id !== '' && $target !== '') {
                $relsMap[$id] = $target;
            }
        }

        $sheets = [];
        foreach ($workbook->sheets->sheet as $sheet) {
            $name = (string) $sheet['name'];
            $relationId = (string) $sheet['id'];
            if ($relationId === '') {
                $relationId = (string) $sheet->attributes('r', true)->id;
            }
            $target = $relsMap[$relationId] ?? null;
            if (!$target) {
                continue;
            }
            $path = 'xl/' . ltrim($target, '/');
            $sheets[] = [
                'name' => $name !== '' ? $name : basename($path, '.xml'),
                'path' => $path,
            ];
        }

        return $sheets;
    }

    private function readUploadSharedStrings(ZipArchive $zip): array
    {
        $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if (!$sharedStringsXml) {
            return [];
        }

        $sharedStringsNode = simplexml_load_string($sharedStringsXml);
        if (!$sharedStringsNode) {
            return [];
        }

        $sharedStrings = [];
        foreach ($sharedStringsNode->si as $item) {
            if (isset($item->t)) {
                $sharedStrings[] = (string) $item->t;
                continue;
            }

            if (isset($item->r)) {
                $text = '';
                foreach ($item->r as $run) {
                    $text .= (string) $run->t;
                }
                $sharedStrings[] = $text;
            }
        }

        return $sharedStrings;
    }

    private function extractUploadSheetRows(string $sheetXml, array $sharedStrings, int $limitRows): array
    {
        $sheet = simplexml_load_string($sheetXml);
        if (!$sheet || !isset($sheet->sheetData)) {
            return [[], 0];
        }

        $rows = [];
        $rowCount = 0;
        foreach ($sheet->sheetData->row as $row) {
            $rowCount += 1;
            if (count($rows) >= $limitRows) {
                continue;
            }

            $cells = [];
            $nextIndex = 0;
            foreach ($row->c as $cell) {
                $cellRef = (string) $cell['r'];
                if ($cellRef !== '') {
                    $columnIndex = $this->columnIndexFromUploadCellRef($cellRef);
                    $nextIndex = max($nextIndex, $columnIndex + 1);
                } else {
                    $columnIndex = $nextIndex;
                    $nextIndex += 1;
                }

                $cells[$columnIndex] = $this->readUploadCellValue($cell, $sharedStrings);
            }

            $rows[] = $this->normalizeUploadRowByIndex($cells);
        }

        return [$rows, $rowCount];
    }

    private function readUploadCellValue(\SimpleXMLElement $cell, array $sharedStrings): string
    {
        $type = (string) $cell['t'];
        if ($type === 'inlineStr' && isset($cell->is)) {
            return (string) $cell->is->t;
        }

        $value = (string) $cell->v;
        if ($type === 's') {
            $index = (int) $value;
            return $sharedStrings[$index] ?? '';
        }

        return $value;
    }

    private function columnIndexFromUploadCellRef(string $cellRef): int
    {
        $letters = preg_replace('/[^A-Z]/', '', strtoupper($cellRef));
        $index = 0;
        for ($i = 0, $len = strlen($letters); $i < $len; $i++) {
            $index = $index * 26 + (ord($letters[$i]) - 64);
        }

        return max(0, $index - 1);
    }

    private function normalizeUploadRowByIndex(array $cells): array
    {
        if (empty($cells)) {
            return [];
        }

        ksort($cells);
        $maxIndex = max(array_keys($cells));
        $row = array_fill(0, $maxIndex + 1, '');
        foreach ($cells as $index => $value) {
            $row[$index] = $value;
        }

        return $this->expandUploadDelimitedRow($row);
    }

    private function fillUploadRow(array $columns, array $data): array
    {
        if (array_values($data) !== $data) {
            ksort($data);
            $data = array_values($data);
        }

        $row = [];
        $count = max(count($columns), count($data));
        for ($i = 0; $i < $count; $i++) {
            $row[] = $data[$i] ?? '';
        }

        return $row;
    }

    private function expandUploadDelimitedRow(array $row): array
    {
        if (count($row) !== 1) {
            return $row;
        }

        $cell = (string) ($row[0] ?? '');
        if ($cell === '') {
            return $row;
        }

        if (strpos($cell, "\t") !== false) {
            return array_map('trim', explode("\t", $cell));
        }
        if (strpos($cell, ';') !== false && strpos($cell, ',') === false) {
            return array_map('trim', explode(';', $cell));
        }

        $parts = preg_split('/\s{2,}/', $cell);
        if (is_array($parts) && count($parts) >= 4) {
            return array_map('trim', $parts);
        }

        return $row;
    }

    private function fallbackUploadColumnsFromRows(array $rows): array
    {
        $max = 0;
        foreach ($rows as $row) {
            $max = max($max, count($row));
        }

        $columns = [];
        for ($i = 0; $i < $max; $i++) {
            $columns[] = 'Columna ' . ($i + 1);
        }

        return $columns;
    }

    private function isUploadRowEmpty(array $row): bool
    {
        foreach ($row as $cell) {
            if (trim((string) $cell) !== '') {
                return false;
            }
        }

        return true;
    }

    private function refreshRunCounters(LiquidacionImportRun $run): void
    {
        $rowsQuery = LiquidacionStagingRow::query()->where('run_id', $run->id);
        $rowsTotal = (int) $rowsQuery->count();
        $rowsOk = (int) (clone $rowsQuery)->where('validation_status', 'OK')->count();
        $rowsError = (int) (clone $rowsQuery)->where('validation_status', 'ERROR_CRITICO')->count();
        $rowsAlert = (int) (clone $rowsQuery)->where('validation_status', 'ALERTA')->count();
        $rowsDiff = (int) (clone $rowsQuery)->where('validation_status', 'DIFERENCIA')->count();

        $run->update([
            'rows_total' => $rowsTotal,
            'rows_ok' => $rowsOk,
            'rows_error' => $rowsError,
            'rows_alert' => $rowsAlert,
            'rows_diff' => $rowsDiff,
        ]);
    }

    private function generateAutomaticObservations(LiquidacionImportRun $run): void
    {
        $rows = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->whereIn('validation_status', ['ERROR_CRITICO', 'ALERTA', 'DIFERENCIA'])
            ->get();

        foreach ($rows as $row) {
            $message = $this->normalizeNullableString($row->observations_auto)
                ?? sprintf('Fila %s marcada como %s.', (string) ($row->row_number ?? $row->id), $row->validation_status);

            LiquidacionObservation::query()->firstOrCreate([
                'run_id' => $run->id,
                'staging_row_id' => $row->id,
                'type' => $this->observationTypeFromValidationStatus((string) $row->validation_status),
                'message' => $message,
            ], [
                'status' => 'OPEN',
            ]);
        }

        $failedValidations = LiquidacionValidationResult::query()
            ->where('run_id', $run->id)
            ->where('result', 'FAIL')
            ->where('severity', 'CRITICAL')
            ->get();

        foreach ($failedValidations as $validation) {
            $message = $this->normalizeNullableString($validation->message)
                ?? sprintf('Regla %s falló con severidad crítica.', $validation->rule_code);

            LiquidacionObservation::query()->firstOrCreate([
                'run_id' => $run->id,
                'staging_row_id' => $validation->staging_row_id,
                'validation_result_id' => $validation->id,
                'type' => 'ERROR',
                'message' => $message,
            ], [
                'status' => 'OPEN',
            ]);
        }
    }

    private function clearOpenAutomaticObservations(LiquidacionImportRun $run): void
    {
        LiquidacionObservation::query()
            ->where('run_id', $run->id)
            ->where('status', 'OPEN')
            ->whereNull('assigned_to')
            ->whereNull('resolved_at')
            ->delete();
    }

    private function buildPeriodRange(int $anio, int $mes, string $tipoPeriodo, ?string $quincena): array
    {
        $base = Carbon::create($anio, $mes, 1, 0, 0, 0)->startOfDay();
        if ($tipoPeriodo === 'QUINCENAL') {
            if ($quincena === '2Q') {
                return [$base->copy()->day(16), $base->copy()->endOfMonth()];
            }

            return [$base->copy()->day(1), $base->copy()->day(15)];
        }

        return [$base->copy()->day(1), $base->copy()->endOfMonth()];
    }

    private function resolveImportacionVersion(
        string $clientCode,
        Carbon $periodFrom,
        Carbon $periodTo,
        string $tipoPeriodo,
        ?string $quincena,
        int $sucursalId
    ): int {
        $runs = LiquidacionImportRun::query()
            ->where('client_code', $clientCode)
            ->whereDate('period_from', $periodFrom->toDateString())
            ->whereDate('period_to', $periodTo->toDateString())
            ->get(['metadata']);

        $maxVersion = 0;
        foreach ($runs as $run) {
            $metadata = is_array($run->metadata) ? $run->metadata : [];
            $period = is_array($metadata['period'] ?? null) ? $metadata['period'] : [];
            $importacion = is_array($metadata['importacion'] ?? null) ? $metadata['importacion'] : [];

            $sameTipo = strtoupper((string) ($period['tipo_periodo'] ?? '')) === strtoupper($tipoPeriodo);
            $sameQuincena = (($period['quincena'] ?? null) ?: null) === (($quincena ?: null));
            $sameSucursal = (int) ($period['sucursal_id'] ?? 0) === $sucursalId;
            if (!$sameTipo || !$sameQuincena || !$sameSucursal) {
                continue;
            }

            $maxVersion = max($maxVersion, (int) ($importacion['version'] ?? 1));
        }

        return max(1, $maxVersion + 1);
    }

    private function buildImportacionPreviewDistribuidores(LiquidacionImportRun $run): array
    {
        $distribuidores = LiquidacionDistribuidor::query()
            ->where('run_id', $run->id)
            ->orderBy('id')
            ->get();

        $result = [];
        foreach ($distribuidores as $distribuidor) {
            $alertas = [];
            $lineas = LiquidacionDistribuidorLinea::query()
                ->where('distributor_id', $distribuidor->id)
                ->whereNotNull('alertas')
                ->limit(50)
                ->get(['row_number', 'alertas']);

            foreach ($lineas as $linea) {
                $items = is_array($linea->alertas) ? $linea->alertas : [];
                foreach ($items as $item) {
                    $msg = $this->normalizeNullableString((string) $item);
                    if ($msg !== null) {
                        $alertas[] = sprintf('Fila %s: %s', (string) ($linea->row_number ?? $linea->id), $msg);
                    }
                }
            }

            $result[] = [
                'liquidacion_distribuidor_id' => $distribuidor->id,
                'proveedor_id' => $distribuidor->provider_id,
                'patente' => $distribuidor->patente_norm,
                'categoria' => $distribuidor->categoria_vehiculo,
                'subtotal_calculado' => round((float) $distribuidor->subtotal_calculado, 2),
                'subtotal_final' => round((float) $distribuidor->subtotal_final, 2),
                'gastos_admin_default' => round((float) $distribuidor->gastos_admin_default, 2),
                'gastos_admin_override' => $distribuidor->gastos_admin_override !== null
                    ? round((float) $distribuidor->gastos_admin_override, 2)
                    : null,
                'gastos_admin_final' => round((float) $distribuidor->gastos_admin_final, 2),
                'total_final' => round((float) $distribuidor->total_final, 2),
                'tiene_overrides' => (bool) $distribuidor->has_overrides,
                'alertas' => array_values(array_unique($alertas)),
            ];
        }

        return $result;
    }

    private function syncRunDistributorSnapshots(LiquidacionImportRun $run): void
    {
        $rows = LiquidacionStagingRow::query()
            ->where('run_id', $run->id)
            ->orderBy('row_number')
            ->orderBy('id')
            ->get();

        if ($rows->isEmpty()) {
            LiquidacionDistribuidor::query()->where('run_id', $run->id)->delete();
            return;
        }

        $groups = [];
        foreach ($rows as $row) {
            $key = $this->buildDistributorKeyFromStagingRow($row);
            if (!isset($groups[$key])) {
                $groups[$key] = [];
            }
            $groups[$key][] = $row;
        }

        $activeDistributorIds = [];
        foreach ($groups as $key => $groupRows) {
            $first = $groupRows[0];
            $rawPayload = is_array($first->raw_payload_json) ? $first->raw_payload_json : [];
            $mappedPayload = is_array($rawPayload['mapped'] ?? null) ? $rawPayload['mapped'] : [];

            $distribuidor = LiquidacionDistribuidor::query()
                ->where('run_id', $run->id)
                ->where('distributor_key', $key)
                ->first();

            if (!$distribuidor) {
                $distribuidor = new LiquidacionDistribuidor();
                $distribuidor->run_id = $run->id;
                $distribuidor->distributor_key = $key;
                $distribuidor->gastos_admin_default = 2010.0;
                $distribuidor->gastos_admin_final = 2010.0;
                $distribuidor->ajuste_manual = 0.0;
            }

            $distribuidor->provider_id = $first->distributor_id;
            $distribuidor->patente_norm = $first->domain_norm;
            $distribuidor->distributor_code = $this->normalizeNullableString($first->distributor_code);
            $distribuidor->distributor_name = $this->normalizeNullableString($first->distributor_name);
            $distribuidor->categoria_vehiculo = $this->resolveLineCategory($first);
            $distribuidor->status = $run->status;
            $distribuidor->save();
            $activeDistributorIds[] = $distribuidor->id;

            $lineIdsToKeep = [];
            foreach ($groupRows as $row) {
                $linea = LiquidacionDistribuidorLinea::query()
                    ->where('run_id', $run->id)
                    ->where('staging_row_id', $row->id)
                    ->first();
                if (!$linea) {
                    $linea = new LiquidacionDistribuidorLinea();
                    $linea->run_id = $run->id;
                    $linea->staging_row_id = $row->id;
                }

                $linea->distributor_id = $distribuidor->id;
                $linea->row_number = $row->row_number;
                $linea->fecha = $row->occurred_at;

                $rowRawPayload = is_array($row->raw_payload_json) ? $row->raw_payload_json : [];
                $mapped = is_array($rowRawPayload['mapped'] ?? null) ? $rowRawPayload['mapped'] : [];
                $epsa = is_array($rowRawPayload['epsa'] ?? null) ? $rowRawPayload['epsa'] : [];
                $linea->id_ruta = $this->normalizeNullableString((string) (
                    $mapped['ID RUTA']
                    ?? $mapped['RUTA']
                    ?? $epsa['nro_planilla']
                    ?? ''
                ));
                $linea->svc = $this->normalizeNullableString((string) (
                    $mapped['SVC']
                    ?? $mapped['ZONA RECORRIDO']
                    ?? $row->station
                    ?? ''
                ));

                $factorJornada = $this->resolveLineFactorJornada($row);
                $lineTurno = $this->resolveLineTurno($row);
                $lineCategory = $this->resolveLineCategory($row);
                $linea->turno_norm = $lineTurno;
                $linea->factor_jornada = $factorJornada;
                $linea->tarifa_dist_calculada = $this->resolveLineTarifaDistCalculada(
                    $run,
                    $row,
                    $lineCategory,
                    $lineTurno,
                    $linea->svc
                );
                $linea->plus_calculado = $this->resolveLinePlus($run, $row, $factorJornada);
                $linea->importe_calculado = round(
                    ((float) ($linea->tarifa_dist_calculada ?? 0) * (float) ($linea->factor_jornada ?? 1))
                    + (float) ($linea->plus_calculado ?? 0),
                    2
                );
                $linea->alertas = $this->resolveLineAlerts($row);
                $this->recalculateLineaFinal($linea);
                $linea->save();

                $lineIdsToKeep[] = $linea->id;
            }

            if (!empty($lineIdsToKeep)) {
                LiquidacionDistribuidorLinea::query()
                    ->where('distributor_id', $distribuidor->id)
                    ->whereNotIn('id', $lineIdsToKeep)
                    ->delete();
            }

            $this->recalculateDistribuidorTotals($distribuidor);
        }

        if (!empty($activeDistributorIds)) {
            LiquidacionDistribuidor::query()
                ->where('run_id', $run->id)
                ->whereNotIn('id', $activeDistributorIds)
                ->delete();
        }
    }

    private function buildDistributorKeyFromStagingRow(LiquidacionStagingRow $row): string
    {
        return $this->normalizeNullableString($row->distributor_code)
            ?? $this->normalizeNullableString($row->domain_norm)
            ?? $this->normalizeNullableString($row->name_excel_norm)
            ?? ('SIN-PROVEEDOR-' . $row->id);
    }

    private function resolveLineAlerts(LiquidacionStagingRow $row): array
    {
        $alerts = [];
        if (in_array((string) $row->validation_status, ['ALERTA', 'DIFERENCIA', 'ERROR_CRITICO'], true)) {
            $alerts[] = (string) $row->validation_status;
        }

        $auto = $this->normalizeNullableString($row->observations_auto);
        if ($auto !== null) {
            $chunks = preg_split('/[;\n]+/', $auto) ?: [];
            foreach ($chunks as $chunk) {
                $msg = $this->normalizeNullableString($chunk);
                if ($msg !== null) {
                    $alerts[] = $msg;
                }
            }
        }

        return array_values(array_unique($alerts));
    }

    private function resolveLineFactorJornada(LiquidacionStagingRow $row): float
    {
        $rawPayload = is_array($row->raw_payload_json) ? $row->raw_payload_json : [];
        $epsa = is_array($rawPayload['epsa'] ?? null) ? $rawPayload['epsa'] : [];
        $epsaFactor = $this->parseFloatOrNull($epsa['factor_jornada'] ?? null);
        if ($epsaFactor !== null && $epsaFactor > 0) {
            return $epsaFactor;
        }
        $mapped = is_array($rawPayload['mapped'] ?? null) ? $rawPayload['mapped'] : [];
        $candidate = $this->mappedPayloadString(
            $mapped,
            [
                '¿REALIZO RUTA ASIGNADA POR SVC?',
                'REALIZO RUTA ASIGNADA POR SVC',
                'REALIZO RUTA',
                'RUTA ASIGNADA',
            ]
        );
        if ($candidate === null) {
            return 1.0;
        }

        $normalized = strtoupper($this->normalizeUploadHeader($candidate));
        if ($normalized === 'NO') {
            return 0.5;
        }

        return 1.0;
    }

    private function resolveLineTurno(LiquidacionStagingRow $row): ?string
    {
        $rawPayload = is_array($row->raw_payload_json) ? $row->raw_payload_json : [];
        $mapped = is_array($rawPayload['mapped'] ?? null) ? $rawPayload['mapped'] : [];
        $turnoRaw = $this->mappedPayloadString($mapped, ['TURNO', 'Turno']);
        if ($turnoRaw !== null) {
            $upper = strtoupper($turnoRaw);
            if (in_array($upper, ['AM', 'PM', 'FULL'], true)) {
                return $upper;
            }
        }

        $productRaw = strtoupper((string) ($row->product ?? ''));
        if (str_contains($productRaw, ' AM')) {
            return 'AM';
        }
        if (str_contains($productRaw, ' PM')) {
            return 'PM';
        }

        return null;
    }

    private function resolveLineCategory(LiquidacionStagingRow $row): ?string
    {
        $rawPayload = is_array($row->raw_payload_json) ? $row->raw_payload_json : [];
        $mapped = is_array($rawPayload['mapped'] ?? null) ? $rawPayload['mapped'] : [];

        $candidate = $this->mappedPayloadString(
            $mapped,
            ['Categoria', 'Categoría', 'UNIDAD', 'Unidad', 'Producto', 'TIPO UNIDAD', 'Tipo unidad']
        ) ?? $this->normalizeNullableString((string) ($row->product ?? ''));
        if ($candidate === null) {
            return null;
        }

        $normalized = $this->normalizeRuleProduct($candidate);
        if (str_contains($normalized, 'largo') && (str_contains($normalized, '2018') || str_contains($normalized, 'new'))) {
            return 'LARGO_2018';
        }
        if (str_contains($normalized, 'largo')) {
            return 'LARGO';
        }
        if (str_contains($normalized, 'mediano')) {
            return 'MEDIANO';
        }
        if (str_contains($normalized, 'corto')) {
            return 'CORTO';
        }

        return strtoupper(str_replace(' ', '_', $normalized));
    }

    private function resolveLineTarifaDistCalculada(
        LiquidacionImportRun $run,
        LiquidacionStagingRow $row,
        ?string $category,
        ?string $turno,
        ?string $svc
    ): float {
        $rawPayload = is_array($row->raw_payload_json) ? $row->raw_payload_json : [];
        $epsa = is_array($rawPayload['epsa'] ?? null) ? $rawPayload['epsa'] : [];
        $epsaTarifa = $this->parseFloatOrNull($epsa['la_jornada_base'] ?? null);
        if ($epsaTarifa !== null && $epsaTarifa > 0) {
            return round($epsaTarifa, 2);
        }

        static $rulesCache = [];
        $clientCode = strtoupper((string) ($run->client_code ?? 'DEFAULT'));
        if (!isset($rulesCache[$clientCode])) {
            $rulesCache[$clientCode] = $this->resolveClientRuleSet($run->client_code)['rules'] ?? [];
        }
        $rules = $rulesCache[$clientCode];

        $fromRuleTariff = $this->resolveLineTarifaFromRuleTariffs($rules, $row, $category, $turno, $svc);
        if ($fromRuleTariff !== null) {
            return round($fromRuleTariff, 2);
        }

        return round((float) ($row->amount_expected ?? $row->amount ?? 0), 2);
    }

    private function resolveLineTarifaFromRuleTariffs(
        array $rules,
        LiquidacionStagingRow $row,
        ?string $category,
        ?string $turno,
        ?string $svc
    ): ?float {
        $fromMatrix = $this->resolveLineTarifaFromRuleMatrix($rules, $row, $category, $turno, $svc);
        if ($fromMatrix !== null) {
            return $fromMatrix;
        }

        $tariffs = is_array($rules['tariffs'] ?? null) ? $rules['tariffs'] : [];
        if (empty($tariffs)) {
            return null;
        }

        $targetKey = $this->resolveLineServiceKey($row, $category, $turno, $svc);
        if ($targetKey === null) {
            return null;
        }

        $fallbackValue = null;
        foreach ($tariffs as $tariff) {
            if (!is_array($tariff)) {
                continue;
            }

            $tariffKey = $this->resolveTariffRuleServiceKey((string) ($tariff['product'] ?? ''));
            if ($tariffKey === null) {
                continue;
            }

            $value = $this->parseFloatOrNull($tariff['price_per_liter'] ?? null);
            if ($value === null || $value <= 0) {
                continue;
            }

            if ($tariffKey === $targetKey) {
                return $value;
            }

            if ($targetKey === 'CORTO_PM_SC21' && $tariffKey === 'CORTO_PM') {
                $fallbackValue = $value;
            }
        }

        return $fallbackValue;
    }

    private function resolveLineTarifaFromRuleMatrix(
        array $rules,
        LiquidacionStagingRow $row,
        ?string $category,
        ?string $turno,
        ?string $svc
    ): ?float {
        $matrix = is_array($rules['tariff_matrix'] ?? null) ? $rules['tariff_matrix'] : null;
        if (!$matrix) {
            return null;
        }
        $zones = is_array($matrix['zones'] ?? null) ? $matrix['zones'] : [];
        if (empty($zones)) {
            return null;
        }

        $serviceKey = $this->resolveLineServiceKey($row, $category, $turno, $svc);
        if ($serviceKey === null) {
            return null;
        }

        $zoneKey = $this->resolveLineZoneKey($row, $svc);
        $defaultZone = strtoupper(trim((string) ($matrix['default_zone'] ?? 'AMBA')));

        $zoneData = $this->resolveMatrixZoneData($zones, $zoneKey)
            ?? $this->resolveMatrixZoneData($zones, $defaultZone)
            ?? $this->resolveMatrixZoneData($zones, 'AMBA');
        if (!is_array($zoneData)) {
            return null;
        }

        $keysToTry = array_values(array_unique(array_filter([
            $serviceKey,
            $serviceKey === 'CORTO_PM_SC21' ? 'ESCOBAR_PM' : null,
            $serviceKey === 'ESCOBAR_PM' ? 'CORTO_PM_SC21' : null,
        ])));

        $inferredKey = $this->inferServiceKeyFromOriginalAmount($zoneData, $row, $serviceKey);
        if ($inferredKey !== null && !in_array($inferredKey, $keysToTry, true)) {
            $keysToTry[] = $inferredKey;
        }

        foreach ($keysToTry as $key) {
            $entry = $this->resolveMatrixTariffEntry($zoneData, (string) $key);
            if (!is_array($entry)) {
                continue;
            }

            $value = $this->parseFloatOrNull(
                $entry['liquidacion']
                ?? $entry['liquidacion_tarifa']
                ?? $entry['tarifa_liquidacion']
                ?? $entry['price_per_liter']
                ?? null
            );
            if ($value !== null && $value > 0) {
                return $value;
            }

            $value = $this->parseFloatOrNull($entry['original'] ?? $entry['tarifa_original'] ?? null);
            if ($value !== null && $value > 0) {
                return $value;
            }
        }

        return null;
    }

    private function inferServiceKeyFromOriginalAmount(
        array $zoneData,
        LiquidacionStagingRow $row,
        ?string $currentServiceKey
    ): ?string {
        $rawPayload = is_array($row->raw_payload_json) ? $row->raw_payload_json : [];
        $mapped = is_array($rawPayload['mapped'] ?? null) ? $rawPayload['mapped'] : [];
        $amountCandidates = [
            $this->parseFloatOrNull($this->mappedPayloadString($mapped, ['Importe'])),
            $this->parseFloatOrNull($this->mappedPayloadString($mapped, ['Tarifa final', 'TARIFA FINAL'])),
            $this->parseFloatOrNull($row->amount ?? null),
            $this->parseFloatOrNull($row->tariff_expected ?? null),
        ];

        $amount = null;
        foreach ($amountCandidates as $candidate) {
            if ($candidate === null || abs($candidate) < 0.00001) {
                continue;
            }
            $amount = abs($candidate);
            break;
        }
        if ($amount === null) {
            return null;
        }

        $serviceKeys = [
            'CORTO_AM',
            'CORTO_PM',
            'CORTO_PM_SC21',
            'CORTO',
            'MEDIANO',
            'LARGO',
            'LARGO_2018',
            'CHASIS',
        ];
        $bestKey = null;
        $bestDiff = null;
        foreach ($serviceKeys as $serviceKey) {
            $entry = $this->resolveMatrixTariffEntry($zoneData, $serviceKey);
            if (!is_array($entry)) {
                continue;
            }
            $original = $this->parseFloatOrNull($entry['original'] ?? $entry['tarifa_original'] ?? null);
            if ($original === null || $original <= 0) {
                continue;
            }
            $diff = abs($amount - $original);
            if ($bestDiff === null || $diff < $bestDiff) {
                $bestDiff = $diff;
                $bestKey = $serviceKey;
            }
        }

        if ($bestKey === null || $bestDiff === null) {
            return null;
        }

        $maxAllowedDiff = max(1.0, $amount * 0.10);
        if ($bestDiff > $maxAllowedDiff) {
            return null;
        }

        if ($currentServiceKey === 'CORTO' && str_starts_with($bestKey, 'CORTO_')) {
            return $bestKey;
        }

        if ($currentServiceKey === null) {
            return $bestKey;
        }

        return null;
    }

    private function mappedPayloadString(array $mapped, array $aliases): ?string
    {
        foreach ($aliases as $alias) {
            if (array_key_exists($alias, $mapped)) {
                $value = $this->normalizeNullableString((string) ($mapped[$alias] ?? ''));
                if ($value !== null) {
                    return $value;
                }
            }
        }

        $byNormalizedKey = [];
        foreach ($mapped as $key => $value) {
            $normalizedKey = $this->normalizeUploadHeader((string) $key);
            if ($normalizedKey === '' || isset($byNormalizedKey[$normalizedKey])) {
                continue;
            }
            $byNormalizedKey[$normalizedKey] = $value;
        }

        foreach ($aliases as $alias) {
            $normalizedAlias = $this->normalizeUploadHeader((string) $alias);
            if ($normalizedAlias === '' || !array_key_exists($normalizedAlias, $byNormalizedKey)) {
                continue;
            }
            $value = $this->normalizeNullableString((string) ($byNormalizedKey[$normalizedAlias] ?? ''));
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function resolveLineServiceKey(
        LiquidacionStagingRow $row,
        ?string $category,
        ?string $turno,
        ?string $svc
    ): ?string {
        $categoryNorm = strtoupper(trim((string) $category));
        $turnNorm = strtoupper(trim((string) ($turno ?? '')));
        if ($turnNorm === '') {
            $turnNorm = 'FULL';
        }

        $isEscobar = $this->containsEscobar($svc)
            || $this->containsEscobar($row->station)
            || $this->containsEscobar($row->product);
        $isLargo2018 = $categoryNorm === 'LARGO_2018'
            || $this->contains2018OrNew($row->product);

        if ($categoryNorm === 'CORTO') {
            if ($turnNorm === 'PM' && $isEscobar) {
                return 'CORTO_PM_SC21';
            }
            if (in_array($turnNorm, ['AM', 'PM'], true)) {
                return 'CORTO_' . $turnNorm;
            }
            return 'CORTO';
        }
        if ($categoryNorm === 'MEDIANO') {
            return 'MEDIANO';
        }
        if ($categoryNorm === 'LARGO' || $categoryNorm === 'LARGO_2018') {
            if ($isLargo2018) {
                return 'LARGO_2018';
            }
            return 'LARGO';
        }
        if ($categoryNorm === 'CHASIS') {
            return 'CHASIS';
        }

        return null;
    }

    private function resolveTariffRuleServiceKey(string $ruleLabel): ?string
    {
        $normalized = $this->normalizeRuleProduct($ruleLabel);
        if ($normalized === '') {
            return null;
        }

        if (
            (str_contains($normalized, 'escobar') && str_contains($normalized, 'pm'))
            || str_contains($normalized, 'sc21')
        ) {
            return 'CORTO_PM_SC21';
        }
        if (str_contains($normalized, 'corto') && str_contains($normalized, 'am')) {
            return 'CORTO_AM';
        }
        if (str_contains($normalized, 'corto') && str_contains($normalized, 'pm')) {
            return 'CORTO_PM';
        }
        if (str_contains($normalized, 'corto')) {
            return 'CORTO';
        }
        if (str_contains($normalized, 'mediano')) {
            return 'MEDIANO';
        }
        if (str_contains($normalized, 'largo') && (str_contains($normalized, '2018') || str_contains($normalized, 'new'))) {
            return 'LARGO_2018';
        }
        if (str_contains($normalized, 'largo')) {
            return 'LARGO';
        }
        if (str_contains($normalized, 'chasis')) {
            return 'CHASIS';
        }

        return null;
    }

    private function resolveLineZoneKey(LiquidacionStagingRow $row, ?string $svc): string
    {
        $candidates = [
            (string) $svc,
            (string) ($row->station ?? ''),
            (string) ($row->product ?? ''),
        ];
        foreach ($candidates as $candidate) {
            $normalized = $this->normalizeRuleProduct($candidate);
            if ($normalized === '') {
                continue;
            }
            if (str_contains($normalized, 'mar del plata') || str_contains($normalized, 'mdq')) {
                return 'MDQ';
            }
            if (str_contains($normalized, 'rosario')) {
                return 'ROSARIO';
            }
            if (str_contains($normalized, 'santa fe')) {
                return 'SANTA_FE';
            }
            if (str_contains($normalized, 'neuquen')) {
                return 'NEUQUEN';
            }
            if (str_contains($normalized, 'bariloche')) {
                return 'BARILOCHE';
            }
            if (str_contains($normalized, 'amba') || str_contains($normalized, 'buenos aires')) {
                return 'AMBA';
            }
        }

        return 'AMBA';
    }

    private function resolveMatrixZoneData(array $zones, string $zoneKey): ?array
    {
        if (isset($zones[$zoneKey]) && is_array($zones[$zoneKey])) {
            return $zones[$zoneKey];
        }
        $upperKey = strtoupper(trim($zoneKey));
        foreach ($zones as $key => $value) {
            if (!is_array($value)) {
                continue;
            }
            if (strtoupper(trim((string) $key)) === $upperKey) {
                return $value;
            }
        }
        return null;
    }

    private function resolveMatrixTariffEntry(array $zoneData, string $serviceKey): ?array
    {
        if (isset($zoneData[$serviceKey]) && is_array($zoneData[$serviceKey])) {
            return $zoneData[$serviceKey];
        }

        $upperServiceKey = strtoupper(trim($serviceKey));
        foreach ($zoneData as $key => $value) {
            if (!is_array($value)) {
                continue;
            }
            $normalizedKey = $this->resolveTariffRuleServiceKey((string) $key);
            if ($normalizedKey === $upperServiceKey) {
                return $value;
            }
            $alias = strtoupper(trim((string) ($value['key'] ?? '')));
            if ($alias !== '' && $alias === $upperServiceKey) {
                return $value;
            }
        }

        return null;
    }

    private function containsEscobar($value): bool
    {
        $normalized = $this->normalizeRuleProduct((string) $value);
        return str_contains($normalized, 'escobar');
    }

    private function contains2018OrNew($value): bool
    {
        $normalized = $this->normalizeRuleProduct((string) $value);
        return str_contains($normalized, '2018') || str_contains($normalized, 'new');
    }

    private function resolveLinePlus(LiquidacionImportRun $run, LiquidacionStagingRow $row, float $factorJornada): float
    {
        $patente = strtoupper((string) ($row->domain_norm ?? ''));
        if ($patente === 'AH636RD') {
            return $factorJornada < 1 ? 5000.0 : 10000.0;
        }

        static $rulesCache = [];
        $cacheKey = strtoupper((string) ($run->client_code ?? 'DEFAULT'));
        if (!isset($rulesCache[$cacheKey])) {
            $rulesCache[$cacheKey] = $this->resolveClientRuleSet($run->client_code)['rules'] ?? [];
        }
        $rules = $rulesCache[$cacheKey];
        $plusOverrides = is_array($rules['plus_by_patente'] ?? null) ? $rules['plus_by_patente'] : [];
        if (isset($plusOverrides[$patente]) && is_array($plusOverrides[$patente])) {
            $media = $this->parseFloatOrNull($plusOverrides[$patente]['plus_media'] ?? null) ?? 0.0;
            $completa = $this->parseFloatOrNull($plusOverrides[$patente]['plus_completa'] ?? null) ?? 0.0;
            return $factorJornada < 1 ? $media : $completa;
        }

        return 0.0;
    }

    private function recalculateLineaFinal(LiquidacionDistribuidorLinea $linea): void
    {
        $factor = (float) ($linea->factor_jornada ?? 1);
        $tarifaFinal = $linea->tarifa_override !== null
            ? (float) $linea->tarifa_override
            : (float) ($linea->tarifa_dist_calculada ?? 0);
        $plusFinal = $linea->plus_override !== null
            ? (float) $linea->plus_override
            : (float) ($linea->plus_calculado ?? 0);

        $autoFinal = round(($tarifaFinal * $factor) + $plusFinal, 2);
        $linea->importe_final = $linea->importe_override !== null
            ? round((float) $linea->importe_override, 2)
            : $autoFinal;
    }

    private function recalculateDistribuidorTotals(LiquidacionDistribuidor $distribuidor): void
    {
        $lines = LiquidacionDistribuidorLinea::query()
            ->where('distributor_id', $distribuidor->id)
            ->get();

        $subtotalCalculado = 0.0;
        $subtotalFinal = 0.0;
        $hasLineOverrides = false;
        $alertsCount = 0;

        foreach ($lines as $linea) {
            $subtotalCalculado += (float) ($linea->importe_calculado ?? 0);
            $subtotalFinal += (float) ($linea->importe_final ?? 0);
            $hasLineOverrides = $hasLineOverrides
                || $linea->importe_override !== null
                || $linea->plus_override !== null
                || $linea->tarifa_override !== null;
            if (is_array($linea->alertas) && count($linea->alertas) > 0) {
                $alertsCount += 1;
            }
        }

        $gastosDefault = $this->parseFloatOrNull($distribuidor->gastos_admin_default) ?? 2010.0;
        $gastosFinal = $distribuidor->gastos_admin_override !== null
            ? (float) $distribuidor->gastos_admin_override
            : $gastosDefault;
        $ajuste = (float) ($distribuidor->ajuste_manual ?? 0);

        $distribuidor->subtotal_calculado = round($subtotalCalculado, 2);
        $distribuidor->subtotal_final = round($subtotalFinal, 2);
        $distribuidor->gastos_admin_default = round($gastosDefault, 2);
        $distribuidor->gastos_admin_final = round($gastosFinal, 2);
        $distribuidor->total_final = round($subtotalFinal - $gastosFinal + $ajuste, 2);
        $distribuidor->has_overrides = $hasLineOverrides
            || $distribuidor->gastos_admin_override !== null
            || abs($ajuste) > 0.000001;
        $distribuidor->alerts_count = $alertsCount;
        $distribuidor->save();
    }

    private function serializeDistribuidorDetail(LiquidacionDistribuidor $distribuidor): array
    {
        $distribuidor->load([
            'lines' => fn ($query) => $query->orderBy('row_number')->orderBy('id'),
        ]);

        return [
            'liquidacion_distribuidor_id' => $distribuidor->id,
            'proveedor_id' => $distribuidor->provider_id,
            'patente' => $distribuidor->patente_norm,
            'gastos_admin_default' => round((float) $distribuidor->gastos_admin_default, 2),
            'gastos_admin_override' => $distribuidor->gastos_admin_override !== null
                ? round((float) $distribuidor->gastos_admin_override, 2)
                : null,
            'lineas' => $distribuidor->lines->map(function (LiquidacionDistribuidorLinea $linea) {
                return [
                    'linea_id' => $linea->id,
                    'staging_linea_id' => $linea->staging_row_id,
                    'fecha' => $linea->fecha?->format('Y-m-d'),
                    'id_ruta' => $linea->id_ruta,
                    'svc' => $linea->svc,
                    'turno_norm' => $linea->turno_norm,
                    'factor_jornada' => (float) ($linea->factor_jornada ?? 1),
                    'tarifa_dist_calculada' => round((float) ($linea->tarifa_dist_calculada ?? 0), 2),
                    'plus_calculado' => round((float) ($linea->plus_calculado ?? 0), 2),
                    'importe_calculado' => round((float) ($linea->importe_calculado ?? 0), 2),
                    'importe_override' => $linea->importe_override !== null
                        ? round((float) $linea->importe_override, 2)
                        : null,
                    'importe_final' => round((float) ($linea->importe_final ?? 0), 2),
                    'alertas' => is_array($linea->alertas) ? $linea->alertas : [],
                ];
            })->values()->all(),
        ];
    }

    private function recordAuditChangesForEntity(
        string $entityType,
        int $entityId,
        array $oldValues,
        array $newValues,
        ?int $userId,
        string $reason
    ): void {
        foreach ($newValues as $field => $newValue) {
            $oldValue = $oldValues[$field] ?? null;
            $oldComparable = $this->stringifyAuditValue($oldValue);
            $newComparable = $this->stringifyAuditValue($newValue);
            if ($oldComparable === $newComparable) {
                continue;
            }

            LiquidacionAuditChange::query()->create([
                'entity_type' => strtoupper(trim($entityType)),
                'entity_id' => $entityId,
                'field' => $field,
                'old_value' => $oldComparable,
                'new_value' => $newComparable,
                'user_id' => $userId,
                'reason' => $reason,
                'created_at' => now(),
            ]);
        }
    }

    private function stringifyAuditValue($value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_scalar($value)) {
            return (string) $value;
        }
        if ($value instanceof Carbon) {
            return $value->toIso8601String();
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }

    private function isRunEditable(LiquidacionImportRun $run): bool
    {
        return in_array(strtoupper((string) $run->status), ['PRELIQUIDACION', 'CARGADA'], true);
    }

    private function serializeRun(LiquidacionImportRun $run): array
    {
        $metadata = is_array($run->metadata) ? $run->metadata : [];
        $importacion = is_array($metadata['importacion'] ?? null) ? $metadata['importacion'] : [];

        return [
            'id' => $run->id,
            'sourceSystem' => $run->source_system,
            'clientCode' => $run->client_code,
            'periodFrom' => optional($run->period_from)->format('Y-m-d'),
            'periodTo' => optional($run->period_to)->format('Y-m-d'),
            'version' => (int) ($importacion['version'] ?? 1),
            'sourceFileName' => $run->source_file_name,
            'sourceFileUrl' => $run->source_file_url,
            'sourceFileHash' => $run->source_file_hash,
            'status' => $run->status,
            'rowsTotal' => (int) $run->rows_total,
            'rowsOk' => (int) $run->rows_ok,
            'rowsError' => (int) $run->rows_error,
            'rowsAlert' => (int) $run->rows_alert,
            'rowsDiff' => (int) $run->rows_diff,
            'metadata' => $run->metadata,
            'approvedAt' => $run->approved_at?->toIso8601String(),
            'publishedAt' => $run->published_at?->toIso8601String(),
            'createdAt' => $run->created_at?->toIso8601String(),
            'updatedAt' => $run->updated_at?->toIso8601String(),
        ];
    }

    private function serializePublishJob(LiquidacionPublishJob $job): array
    {
        return [
            'id' => $job->id,
            'runId' => $job->run_id,
            'status' => $job->status,
            'erpRequestId' => $job->erp_request_id,
            'erpBatchId' => $job->erp_batch_id,
            'sentAt' => $job->sent_at?->toIso8601String(),
            'confirmedAt' => $job->confirmed_at?->toIso8601String(),
            'requestPayload' => $this->decodeJsonSafely($job->request_payload),
            'responsePayload' => $this->decodeJsonSafely($job->response_payload),
            'errorMessage' => $job->error_message,
            'createdAt' => $job->created_at?->toIso8601String(),
            'updatedAt' => $job->updated_at?->toIso8601String(),
        ];
    }

    private function decodeJsonSafely(?string $payload)
    {
        if (!is_string($payload) || trim($payload) === '') {
            return null;
        }

        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : $payload;
    }

    private function normalizeRunStatus(?string $status): string
    {
        $value = strtoupper(trim((string) $status));
        if ($value === '') {
            return 'CARGADA';
        }

        return match ($value) {
            'RECEIVED' => 'CARGADA',
            'NORMALIZED' => 'PROCESADA',
            'VALIDATED' => 'PRELIQUIDACION',
            'APPROVED' => 'APROBADA',
            'PUBLISHED' => 'PUBLICADA',
            default => $value,
        };
    }

    private function normalizeValidationStatus(?string $status): string
    {
        $value = strtoupper(trim((string) $status));
        return match ($value) {
            'OK', 'VALID', 'VALIDADO' => 'OK',
            'ERROR', 'ERROR_CRITICO', 'CRITICAL', 'CRITICO' => 'ERROR_CRITICO',
            'ALERTA', 'WARNING' => 'ALERTA',
            'DIFERENCIA', 'DIFFERENCE' => 'DIFERENCIA',
            default => 'ALERTA',
        };
    }

    private function normalizeSeverity(?string $severity): string
    {
        $value = strtoupper(trim((string) $severity));
        return match ($value) {
            'CRITICAL', 'CRITICO', 'CRÍTICO', 'ERROR' => 'CRITICAL',
            'WARNING', 'WARN', 'ALERTA' => 'WARNING',
            default => 'INFO',
        };
    }

    private function severityFromStatus(string $status): string
    {
        return match ($status) {
            'ERROR_CRITICO' => 'CRITICAL',
            'ALERTA' => 'WARNING',
            'DIFERENCIA' => 'WARNING',
            default => 'INFO',
        };
    }

    private function observationTypeFromValidationStatus(string $status): string
    {
        return match (strtoupper($status)) {
            'ERROR_CRITICO' => 'ERROR',
            'DIFERENCIA' => 'DIFERENCIA',
            default => 'ALERTA',
        };
    }

    private function isEpsaUploadMode($clientCode, ?string $format): bool
    {
        if ($this->isEpsaClientCode($this->normalizeClientCode($clientCode))) {
            return true;
        }

        $normalizedFormat = strtolower(trim((string) ($format ?? '')));
        return in_array($normalizedFormat, ['epsa', 'epsa_table', 'epsa-table'], true);
    }

    private function normalizeEpsaPlanillaNumber($value): ?string
    {
        $numeric = $this->parseFloatOrNull($value);
        if ($numeric === null || $numeric <= 0) {
            return null;
        }

        $rounded = (int) round($numeric);
        if (abs($numeric - $rounded) > 0.00001) {
            return null;
        }

        $planilla = (string) $rounded;
        if (in_array($planilla, ['81114101', '81115102'], true)) {
            return null;
        }

        return $planilla;
    }

    private function normalizeEpsaDistributorName(string $value): ?string
    {
        $normalized = strtoupper(trim($value));
        if ($normalized === '') {
            return null;
        }

        $normalized = strtr($normalized, [
            'Á' => 'A',
            'É' => 'E',
            'Í' => 'I',
            'Ó' => 'O',
            'Ú' => 'U',
            'Ü' => 'U',
            'Ñ' => 'N',
        ]);
        $normalized = str_replace(',', ' ', $normalized);
        $normalized = preg_replace('/[^A-Z ]+/u', ' ', $normalized);
        $normalized = preg_replace('/\s+/u', ' ', (string) $normalized);
        $normalized = trim((string) $normalized);
        if ($normalized === '') {
            return null;
        }

        $stopwords = ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'SRL', 'SA', 'S', 'A'];
        $tokens = array_values(array_filter(
            explode(' ', $normalized),
            static fn ($token) => $token !== '' && !in_array($token, $stopwords, true)
        ));

        if (empty($tokens)) {
            return null;
        }

        return implode(' ', $tokens);
    }

    private function resolveEpsaFactorJornada(string $zonaRecorridoRaw): array
    {
        $normalizedZone = $this->normalizeRuleProduct($zonaRecorridoRaw);
        if ($normalizedZone !== '' && str_contains($normalizedZone, 'media ruta')) {
            return [
                'factor' => 0.5,
                'motivo' => 'MEDIA_RUTA',
            ];
        }
        if ($normalizedZone !== '' && str_contains($normalizedZone, 'ambulancia')) {
            return [
                'factor' => 0.5,
                'motivo' => 'AMBULANCIA',
            ];
        }

        return [
            'factor' => 1.0,
            'motivo' => 'NORMAL',
        ];
    }

    private function resolveEpsaTarifaByKms(array $rules, ?float $kms): array
    {
        if ($kms === null || $kms <= 0) {
            return [
                'la_jornada' => null,
                'error' => 'KM inválido.',
            ];
        }

        $tarifarioRows = is_array($rules['epsa']['tarifario_ut_chico'] ?? null)
            ? $rules['epsa']['tarifario_ut_chico']
            : [];
        foreach ($tarifarioRows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $kmDesde = $this->parseFloatOrNull($row['km_desde'] ?? null);
            $kmHasta = $this->parseFloatOrNull($row['km_hasta'] ?? null);
            $laJornada = $this->parseFloatOrNull($row['la_jornada'] ?? null);
            if ($kmDesde === null || $kmHasta === null || $laJornada === null || $laJornada <= 0) {
                continue;
            }

            if ($kms >= $kmDesde && $kms <= $kmHasta) {
                return [
                    'la_jornada' => $laJornada,
                    'error' => null,
                ];
            }
        }

        return [
            'la_jornada' => null,
            'error' => 'KM fuera de rango tarifario UT.Chico.',
        ];
    }

    private function normalizeNullableString($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeClientCode($value): ?string
    {
        $normalized = $this->normalizeNullableString(is_string($value) ? $value : null);
        return $normalized !== null ? strtoupper($normalized) : null;
    }

    private function normalizeDomain($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $normalized = strtoupper(trim($value));
        $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);
        if (!is_string($normalized) || $normalized === '') {
            return null;
        }

        return $normalized;
    }

    private function parseFloatOrNull($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_string($value)) {
            $clean = str_replace(["\u{00A0}", ' '], '', trim($value));
            $clean = preg_replace('/[^0-9,\.\-\+]+/u', '', $clean ?? '');
            if (!is_string($clean) || $clean === '' || $clean === '-' || $clean === '+' || $clean === ',' || $clean === '.') {
                return null;
            }
            $hasComma = strpos($clean, ',') !== false;
            $hasDot = strpos($clean, '.') !== false;
            if ($hasComma && $hasDot) {
                $lastCommaPos = strrpos($clean, ',');
                $lastDotPos = strrpos($clean, '.');
                if ($lastCommaPos !== false && $lastDotPos !== false && $lastCommaPos > $lastDotPos) {
                    $clean = str_replace('.', '', $clean);
                    $clean = str_replace(',', '.', $clean);
                } else {
                    $clean = str_replace(',', '', $clean);
                }
            } elseif ($hasComma) {
                $clean = str_replace(',', '.', $clean);
            }
        } else {
            $clean = (string) $value;
        }

        if (!is_numeric($clean)) {
            return null;
        }

        return (float) $clean;
    }

    private function parseDateTimeOrNull($value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof Carbon) {
            return $value;
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return null;
            }

            try {
                return Carbon::parse($trimmed);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    private function parseDateOnlyOrNull($value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof Carbon) {
            return $value->copy()->startOfDay();
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return null;
            }
            try {
                return Carbon::parse($trimmed)->startOfDay();
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }
}
