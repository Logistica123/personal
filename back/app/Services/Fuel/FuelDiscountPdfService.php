<?php

namespace App\Services\Fuel;

use App\Models\Archivo;
use App\Models\FuelReport;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Carbon;

class FuelDiscountPdfService
{
    public function renderPdf(Archivo $liquidacion, FuelReport $report, string $label): string
    {
        $liquidacion->loadMissing([
            'persona:id,apellidos,nombres,cuil,patente,cliente_id',
            'persona.cliente:id,nombre',
        ]);

        $persona = $liquidacion->persona;
        $clienteNombre = null;
        if ($persona && $persona->cliente) {
            $clienteNombre = $persona->cliente->nombre ?? null;
        }

        $logoDataUri = $this->loadLogoDataUri();
        $generatedAt = Carbon::now()->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->format('d/m/Y H:i');

        $items = [];
        foreach ($report->items as $item) {
            $movement = $item->movement;
            $date = $movement?->occurred_at
                ? $movement->occurred_at->timezone(config('app.timezone', 'America/Argentina/Buenos_Aires'))->format('d/m/Y')
                : null;
            $items[] = [
                'date' => $date,
                'station' => $movement?->station,
                'product' => $movement?->product,
                'liters' => $item->liters,
                'amount' => $item->amount,
            ];
        }

        $personaNombre = $persona ? trim(($persona->apellidos ?? '').' '.($persona->nombres ?? '')) : null;

        $html = view('combustible.descuento_combustible', [
            'logoDataUri' => $logoDataUri,
            'clienteNombre' => $clienteNombre,
            'reportId' => (int) $report->id,
            'liquidacionId' => (int) ($liquidacion->id ?? 0),
            'periodFrom' => $report->period_from,
            'periodTo' => $report->period_to,
            'generatedAt' => $generatedAt,
            'personaNombre' => $personaNombre,
            'personaCuil' => $persona?->cuil,
            'personaPatente' => $persona?->patente,
            'items' => $items,
            'totalAmount' => (float) $report->total_amount,
            'adjustmentsTotal' => (float) $report->adjustments_total,
            'totalDiscount' => (float) $report->total_to_bill * -1,
            'label' => $label,
        ])->render();

        $options = new Options();
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('isRemoteEnabled', false);
        $options->set('isHtml5ParserEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();

        return $dompdf->output();
    }

    private function loadLogoDataUri(): ?string
    {
        $path = public_path('logo-empresa.png');
        if (! is_string($path) || ! file_exists($path)) {
            return null;
        }

        $bin = file_get_contents($path);
        if ($bin === false || $bin === '') {
            return null;
        }

        return 'data:image/png;base64,' . base64_encode($bin);
    }
}
