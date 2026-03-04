<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liq_staging_rows', function (Blueprint $table) {
            $table->string('match_status', 40)->nullable()->after('severity_max')->index();
            $table->unsignedBigInteger('match_provider_persona_id')->nullable()->after('match_status')->index();
            $table->string('name_excel_raw')->nullable()->after('conductor');
            $table->string('name_excel_norm')->nullable()->after('name_excel_raw')->index();
            $table->json('match_candidates_json')->nullable()->after('raw_payload_json');
        });

        Schema::create('liq_client_identifier_aliases', function (Blueprint $table) {
            $table->id();
            $table->string('client_code', 100)->index();
            $table->string('alias_type', 20)->index();
            $table->string('alias_norm', 190)->index();
            $table->unsignedBigInteger('provider_persona_id')->index();
            $table->boolean('active')->default(true)->index();
            $table->unsignedBigInteger('created_by')->nullable()->index();
            $table->timestamp('last_used_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['client_code', 'alias_type', 'alias_norm'], 'liq_aliases_unique');
            $table->index(['client_code', 'provider_persona_id'], 'liq_aliases_client_provider_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liq_client_identifier_aliases');

        Schema::table('liq_staging_rows', function (Blueprint $table) {
            $table->dropColumn([
                'match_status',
                'match_provider_persona_id',
                'name_excel_raw',
                'name_excel_norm',
                'match_candidates_json',
            ]);
        });
    }
};
