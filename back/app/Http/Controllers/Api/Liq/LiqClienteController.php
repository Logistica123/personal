<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\LiqCliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiqClienteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize($request);

        $clientes = LiqCliente::query()
            ->when(! $request->boolean('todos'), fn ($q) => $q->where('activo', true))
            ->orderBy('nombre_corto')
            ->get();

        return response()->json(['data' => $clientes]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'razon_social' => ['required', 'string', 'max:255'],
            'nombre_corto' => ['required', 'string', 'max:80', 'unique:liq_clientes,nombre_corto'],
            'cuit'         => ['nullable', 'string', 'max:20'],
            'configuracion_excel' => ['nullable', 'array'],
        ]);

        $cliente = LiqCliente::query()->create($validated);

        return response()->json(['data' => $cliente], 201);
    }

    public function update(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'razon_social' => ['sometimes', 'string', 'max:255'],
            'nombre_corto' => ['sometimes', 'string', 'max:80', "unique:liq_clientes,nombre_corto,{$cliente->id}"],
            'cuit'         => ['nullable', 'string', 'max:20'],
            'activo'       => ['sometimes', 'boolean'],
            'configuracion_excel' => ['nullable', 'array'],
        ]);

        $cliente->update($validated);

        return response()->json(['data' => $cliente]);
    }

    // ── Esquemas tarifarios ───────────────────────────────────────────────

    public function esquemas(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $esquemas = $cliente->esquemas()
            ->orderByDesc('activo')
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $esquemas]);
    }

    public function storeEsquema(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'nombre'      => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'dimensiones' => ['required', 'array', 'min:1'],
            'dimensiones.*' => ['required', 'string', 'max:80'],
        ]);

        // Normalizar dimensiones a minúsculas
        $validated['dimensiones'] = array_map('strtolower', $validated['dimensiones']);

        $esquema = $cliente->esquemas()->create($validated);
        $esquema->load('cliente:id,nombre_corto');

        return response()->json(['data' => $esquema], 201);
    }

    // ── Mapeos de concepto ────────────────────────────────────────────────

    public function mapeosConcepto(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $mapeos = $cliente->mapeosConcepto()
            ->orderBy('valor_excel')
            ->get();

        return response()->json(['data' => $mapeos]);
    }

    public function storeMapeosConcepto(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'valor_excel'       => ['required', 'string', 'max:255'],
            'dimension_destino' => ['required', 'string', 'max:80'],
            'valor_tarifa'      => ['required', 'string', 'max:255'],
        ]);

        $valorExcel = trim($validated['valor_excel']);
        $dimensionDestino = strtolower(trim($validated['dimension_destino']));
        $valorTarifa = trim($validated['valor_tarifa']);

        $existing = $cliente->mapeosConcepto()
            ->where('valor_excel', $valorExcel)
            ->where('dimension_destino', $dimensionDestino)
            ->first();

        $mapeo = $cliente->mapeosConcepto()->updateOrCreate(
            [
                'valor_excel' => $valorExcel,
                'dimension_destino' => $dimensionDestino,
            ],
            [
                'valor_tarifa' => $valorTarifa,
                'activo' => true,
            ]
        );

        return response()->json(['data' => $mapeo], $existing ? 200 : 201);
    }

    // ── Mapeos de sucursal ────────────────────────────────────────────────

    public function mapeosSucursal(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $mapeos = $cliente->mapeosSucursal()
            ->orderBy('patron_archivo')
            ->get();

        return response()->json(['data' => $mapeos]);
    }

    public function storeMapeosSucursal(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'patron_archivo' => ['required', 'string', 'max:255'],
            'sucursal_tarifa'=> ['required', 'string', 'max:255'],
            'tipo_operacion' => ['nullable', 'string', 'max:255'],
        ]);

        $mapeo = $cliente->mapeosSucursal()->create($validated);

        return response()->json(['data' => $mapeo], 201);
    }

    // ── Gastos administrativos ────────────────────────────────────────────

    public function gastos(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $gastos = $cliente->configuracionGastos()
            ->orderByDesc('vigencia_desde')
            ->get();

        return response()->json(['data' => $gastos]);
    }

    public function storeGastos(Request $request, LiqCliente $cliente): JsonResponse
    {
        $this->authorize($request);

        $validated = $request->validate([
            'concepto_gasto' => ['required', 'string', 'max:255'],
            'monto'          => ['required', 'numeric', 'min:0'],
            'tipo'           => ['required', 'in:fijo,porcentual'],
            'vigencia_desde' => ['required', 'date'],
            'vigencia_hasta' => ['nullable', 'date', 'after:vigencia_desde'],
        ]);

        $gasto = $cliente->configuracionGastos()->create($validated);

        return response()->json(['data' => $gasto], 201);
    }

    // ── Autorización ──────────────────────────────────────────────────────

    private function authorize(Request $request): void
    {
        $user = $request->user();
        $role = strtolower(trim((string) ($user?->role ?? '')));
        $perms = is_array($user?->permissions) ? $user->permissions : [];

        $allowed = in_array($role, ['admin', 'admin2', 'encargado'], true)
            || in_array('liquidaciones', $perms, true);

        if (! $allowed) {
            abort(response()->json(['message' => 'Sin permisos para liquidaciones.'], 403));
        }
    }
}
