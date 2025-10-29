<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('personas', 'agente_responsable_id')) {
            Schema::table('personas', function (Blueprint $table) {
                $table->foreignId('agente_responsable_id')
                    ->nullable()
                    ->after('agente_id')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('personas', 'agente_responsable_id')) {
            Schema::table('personas', function (Blueprint $table) {
                $table->dropConstrainedForeignId('agente_responsable_id');
            });
        }
    }
};
