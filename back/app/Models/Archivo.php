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
        'categoria',
        'mime',
        'size',
        'fecha_vencimiento',
        'fortnight_key',
        'month_key',
        'importe_facturar',
        'tipo_comprobante',
        'importe_facturar_base',
        'iva_porcentaje',
        'importe_iva',
        'importe_facturar_overridido',
        'requiere_revision_dual',
        'cobrador_override_nombre',
        'cobrador_override_cuit',
        'cobrador_override_cbu',
        'cobrador_override_alias_cbu',
        'cobrador_override_motivo',
        'cobrador_override_at',
        'cobrador_override_por',
        'enviada',
        'recibido',
        'pagado',
        'liquidacion_destinatario_tipo',
        'liquidacion_destinatario_emails',
    ];

    protected $casts = [
        'es_pendiente' => 'boolean',
        'enviada' => 'boolean',
        'recibido' => 'boolean',
        'pagado' => 'boolean',
        'importe_facturar' => 'decimal:2',
        'importe_facturar_base' => 'decimal:2',
        'iva_porcentaje' => 'decimal:2',
        'importe_iva' => 'decimal:2',
        'importe_facturar_overridido' => 'boolean',
        'requiere_revision_dual' => 'boolean',
        'cobrador_override_at' => 'datetime',
        'liquidacion_destinatario_emails' => 'array',
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
