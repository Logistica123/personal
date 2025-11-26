<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'es_cobrador')) {
                $table->boolean('es_cobrador')->default(false)->after('tarifaespecial');
            }

            if (! Schema::hasColumn('personas', 'cobrador_nombre')) {
                $table->string('cobrador_nombre')->nullable()->after('es_cobrador');
            }

            if (! Schema::hasColumn('personas', 'cobrador_email')) {
                $table->string('cobrador_email')->nullable()->after('cobrador_nombre');
            }

            if (! Schema::hasColumn('personas', 'cobrador_cuil')) {
                $table->string('cobrador_cuil')->nullable()->after('cobrador_email');
            }

            if (! Schema::hasColumn('personas', 'cobrador_cbu_alias')) {
                $table->string('cobrador_cbu_alias')->nullable()->after('cobrador_cuil');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            foreach (['cobrador_cbu_alias', 'cobrador_cuil', 'cobrador_email', 'cobrador_nombre', 'es_cobrador'] as $column) {
                if (Schema::hasColumn('personas', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
