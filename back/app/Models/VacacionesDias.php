<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VacacionesDias extends Model
{
    use HasFactory;

    protected $table = 'vacaciones_dias';

    protected $fillable = [
        'user_id',
        'dias',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
