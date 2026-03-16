<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arca_emisor', function (Blueprint $table) {
            $table->id();
            $table->string('razon_social');
            $table->unsignedBigInteger('cuit');
            $table->string('condicion_iva', 80);
            $table->enum('ambiente_default', ['HOMO', 'PROD'])->default('PROD');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique('cuit', 'arca_emisor_cuit_unique');
            $table->index(['activo', 'ambiente_default'], 'arca_emisor_estado_idx');
        });

        Schema::create('arca_certificado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('emisor_id')->constrained('arca_emisor')->cascadeOnDelete();
            $table->string('alias', 120);
            $table->enum('ambiente', ['HOMO', 'PROD']);
            $table->text('subject_dn')->nullable();
            $table->string('serial_number_subject', 120)->nullable();
            $table->string('thumbprint_sha1', 80)->nullable();
            $table->string('thumbprint_sha256', 128)->nullable();
            $table->text('certificado_pem_path')->nullable();
            $table->text('private_key_path_encrypted')->nullable();
            $table->text('p12_path_encrypted')->nullable();
            $table->text('password_ref')->nullable();
            $table->timestamp('valid_from')->nullable();
            $table->timestamp('valid_to')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamp('ultimo_login_wsaa_ok_at')->nullable();
            $table->timestamps();

            $table->unique(['emisor_id', 'alias', 'ambiente'], 'arca_certificado_emisor_alias_amb_unique');
            $table->index(['emisor_id', 'ambiente', 'activo'], 'arca_certificado_lookup_idx');
            $table->index('valid_to', 'arca_certificado_valid_to_idx');
            $table->index('thumbprint_sha256', 'arca_certificado_thumbprint_idx');
        });

        Schema::create('arca_ta_cache', function (Blueprint $table) {
            $table->id();
            $table->foreignId('certificado_id')->constrained('arca_certificado')->cascadeOnDelete();
            $table->enum('ambiente', ['HOMO', 'PROD']);
            $table->string('service_name', 50);
            $table->longText('token');
            $table->longText('sign');
            $table->timestamp('generation_time');
            $table->timestamp('expiration_time');
            $table->timestamps();

            $table->unique(['certificado_id', 'ambiente', 'service_name'], 'arca_ta_cache_unique');
            $table->index('expiration_time', 'arca_ta_cache_expiration_idx');
        });

        Schema::create('arca_punto_venta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('emisor_id')->constrained('arca_emisor')->cascadeOnDelete();
            $table->enum('ambiente', ['HOMO', 'PROD']);
            $table->unsignedInteger('nro');
            $table->string('sistema_arca', 120)->nullable();
            $table->string('emision_tipo', 50)->nullable();
            $table->boolean('bloqueado')->default(false);
            $table->date('fch_baja')->nullable();
            $table->boolean('habilitado_para_erp')->default(true);
            $table->unsignedInteger('default_para_cbte_tipo')->nullable();
            $table->timestamps();

            $table->unique(['emisor_id', 'ambiente', 'nro'], 'arca_punto_venta_emisor_amb_nro_unique');
            $table->index(['emisor_id', 'ambiente', 'habilitado_para_erp'], 'arca_punto_venta_lookup_idx');
            $table->index(['ambiente', 'nro'], 'arca_punto_venta_amb_nro_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arca_punto_venta');
        Schema::dropIfExists('arca_ta_cache');
        Schema::dropIfExists('arca_certificado');
        Schema::dropIfExists('arca_emisor');
    }
};
