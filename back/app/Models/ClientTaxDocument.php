<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientTaxDocument extends Model
{
    protected $table = 'client_tax_documents';

    protected $fillable = [
        'cliente_id',
        'uploaded_by',
        'category',
        'title',
        'description',
        'fecha_vencimiento',
        'disk',
        'path',
        'original_name',
        'mime',
        'size',
    ];

    protected $casts = [
        'fecha_vencimiento' => 'date',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }
}
