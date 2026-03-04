<?php

namespace App\Services\Liquidaciones;

use App\Models\AuditLog;
use App\Models\LiquidacionImportRun;
use App\Models\LiquidacionObservation;
use App\Models\LiquidacionPublishJob;
use App\Services\Erp\ErpClient;

class LiquidacionPublishProcessor
{
    public function __construct(private readonly ErpClient $erpClient)
    {
    }

    public function processById(int $publishJobId, ?int $actorUserId = null): array
    {
        $publishJob = LiquidacionPublishJob::query()->find($publishJobId);
        if (!$publishJob) {
            throw new \RuntimeException('Publish job no encontrado.');
        }

        return $this->process($publishJob, $actorUserId);
    }

    public function process(LiquidacionPublishJob $publishJob, ?int $actorUserId = null): array
    {
        $publishJob->refresh();
        $run = $publishJob->run()->first();
        if (!$run) {
            throw new \RuntimeException('Run asociado al publish job no encontrado.');
        }

        if (in_array($publishJob->status, ['CONFIRMED', 'FAILED', 'PARTIAL'], true)) {
            return [
                'publish_job' => $publishJob,
                'run' => $run,
                'final_status' => $publishJob->status,
                'retryable_failure' => false,
                'error_message' => $publishJob->error_message,
            ];
        }

        $payload = $this->decodePayload($publishJob->request_payload);
        $distributorPayloads = is_array($payload['distributor_payloads'] ?? null)
            ? $payload['distributor_payloads']
            : [];
        $facturacionPayload = is_array($payload['facturacion_payload'] ?? null)
            ? $payload['facturacion_payload']
            : null;

        if ($facturacionPayload === null) {
            $message = 'Payload de facturación inválido o ausente.';
            $this->finalizeFailure($publishJob, $run, $message, $actorUserId);

            return [
                'publish_job' => $publishJob->fresh(),
                'run' => $run->fresh(),
                'final_status' => 'FAILED',
                'retryable_failure' => false,
                'error_message' => $message,
            ];
        }

        if (!$this->erpClient->canPublish()) {
            $message = 'Integración ERP deshabilitada o sin base_url configurada.';
            $this->finalizeFailure($publishJob, $run, $message, $actorUserId);

            return [
                'publish_job' => $publishJob->fresh(),
                'run' => $run->fresh(),
                'final_status' => 'FAILED',
                'retryable_failure' => false,
                'error_message' => $message,
            ];
        }

        $publishJob->update([
            'status' => 'PROCESSING',
            'sent_at' => now(),
            'error_message' => null,
        ]);

        $responses = [
            'distributor' => [],
            'facturacion' => null,
        ];

        $distributorOkCount = 0;
        foreach ($distributorPayloads as $distributorPayload) {
            if (!is_array($distributorPayload)) {
                continue;
            }

            $response = $this->erpClient->publishDistributor($distributorPayload);
            if (($response['ok'] ?? false) === true) {
                $distributorOkCount += 1;
            }
            $responses['distributor'][] = $response;
        }

        $facturacionResponse = $this->erpClient->publishFacturacion($facturacionPayload);
        $responses['facturacion'] = $facturacionResponse;

        $billingOk = (bool) ($facturacionResponse['ok'] ?? false);
        $allDistributorOk = $distributorOkCount === count($responses['distributor']);
        $anyOk = $distributorOkCount > 0 || $billingOk;

        $finalStatus = 'FAILED';
        if ($allDistributorOk && $billingOk) {
            $finalStatus = 'CONFIRMED';
        } elseif ($anyOk) {
            $finalStatus = 'PARTIAL';
        }

        $firstDistributorRequestId = null;
        $firstDistributorBatchId = null;
        foreach ($responses['distributor'] as $item) {
            $firstDistributorRequestId = $firstDistributorRequestId ?? ($item['erp_request_id'] ?? null);
            $firstDistributorBatchId = $firstDistributorBatchId ?? ($item['erp_batch_id'] ?? null);
        }

        $publishJob->update([
            'status' => $finalStatus,
            'erp_request_id' => $facturacionResponse['erp_request_id'] ?? $firstDistributorRequestId,
            'erp_batch_id' => $facturacionResponse['erp_batch_id'] ?? $firstDistributorBatchId,
            'confirmed_at' => $finalStatus === 'CONFIRMED' ? now() : null,
            'response_payload' => json_encode($responses, JSON_UNESCAPED_UNICODE),
            'error_message' => $finalStatus === 'FAILED'
                ? ($facturacionResponse['message'] ?? 'Error de publicación ERP.')
                : null,
        ]);

        if ($finalStatus === 'CONFIRMED') {
            $run->status = 'PUBLICADA';
            $run->published_at = now();
            $run->save();
        } elseif ($finalStatus === 'PARTIAL') {
            $run->status = 'PARTIAL';
            $run->save();
        } else {
            $run->status = 'FAILED';
            $run->save();
        }

        $this->createPublishFailureObservations($run, $responses);

        $this->writeAuditLog($actorUserId, $run, [
            'action' => 'liquidaciones.run.publish_erp.processed',
            'publish_job_id' => $publishJob->id,
            'status' => $finalStatus,
            'rows_ok' => $run->rows_ok,
            'distributor_payloads' => count($responses['distributor']),
            'distributor_ok' => $distributorOkCount,
            'billing_ok' => $billingOk,
        ]);

        $retryableFailure = $finalStatus === 'FAILED' && $this->hasTransientError($responses);

        return [
            'publish_job' => $publishJob->fresh(),
            'run' => $run->fresh(),
            'final_status' => $finalStatus,
            'retryable_failure' => $retryableFailure,
            'error_message' => $publishJob->error_message,
            'responses' => $responses,
        ];
    }

