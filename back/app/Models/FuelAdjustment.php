<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FuelAdjustment extends Model
{
    protected $table = 'fuel_adjustments';

    protected $fillable = [
        'fuel_report_id',
        'type',
        'amount',
        'note',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function report()
    {
        return $this->belongsTo(FuelReport::class, 'fuel_report_id');
    }
}
