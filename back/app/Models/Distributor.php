<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Distributor extends Model
{
    protected $table = 'distributors';

    protected $fillable = [
        'name',
        'code',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function domains()
    {
        return $this->hasMany(DistributorDomain::class);
    }

    public function fuelReports()
    {
        return $this->hasMany(FuelReport::class);
    }
}
