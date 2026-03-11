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
        'fiscal_address_street',
        'fiscal_address_number',
        'fiscal_address_floor',
        'fiscal_address_unit',
        'fiscal_address_locality',
        'fiscal_address_postal_code',
        'fiscal_address_province',
        'activity_main_code',
        'activity_main_description',
        'activity_main_sector',
        'activity_main_started_at',
        'activities',
        'afip_key_status',
        'afip_key_status_at',
        'iva_inscripto',
        'iva_exento_retencion',
        'iva_registered_at',
        'iva_condition',
        'ganancias_inscripto',
        'ganancias_exento_retencion',
        'ganancias_registered_at',
        'ganancias_condition',
        'monotributo_inscripto',
        'monotributo_registered_at',
        'monotributo_category',
        'monotributo_type',
        'monotributo_activity',
        'monotributo_seniority_months',
        'is_employee',
        'is_employer',
        'is_retired',
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

    protected $casts = [
        'activity_main_started_at' => 'date',
        'activities' => 'array',
        'afip_key_status_at' => 'date',
        'iva_registered_at' => 'date',
        'ganancias_registered_at' => 'date',
        'monotributo_registered_at' => 'date',
        'iva_inscripto' => 'boolean',
        'iva_exento_retencion' => 'boolean',
        'ganancias_inscripto' => 'boolean',
        'ganancias_exento_retencion' => 'boolean',
        'monotributo_inscripto' => 'boolean',
        'is_employee' => 'boolean',
        'is_employer' => 'boolean',
        'is_retired' => 'boolean',
    ];

    public function latestNosisSnapshot()
    {
        return $this->belongsTo(NosisSnapshot::class, 'latest_nosis_snapshot_id');
    }
}
