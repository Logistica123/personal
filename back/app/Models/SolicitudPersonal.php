<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SolicitudPersonal extends Model
{
    use HasFactory;

    protected $table = 'solicitud_personal';

    protected $fillable = [
        'tipo',
        'estado',
        'form',
        'solicitante_id',
        'destinatario_id',
    ];

    protected $casts = [
        'form' => 'array',
    ];

    public function solicitante()
    {
        return $this->belongsTo(User::class, 'solicitante_id');
    }

    public function destinatario()
    {
        return $this->belongsTo(User::class, 'destinatario_id');
    }
}
