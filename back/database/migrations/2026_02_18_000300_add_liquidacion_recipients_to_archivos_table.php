<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (! Schema::hasColumn('archivos', 'liquidacion_destinatario_tipo')) {
                $table->string('liquidacion_destinatario_tipo', 20)
                    ->nullable()
                    ->after('pagado');
            }

            if (! Schema::hasColumn('archivos', 'liquidacion_destinatario_emails')) {
                $table->json('liquidacion_destinatario_emails')
                    ->nullable()
                    ->after('liquidacion_destinatario_tipo');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (Schema::hasColumn('archivos', 'liquidacion_destinatario_emails')) {
                $table->dropColumn('liquidacion_destinatario_emails');
            }

            if (Schema::hasColumn('archivos', 'liquidacion_destinatario_tipo')) {
                $table->dropColumn('liquidacion_destinatario_tipo');
            }
        });
    }
};
