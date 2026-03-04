<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiquidacionClientRule extends Model
{
    protected $table = 'liq_client_rules';

    protected $fillable = [
        'client_code',
        'active',
        'rules_json',
        'note',
        'updated_by',
    ];

    protected $casts = [
        'active' => 'boolean',
        'rules_json' => 'array',
    ];
}

