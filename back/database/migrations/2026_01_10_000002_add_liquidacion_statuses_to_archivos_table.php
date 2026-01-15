<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            $table->boolean('enviada')->default(false)->after('importe_facturar');
            $table->boolean('recibido')->default(false)->after('enviada');
            $table->boolean('pagado')->default(false)->after('recibido');
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            $table->dropColumn(['enviada', 'recibido', 'pagado']);
        });
    }
};
