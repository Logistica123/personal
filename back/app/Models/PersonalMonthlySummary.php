<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PersonalMonthlySummary extends Model
{
    protected $table = 'personal_monthly_summaries';

    protected $fillable = [
        'year',
        'month',
        'altas',
        'bajas',
        'total',
        'frozen_at',
    ];

    protected $casts = [
        'frozen_at' => 'datetime',
    ];
}
