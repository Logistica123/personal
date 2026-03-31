<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cierres_diarios', function (Blueprint $table) {
            $table->id();
            $table->date('fecha_importacion')->comment('Fecha en que se realizó la importación del cierre');
            $table->date('fecha_lead')->nullable()->comment('Fecha del lead (columna Fecha del export Kommo)');
            $table->unsignedBigInteger('lead_id')->nullable()->comment('ID del lead en Kommo');
            $table->string('contacto')->nullable()->comment('EXTRAER CONTACTO - número de teléfono');
            $table->string('estatus_lead')->nullable();
            $table->string('etiquetas_lead')->nullable();
            $table->string('sucursal')->nullable();
            $table->string('vehiculo')->nullable();
            $table->string('empresa')->nullable();
            $table->string('embudo')->nullable();
            $table->string('nombre_distribuidor')->nullable();
            $table->string('asesor_comercial')->nullable();
            $table->unsignedSmallInteger('mes')->nullable();
            $table->unsignedSmallInteger('semana')->nullable();
            $table->unsignedSmallInteger('dia')->nullable();
            $table->string('importado_por')->nullable();
            $table->timestamps();

            $table->index('fecha_importacion', 'cierres_diarios_fecha_idx');
            $table->index(['fecha_importacion', 'asesor_comercial'], 'cierres_diarios_fecha_asesor_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cierres_diarios');
    }
};
