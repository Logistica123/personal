<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('fuel_movements', 'distributor_id')) {
                $table->unsignedBigInteger('distributor_id')->nullable()->index();
            }
            if (!Schema::hasColumn('fuel_movements', 'fuel_report_id')) {
                $table->unsignedBigInteger('fuel_report_id')->nullable()->index();
            }
            if (!Schema::hasColumn('fuel_movements', 'discounted')) {
                $table->boolean('discounted')->default(false)->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            if (Schema::hasColumn('fuel_movements', 'distributor_id')) {
                $table->dropColumn('distributor_id');
            }
            if (Schema::hasColumn('fuel_movements', 'fuel_report_id')) {
                $table->dropColumn('fuel_report_id');
            }
            if (Schema::hasColumn('fuel_movements', 'discounted')) {
                $table->dropColumn('discounted');
            }
        });
    }
};
