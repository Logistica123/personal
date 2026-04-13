<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- liq_ordenes_pago: campos de tracking ICBC ---
        Schema::table('liq_ordenes_pago', function (Blueprint $table) {
            $table->string('icbc_list_id', 20)->nullable()->after('medio_pago');
            $table->unsignedInteger('icbc_ref_id')->nullable()->after('icbc_list_id');
            $table->string('icbc_estado', 30)->nullable()->after('icbc_ref_id');
            $table->string('icbc_estado_upload', 1)->nullable()->after('icbc_estado');
            $table->string('icbc_tx_id', 100)->nullable()->after('icbc_estado_upload');
            $table->string('icbc_error_code', 50)->nullable()->after('icbc_tx_id');
            $table->text('icbc_error_msg')->nullable()->after('icbc_error_code');
            $table->timestamp('icbc_enviado_at')->nullable()->after('icbc_error_msg');
            $table->timestamp('icbc_acreditado_at')->nullable()->after('icbc_enviado_at');
            $table->unsignedInteger('icbc_items_aceptados')->nullable()->after('icbc_acreditado_at');
            $table->unsignedInteger('icbc_items_rechazados')->nullable()->after('icbc_items_aceptados');

            $table->index('icbc_list_id');
        });

        // --- liq_ordenes_pago_detalle: estado individual por item ---
        Schema::table('liq_ordenes_pago_detalle', function (Blueprint $table) {
            $table->string('icbc_item_estado', 20)->nullable()->after('medio_pago');
            $table->string('icbc_item_novedad', 50)->nullable()->after('icbc_item_estado');
            $table->string('icbc_numero_pago', 20)->nullable()->after('icbc_item_novedad');
        });

        // --- liq_config_banco: campos SOAP ICBC ---
        Schema::table('liq_config_banco', function (Blueprint $table) {
            if (!Schema::hasColumn('liq_config_banco', 'wsdl_url')) {
                $table->text('wsdl_url')->nullable()->after('url_base');
            }
            if (!Schema::hasColumn('liq_config_banco', 'cert_empresa_path')) {
                $table->string('cert_empresa_path', 500)->nullable()->after('certificado_cliente_path');
            }
            if (!Schema::hasColumn('liq_config_banco', 'doc_type')) {
                $table->string('doc_type', 2)->default('06')->after('cuil_empresa');
            }
            if (!Schema::hasColumn('liq_config_banco', 'doc_number')) {
                $table->string('doc_number', 11)->nullable()->after('doc_type');
            }
            if (!Schema::hasColumn('liq_config_banco', 'service_id')) {
                $table->string('service_id', 22)->nullable()->after('ordenante_id');
            }
            if (!Schema::hasColumn('liq_config_banco', 'product_type')) {
                $table->string('product_type', 8)->nullable()->after('service_id');
            }
            if (!Schema::hasColumn('liq_config_banco', 'delivery_branch')) {
                $table->string('delivery_branch', 4)->nullable()->after('product_type');
            }
            if (!Schema::hasColumn('liq_config_banco', 'cert_vencimiento')) {
                $table->date('cert_vencimiento')->nullable()->after('ultimo_test_resultado');
            }
        });
    }

    public function down(): void
    {
        Schema::table('liq_ordenes_pago', function (Blueprint $table) {
            $table->dropIndex(['icbc_list_id']);
            $table->dropColumn([
                'icbc_list_id', 'icbc_ref_id', 'icbc_estado', 'icbc_estado_upload',
                'icbc_tx_id', 'icbc_error_code', 'icbc_error_msg',
                'icbc_enviado_at', 'icbc_acreditado_at',
                'icbc_items_aceptados', 'icbc_items_rechazados',
            ]);
        });

        Schema::table('liq_ordenes_pago_detalle', function (Blueprint $table) {
            $table->dropColumn(['icbc_item_estado', 'icbc_item_novedad', 'icbc_numero_pago']);
        });

        Schema::table('liq_config_banco', function (Blueprint $table) {
            $cols = ['wsdl_url', 'cert_empresa_path', 'doc_type', 'doc_number', 'service_id', 'product_type', 'delivery_branch', 'cert_vencimiento'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('liq_config_banco', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
