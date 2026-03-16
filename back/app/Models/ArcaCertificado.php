<?php

namespace App\Models;

use App\Support\Facturacion\AmbienteArca;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArcaCertificado extends Model
{
    use HasFactory;

    protected $table = 'arca_certificado';

    protected $fillable = [
        'emisor_id',
        'alias',
        'ambiente',
        'subject_dn',
        'serial_number_subject',
        'csr_pem',
        'csr_path',
        'thumbprint_sha1',
        'thumbprint_sha256',
        'certificado_pem_path',
        'certificate_crt_path',
        'private_key_path_encrypted',
        'p12_path_encrypted',
        'password_ref',
        'p12_password_ref',
        'valid_from',
        'valid_to',
        'activo',
        'estado',
        'ultimo_login_wsaa_ok_at',
    ];

    protected function casts(): array
    {
        return [
            'ambiente' => AmbienteArca::class,
            'valid_from' => 'datetime',
            'valid_to' => 'datetime',
            'ultimo_login_wsaa_ok_at' => 'datetime',
            'activo' => 'boolean',
        ];
    }

    public function emisor()
    {
        return $this->belongsTo(ArcaEmisor::class, 'emisor_id');
    }

    public function taCache()
    {
        return $this->hasMany(ArcaTaCache::class, 'certificado_id');
    }
}
