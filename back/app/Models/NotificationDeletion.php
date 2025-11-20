<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationDeletion extends Model
{
    use HasFactory;

    protected $fillable = [
        'notification_id',
        'deleted_by_id',
        'message',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function deleter()
    {
        return $this->belongsTo(User::class, 'deleted_by_id');
    }
}
