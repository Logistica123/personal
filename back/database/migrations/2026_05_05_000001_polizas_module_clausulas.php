<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo Pólizas — feature Cláusulas (consolida addendums 10/11/12).
 *
 *  - `polizas_clausulas`             catálogo de cláusulas (con `alias` desde el inicio)
 *  - `polizas_clausulas_aplicadas`   pivot histórico póliza × cláusula (`tipo_aplicacion`)
 *  - `polizas_asegurados_clausulas`  cláusulas individuales por asegurado
 *  - `polizas_email_config`          + `separador_entre_asegurados` (default `\n`)
 *  - `polizas_admin_permisos`        + `puede_gestionar_clausulas` (default false)
 *  - `polizas_solicitudes`           + `tipo_clausula_global` y `clausula_global_id`
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('polizas_clausulas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre_corto', 100);
            $table->string('alias', 50)->default('');
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursals')->nullOnDelete();
            $table->string('cuit_titular', 15);
            $table->string('razon_social_titular', 150);
            $table->string('tipo', 50)->default('no_repeticion');  // 'no_repeticion'|'subrogacion'|'otra'
            $table->string('descripcion_corta')->nullable();
            $table->boolean('activa')->default(true);
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->index('activa', 'idx_clausula_activa');
        });

        Schema::create('polizas_clausulas_aplicadas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->constrained('polizas')->cascadeOnDelete();
            $table->foreignId('clausula_id')->constrained('polizas_clausulas');
            $table->enum('tipo_aplicacion', ['global', 'individual'])->default('global');
            $table->date('aplicada_desde');
            $table->date('aplicada_hasta')->nullable();
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->unique(['poliza_id', 'clausula_id', 'aplicada_desde'], 'uniq_pol_clausula_desde');
        });

        Schema::create('polizas_asegurados_clausulas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asegurado_id')->constrained('polizas_asegurados')->cascadeOnDelete();
            $table->foreignId('clausula_id')->constrained('polizas_clausulas');
            $table->date('aplicada_desde');
            $table->date('aplicada_hasta')->nullable();
            $table->text('notas')->nullable();
            $table->timestamps();

            $table->unique(['asegurado_id', 'clausula_id', 'aplicada_desde'], 'uniq_aseg_clausula_desde');
        });

        Schema::table('polizas_email_config', function (Blueprint $table) {
            $table->string('separador_entre_asegurados', 10)->default("\n")->after('asegurado_template');
        });

        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->boolean('puede_gestionar_clausulas')->default(false)->after('puede_editar_email_config');
        });

        Schema::table('polizas_solicitudes', function (Blueprint $table) {
            // Snapshot de las decisiones de cláusulas al momento de crear la solicitud.
            $table->enum('tipo_clausula_global', ['ninguna', 'aplicar', 'previa_existente'])
                  ->default('ninguna')
                  ->after('email_message_id');
            $table->foreignId('clausula_global_id')
                  ->nullable()
                  ->after('tipo_clausula_global')
                  ->constrained('polizas_clausulas')
                  ->nullOnDelete();
            // JSON: [{asegurado_id: int, clausula_id: int}, ...]
            $table->json('clausulas_individuales')->nullable()->after('clausula_global_id');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_solicitudes', function (Blueprint $table) {
            $table->dropForeign(['clausula_global_id']);
            $table->dropColumn(['tipo_clausula_global', 'clausula_global_id', 'clausulas_individuales']);
        });
        Schema::table('polizas_admin_permisos', function (Blueprint $table) {
            $table->dropColumn('puede_gestionar_clausulas');
        });
        Schema::table('polizas_email_config', function (Blueprint $table) {
            $table->dropColumn('separador_entre_asegurados');
        });
        Schema::dropIfExists('polizas_asegurados_clausulas');
        Schema::dropIfExists('polizas_clausulas_aplicadas');
        Schema::dropIfExists('polizas_clausulas');
    }
};
