<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReclamoDocument extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'reclamo_id',
        'nombre_original',
        'disk',
        'path',
        'download_url',
        'mime',
        'size',
    ];

    protected $casts = [
        'size' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function reclamo()
    {
        return $this->belongsTo(Reclamo::class);
    }
}
