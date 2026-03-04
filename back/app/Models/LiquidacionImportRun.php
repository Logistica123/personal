<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionImportRun extends Model
{
    protected $table = 'liq_import_runs';

    protected $fillable = [
        'source_system',
        'client_code',
        'period_from',
        'period_to',
        'source_file_name',
        'source_file_url',
        'source_file_hash',
        'status',
        'rows_total',
        'rows_ok',
        'rows_error',
        'rows_alert',
        'rows_diff',
        'metadata',
        'created_by',
        'approved_by',
        'approved_at',
        'published_at',
    ];

    protected $casts = [
        'period_from' => 'date',
        'period_to' => 'date',
        'metadata' => 'array',
        'approved_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    public function stagingRows()
    {
        return $this->hasMany(LiquidacionStagingRow::class, 'run_id');
    }

    public function validationResults()
    {
        return $this->hasMany(LiquidacionValidationResult::class, 'run_id');
    }

    public function publishJobs()
    {
        return $this->hasMany(LiquidacionPublishJob::class, 'run_id');
    }

    public function observations()
    {
        return $this->hasMany(LiquidacionObservation::class, 'run_id');
    }

    public function distributors()
    {
        return $this->hasMany(LiquidacionDistribuidor::class, 'run_id');
    }

    public function distributorLines()
    {
        return $this->hasMany(LiquidacionDistribuidorLinea::class, 'run_id');
    }
}
