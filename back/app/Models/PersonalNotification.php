<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PersonalNotification extends Model
{
    protected $table = 'personal_notifications';

    protected $fillable = [
        'persona_id',
        'type',
        'title',
        'message',
        'metadata',
        'read_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'read_at' => 'datetime',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }
}
