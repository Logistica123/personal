<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LiqEsquemaTarifario extends Model
{
    protected $table = 'liq_esquemas_tarifarios';

    protected $fillable = [
        'cliente_id',
        'nombre',
        'descripcion',
        'dimensiones',
        'activo',
    ];

    protected function casts(): array
    {
        return [
            'dimensiones' => 'array',
            'activo'      => 'boolean',
        ];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(LiqCliente::class, 'cliente_id');
    }

    public function dimensionValores(): HasMany
    {
        return $this->hasMany(LiqDimensionValor::class, 'esquema_id');
    }

    public function lineas(): HasMany
    {
        return $this->hasMany(LiqLineaTarifa::class, 'esquema_id');
    }

    /**
     * Devuelve los valores activos agrupados por nombre de dimensión.
     *
     * @return array<string, LiqDimensionValor[]>
     */
    public function valoresPorDimension(): array
    {
        return $this->dimensionValores()
            ->where('activo', true)
            ->orderBy('orden_display')
            ->get()
            ->groupBy('nombre_dimension')
            ->toArray();
    }

    /**
     * Busca la línea de tarifa activa que coincide exactamente con las dimensiones
     * proporcionadas, dentro de la vigencia de la fecha indicada.
     *
     * @param array<string, string> $dimensionesValores
     */
    public function buscarLinea(array $dimensionesValores, string $fecha): ?LiqLineaTarifa
    {
        return $this->lineas()
            ->where('activo', true)
            ->where('aprobado_por', '!=', null)
            ->where('vigencia_desde', '<=', $fecha)
            ->where(fn ($q) => $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha))
            ->get()
            ->first(function (LiqLineaTarifa $linea) use ($dimensionesValores) {
                foreach ($dimensionesValores as $dim => $valor) {
                    if (($linea->dimensiones_valores[$dim] ?? null) !== $valor) {
                        return false;
                    }
                }

                return true;
            });
    }
}
