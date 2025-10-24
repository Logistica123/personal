<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReclamoLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'reclamo_id',
        'old_status',
        'new_status',
        'changed_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function reclamo()
    {
        return $this->belongsTo(Reclamo::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
