<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'agentes_responsables_ids')) {
                $table->json('agentes_responsables_ids')->nullable()->after('agente_responsable_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'agentes_responsables_ids')) {
                $table->dropColumn('agentes_responsables_ids');
            }
        });
    }
};
