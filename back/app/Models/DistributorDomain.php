<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DistributorDomain extends Model
{
    protected $table = 'distributor_domains';

    protected $fillable = [
        'distributor_id',
        'domain_norm',
        'domain_raw',
    ];

    public function distributor()
    {
        return $this->belongsTo(Distributor::class);
    }
}
