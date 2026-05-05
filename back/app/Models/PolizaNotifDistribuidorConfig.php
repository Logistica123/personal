<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaNotifDistribuidorConfig extends Model
{
    use HasFactory;

    protected $table = 'polizas_notif_distribuidor_config';

    protected $fillable = [
        'poliza_id',
        'activo',
        'asunto_template',
        'body_template',
        'cc_admin_email',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }
}
