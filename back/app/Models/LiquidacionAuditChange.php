<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionAuditChange extends Model
{
    protected $table = 'liq_audit_changes';

    public $timestamps = false;

    protected $fillable = [
        'entity_type',
        'entity_id',
        'field',
        'old_value',
        'new_value',
        'user_id',
        'reason',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}

