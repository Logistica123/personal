<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PersonaHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'persona_id',
        'user_id',
        'description',
        'changes',
    ];

    protected $casts = [
        'changes' => 'array',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
