<?php

namespace App\Services\Arca\Wsfe;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class EmissionLockService
{
    /**
     * @template T
     * @param callable():T $callback
     * @return T
     */
    public function runWithLock(int $emisorId, string $ambiente, int $ptoVta, int $cbteTipo, callable $callback): mixed
    {
        $key = sprintf('arca:emit:%d:%s:%d:%d', $emisorId, strtolower($ambiente), $ptoVta, $cbteTipo);

        try {
            return Cache::lock($key, 30)->block(10, $callback);
        } catch (LockTimeoutException) {
            return $this->runWithDatabaseLock($key, $callback);
        } catch (\Throwable) {
            return $this->runWithDatabaseLock($key, $callback);
        }
    }

    /**
     * @template T
     * @param callable():T $callback
     * @return T
     */
    private function runWithDatabaseLock(string $key, callable $callback): mixed
    {
        $lockRow = DB::selectOne('SELECT GET_LOCK(?, 10) as locked', [$key]);
        $locked = (int) ($lockRow->locked ?? 0) === 1;

        if (! $locked) {
            throw new \RuntimeException('No se pudo obtener el lock de emisión ARCA.');
        }

        try {
            return $callback();
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?) as released', [$key]);
        }
    }
}
