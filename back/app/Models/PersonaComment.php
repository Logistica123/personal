<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PersonaComment extends Model
{
    use HasFactory;

    protected $table = 'persona_comments';

    protected $fillable = [
        'persona_id',
        'user_id',
        'message',
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
