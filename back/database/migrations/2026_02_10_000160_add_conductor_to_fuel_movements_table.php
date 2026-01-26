<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            $table->string('conductor')->nullable()->after('product');
        });
    }

    public function down(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            $table->dropColumn('conductor');
        });
    }
};
