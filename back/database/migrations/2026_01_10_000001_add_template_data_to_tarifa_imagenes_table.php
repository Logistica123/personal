<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('tarifa_imagenes', 'template_data')) {
            Schema::table('tarifa_imagenes', function (Blueprint $table) {
                $table->json('template_data')->nullable()->after('size');
            });
        }
    }

    public function down(): void
    {
        Schema::table('tarifa_imagenes', function (Blueprint $table) {
            $table->dropColumn('template_data');
        });
    }
};
