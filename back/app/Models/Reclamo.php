<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Reclamo extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'creator_id',
        'persona_id',
        'agente_id',
        'reclamo_type_id',
        'detalle',
        'cliente_nombre',
        'sucursal_nombre',
        'distribuidor_nombre',
        'emisor_factura',
        'importe_solicitado',
        'cuit_cobrador',
        'medio_pago',
        'concepto',
        'fecha_compromiso_pago',
        'aprobacion_estado',
        'aprobacion_motivo',
        'bloqueado_en',
        'en_revision',
        'fecha_alta',
        'status',
        'pagado',
        'importe_pagado',
        'importe_facturado',
    ];

    protected $casts = [
        'fecha_alta' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'fecha_compromiso_pago' => 'date',
        'bloqueado_en' => 'datetime',
        'en_revision' => 'boolean',
        'pagado' => 'boolean',
        'importe_solicitado' => 'decimal:2',
        'importe_pagado' => 'decimal:2',
        'importe_facturado' => 'decimal:2',
    ];


    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }

    public function agente()
    {
        return $this->belongsTo(User::class, 'agente_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function tipo()
    {
        return $this->belongsTo(ReclamoType::class, 'reclamo_type_id');
    }

    public function comments()
    {
        return $this->hasMany(ReclamoComment::class);
    }

    public function logs()
    {
        return $this->hasMany(ReclamoLog::class);
    }

    public function documents()
    {
        return $this->hasMany(ReclamoDocument::class);
    }
}
