<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaxProfile extends Model
{
    protected $table = 'tax_profiles';

    protected $fillable = [
        'entity_type',
        'entity_id',
        'cuit',
        'razon_social',
        'arca_status',
        'dgr_status',
        'exclusion_notes',
        'exemption_notes',
        'regime_notes',
        'bank_account',
        'bank_alias',
        'bank_owner_name',
        'bank_owner_document',
        'bank_validation_status',
        'insurance_notes',
        'observations',
        'latest_nosis_snapshot_id',
    ];

    public function latestNosisSnapshot()
    {
        return $this->belongsTo(NosisSnapshot::class, 'latest_nosis_snapshot_id');
    }
}
