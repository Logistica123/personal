<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- liq_config_banco: campos ICBC Multipay H2H ---
        Schema::table('liq_config_banco', function (Blueprint $table) {
            $table->string('banco_codigo', 20)->nullable()->after('nombre_banco');
            $table->string('clave_privada_path', 500)->nullable()->after('certificado_path');
            $table->string('certificado_cliente_path', 500)->nullable()->after('clave_privada_path');
            $table->string('ordenante_id', 20)->nullable()->after('cuil_empresa');
            $table->string('ordenante_nombre', 200)->nullable()->after('ordenante_id');
            $table->string('producto', 50)->default('PAGO_PROVEEDORES')->after('ordenante_nombre');
            $table->unsignedSmallInteger('reintentos_max')->default(3)->after('timeout_segundos');
            $table->timestamp('ultimo_test')->nullable()->after('activo');
            $table->string('ultimo_test_resultado', 500)->nullable()->after('ultimo_test');
        });

        // --- liq_transferencias_banco: campos ICBC ---
        Schema::table('liq_transferencias_banco', function (Blueprint $table) {
            $table->string('referencia_interna', 100)->nullable()->after('orden_pago_id');
            $table->string('nombre_beneficiario', 200)->nullable()->after('cuil_destino');
            $table->string('moneda', 3)->default('ARS')->after('importe');

            $table->index('referencia_interna');
        });
    }

    public function down(): void
    {
        Schema::table('liq_config_banco', function (Blueprint $table) {
            $table->dropColumn([
                'banco_codigo', 'clave_privada_path', 'certificado_cliente_path',
                'ordenante_id', 'ordenante_nombre', 'producto',
                'reintentos_max', 'ultimo_test', 'ultimo_test_resultado',
            ]);
        });

        Schema::table('liq_transferencias_banco', function (Blueprint $table) {
            $table->dropIndex(['referencia_interna']);
            $table->dropColumn(['referencia_interna', 'nombre_beneficiario', 'moneda']);
        });
    }
};
