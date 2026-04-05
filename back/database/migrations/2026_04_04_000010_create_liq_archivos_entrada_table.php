<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $uniqueName = 'liq_arch_ent_lc_nombre_uq';
    private string $indexName = 'liq_arch_ent_lc_tipo_idx';

    public function up(): void
    {
        if (! Schema::hasTable('liq_archivos_entrada')) {
            Schema::create('liq_archivos_entrada', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('liquidacion_cliente_id');
                $table->enum('tipo_archivo', ['DATA_CLIENTE', 'DETALLE_SUCURSAL', 'TARIFARIO', 'BASE_DISTRIB', 'VARIABLES']);
                $table->string('nombre_original', 255);
                $table->string('nombre_interno', 255);
                $table->string('disk', 255)->default('local');
                $table->string('ruta_storage', 255);
                $table->unsignedBigInteger('tamano')->default(0);
                $table->unsignedInteger('cant_registros')->nullable();
                $table->string('sucursal', 255)->nullable();
                $table->timestamps();

                $table
                    ->foreign('liquidacion_cliente_id')
                    ->references('id')
                    ->on('liq_liquidaciones_cliente')
                    ->cascadeOnDelete();

                // IMPORTANT: nombres cortos por límite de 64 chars en MySQL
                $table->unique(['liquidacion_cliente_id', 'nombre_interno'], $this->uniqueName);
                $table->index(['liquidacion_cliente_id', 'tipo_archivo'], $this->indexName);
            });
        }

        // Si la tabla quedó creada por un intento previo (pero falló al crear índices),
        // garantizamos que existan con nombres cortos.
        $this->ensureIndexes();
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_archivos_entrada');
    }

    private function ensureIndexes(): void
    {
        if (! Schema::hasTable('liq_archivos_entrada')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        // `SHOW INDEX` es específico de MySQL/MariaDB.
        if (! in_array($driver, ['mysql'], true)) {
            return;
        }

        $indexes = collect(DB::select('SHOW INDEX FROM `liq_archivos_entrada`'))
            ->map(fn ($row) => (string) ($row->Key_name ?? ''))
            ->filter()
            ->unique()
            ->values();

        if (! $indexes->contains($this->uniqueName)) {
            Schema::table('liq_archivos_entrada', function (Blueprint $table) {
                $table->unique(['liquidacion_cliente_id', 'nombre_interno'], $this->uniqueName);
            });
        }

        if (! $indexes->contains($this->indexName)) {
            Schema::table('liq_archivos_entrada', function (Blueprint $table) {
                $table->index(['liquidacion_cliente_id', 'tipo_archivo'], $this->indexName);
            });
        }
    }
};
