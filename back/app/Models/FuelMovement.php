<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FuelMovement extends Model
{
    protected $table = 'fuel_movements';

    protected $fillable = [
        'occurred_at',
        'station',
        'domain_raw',
        'domain_norm',
        'product',
        'conductor',
        'liters',
        'amount',
        'price_per_liter',
        'status',
        'observations',
        'source_file',
        'source_row',
        'duplicate_hash',
        'provider',
        'format',
        'period_from',
        'period_to',
        'imported_by',
        'distributor_id',
        'fuel_report_id',
        'discounted',
        'late_charge',
        'late_report_id',
        'manual_adjustment_required',
        'manual_adjustment_amount',
        'manual_adjustment_note',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'liters' => 'float',
        'amount' => 'float',
        'price_per_liter' => 'float',
        'source_row' => 'integer',
        'imported_by' => 'integer',
        'distributor_id' => 'integer',
        'fuel_report_id' => 'integer',
        'discounted' => 'boolean',
        'late_charge' => 'boolean',
        'late_report_id' => 'integer',
        'manual_adjustment_required' => 'boolean',
        'manual_adjustment_amount' => 'float',
    ];

    public function distributor()
    {
        return $this->belongsTo(Distributor::class);
    }

    public function report()
    {
        return $this->belongsTo(FuelReport::class, 'fuel_report_id');
    }
}
