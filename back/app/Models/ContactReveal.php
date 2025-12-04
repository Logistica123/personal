<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContactReveal extends Model
{
    use HasFactory;

    protected $fillable = [
        'persona_id',
        'campo',
        'actor_id',
        'actor_name',
        'actor_email',
        'ip_address',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
