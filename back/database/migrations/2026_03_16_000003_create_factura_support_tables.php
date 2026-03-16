<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('factura_iva', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('factura_cabecera')->cascadeOnDelete();
            $table->unsignedInteger('iva_id');
            $table->decimal('base_imp', 18, 2);
            $table->decimal('importe', 18, 2);
            $table->timestamps();

            $table->index(['factura_id', 'iva_id'], 'factura_iva_factura_iva_idx');
        });

        Schema::create('factura_tributo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('factura_cabecera')->cascadeOnDelete();
            $table->unsignedInteger('tributo_id');
            $table->string('descr')->nullable();
            $table->decimal('base_imp', 18, 2)->nullable();
            $table->decimal('alic', 8, 4)->nullable();
            $table->decimal('importe', 18, 2);
            $table->timestamps();

            $table->index(['factura_id', 'tributo_id'], 'factura_tributo_factura_tributo_idx');
        });

        Schema::create('factura_detalle_pdf', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('factura_cabecera')->cascadeOnDelete();
            $table->unsignedInteger('orden');
            $table->text('descripcion');
            $table->decimal('cantidad', 18, 4);
            $table->string('unidad_medida', 50)->nullable();
            $table->decimal('precio_unitario', 18, 2);
            $table->decimal('bonificacion_pct', 8, 4)->default(0);
            $table->decimal('subtotal', 18, 2);
            $table->decimal('alicuota_iva_pct', 8, 4)->default(0);
            $table->decimal('subtotal_con_iva', 18, 2);
            $table->timestamps();

            $table->unique(['factura_id', 'orden'], 'factura_detalle_pdf_factura_orden_unique');
        });

        Schema::create('historial_cobranza_factura', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('factura_cabecera')->cascadeOnDelete();
            $table->timestamp('fecha_evento')->useCurrent();
            $table->string('estado_anterior', 20)->nullable();
            $table->string('estado_nuevo', 20)->nullable();
            $table->date('fecha_aprox_cobro_anterior')->nullable();
            $table->date('fecha_aprox_cobro_nueva')->nullable();
            $table->date('fecha_pago_anterior')->nullable();
            $table->date('fecha_pago_nueva')->nullable();
            $table->decimal('monto_pagado_anterior', 18, 2)->nullable();
            $table->decimal('monto_pagado_nuevo', 18, 2)->nullable();
            $table->text('observaciones')->nullable();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['factura_id', 'fecha_evento'], 'historial_cobranza_factura_factura_fecha_idx');
            $table->index(['estado_nuevo', 'fecha_pago_nueva'], 'historial_cobranza_factura_estado_pago_idx');
        });

        Schema::create('auditoria_facturacion', function (Blueprint $table) {
            $table->id();
            $table->string('entidad', 80);
            $table->unsignedBigInteger('entidad_id');
            $table->string('evento', 80);
            $table->json('payload_before_json')->nullable();
            $table->json('payload_after_json')->nullable();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('ip', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entidad', 'entidad_id', 'created_at'], 'auditoria_facturacion_entidad_idx');
            $table->index(['evento', 'created_at'], 'auditoria_facturacion_evento_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auditoria_facturacion');
        Schema::dropIfExists('historial_cobranza_factura');
        Schema::dropIfExists('factura_detalle_pdf');
        Schema::dropIfExists('factura_tributo');
        Schema::dropIfExists('factura_iva');
    }
};
