<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'membresia_desde')) {
                $table->date('membresia_desde')->nullable()->after('cobrador_telefono_emergencia');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'membresia_desde')) {
                $table->dropColumn('membresia_desde');
            }
        });
    }
};
