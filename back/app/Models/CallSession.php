<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'initiator_user_id',
        'target_user_id',
        'provider',
        'direction',
        'channel',
        'status',
        'initiator_identity',
        'target_identity',
        'from_phone',
        'to_phone',
        'provider_call_sid',
        'started_at',
        'answered_at',
        'ended_at',
        'duration_seconds',
        'end_reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'started_at' => 'datetime',
            'answered_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_user_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
