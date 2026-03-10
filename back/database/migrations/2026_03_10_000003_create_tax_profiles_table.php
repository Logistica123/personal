<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tax_profiles')) {
            return;
        }

        Schema::create('tax_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id');
            $table->string('cuit', 20)->nullable();
            $table->string('razon_social')->nullable();
            $table->string('arca_status')->nullable();
            $table->string('dgr_status')->nullable();
            $table->text('exclusion_notes')->nullable();
            $table->text('exemption_notes')->nullable();
            $table->text('regime_notes')->nullable();
            $table->string('bank_account', 40)->nullable();
            $table->string('bank_alias')->nullable();
            $table->string('bank_owner_name')->nullable();
            $table->string('bank_owner_document', 20)->nullable();
            $table->string('bank_validation_status', 40)->nullable();
            $table->text('insurance_notes')->nullable();
            $table->text('observations')->nullable();
            $table->unsignedBigInteger('latest_nosis_snapshot_id')->nullable();
            $table->timestamps();

            $table->unique(['entity_type', 'entity_id'], 'tax_profiles_entity_unique');
            $table->index('cuit', 'tax_profiles_cuit_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_profiles');
    }
};
