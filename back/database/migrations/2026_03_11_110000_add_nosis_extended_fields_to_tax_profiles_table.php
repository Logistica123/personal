<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tax_profiles')) {
            return;
        }

        Schema::table('tax_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_street')) {
                $table->string('fiscal_address_street')->nullable()->after('dgr_status');
            }
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_number')) {
                $table->string('fiscal_address_number', 20)->nullable()->after('fiscal_address_street');
            }
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_floor')) {
                $table->string('fiscal_address_floor', 20)->nullable()->after('fiscal_address_number');
            }
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_unit')) {
                $table->string('fiscal_address_unit', 20)->nullable()->after('fiscal_address_floor');
            }
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_locality')) {
                $table->string('fiscal_address_locality')->nullable()->after('fiscal_address_unit');
            }
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_postal_code')) {
                $table->string('fiscal_address_postal_code', 20)->nullable()->after('fiscal_address_locality');
            }
            if (! Schema::hasColumn('tax_profiles', 'fiscal_address_province')) {
                $table->string('fiscal_address_province', 120)->nullable()->after('fiscal_address_postal_code');
            }
            if (! Schema::hasColumn('tax_profiles', 'activity_main_code')) {
                $table->string('activity_main_code', 20)->nullable()->after('fiscal_address_province');
            }
            if (! Schema::hasColumn('tax_profiles', 'activity_main_description')) {
                $table->string('activity_main_description')->nullable()->after('activity_main_code');
            }
            if (! Schema::hasColumn('tax_profiles', 'activity_main_sector')) {
                $table->string('activity_main_sector', 120)->nullable()->after('activity_main_description');
            }
            if (! Schema::hasColumn('tax_profiles', 'activity_main_started_at')) {
                $table->date('activity_main_started_at')->nullable()->after('activity_main_sector');
            }
            if (! Schema::hasColumn('tax_profiles', 'afip_key_status')) {
                $table->string('afip_key_status', 120)->nullable()->after('activity_main_started_at');
            }
            if (! Schema::hasColumn('tax_profiles', 'afip_key_status_at')) {
                $table->date('afip_key_status_at')->nullable()->after('afip_key_status');
            }
            if (! Schema::hasColumn('tax_profiles', 'iva_inscripto')) {
                $table->boolean('iva_inscripto')->nullable()->after('afip_key_status_at');
            }
            if (! Schema::hasColumn('tax_profiles', 'iva_exento_retencion')) {
                $table->boolean('iva_exento_retencion')->nullable()->after('iva_inscripto');
            }
            if (! Schema::hasColumn('tax_profiles', 'iva_registered_at')) {
                $table->date('iva_registered_at')->nullable()->after('iva_exento_retencion');
            }
            if (! Schema::hasColumn('tax_profiles', 'iva_condition')) {
                $table->string('iva_condition', 120)->nullable()->after('iva_registered_at');
            }
            if (! Schema::hasColumn('tax_profiles', 'ganancias_inscripto')) {
                $table->boolean('ganancias_inscripto')->nullable()->after('iva_condition');
            }
            if (! Schema::hasColumn('tax_profiles', 'ganancias_exento_retencion')) {
                $table->boolean('ganancias_exento_retencion')->nullable()->after('ganancias_inscripto');
            }
            if (! Schema::hasColumn('tax_profiles', 'ganancias_registered_at')) {
                $table->date('ganancias_registered_at')->nullable()->after('ganancias_exento_retencion');
            }
            if (! Schema::hasColumn('tax_profiles', 'ganancias_condition')) {
                $table->string('ganancias_condition', 120)->nullable()->after('ganancias_registered_at');
            }
            if (! Schema::hasColumn('tax_profiles', 'monotributo_inscripto')) {
                $table->boolean('monotributo_inscripto')->nullable()->after('ganancias_condition');
            }
            if (! Schema::hasColumn('tax_profiles', 'monotributo_registered_at')) {
                $table->date('monotributo_registered_at')->nullable()->after('monotributo_inscripto');
            }
            if (! Schema::hasColumn('tax_profiles', 'monotributo_category')) {
                $table->string('monotributo_category', 40)->nullable()->after('monotributo_registered_at');
            }
            if (! Schema::hasColumn('tax_profiles', 'monotributo_type')) {
                $table->string('monotributo_type')->nullable()->after('monotributo_category');
            }
            if (! Schema::hasColumn('tax_profiles', 'monotributo_activity')) {
                $table->string('monotributo_activity')->nullable()->after('monotributo_type');
            }
            if (! Schema::hasColumn('tax_profiles', 'monotributo_seniority_months')) {
                $table->unsignedInteger('monotributo_seniority_months')->nullable()->after('monotributo_activity');
            }
            if (! Schema::hasColumn('tax_profiles', 'is_employee')) {
                $table->boolean('is_employee')->nullable()->after('monotributo_seniority_months');
            }
            if (! Schema::hasColumn('tax_profiles', 'is_employer')) {
                $table->boolean('is_employer')->nullable()->after('is_employee');
            }
            if (! Schema::hasColumn('tax_profiles', 'is_retired')) {
                $table->boolean('is_retired')->nullable()->after('is_employer');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tax_profiles')) {
            return;
        }

        Schema::table('tax_profiles', function (Blueprint $table) {
            $columns = [
                'fiscal_address_street',
                'fiscal_address_number',
                'fiscal_address_floor',
                'fiscal_address_unit',
                'fiscal_address_locality',
                'fiscal_address_postal_code',
                'fiscal_address_province',
                'activity_main_code',
                'activity_main_description',
                'activity_main_sector',
                'activity_main_started_at',
                'afip_key_status',
                'afip_key_status_at',
                'iva_inscripto',
                'iva_exento_retencion',
                'iva_registered_at',
                'iva_condition',
                'ganancias_inscripto',
                'ganancias_exento_retencion',
                'ganancias_registered_at',
                'ganancias_condition',
                'monotributo_inscripto',
                'monotributo_registered_at',
                'monotributo_category',
                'monotributo_type',
                'monotributo_activity',
                'monotributo_seniority_months',
                'is_employee',
                'is_employer',
                'is_retired',
            ];

            $existingColumns = array_values(array_filter($columns, static fn (string $column) => Schema::hasColumn('tax_profiles', $column)));
            if ($existingColumns !== []) {
                $table->dropColumn($existingColumns);
            }
        });
    }
};
