<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('fuel_movements', 'invoice_number')) {
                $table->string('invoice_number')->nullable()->index()->after('product');
            }
        });
    }

    public function down(): void
    {
        Schema::table('fuel_movements', function (Blueprint $table) {
            if (Schema::hasColumn('fuel_movements', 'invoice_number')) {
                $table->dropColumn('invoice_number');
            }
        });
    }
};

