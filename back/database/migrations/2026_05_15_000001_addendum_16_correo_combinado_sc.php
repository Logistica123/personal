<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADDENDUM 16 — Correo combinado Altas+Bajas para San Cristóbal.
 *
 *   - polizas_email_config.tipo  enum + 'combinado'
 *       una póliza "soporta combinado" si tiene una row con tipo='combinado'
 *       y activo=true. La row guarda destinatarios + asunto + body wrapper
 *       (con placeholders {altas_block} y {bajas_block}).
 *
 *   - polizas_solicitudes.tipo   enum + 'combinado'
 *       cuando una solicitud es combinada lleva tanto altas como bajas en
 *       el pivot polizas_solicitud_asegurados, distinguidas por `operacion`.
 *
 *   - polizas_solicitud_asegurados.operacion  enum nuevo
 *       null para solicitudes tipo='alta'/'baja' (clásicas).
 *       'alta'|'baja' para tipo='combinado'. El render y el cambio de estado
 *       usan este campo para ubicar cada asegurado en su sección.
 */
return new class extends Migration {
    public function up(): void
    {
        // 1) polizas_email_config.tipo  +'combinado'
        DB::statement("ALTER TABLE polizas_email_config MODIFY COLUMN tipo ENUM('alta','baja','combinado') NOT NULL");

        // 2) polizas_solicitudes.tipo  +'combinado'
        DB::statement("ALTER TABLE polizas_solicitudes MODIFY COLUMN tipo ENUM('alta','baja','combinado') NOT NULL");

        // 3) pivot: operacion nullable (solo se usa cuando solicitud.tipo='combinado').
        Schema::table('polizas_solicitud_asegurados', function (Blueprint $table) {
            $table->enum('operacion', ['alta', 'baja'])->nullable()->after('asegurado_id');
        });
    }

    public function down(): void
    {
        Schema::table('polizas_solicitud_asegurados', function (Blueprint $table) {
            $table->dropColumn('operacion');
        });

        // Volver los enums al estado anterior. Asumimos que no quedaron rows
        // 'combinado' (en down lo lógico es que el seeder no esté activo).
        DB::statement("ALTER TABLE polizas_solicitudes MODIFY COLUMN tipo ENUM('alta','baja') NOT NULL");
        DB::statement("ALTER TABLE polizas_email_config MODIFY COLUMN tipo ENUM('alta','baja') NOT NULL");
    }
};
