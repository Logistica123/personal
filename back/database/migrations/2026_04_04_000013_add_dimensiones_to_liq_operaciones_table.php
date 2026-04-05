<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('liq_operaciones')) {
            return;
        }

        $this->asegurarColumnasBaseLiqOperaciones();
        $this->asegurarEnumEstadoLiqOperaciones();

        $hasDimensionesValores = Schema::hasColumn('liq_operaciones', 'dimensiones_valores');
        $hasDimensionFallida = Schema::hasColumn('liq_operaciones', 'dimension_fallida');

        $indexName = 'liq_operaciones_liq_cliente_dim_fallida_idx';
        $hasIndex = $this->indexExists('liq_operaciones', $indexName);

        if ($hasDimensionesValores && $hasDimensionFallida && $hasIndex) {
            return;
        }

        Schema::table('liq_operaciones', function (Blueprint $table) use ($hasDimensionesValores, $hasDimensionFallida, $hasIndex, $indexName) {
            if (!$hasDimensionesValores) {
                $table->json('dimensiones_valores')->nullable();
            }
            if (!$hasDimensionFallida) {
                $table->string('dimension_fallida', 80)->nullable();
            }
            if (!$hasIndex) {
                $table->index(['liquidacion_cliente_id', 'dimension_fallida'], $indexName);
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('liq_operaciones')) {
            return;
        }

        $indexName = 'liq_operaciones_liq_cliente_dim_fallida_idx';
        $hasDimensionesValores = Schema::hasColumn('liq_operaciones', 'dimensiones_valores');
        $hasDimensionFallida = Schema::hasColumn('liq_operaciones', 'dimension_fallida');
        $hasIndex = $this->indexExists('liq_operaciones', $indexName);

        if (!$hasDimensionesValores && !$hasDimensionFallida && !$hasIndex) {
            return;
        }

        Schema::table('liq_operaciones', function (Blueprint $table) use ($hasDimensionesValores, $hasDimensionFallida, $hasIndex, $indexName) {
            if ($hasIndex) {
                $table->dropIndex($indexName);
            }
            if ($hasDimensionesValores || $hasDimensionFallida) {
                $cols = [];
                if ($hasDimensionesValores) $cols[] = 'dimensiones_valores';
                if ($hasDimensionFallida) $cols[] = 'dimension_fallida';
                $table->dropColumn($cols);
            }
        });
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        $dbName = DB::getDatabaseName();

        return DB::table('information_schema.statistics')
            ->where('table_schema', $dbName)
            ->where('table_name', $tableName)
            ->where('index_name', $indexName)
            ->exists();
    }

    private function asegurarColumnasBaseLiqOperaciones(): void
    {
        $hasArchivoEntradaId = Schema::hasColumn('liq_operaciones', 'archivo_entrada_id');
        $hasSucursalTarifa = Schema::hasColumn('liq_operaciones', 'sucursal_tarifa');
        $hasObservaciones = Schema::hasColumn('liq_operaciones', 'observaciones');

        if ($hasArchivoEntradaId && $hasSucursalTarifa && $hasObservaciones) {
            return;
        }

        Schema::table('liq_operaciones', function (Blueprint $table) use ($hasArchivoEntradaId, $hasSucursalTarifa, $hasObservaciones) {
            if (!$hasArchivoEntradaId) {
                $table->unsignedBigInteger('archivo_entrada_id')->nullable();
                $table->index(['archivo_entrada_id']);
            }
            if (!$hasSucursalTarifa) {
                $table->string('sucursal_tarifa', 150)->nullable();
                $table->index(['sucursal_tarifa']);
            }
            if (!$hasObservaciones) {
                $table->text('observaciones')->nullable();
            }
        });
    }

    private function asegurarEnumEstadoLiqOperaciones(): void
    {
        $dbName = DB::getDatabaseName();

        $col = DB::table('information_schema.columns')
            ->select(['column_type'])
            ->where('table_schema', $dbName)
            ->where('table_name', 'liq_operaciones')
            ->where('column_name', 'estado')
            ->first();

        if (!$col || !isset($col->column_type)) {
            return;
        }

        $columnType = (string) $col->column_type;
        if (str_contains($columnType, "'pendiente'") && str_contains($columnType, "'excluida'")) {
            return;
        }

        DB::statement(
            "ALTER TABLE `liq_operaciones` MODIFY COLUMN `estado` " .
            "ENUM('pendiente','ok','diferencia','sin_tarifa','sin_distribuidor','duplicado','observado','excluida') " .
            "NOT NULL DEFAULT 'pendiente'"
        );
    }
};
