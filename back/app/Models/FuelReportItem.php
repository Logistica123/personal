<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FuelReportItem extends Model
{
    protected $table = 'fuel_report_items';

    protected $fillable = [
        'fuel_report_id',
        'fuel_movement_id',
        'liters',
        'amount',
    ];

    protected $casts = [
        'liters' => 'decimal:3',
        'amount' => 'decimal:2',
    ];

    public function report()
    {
        return $this->belongsTo(FuelReport::class, 'fuel_report_id');
    }

    public function movement()
    {
        return $this->belongsTo(FuelMovement::class, 'fuel_movement_id');
    }
}
