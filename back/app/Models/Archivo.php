<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Archivo extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'archivos';

    protected $fillable = [
        'persona_id',
        'tipo_archivo_id',
        'carpeta',
        'ruta',
        'download_url',
        'disk',
        'nombre_original',
        'mime',
        'size',
        'fecha_vencimiento',
    ];

    protected $dates = [
        'fecha_vencimiento',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }
}
