<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('arca_certificado', function (Blueprint $table) {
            $table->longText('csr_pem')->nullable()->after('serial_number_subject');
            $table->text('csr_path')->nullable()->after('csr_pem');
            $table->text('certificate_crt_path')->nullable()->after('certificado_pem_path');
            $table->text('p12_password_ref')->nullable()->after('p12_path_encrypted');
            $table->string('estado', 30)->default('CRT_IMPORTADO')->after('p12_password_ref');
        });

        DB::table('arca_certificado')
            ->whereNull('estado')
            ->orWhere('estado', '')
            ->update([
                'estado' => DB::raw("CASE WHEN activo = 1 THEN 'ACTIVO' ELSE 'CRT_IMPORTADO' END"),
            ]);
    }

    public function down(): void
    {
        Schema::table('arca_certificado', function (Blueprint $table) {
            $table->dropColumn([
                'csr_pem',
                'csr_path',
                'certificate_crt_path',
                'p12_password_ref',
                'estado',
            ]);
        });
    }
};
