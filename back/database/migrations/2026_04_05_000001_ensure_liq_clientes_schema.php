<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function isMysql(): bool
    {
        return Schema::getConnection()->getDriverName() === 'mysql';
    }

    public function up(): void
    {
        if (! Schema::hasTable('liq_clientes')) {
            Schema::create('liq_clientes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('distriapp_cliente_id')->nullable();
                $table->string('razon_social', 255);
                $table->string('nombre_corto', 80);
                $table->string('codigo_corto', 3)->nullable();
                $table->string('cuit', 20)->nullable();
                $table->boolean('activo')->default(true);
                $table->json('configuracion_excel')->nullable();
                $table->timestamps();

                $table->index(['activo']);
                $table->index(['distriapp_cliente_id']);
            });
        } else {
            Schema::table('liq_clientes', function (Blueprint $table) {
                if (! Schema::hasColumn('liq_clientes', 'distriapp_cliente_id')) {
                    $table->unsignedBigInteger('distriapp_cliente_id')->nullable()->after('id');
                }
                if (! Schema::hasColumn('liq_clientes', 'razon_social')) {
                    $table->string('razon_social', 255)->nullable()->after('distriapp_cliente_id');
                }
                if (! Schema::hasColumn('liq_clientes', 'nombre_corto')) {
                    $table->string('nombre_corto', 80)->nullable()->after('razon_social');
                }
                if (! Schema::hasColumn('liq_clientes', 'codigo_corto')) {
                    $table->string('codigo_corto', 3)->nullable()->after('nombre_corto');
                }
                if (! Schema::hasColumn('liq_clientes', 'cuit')) {
                    $table->string('cuit', 20)->nullable()->after('codigo_corto');
                }
                if (! Schema::hasColumn('liq_clientes', 'activo')) {
                    $table->boolean('activo')->default(true)->after('cuit');
                }
                if (! Schema::hasColumn('liq_clientes', 'configuracion_excel')) {
                    $table->json('configuracion_excel')->nullable()->after('activo');
                }
                if (! Schema::hasColumn('liq_clientes', 'created_at')) {
                    $table->timestamps();
                }
            });

            // Compatibilidad: si existía una columna legacy `cliente_id`, la copiamos.
            if (
                Schema::hasColumn('liq_clientes', 'cliente_id')
                && Schema::hasColumn('liq_clientes', 'distriapp_cliente_id')
            ) {
                DB::statement('UPDATE `liq_clientes` SET `distriapp_cliente_id` = `cliente_id` WHERE `distriapp_cliente_id` IS NULL');
            }
        }

        $this->ensureIndexes();
    }

    public function down(): void
    {
        // No se revierte: es una migración correctiva/idempotente.
    }

    private function ensureIndexes(): void
    {
        if (! Schema::hasTable('liq_clientes')) {
            return;
        }
        if (! $this->isMysql()) {
            return;
        }

        $rows = DB::select('SHOW INDEX FROM `liq_clientes`');

        $hasIndex = function (array $columns, bool $unique) use ($rows): bool {
            $want = array_values($columns);
            foreach ($this->groupIndexes($rows) as $idx) {
                if (($idx['unique'] ?? false) !== $unique) continue;
                if (($idx['columns'] ?? []) === $want) return true;
            }
            return false;
        };

        Schema::table('liq_clientes', function (Blueprint $table) use ($hasIndex) {
            if (! $hasIndex(['nombre_corto'], true)) {
                $table->unique(['nombre_corto']);
            }
            if (! $hasIndex(['codigo_corto'], true)) {
                $table->unique(['codigo_corto']);
            }
            if (! $hasIndex(['activo'], false)) {
                $table->index(['activo']);
            }
            if (! $hasIndex(['distriapp_cliente_id'], false)) {
                $table->index(['distriapp_cliente_id']);
            }
        });
    }

    /**
     * @param array<int, object> $rows
     * @return array<string, array{unique: bool, columns: array<int, string>}>
     */
    private function groupIndexes(array $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            $key = (string) ($row->Key_name ?? '');
            if ($key === '') continue;
            $seq = (int) ($row->Seq_in_index ?? 0);
            $col = (string) ($row->Column_name ?? '');
            $nonUnique = (int) ($row->Non_unique ?? 1);

            if (!isset($out[$key])) {
                $out[$key] = ['unique' => $nonUnique === 0, 'columns' => []];
            }
            $out[$key]['unique'] = $nonUnique === 0;
            $out[$key]['columns'][$seq] = $col;
        }

        foreach ($out as &$idx) {
            ksort($idx['columns']);
            $idx['columns'] = array_values($idx['columns']);
        }

        return $out;
    }
};

