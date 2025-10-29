<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'aprobado')) {
                $table->boolean('aprobado')->default(false)->after('observaciones');
            }

            if (! Schema::hasColumn('personas', 'aprobado_at')) {
                $table->timestamp('aprobado_at')->nullable()->after('aprobado');
            }

            if (! Schema::hasColumn('personas', 'aprobado_por')) {
                $table->foreignId('aprobado_por')
                    ->nullable()
                    ->after('aprobado_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'aprobado_por')) {
                $table->dropConstrainedForeignId('aprobado_por');
            }

            if (Schema::hasColumn('personas', 'aprobado_at')) {
                $table->dropColumn('aprobado_at');
            }

            if (Schema::hasColumn('personas', 'aprobado')) {
                $table->dropColumn('aprobado');
            }
        });
    }
};
