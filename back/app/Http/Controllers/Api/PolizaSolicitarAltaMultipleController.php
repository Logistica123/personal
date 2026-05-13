<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use App\Models\Poliza;
use App\Models\PolizaAseguradora;
use App\Services\Polizas\SolicitudService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * ADDENDUM 15 Bloque 3.G — Wizard de alta múltiple precargado desde la
 * solicitud aprobada del CRM.
 *
 *   GET  /api/polizas/solicitar-alta-multiple/preparacion/{persona}
 *        → resuelve qué pólizas activar (AP + Vehículos) a partir del
 *          `solicitud_polizas_json` de la persona y devuelve el shape listo
 *          para que el wizard del frontend lo muestre.
 *
 *   POST /api/polizas/solicitar-alta-multiple/aprobar
 *        body: { persona_id, polizas: [{poliza_id, clausula_id?}, ...],
 *                importe_negociado_mensual? }
 *        → crea N solicitudes (1 por póliza) en `borrador` para que el admin
 *          las envíe (puede usar el wizard de envío existente).
 */
class PolizaSolicitarAltaMultipleController extends Controller
{
    public function __construct(private readonly SolicitudService $solicitudService)
    {
    }

    public function preparacion(Request $request, Persona $persona): JsonResponse
    {
        $solicitudJson = $persona->solicitud_polizas_json ?? [];

        $sugerencias = [];
        $aseguradoras = PolizaAseguradora::query()->get()->keyBy('id');

        // — AP —
        if (($solicitudJson['ap']['solicitar'] ?? false)) {
            $aseguradoraId = $solicitudJson['ap']['aseguradora_id'] ?? null;
            $polizasAp = Poliza::query()
                ->where('activa', true)
                ->where('tipo_asegurado', 'persona')
                ->when($aseguradoraId, fn ($q) => $q->where('aseguradora_id', $aseguradoraId))
                ->with('aseguradora:id,nombre')
                ->get();

            foreach ($polizasAp as $p) {
                $sugerencias[] = [
                    'ramo'               => 'accidentes_personales',
                    'poliza_id'          => $p->id,
                    'poliza_nombre'      => $p->nombre_descriptivo,
                    'aseguradora_id'     => $p->aseguradora_id,
                    'aseguradora_nombre' => $p->aseguradora?->nombre,
                    'clausula_id'        => $solicitudJson['ap']['clausula_id'] ?? null,
                    'importe_negociado_mensual' => null,
                    'recomendada'        => true,
                ];
            }
        }

        // — Vehículos —
        if (($solicitudJson['vehiculos']['solicitar'] ?? false)) {
            $aseguradoraId = $solicitudJson['vehiculos']['aseguradora_id'] ?? null;
            $tipo = $solicitudJson['vehiculos']['tipo'] ?? null;  // 'autos' | 'motos'
            $polizasVeh = Poliza::query()
                ->where('activa', true)
                ->where('tipo_asegurado', 'vehiculo')
                ->when($aseguradoraId, fn ($q) => $q->where('aseguradora_id', $aseguradoraId))
                ->when($tipo, fn ($q) => $q->where(function ($qq) use ($tipo) {
                    // Heurística: el nombre suele contener 'Autos' o 'Motos'.
                    $qq->where('nombre_descriptivo', 'LIKE', '%' . ucfirst($tipo) . '%');
                }))
                ->with('aseguradora:id,nombre')
                ->get();

            foreach ($polizasVeh as $p) {
                $sugerencias[] = [
                    'ramo'               => 'vehiculos',
                    'poliza_id'          => $p->id,
                    'poliza_nombre'      => $p->nombre_descriptivo,
                    'aseguradora_id'     => $p->aseguradora_id,
                    'aseguradora_nombre' => $p->aseguradora?->nombre,
                    'tipo_vehiculo'      => $tipo,
                    'patente'            => $solicitudJson['vehiculos']['patente']
                        ?? $persona->patente,
                    'clausula_id'        => $solicitudJson['vehiculos']['clausula_id'] ?? null,
                    'importe_negociado_mensual' => $solicitudJson['vehiculos']['importe_negociado_mensual'] ?? null,
                    'recomendada'        => true,
                ];
            }
        }

        return response()->json(['data' => [
            'persona' => [
                'id'         => $persona->id,
                'nombre'     => trim(($persona->apellidos ?? '') . ', ' . ($persona->nombres ?? '')),
                'cuil'       => $persona->cuil,
                'patente'    => $persona->patente,
                'aprobado'   => (bool) $persona->aprobado,
            ],
            'sugerencias'       => $sugerencias,
            'solicitud_polizas' => $solicitudJson,
            'choferes'          => $persona->solicitud_choferes_json ?? [],
        ]]);
    }

    public function aprobar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'persona_id'                   => ['required', 'integer', 'exists:personas,id'],
            'polizas'                      => ['required', 'array', 'min:1'],
            'polizas.*.poliza_id'          => ['required', 'integer', 'exists:polizas,id'],
            'polizas.*.clausula_id'        => ['nullable', 'integer', 'exists:polizas_clausulas,id'],
            'polizas.*.importe_negociado_mensual' => ['nullable', 'numeric', 'min:0'],
        ]);

        $persona = Persona::findOrFail($data['persona_id']);
        $admin = $request->user();
        $solicitudesCreadas = [];

        foreach ($data['polizas'] as $sel) {
            try {
                $poliza = Poliza::findOrFail($sel['poliza_id']);

                $opciones = [
                    'persona_ids' => [$persona->id],
                ];
                if (!empty($sel['clausula_id'])) {
                    $opciones['tipo_clausula_global'] = 'global';
                    $opciones['clausula_global_id']   = $sel['clausula_id'];
                }

                $solicitud = $this->solicitudService->crearBorrador(
                    poliza:       $poliza,
                    tipo:         'alta',
                    aseguradoIds: [],
                    admin:        $admin,
                    opciones:     $opciones,
                );

                $solicitudesCreadas[] = [
                    'solicitud_id'  => $solicitud->id,
                    'poliza_id'     => $poliza->id,
                    'poliza_nombre' => $poliza->nombre_descriptivo,
                    'importe_negociado_mensual' => $sel['importe_negociado_mensual'] ?? null,
                ];
            } catch (\Throwable $e) {
                Log::warning("SolicitarAltaMultiple.aprobar falló para poliza={$sel['poliza_id']}: " . $e->getMessage());
                $solicitudesCreadas[] = [
                    'poliza_id' => $sel['poliza_id'],
                    'ok'        => false,
                    'error'     => mb_substr($e->getMessage(), 0, 500),
                ];
            }
        }

        return response()->json(['data' => [
            'persona_id'           => $persona->id,
            'solicitudes_creadas'  => $solicitudesCreadas,
        ]], 201);
    }
}
