<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE liq_archivos_entrada MODIFY COLUMN tipo_archivo VARCHAR(40) NOT NULL DEFAULT 'DATA_CLIENTE'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE liq_archivos_entrada MODIFY COLUMN tipo_archivo ENUM('DATA_CLIENTE','DETALLE_SUCURSAL','TARIFARIO','BASE_DISTRIB','VARIABLES') NOT NULL DEFAULT 'DATA_CLIENTE'");
    }
};
