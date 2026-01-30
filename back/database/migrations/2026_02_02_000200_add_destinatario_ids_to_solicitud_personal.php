<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('solicitud_personal', function (Blueprint $table) {
            if (!Schema::hasColumn('solicitud_personal', 'destinatario_ids')) {
                $table->json('destinatario_ids')->nullable()->after('destinatario_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('solicitud_personal', function (Blueprint $table) {
            if (Schema::hasColumn('solicitud_personal', 'destinatario_ids')) {
                $table->dropColumn('destinatario_ids');
            }
        });
    }
};
