<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReclamoComment extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'reclamo_id',
        'creator_id',
        'sender_type',
        'sender_persona_id',
        'sender_user_id',
        'message',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function reclamo()
    {
        return $this->belongsTo(Reclamo::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function senderPersona()
    {
        return $this->belongsTo(Persona::class, 'sender_persona_id');
    }

    public function senderUser()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
