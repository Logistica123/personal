<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activos_asesores_comerciales', function (Blueprint $table) {
            $table->string('modalidad_trabajo')->default('Presencial')->after('rol');
            $table->text('comentarios')->nullable()->after('numero');
            $table->string('cliente')->nullable()->after('comentarios');
            $table->string('asesor_postventa')->nullable()->after('cliente');
            $table->string('sucursal')->nullable()->after('asesor_postventa');
            $table->string('vehiculo')->nullable()->after('sucursal');
            $table->timestamp('fecha_ultima_asignacion')->nullable()->after('vehiculo');
        });

        DB::table('activos_asesores_comerciales')
            ->whereRaw('LOWER(COALESCE(asesor_comercial, \'\')) LIKE ?', ['%sofia%'])
            ->orWhereRaw('LOWER(COALESCE(asesor_comercial, \'\')) LIKE ?', ['%cecilia%'])
            ->update(['modalidad_trabajo' => 'Remoto']);
    }

    public function down(): void
    {
        Schema::table('activos_asesores_comerciales', function (Blueprint $table) {
            $table->dropColumn([
                'modalidad_trabajo',
                'comentarios',
                'cliente',
                'asesor_postventa',
                'sucursal',
                'vehiculo',
                'fecha_ultima_asignacion',
            ]);
        });
    }
};

