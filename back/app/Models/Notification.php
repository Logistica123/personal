<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'reclamo_id',
        'entity_type',
        'entity_id',
        'type',
        'message',
        'description',
        'read_at',
        'metadata',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reclamo()
    {
        return $this->belongsTo(Reclamo::class);
    }
}
