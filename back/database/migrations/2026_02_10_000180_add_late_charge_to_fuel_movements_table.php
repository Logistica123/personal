<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('fuel_movements', 'late_charge')) {
                $table->boolean('late_charge')->default(false)->after('discounted')->index();
            }
            if (! Schema::hasColumn('fuel_movements', 'late_report_id')) {
                $table->unsignedBigInteger('late_report_id')->nullable()->after('late_charge')->index();
            }
            if (! Schema::hasColumn('fuel_movements', 'manual_adjustment_required')) {
                $table->boolean('manual_adjustment_required')->default(false)->after('late_report_id')->index();
            }
            if (! Schema::hasColumn('fuel_movements', 'manual_adjustment_amount')) {
                $table->decimal('manual_adjustment_amount', 12, 2)->nullable()->after('manual_adjustment_required');
            }
            if (! Schema::hasColumn('fuel_movements', 'manual_adjustment_note')) {
                $table->string('manual_adjustment_note', 255)->nullable()->after('manual_adjustment_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            if (Schema::hasColumn('fuel_movements', 'manual_adjustment_note')) {
                $table->dropColumn('manual_adjustment_note');
            }
            if (Schema::hasColumn('fuel_movements', 'manual_adjustment_amount')) {
                $table->dropColumn('manual_adjustment_amount');
            }
            if (Schema::hasColumn('fuel_movements', 'manual_adjustment_required')) {
                $table->dropColumn('manual_adjustment_required');
            }
            if (Schema::hasColumn('fuel_movements', 'late_report_id')) {
                $table->dropColumn('late_report_id');
            }
            if (Schema::hasColumn('fuel_movements', 'late_charge')) {
                $table->dropColumn('late_charge');
            }
        });
    }
};
