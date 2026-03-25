<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\MembresiaCuota;
use App\Models\MembresiaBeneficioUso;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class MembresiaController extends Controller
{
    public function show(Request $request, Persona $persona): JsonResponse
    {
        $membresiaDesde = $persona->membresia_desde;

        $cuotas = MembresiaCuota::where('persona_id', $persona->id)
            ->orderBy('periodo', 'desc')
            ->get()
            ->keyBy('periodo');

        $generatedCuotas = [];

        if ($membresiaDesde) {
            $start = Carbon::parse($membresiaDesde)->startOfMonth();
            $current = Carbon::now()->startOfMonth();

            $mesesActivos = (int) $start->diffInMonths($current) + 1;

            $cursor = $current->copy();
            while ($cursor->gte($start)) {
                $periodo = $cursor->format('Y-m');
                if ($cuotas->has($periodo)) {
                    $cuota = $cuotas->get($periodo);
                    $generatedCuotas[] = [
                        'id' => $cuota->id,
                        'periodo' => $cuota->periodo,
                        'monto' => $cuota->monto,
                        'pagado' => (bool) $cuota->pagado,
                        'fechaPago' => $cuota->fecha_pago ? Carbon::parse($cuota->fecha_pago)->format('Y-m-d') : null,
                        'observaciones' => $cuota->observaciones,
                    ];
                } else {
                    $generatedCuotas[] = [
                        'id' => null,
                        'periodo' => $periodo,
                        'monto' => null,
                        'pagado' => false,
                        'fechaPago' => null,
                        'observaciones' => null,
                    ];
                }
                $cursor->subMonth();
            }
        } else {
            $mesesActivos = 0;
        }

        $beneficioUsos = MembresiaBeneficioUso::where('persona_id', $persona->id)
            ->orderBy('fecha_uso', 'desc')
            ->get()
            ->map(fn ($uso) => [
                'id' => $uso->id,
                'tramo' => $uso->tramo,
                'beneficioKey' => $uso->beneficio_key,
                'beneficioLabel' => $uso->beneficio_label,
                'fechaUso' => Carbon::parse($uso->fecha_uso)->format('Y-m-d'),
                'observaciones' => $uso->observaciones,
            ]);

        $nombreCompleto = trim(($persona->apellidos ?? '') . ', ' . ($persona->nombres ?? ''));

        return response()->json([
            'persona' => [
                'id' => $persona->id,
                'nombre' => $nombreCompleto,
                'membresiaDesde' => $membresiaDesde ? Carbon::parse($membresiaDesde)->format('Y-m-d') : null,
                'mesesActivos' => $mesesActivos,
            ],
            'cuotas' => $generatedCuotas,
            'beneficioUsos' => $beneficioUsos,
        ]);
    }

    public function storeCuota(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'periodo' => 'required|string|max:7',
            'monto' => 'nullable|numeric',
            'pagado' => 'boolean',
            'fecha_pago' => 'nullable|date',
            'observaciones' => 'nullable|string',
        ]);

        $cuota = MembresiaCuota::updateOrCreate(
            ['persona_id' => $persona->id, 'periodo' => $validated['periodo']],
            [
                'monto' => $validated['monto'] ?? null,
                'pagado' => $validated['pagado'] ?? false,
                'fecha_pago' => $validated['fecha_pago'] ?? null,
                'observaciones' => $validated['observaciones'] ?? null,
            ]
        );

        return response()->json([
            'id' => $cuota->id,
            'periodo' => $cuota->periodo,
            'monto' => $cuota->monto,
            'pagado' => (bool) $cuota->pagado,
            'fechaPago' => $cuota->fecha_pago ? Carbon::parse($cuota->fecha_pago)->format('Y-m-d') : null,
            'observaciones' => $cuota->observaciones,
        ]);
    }

    public function storeBeneficioUso(Request $request, Persona $persona): JsonResponse
    {
        $validated = $request->validate([
            'tramo' => 'required|in:mes_1,mes_3,mes_6,mes_12',
            'beneficio_key' => 'required|string|max:255',
            'beneficio_label' => 'required|string|max:255',
            'fecha_uso' => 'required|date',
            'observaciones' => 'nullable|string',
        ]);

        $uso = MembresiaBeneficioUso::create([
            'persona_id' => $persona->id,
            'tramo' => $validated['tramo'],
            'beneficio_key' => $validated['beneficio_key'],
            'beneficio_label' => $validated['beneficio_label'],
            'fecha_uso' => $validated['fecha_uso'],
            'observaciones' => $validated['observaciones'] ?? null,
        ]);

        return response()->json([
            'id' => $uso->id,
            'tramo' => $uso->tramo,
            'beneficioKey' => $uso->beneficio_key,
            'beneficioLabel' => $uso->beneficio_label,
            'fechaUso' => Carbon::parse($uso->fecha_uso)->format('Y-m-d'),
            'observaciones' => $uso->observaciones,
        ], 201);
    }

    public function destroyBeneficioUso(Request $request, Persona $persona, MembresiaBeneficioUso $uso): JsonResponse
    {
        if ((int) $uso->persona_id !== (int) $persona->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $uso->delete();

        return response()->json(['message' => 'Eliminado correctamente.']);
    }
}
