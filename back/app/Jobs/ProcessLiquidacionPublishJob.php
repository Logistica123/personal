<?php

namespace App\Jobs;

use App\Services\Liquidaciones\LiquidacionPublishProcessor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessLiquidacionPublishJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public function __construct(public int $publishJobId, public ?int $actorUserId = null)
    {
        $this->tries = max(1, (int) config('services.erp.publish_tries', 3));
        $this->onQueue((string) config('services.erp.publish_queue', 'erp-publish'));
    }

    public function backoff(): array|int
    {
        $raw = (string) config('services.erp.publish_backoff', '10,30,90');
        $parts = array_values(array_filter(array_map('trim', explode(',', $raw)), fn ($value) => $value !== ''));

        $values = [];
        foreach ($parts as $part) {
            if (is_numeric($part)) {
                $values[] = max(1, (int) $part);
            }
        }

        if (count($values) === 0) {
            return 10;
        }

        return $values;
    }

    public function handle(LiquidacionPublishProcessor $processor): void
    {
        $result = $processor->processById($this->publishJobId, $this->actorUserId);
        if (($result['retryable_failure'] ?? false) === true) {
            throw new \RuntimeException((string) ($result['error_message'] ?? 'Error transitorio publicando al ERP.'));
        }
    }

    public function failed(Throwable $exception): void
    {
        app(LiquidacionPublishProcessor::class)
            ->markJobAsFailedAfterRetries($this->publishJobId, $exception->getMessage(), $this->actorUserId);
    }
}
