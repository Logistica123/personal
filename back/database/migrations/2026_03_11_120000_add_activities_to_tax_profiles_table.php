<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tax_profiles') || Schema::hasColumn('tax_profiles', 'activities')) {
            return;
        }

        Schema::table('tax_profiles', function (Blueprint $table) {
            $table->json('activities')->nullable()->after('activity_main_started_at');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tax_profiles') || ! Schema::hasColumn('tax_profiles', 'activities')) {
            return;
        }

        Schema::table('tax_profiles', function (Blueprint $table) {
            $table->dropColumn('activities');
        });
    }
};
