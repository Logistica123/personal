<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionValidationResult extends Model
{
    protected $table = 'liq_validation_results';

    protected $fillable = [
        'run_id',
        'staging_row_id',
        'rule_code',
        'severity',
        'result',
        'expected_value',
        'actual_value',
        'message',
    ];

    public function run()
    {
        return $this->belongsTo(LiquidacionImportRun::class, 'run_id');
    }

    public function stagingRow()
    {
        return $this->belongsTo(LiquidacionStagingRow::class, 'staging_row_id');
    }
}

