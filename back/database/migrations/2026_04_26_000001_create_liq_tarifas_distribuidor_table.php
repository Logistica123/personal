<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC v4 · Sistema de tarifas distribuidor configurable.
 *
 * Antes había un único factor 0,85 universal para LA→Distribuidor en rama D OCASA.
 * Ahora cada regla tiene dimensiones opcionales (ruta, sucursal, material, zona, etc.)
 * y un tipo (monto_parada, monto_bulto, factor_ocasa). El resolver elige la regla
 * más específica que matchee — más dimensiones NULL = menos prioridad.
 *
 * Compatibilidad: la regla Default OCASA con factor_ocasa 0,85 prioridad=0 actúa como
 * fallback para mantener el comportamiento actual mientras no haya overrides cargados.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('liq_tarifas_distribuidor', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');

            // Dimensiones de match (todas NULLABLE — NULL = "cualquiera")
            $table->string('ruta', 20)->nullable();
            $table->string('sucursal', 60)->nullable();
            $table->string('distrito', 80)->nullable();
            $table->string('material_la', 60)->nullable();
            $table->string('zona', 20)->nullable();
            $table->string('motivo', 20)->nullable();
            $table->unsignedInteger('capacidad_vehiculo')->nullable();
            $table->string('patente', 20)->nullable();
            $table->unsignedBigInteger('distribuidor_id')->nullable();

            // Cómo calcular el pago al distribuidor
            $table->enum('tipo_tarifa', ['monto_parada', 'monto_bulto', 'factor_ocasa']);
            $table->decimal('valor', 14, 4);
            $table->boolean('aplica_multibulto')->default(false);

            // Vigencia
            $table->date('vigencia_desde');
            $table->date('vigencia_hasta')->nullable();

            // Metadata
            $table->text('notas')->nullable();
            $table->integer('prioridad')->default(0); // calculada por trigger según dimensiones NOT NULL

            $table->timestamps();

            $table->foreign('cliente_id')->references('id')->on('liq_clientes')->cascadeOnDelete();
            $table->index(['cliente_id', 'ruta', 'sucursal', 'distrito', 'material_la', 'zona', 'motivo', 'vigencia_desde'], 'idx_td_lookup');
            $table->index(['cliente_id', 'prioridad', 'vigencia_desde'], 'idx_td_prioridad');
        });

        // Triggers MySQL para calcular prioridad automáticamente
        DB::unprepared('DROP TRIGGER IF EXISTS trg_td_prioridad_ins');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_td_prioridad_upd');

        $bodyPrioridad = <<<'SQL'
            SET NEW.prioridad =
                (NEW.ruta               IS NOT NULL) +
                (NEW.sucursal           IS NOT NULL) +
                (NEW.distrito           IS NOT NULL) +
                (NEW.material_la        IS NOT NULL) +
                (NEW.zona               IS NOT NULL) +
                (NEW.motivo             IS NOT NULL) +
                (NEW.capacidad_vehiculo IS NOT NULL) +
                (NEW.patente            IS NOT NULL) +
                (NEW.distribuidor_id    IS NOT NULL);
        SQL;

        DB::unprepared("CREATE TRIGGER trg_td_prioridad_ins BEFORE INSERT ON liq_tarifas_distribuidor FOR EACH ROW BEGIN {$bodyPrioridad} END");
        DB::unprepared("CREATE TRIGGER trg_td_prioridad_upd BEFORE UPDATE ON liq_tarifas_distribuidor FOR EACH ROW BEGIN {$bodyPrioridad} END");

        // Carga inicial: regla Default OCASA factor 0,85 — fallback que mantiene la lógica actual
        $ocasa = DB::table('liq_clientes')
            ->where('codigo_corto', 'OCASA')
            ->orWhere('nombre_corto', 'OCASA')
            ->orWhere('razon_social', 'like', '%OCASA%')
            ->value('id');

        if ($ocasa) {
            DB::table('liq_tarifas_distribuidor')->insert([
                'cliente_id'        => $ocasa,
                'tipo_tarifa'       => 'factor_ocasa',
                'valor'             => 0.8500,
                'aplica_multibulto' => false,
                'vigencia_desde'    => '2026-01-01',
                'notas'             => 'Default OCASA — fallback factor 0,85 cuando no hay tarifa contractual definida',
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS trg_td_prioridad_ins');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_td_prioridad_upd');
        Schema::dropIfExists('liq_tarifas_distribuidor');
    }
};
