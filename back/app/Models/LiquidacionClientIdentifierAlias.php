<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionClientIdentifierAlias extends Model
{
    protected $table = 'liq_client_identifier_aliases';

    protected $fillable = [
        'client_code',
        'alias_type',
        'alias_norm',
        'provider_persona_id',
        'active',
        'created_by',
        'last_used_at',
    ];

    protected $casts = [
        'active' => 'boolean',
        'last_used_at' => 'datetime',
    ];
}
