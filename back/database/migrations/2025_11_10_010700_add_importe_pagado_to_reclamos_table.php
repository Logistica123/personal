<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('reclamos')) {
            return;
        }

        Schema::table('reclamos', function (Blueprint $table) {
            if (! Schema::hasColumn('reclamos', 'importe_pagado')) {
                $table->decimal('importe_pagado', 12, 2)->nullable()->after('pagado');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('reclamos')) {
            return;
        }

        Schema::table('reclamos', function (Blueprint $table) {
            if (Schema::hasColumn('reclamos', 'importe_pagado')) {
                $table->dropColumn('importe_pagado');
            }
        });
    }
};
