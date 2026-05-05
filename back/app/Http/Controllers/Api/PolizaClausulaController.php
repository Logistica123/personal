<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\PolizaClausula;
use App\Models\PolizaClausulaAplicada;
use App\Services\Polizas\ClausulaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolizaClausulaController extends Controller
{
    public function __construct(private readonly ClausulaService $service)
    {
    }

    /** Listar catálogo de cláusulas. */
    public function index(Request $request): JsonResponse
    {
        $query = PolizaClausula::query()
            ->with('cliente:id,nombre')
            ->orderBy('nombre_corto');

        if ($request->boolean('activas_solo')) {
            $query->where('activa', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre_corto'          => ['required', 'string', 'max:100'],
            'alias'                 => ['nullable', 'string', 'max:50'],
            'cliente_id'            => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursal_id'           => ['nullable', 'integer', 'exists:sucursals,id'],
            'cuit_titular'          => ['required', 'string', 'max:15'],
            'razon_social_titular'  => ['required', 'string', 'max:150'],
            'tipo'                  => ['nullable', 'in:no_repeticion,subrogacion,otra'],
            'descripcion_corta'     => ['nullable', 'string', 'max:255'],
            'activa'                => ['nullable', 'boolean'],
            'notas'                 => ['nullable', 'string'],
        ]);
        $clausula = $this->service->crear($data);
        return response()->json(['data' => $clausula], 201);
    }

    public function update(Request $request, PolizaClausula $clausula): JsonResponse
    {
        $data = $request->validate([
            'nombre_corto'          => ['nullable', 'string', 'max:100'],
            'alias'                 => ['nullable', 'string', 'max:50'],
            'cliente_id'            => ['nullable', 'integer', 'exists:clientes,id'],
            'sucursal_id'           => ['nullable', 'integer', 'exists:sucursals,id'],
            'cuit_titular'          => ['nullable', 'string', 'max:15'],
            'razon_social_titular'  => ['nullable', 'string', 'max:150'],
            'tipo'                  => ['nullable', 'in:no_repeticion,subrogacion,otra'],
            'descripcion_corta'     => ['nullable', 'string', 'max:255'],
            'activa'                => ['nullable', 'boolean'],
            'notas'                 => ['nullable', 'string'],
        ]);
        $clausula = $this->service->actualizar($clausula, $data);
        return response()->json(['data' => $clausula]);
    }

    /** Cláusulas vigentes en una póliza (aplicada_hasta IS NULL). */
    public function vigentesPorPoliza(Poliza $poliza): JsonResponse
    {
        $aplicadas = PolizaClausulaAplicada::query()
            ->where('poliza_id', $poliza->id)
            ->whereNull('aplicada_hasta')
            ->with('clausula')
            ->orderByDesc('aplicada_desde')
            ->get();

        return response()->json(['data' => $aplicadas]);
    }

    /** Aplicar cláusula a una póliza. */
    public function aplicar(Request $request, Poliza $poliza): JsonResponse
    {
        $data = $request->validate([
            'clausula_id'      => ['required', 'integer', 'exists:polizas_clausulas,id'],
            'aplicada_desde'   => ['required', 'date'],
            'tipo_aplicacion'  => ['nullable', 'in:global,individual'],
        ]);

        $aplicacion = $this->service->aplicar(
            $poliza,
            $data['clausula_id'],
            $data['aplicada_desde'],
            $data['tipo_aplicacion'] ?? 'global'
        );
        return response()->json(['data' => $aplicacion->load('clausula')], 201);
    }

    /** Marcar una cláusula aplicada como removida (registra aplicada_hasta). */
    public function remover(Request $request, PolizaClausulaAplicada $aplicacion): JsonResponse
    {
        $data = $request->validate([
            'aplicada_hasta' => ['required', 'date'],
        ]);
        $aplicacion = $this->service->remover($aplicacion, $data['aplicada_hasta']);
        return response()->json(['data' => $aplicacion]);
    }
}