    public function markJobAsFailedAfterRetries(int $publishJobId, string $message, ?int $actorUserId = null): void
    {
        $publishJob = LiquidacionPublishJob::query()->find($publishJobId);
        if (!$publishJob) {
            return;
        }

        if (in_array($publishJob->status, ['CONFIRMED', 'PARTIAL'], true)) {
            return;
        }

        $run = $publishJob->run()->first();
        if (!$run) {
            return;
        }

        $this->finalizeFailure($publishJob, $run, $message, $actorUserId);
    }

    private function finalizeFailure(
        LiquidacionPublishJob $publishJob,
        LiquidacionImportRun $run,
        string $message,
        ?int $actorUserId = null
    ): void {
        $publishJob->update([
            'status' => 'FAILED',
            'sent_at' => $publishJob->sent_at ?? now(),
            'error_message' => $message,
        ]);

        $run->status = 'FAILED';
        $run->save();

        LiquidacionObservation::query()->create([
            'run_id' => $run->id,
            'type' => 'ERROR',
            'message' => 'Error publicando liquidación ERP: ' . $message,
            'status' => 'OPEN',
        ]);

        $this->writeAuditLog($actorUserId, $run, [
            'action' => 'liquidaciones.run.publish_erp.failed',
            'publish_job_id' => $publishJob->id,
            'status' => 'FAILED',
            'error' => $message,
        ]);
    }

    private function createPublishFailureObservations(LiquidacionImportRun $run, array $responses): void
    {
        foreach ($responses['distributor'] ?? [] as $item) {
            if (($item['ok'] ?? false) === true) {
                continue;
            }

            $message = 'Error publicando liquidación de distribuidor: ' . ($item['message'] ?? 'sin detalle');
            LiquidacionObservation::query()->create([
                'run_id' => $run->id,
                'type' => 'ERROR',
                'message' => $message,
                'status' => 'OPEN',
            ]);
        }

        $billing = $responses['facturacion'] ?? null;
        if (is_array($billing) && (($billing['ok'] ?? false) !== true)) {
            LiquidacionObservation::query()->create([
                'run_id' => $run->id,
                'type' => 'ERROR',
                'message' => 'Error publicando liquidación de facturación: ' . ($billing['message'] ?? 'sin detalle'),
                'status' => 'OPEN',
            ]);
        }
    }

    private function writeAuditLog(?int $actorUserId, LiquidacionImportRun $run, array $metadata): void
    {
        AuditLog::query()->create([
            'user_id' => $actorUserId,
            'action' => (string) ($metadata['action'] ?? 'liquidaciones.run.publish_erp'),
            'entity_type' => 'liq_import_run',
            'entity_id' => $run->id,
            'metadata' => $metadata,
            'actor_email' => null,
            'actor_name' => null,
            'ip_address' => null,
            'user_agent' => 'queue-job',
        ]);
    }

    private function hasTransientError(array $responses): bool
    {
        foreach ($responses['distributor'] ?? [] as $item) {
            if (($item['ok'] ?? false) === true) {
                continue;
            }

            if (($item['transient'] ?? false) === true) {
                return true;
            }
        }

        $billing = $responses['facturacion'] ?? null;
        return is_array($billing)
            && (($billing['ok'] ?? false) !== true)
            && (($billing['transient'] ?? false) === true);
    }

    private function decodePayload(?string $payload): array
    {
        if (!is_string($payload) || trim($payload) === '') {
            return [];
        }

        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : [];
    }
}
