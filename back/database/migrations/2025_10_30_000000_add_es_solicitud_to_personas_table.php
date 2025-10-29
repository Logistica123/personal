<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'es_solicitud')) {
                $table->boolean('es_solicitud')->default(false)->after('aprobado_por');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'es_solicitud')) {
                $table->dropColumn('es_solicitud');
            }
        });
    }
};
