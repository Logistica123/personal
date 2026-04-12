<?php

namespace App\Support\Liq;

use App\Models\LiqLiquidacionDistribuidor;
use Illuminate\Support\Carbon;

class LiqV2DocumentoHelper
{
    public static function disk(): string
    {
        return 'public';
    }

    public static function directoryForPersona(int $personaId): string
    {
        return "personal/{$personaId}/liq_v2";
    }

    public static function periodString(?string $value): string
    {
        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return substr((string) $value, 0, 10) ?: now()->toDateString();
        }
    }

    public static function buildFilename(LiqLiquidacionDistribuidor $liquidacionDistribuidor): string
    {
        $liquidacionDistribuidor->loadMissing(['distribuidor:id,apellidos,nombres', 'liquidacionCliente:id,cliente_id']);

        $dist = $liquidacionDistribuidor->distribuidor;
        $desde = Carbon::parse(self::periodString($liquidacionDistribuidor->periodo_desde?->toDateString() ?? (string) $liquidacionDistribuidor->periodo_desde));

        // Intentar obtener sucursal de las operaciones
        $sucursal = \App\Models\LiqOperacion::where('liquidacion_cliente_id', $liquidacionDistribuidor->liquidacion_cliente_id)
            ->where('distribuidor_id', $liquidacionDistribuidor->distribuidor_id)
            ->whereNotNull('sucursal_tarifa')
            ->value('sucursal_tarifa');

        if ($dist && $sucursal) {
            // Naming SPEC: {SUC}_{APELLIDONOMBRE}_{Q}{MM}{YY}.pdf
            $nombre = strtoupper(preg_replace('/[^A-Z0-9]/i', '', ($dist->apellidos ?? '') . ($dist->nombres ?? '')));
            $q = $desde->day <= 15 ? '1' : '2';
            $mm = $desde->format('m');
            $yy = $desde->format('y');
            return "{$sucursal}_{$nombre}_{$q}Q{$mm}{$yy}.pdf";
        }

        // Fallback al naming anterior
        $hasta = self::periodString($liquidacionDistribuidor->periodo_hasta?->toDateString() ?? (string) $liquidacionDistribuidor->periodo_hasta);
        return sprintf(
            'LIQ_EXTRACTOS_%d_%d_%s_%s.pdf',
            (int) $liquidacionDistribuidor->liquidacion_cliente_id,
            (int) $liquidacionDistribuidor->id,
            str_replace('-', '', $desde->toDateString()),
            str_replace('-', '', $hasta),
        );
    }

    public static function buildLegacyTxtFilename(LiqLiquidacionDistribuidor $liquidacionDistribuidor): string
    {
        $desde = self::periodString($liquidacionDistribuidor->periodo_desde?->toDateString() ?? (string) $liquidacionDistribuidor->periodo_desde);
        $hasta = self::periodString($liquidacionDistribuidor->periodo_hasta?->toDateString() ?? (string) $liquidacionDistribuidor->periodo_hasta);

        return sprintf(
            'LIQ_EXTRACTOS_%d_%d_%s_%s.txt',
            (int) $liquidacionDistribuidor->liquidacion_cliente_id,
            (int) $liquidacionDistribuidor->id,
            str_replace('-', '', $desde),
            str_replace('-', '', $hasta),
        );
    }

    public static function buildStoredPath(int $personaId, LiqLiquidacionDistribuidor $liquidacionDistribuidor): string
    {
        $directory = self::directoryForPersona($personaId);
        $filename = self::buildFilename($liquidacionDistribuidor);

        return $directory . '/' . $filename;
    }

    public static function buildLegacyTxtStoredPath(int $personaId, LiqLiquidacionDistribuidor $liquidacionDistribuidor): string
    {
        $directory = self::directoryForPersona($personaId);
        $filename = self::buildLegacyTxtFilename($liquidacionDistribuidor);

        return $directory . '/' . $filename;
    }
}
