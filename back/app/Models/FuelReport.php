<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FuelReport extends Model
{
    protected $table = 'fuel_reports';

    protected $fillable = [
        'distributor_id',
        'period_from',
        'period_to',
        'status',
        'total_amount',
        'adjustments_total',
        'total_to_bill',
        'liquidacion_id',
        'created_by',
        'applied_by',
        'applied_at',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'adjustments_total' => 'decimal:2',
        'total_to_bill' => 'decimal:2',
        'applied_at' => 'datetime',
    ];

    public function distributor()
    {
        return $this->belongsTo(Distributor::class);
    }

    public function items()
    {
        return $this->hasMany(FuelReportItem::class);
    }

    public function adjustments()
    {
        return $this->hasMany(FuelAdjustment::class);
    }
}
