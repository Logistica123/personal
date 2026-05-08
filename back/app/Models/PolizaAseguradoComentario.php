<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaAseguradoComentario extends Model
{
    use HasFactory;

    protected $table = 'polizas_asegurados_comentarios';

    public $timestamps = false;  // sólo created_at; sin updated_at

    protected $fillable = [
        'asegurado_id',
        'user_id',
        'comentario',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function asegurado()
    {
        return $this->belongsTo(PolizaAsegurado::class, 'asegurado_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
