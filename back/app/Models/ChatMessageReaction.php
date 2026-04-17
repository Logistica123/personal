<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMessageReaction extends Model
{
    protected $table = 'chat_message_reactions';

    protected $fillable = [
        'message_id',
        'user_id',
        'emoji',
    ];

    protected $casts = [
        'message_id' => 'integer',
        'user_id' => 'integer',
    ];
}
