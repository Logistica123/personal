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
        'fecha_alta',
        'status',
        'pagado',
    ];

    protected $casts = [
        'fecha_alta' => 'datetime',
        'pagado' => 'boolean',
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
