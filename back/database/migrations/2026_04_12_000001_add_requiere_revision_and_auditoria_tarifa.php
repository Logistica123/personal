<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Campo requiere_revision en liq_tarifas_patente
        if (!Schema::hasColumn('liq_tarifas_patente', 'requiere_revision')) {
            Schema::table('liq_tarifas_patente', function (Blueprint $table) {
                $table->boolean('requiere_revision')->default(false)->after('precio_original');
            });
        }

        // 2. Tabla liq_auditoria_tarifa (si no existía ya con otro nombre)
        if (!Schema::hasTable('liq_auditoria_tarifa_log')) {
            Schema::create('liq_auditoria_tarifa_log', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('esquema_id');
                $table->unsignedBigInteger('linea_id')->nullable();
                $table->unsignedBigInteger('override_id')->nullable();
                $table->string('campo', 50);
                $table->decimal('valor_anterior', 12, 2)->nullable();
                $table->decimal('valor_nuevo', 12, 2)->nullable();
                $table->string('tipo', 30);
                $table->string('motivo', 255)->nullable();
                $table->unsignedBigInteger('usuario_id')->nullable();
                $table->timestamps();

                $table->index('esquema_id', 'aud_tarifa_esquema');
                $table->index('linea_id', 'aud_tarifa_linea');
                $table->index('override_id', 'aud_tarifa_override');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_auditoria_tarifa_log');

        if (Schema::hasColumn('liq_tarifas_patente', 'requiere_revision')) {
            Schema::table('liq_tarifas_patente', function (Blueprint $table) {
                $table->dropColumn('requiere_revision');
            });
        }
    }
};
