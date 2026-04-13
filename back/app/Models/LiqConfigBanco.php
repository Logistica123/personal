<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class LiqConfigBanco extends Model
{
    use HasFactory;

    protected $table = 'liq_config_banco';

    const MODO_PRODUCCION = 'PRODUCCION';
    const MODO_TESTING    = 'TESTING';

    protected $fillable = [
        'nombre_banco',
        'banco_codigo',
        'url_base',
        'wsdl_url',
        'certificado_path',
        'clave_privada_path',
        'certificado_cliente_path',
        'cert_empresa_path',
        'certificado_password',
        'cbu_empresa',
        'cuil_empresa',
        'doc_type',
        'doc_number',
        'ordenante_id',
        'service_id',
        'product_type',
        'delivery_branch',
        'ordenante_nombre',
        'producto',
        'timeout_segundos',
        'reintentos_max',
        'modo',
        'activo',
        'ultimo_test',
        'ultimo_test_resultado',
        'cert_vencimiento',
    ];

    protected $casts = [
        'timeout_segundos' => 'integer',
        'reintentos_max'   => 'integer',
        'activo'           => 'boolean',
        'ultimo_test'      => 'datetime',
        'cert_vencimiento' => 'date',
    ];

    protected $hidden = [
        'certificado_password',
        'certificado_path',
        'clave_privada_path',
        'certificado_cliente_path',
    ];

    // -------------------------------------------------------------------------
    // Accessors / Mutators - cifrado del password del certificado
    // -------------------------------------------------------------------------

    public function setCertificadoPasswordAttribute($value)
    {
        $this->attributes['certificado_password'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getCertificadoPasswordDecrypted(): ?string
    {
        return $this->certificado_password ? Crypt::decryptString($this->certificado_password) : null;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    public function esTesting(): bool
    {
        return $this->modo === self::MODO_TESTING;
    }

    public function esProduccion(): bool
    {
        return $this->modo === self::MODO_PRODUCCION;
    }

    /**
     * Devuelve la config activa del banco (singleton pattern en la tabla).
     */
    public static function activa(): ?self
    {
        return static::where('activo', true)->first();
    }
}
