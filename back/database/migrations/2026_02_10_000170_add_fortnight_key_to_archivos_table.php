<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (! Schema::hasColumn('archivos', 'fortnight_key')) {
                $table->string('fortnight_key', 10)->nullable()->after('fecha_vencimiento');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            if (Schema::hasColumn('archivos', 'fortnight_key')) {
                $table->dropColumn('fortnight_key');
            }
        });
    }
};
