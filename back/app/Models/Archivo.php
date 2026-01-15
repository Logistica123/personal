<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\FileType;

class Archivo extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'archivos';

    protected $fillable = [
        'persona_id',
        'parent_document_id',
        'liquidacion_id',
        'es_pendiente',
        'tipo_archivo_id',
        'carpeta',
        'ruta',
        'download_url',
        'disk',
        'nombre_original',
        'mime',
        'size',
        'fecha_vencimiento',
        'importe_facturar',
        'enviada',
        'recibido',
        'pagado',
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

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_document_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_document_id');
    }

    public function tipo()
    {
        return $this->belongsTo(FileType::class, 'tipo_archivo_id');
    }
}
