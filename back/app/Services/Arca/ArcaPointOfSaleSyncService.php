<?php

namespace App\Services\Arca;

use App\Models\ArcaCertificado;
use App\Models\ArcaEmisor;
use App\Models\ArcaPuntoVenta;
use App\Services\Arca\Wsfe\WsfeClient;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ArcaPointOfSaleSyncService
{
    public function __construct(private readonly WsfeClient $wsfeClient)
    {
    }

    /**
     * @return Collection<int,ArcaPuntoVenta>
     */
    public function sync(ArcaEmisor $emisor, ArcaCertificado $certificado): Collection
    {
        $response = $this->wsfeClient->paramGetPtosVenta($certificado);
        $points = collect($response['points'] ?? []);

        DB::transaction(function () use ($points, $emisor, $certificado) {
            $points->each(function ($row) use ($emisor, $certificado) {
                $numero = (int) data_get($row, 'Nro');
                if ($numero <= 0) {
                    return;
                }

                $fchBajaRaw = data_get($row, 'FchBaja');
                if (is_string($fchBajaRaw)) {
                    $trimmed = trim($fchBajaRaw);
                    if ($trimmed === '' || strtoupper($trimmed) === 'NULL' || $trimmed === '0000-00-00') {
                        $fchBajaRaw = null;
                    }
                }

                ArcaPuntoVenta::query()->updateOrCreate(
                    [
                        'emisor_id' => $emisor->id,
                        'ambiente' => $certificado->ambiente?->value ?? (string) $certificado->ambiente,
                        'nro' => $numero,
                    ],
                    [
                        'sistema_arca' => (string) (data_get($row, 'EmisionTipo') ?: data_get($row, 'Sistema') ?: 'RECE'),
                        'emision_tipo' => (string) (data_get($row, 'EmisionTipo') ?: ''),
                        'bloqueado' => (bool) data_get($row, 'Bloqueado', false),
                        'fch_baja' => $fchBajaRaw ?: null,
                        'habilitado_para_erp' => $numero === 11 ? true : (bool) data_get($row, 'Bloqueado', false) === false,
                    ]
                );
            });
        });

        return ArcaPuntoVenta::query()
            ->where('emisor_id', $emisor->id)
            ->where('ambiente', $certificado->ambiente?->value ?? (string) $certificado->ambiente)
            ->orderBy('nro')
            ->get();
    }
}
