<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('factura_cabecera', function (Blueprint $table) {
            $table->id();
            $table->foreignId('emisor_id')->constrained('arca_emisor')->restrictOnDelete();
            $table->foreignId('certificado_id')->nullable()->constrained('arca_certificado')->nullOnDelete();
            $table->enum('ambiente', ['HOMO', 'PROD']);
            $table->unsignedInteger('pto_vta');
            $table->unsignedInteger('cbte_tipo');
            $table->unsignedBigInteger('cbte_numero')->nullable();
            $table->unsignedTinyInteger('concepto');
            $table->unsignedInteger('doc_tipo');
            $table->unsignedBigInteger('doc_nro');
            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();
            $table->foreignId('sucursal_id')->constrained('sucursals')->restrictOnDelete();
            $table->string('cliente_nombre');
            $table->text('cliente_domicilio')->nullable();
            $table->date('fecha_cbte');
            $table->date('fecha_serv_desde')->nullable();
            $table->date('fecha_serv_hasta')->nullable();
            $table->date('fecha_vto_pago')->nullable();
            $table->string('moneda_id', 10);
            $table->decimal('moneda_cotiz', 18, 6)->default(1);
            $table->decimal('imp_total', 18, 2);
            $table->decimal('imp_tot_conc', 18, 2)->default(0);
            $table->decimal('imp_neto', 18, 2)->default(0);
            $table->decimal('imp_op_ex', 18, 2)->default(0);
            $table->decimal('imp_iva', 18, 2)->default(0);
            $table->decimal('imp_trib', 18, 2)->default(0);
            $table->string('resultado_arca', 10)->nullable();
            $table->string('reproceso', 10)->nullable();
            $table->string('cae', 32)->nullable();
            $table->date('cae_vto')->nullable();
            $table->json('observaciones_arca_json')->nullable();
            $table->json('errores_arca_json')->nullable();
            $table->text('request_xml_path')->nullable();
            $table->text('response_xml_path')->nullable();
            $table->text('pdf_path')->nullable();
            $table->enum('estado', [
                'BORRADOR',
                'VALIDADA_LOCAL',
                'LISTA_PARA_ENVIO',
                'ENVIANDO_ARCA',
                'AUTORIZADA',
                'RECHAZADA_ARCA',
                'ERROR_TECNICO',
                'PDF_GENERADO',
            ])->default('BORRADOR');
            $table->string('hash_idempotencia', 128);
            $table->unsignedSmallInteger('anio_facturado');
            $table->unsignedTinyInteger('mes_facturado');
            $table->enum('periodo_facturado', ['PRIMERA_QUINCENA', 'SEGUNDA_QUINCENA', 'MES_COMPLETO']);
            $table->date('fecha_aprox_cobro')->nullable();
            $table->date('fecha_pago_manual')->nullable();
            $table->decimal('monto_pagado_manual', 18, 2)->nullable();
            $table->enum('estado_cobranza', ['PENDIENTE', 'A_VENCER', 'VENCIDA', 'COBRADA', 'PARCIAL'])->default('PENDIENTE');
            $table->text('observaciones_cobranza')->nullable();
            $table->timestamps();

            $table->unique(['emisor_id', 'ambiente', 'pto_vta', 'cbte_tipo', 'cbte_numero'], 'factura_cabecera_numeracion_unique');
            $table->unique('hash_idempotencia', 'factura_cabecera_hash_idempotencia_unique');
            $table->index(['cliente_id', 'sucursal_id', 'anio_facturado', 'mes_facturado', 'periodo_facturado'], 'factura_cabecera_cliente_periodo_idx');
            $table->index(['estado', 'fecha_cbte'], 'factura_cabecera_estado_fecha_idx');
            $table->index(['estado_cobranza', 'fecha_aprox_cobro', 'fecha_pago_manual'], 'factura_cabecera_cobranza_idx');
            $table->index(['emisor_id', 'ambiente', 'pto_vta', 'cbte_tipo'], 'factura_cabecera_arca_lookup_idx');
            $table->index('cae', 'factura_cabecera_cae_idx');
            $table->index(['doc_tipo', 'doc_nro'], 'factura_cabecera_receptor_idx');
        });

        $this->addDatabaseChecks();
    }

    public function down(): void
    {
        Schema::dropIfExists('factura_cabecera');
    }

    private function addDatabaseChecks(): void
    {
        $driver = DB::getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb', 'pgsql'], true)) {
            return;
        }

        DB::statement(
            "ALTER TABLE factura_cabecera
            ADD CONSTRAINT factura_cabecera_importes_chk
            CHECK (ROUND(imp_total, 2) = ROUND(imp_tot_conc + imp_neto + imp_op_ex + imp_iva + imp_trib, 2))"
        );

        DB::statement(
            "ALTER TABLE factura_cabecera
            ADD CONSTRAINT factura_cabecera_servicios_fechas_chk
            CHECK (
                concepto = 1
                OR (
                    fecha_serv_desde IS NOT NULL
                    AND fecha_serv_hasta IS NOT NULL
                    AND fecha_vto_pago IS NOT NULL
                )
            )"
        );
    }
};
