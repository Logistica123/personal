<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionStagingRow extends Model
{
    protected $table = 'liq_staging_rows';

    protected $fillable = [
        'run_id',
        'row_number',
        'external_row_id',
        'domain_norm',
        'occurred_at',
        'station',
        'product',
        'invoice_number',
        'conductor',
        'name_excel_raw',
        'name_excel_norm',
        'distributor_id',
        'distributor_code',
        'distributor_name',
        'liters',
        'amount',
        'price_per_liter',
        'tariff_expected',
        'amount_expected',
        'validation_status',
        'validation_score',
        'severity_max',
        'match_status',
        'match_provider_persona_id',
        'is_duplicate',
        'duplicate_group_key',
        'observations_auto',
        'raw_payload_json',
        'match_candidates_json',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'liters' => 'float',
        'amount' => 'float',
        'price_per_liter' => 'float',
        'tariff_expected' => 'float',
        'amount_expected' => 'float',
        'validation_score' => 'float',
        'is_duplicate' => 'boolean',
        'raw_payload_json' => 'array',
        'match_candidates_json' => 'array',
    ];

    public function run()
    {
        return $this->belongsTo(LiquidacionImportRun::class, 'run_id');
    }

    public function validationResults()
    {
        return $this->hasMany(LiquidacionValidationResult::class, 'staging_row_id');
    }

    public function observations()
    {
        return $this->hasMany(LiquidacionObservation::class, 'staging_row_id');
    }

    public function distributorLine()
    {
        return $this->hasOne(LiquidacionDistribuidorLinea::class, 'staging_row_id');
    }
}
