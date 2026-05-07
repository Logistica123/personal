<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolizaAdminEmailAccount extends Model
{
    use HasFactory;

    protected $table = 'polizas_admin_email_accounts';

    protected $fillable = [
        'user_id',
        'provider',
        'ms_account_email',
        'ms_account_id',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'scope',
        'last_refresh_at',
        'last_error',
        'activo',
    ];

    protected $casts = [
        'token_expires_at' => 'datetime',
        'last_refresh_at'  => 'datetime',
        'activo'           => 'boolean',
    ];

    protected $hidden = [
        // Estos NO deberían exponerse vía API. El frontend solo necesita
        // saber si está vinculado, no los tokens crudos.
        'access_token',
        'refresh_token',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
