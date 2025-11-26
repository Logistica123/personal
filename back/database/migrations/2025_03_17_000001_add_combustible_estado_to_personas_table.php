<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (! Schema::hasColumn('personas', 'combustible_estado')) {
                $table->string('combustible_estado', 50)->nullable()->after('combustible');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personas', function (Blueprint $table) {
            if (Schema::hasColumn('personas', 'combustible_estado')) {
                $table->dropColumn('combustible_estado');
            }
        });
    }
};
