<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionObservation extends Model
{
    protected $table = 'liq_observations';

    protected $fillable = [
        'run_id',
        'staging_row_id',
        'validation_result_id',
        'type',
        'message',
        'assigned_to',
        'status',
        'resolved_note',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function run()
    {
        return $this->belongsTo(LiquidacionImportRun::class, 'run_id');
    }

    public function stagingRow()
    {
        return $this->belongsTo(LiquidacionStagingRow::class, 'staging_row_id');
    }

    public function validationResult()
    {
        return $this->belongsTo(LiquidacionValidationResult::class, 'validation_result_id');
    }
}

