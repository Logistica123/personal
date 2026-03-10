<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NosisSnapshot extends Model
{
    protected $table = 'nosis_snapshots';

    protected $fillable = [
        'entity_type',
        'entity_id',
        'snapshot_type',
        'documento',
        'cbu',
        'valid',
        'message',
        'raw_response',
        'parsed_response',
        'requested_at',
    ];

    protected $casts = [
        'valid' => 'boolean',
        'parsed_response' => 'array',
        'requested_at' => 'datetime',
    ];
}
