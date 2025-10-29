<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReclamoType extends Model
{
    use HasFactory;

    protected $table = 'reclamo_types';

    protected $fillable = [
        'nombre',
        'slug',
    ];

    public function reclamos()
    {
        return $this->hasMany(Reclamo::class, 'reclamo_type_id');
    }
}
