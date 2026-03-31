<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            if (! Schema::hasColumn('liq_operaciones', 'excluida')) {
                $table->boolean('excluida')->default(false)->after('observacion');
            }
            if (! Schema::hasColumn('liq_operaciones', 'motivo_exclusion')) {
                $table->text('motivo_exclusion')->nullable()->after('excluida');
            }
            if (! Schema::hasColumn('liq_operaciones', 'excluida_at')) {
                $table->timestamp('excluida_at')->nullable()->after('motivo_exclusion');
            }
            if (! Schema::hasColumn('liq_operaciones', 'excluida_por')) {
                $table->foreignId('excluida_por')->nullable()->constrained('users')->nullOnDelete()->after('excluida_at');
            }

            $table->index(['liquidacion_cliente_id', 'excluida'], 'liq_ops_liq_excluida_idx');
        });
    }

    public function down(): void
    {
        Schema::table('liq_operaciones', function (Blueprint $table) {
            $table->dropIndex('liq_ops_liq_excluida_idx');

            if (Schema::hasColumn('liq_operaciones', 'excluida_por')) {
                $table->dropConstrainedForeignId('excluida_por');
            }
            if (Schema::hasColumn('liq_operaciones', 'excluida_at')) {
                $table->dropColumn('excluida_at');
            }
            if (Schema::hasColumn('liq_operaciones', 'motivo_exclusion')) {
                $table->dropColumn('motivo_exclusion');
            }
            if (Schema::hasColumn('liq_operaciones', 'excluida')) {
                $table->dropColumn('excluida');
            }
        });
    }
};

