<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC v4.2 · Detección de subpago OCASA — espejo OCASA→LA de liq_tarifas_distribuidor.
 *
 * Cuando OCASA pone un costo en YCC1 menor al contractual, el detector lo flaguea como
 * subpago. Esta tabla almacena la tarifa que OCASA debería pagarnos por (material, zona,
 * motivo, etc.) — el lado simétrico de liq_tarifas_distribuidor.
 *
 * No tiene patente/distribuidor_id porque OCASA paga lo mismo sin importar quién hace
 * la entrega.
 *
 * También extiende liq_reclamos_ocasa con campos para reclamos por parada (productividad).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('liq_tarifas_ocasa_la', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');

            $table->string('ruta', 20)->nullable();
            $table->string('sucursal', 60)->nullable();
            $table->string('distrito', 80)->nullable();
            $table->string('material_la', 60)->nullable();
            $table->string('zona', 20)->nullable();
            $table->string('motivo', 20)->nullable();
            $table->unsignedInteger('capacidad_vehiculo')->nullable();

            $table->enum('tipo_tarifa', ['monto_parada', 'monto_bulto', 'jornada', 'jornada_km']);
            $table->decimal('valor', 14, 4);
            $table->boolean('aplica_multibulto')->default(false);

            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();

            $table->text('notas')->nullable();
            $table->integer('prioridad')->default(0);

            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->index(['cliente_id', 'ruta', 'sucursal', 'distrito', 'material_la', 'zona', 'motivo', 'vigencia_desde'], 'idx_tola_lookup');
            $table->index(['cliente_id', 'prioridad', 'vigencia_desde'], 'idx_tola_prioridad');
        });

        DB::unprepared('DROP TRIGGER IF EXISTS trg_tola_prioridad_ins');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_tola_prioridad_upd');

        $bodyPrioridad = <<<'SQL'
            SET NEW.prioridad =
                (NEW.ruta               IS NOT NULL) +
                (NEW.sucursal           IS NOT NULL) +
                (NEW.distrito           IS NOT NULL) +
                (NEW.material_la        IS NOT NULL) +
                (NEW.zona               IS NOT NULL) +
                (NEW.motivo             IS NOT NULL) +
                (NEW.capacidad_vehiculo IS NOT NULL);
        SQL;

        DB::unprepared("CREATE TRIGGER trg_tola_prioridad_ins BEFORE INSERT ON liq_tarifas_ocasa_la FOR EACH ROW BEGIN {$bodyPrioridad} END");
        DB::unprepared("CREATE TRIGGER trg_tola_prioridad_upd BEFORE UPDATE ON liq_tarifas_ocasa_la FOR EACH ROW BEGIN {$bodyPrioridad} END");

        // Extender liq_reclamos_ocasa con columnas para reclamos productividad por parada
        Schema::table('liq_reclamos_ocasa', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_reclamos_ocasa', 'parada_num')) {
                $table->unsignedInteger('parada_num')->nullable()->after('op_id')
                    ->comment('SPEC v4.2: NULL para subpago jornada, valor para subpago productividad por parada');
            }
            if (!Schema::hasColumn('liq_reclamos_ocasa', 'tarifa_esperada')) {
                $table->decimal('tarifa_esperada', 14, 2)->nullable()->after('parada_num');
            }
            if (!Schema::hasColumn('liq_reclamos_ocasa', 'pagado_ocasa')) {
                $table->decimal('pagado_ocasa', 14, 2)->nullable()->after('tarifa_esperada');
            }
            if (!Schema::hasColumn('liq_reclamos_ocasa', 'detalle')) {
                $table->json('detalle')->nullable()->after('motivo_detectado');
            }
        });
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS trg_tola_prioridad_ins');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_tola_prioridad_upd');
        Schema::dropIfExists('liq_tarifas_ocasa_la');

        Schema::table('liq_reclamos_ocasa', function (Blueprint $table) {
            foreach (['parada_num', 'tarifa_esperada', 'pagado_ocasa', 'detalle'] as $col) {
                if (Schema::hasColumn('liq_reclamos_ocasa', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
