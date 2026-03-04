<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransportistaQrAccessLog extends Model
{
    use HasFactory;

    protected $table = 'transportista_qr_access_logs';

    protected $fillable = [
        'persona_id',
        'qr_code',
        'ip_address',
        'user_agent',
        'referrer',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }
}

