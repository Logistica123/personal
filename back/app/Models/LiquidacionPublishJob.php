<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionPublishJob extends Model
{
    protected $table = 'liq_publish_jobs';

    protected $fillable = [
        'run_id',
        'status',
        'erp_request_id',
        'erp_batch_id',
        'sent_at',
        'confirmed_at',
        'request_payload',
        'response_payload',
        'error_message',
        'created_by',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'confirmed_at' => 'datetime',
    ];

    public function run()
    {
        return $this->belongsTo(LiquidacionImportRun::class, 'run_id');
    }
}

