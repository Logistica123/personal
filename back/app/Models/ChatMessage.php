<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    protected $fillable = [
        'sender_id',
        'recipient_id',
        'text',
        'image_data',
        'image_name',
    ];

    protected $casts = [
        'sender_id' => 'integer',
        'recipient_id' => 'integer',
    ];
}
