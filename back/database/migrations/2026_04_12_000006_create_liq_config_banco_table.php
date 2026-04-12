<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('liq_config_banco')) {
            return;
        }

        Schema::create('liq_config_banco', function (Blueprint $table) {
            $table->id();
            $table->string('nombre_banco', 100);
            $table->string('url_base', 500);
            $table->string('certificado_path', 500)->nullable();
            $table->text('certificado_password')->nullable(); // cifrado con encrypt()
            $table->string('cbu_empresa', 22);
            $table->string('cuil_empresa', 13);
            $table->unsignedSmallInteger('timeout_segundos')->default(30);
            $table->enum('modo', ['PRODUCCION', 'TESTING'])->default('TESTING');
            $table->boolean('activo')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_config_banco');
    }
};
