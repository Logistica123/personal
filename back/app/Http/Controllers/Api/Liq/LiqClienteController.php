<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\LiqCliente;
use App\Models\LiqEsquemaTarifario;
use App\Models\LiqDimensionValor;
use App\Models\LiqLineaTarifa;
use App\Models\LiqMapeoConcepto;
use App\Models\LiqMapeoSucursal;
use App\Models\LiqConfiguracionGastos;
use App\Models\LiqAuditoriaTarifa;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class LiqClienteController extends Controller
{
    // GET /liq/clientes - list clients that have liq_activo = true, include esquema count
    public function index(Request $request): JsonResponse
    {
        if (!Schema::hasTable('liq_clientes')) {
            return response()->json([
                'message' => 'Faltan migraciones del módulo de liquidaciones (tabla liq_clientes). Ejecutá `php artisan migrate --force` en el servidor.',
            ], 500);
        }

        $query = LiqCliente::where('activo', true)
            ->orderBy('nombre_corto');

        // Si todavía no existe la tabla de esquemas, devolvemos sin conteo (graceful).
        if (Schema::hasTable('liq_esquemas_tarifarios')) {
            $query->withCount('esquemas');
        }

        try {
            $clientes = $query->get(['id', 'distriapp_cliente_id', 'razon_social', 'nombre_corto', 'cuit', 'activo', 'configuracion_excel']);
            return response()->json(['data' => $clientes]);
        } catch (QueryException $e) {
            return response()->json([
                'message' => 'Error consultando clientes de liquidaciones. Probable migración pendiente o base inconsistente.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // POST /liq/clientes - create/enable a liq client linked to Cliente base
    public function store(Request $request): JsonResponse
    {
        if (!Schema::hasTable('liq_clientes')) {
            return response()->json([
                'message' => 'Faltan migraciones del módulo de liquidaciones (tabla liq_clientes). Ejecutá `php artisan migrate --force` en el servidor.',
            ], 500);
        }

        $data = $request->validate([
            'distriapp_cliente_id' => 'required|exists:clientes,id',
            'razon_social' => 'sometimes|string|max:255',
            'nombre_corto' => 'sometimes|string|max:80',
            'codigo_corto' => 'nullable|string|max:3',
            'cuit' => 'nullable|string|max:20',
            'configuracion_excel' => 'nullable|array',
        ]);

        $clienteBase = Cliente::findOrFail($data['distriapp_cliente_id']);
        $liqCliente = LiqCliente::updateOrCreate(
            ['distriapp_cliente_id' => $clienteBase->id],
            [
                'razon_social' => $data['razon_social'] ?? $clienteBase->nombre,
                'nombre_corto' => $data['nombre_corto'] ?? ($clienteBase->codigo ?: $clienteBase->nombre),
                'codigo_corto' => $data['codigo_corto'] ?? null,
                'cuit' => $data['cuit'] ?? $clienteBase->documento_fiscal,
                'activo' => true,
                'configuracion_excel' => $data['configuracion_excel'] ?? null,
            ]
        );

        return response()->json(['data' => $liqCliente, 'message' => 'Cliente habilitado para liquidaciones'], 201);
    }

    // PATCH /liq/clientes/{cliente} - update liq config
    public function update(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'razon_social' => 'sometimes|string|max:255',
            'nombre_corto' => 'sometimes|string|max:80',
            'codigo_corto' => 'sometimes|nullable|string|max:3',
            'cuit' => 'sometimes|nullable|string|max:20',
            'configuracion_excel' => 'sometimes|nullable|array',
            'activo' => 'sometimes|boolean',
        ]);
        $cliente->update($data);
        return response()->json(['data' => $cliente, 'message' => 'Configuración actualizada']);
    }

    // GET /liq/clientes/{cliente}/esquemas - list tariff schemes for client
    public function esquemas(LiqCliente $cliente): JsonResponse
    {
        $esquemas = LiqEsquemaTarifario::where('cliente_id', $cliente->id)
            ->withCount(['dimensionValores', 'lineasTarifa'])
            ->orderBy('activo', 'desc')
            ->latest()
            ->get();
        return response()->json(['data' => $esquemas]);
    }

    // POST /liq/clientes/{cliente}/esquemas - create tariff scheme
    public function storeEsquema(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'dimensiones' => 'required|array|min:1',
            'dimensiones.*' => 'string|max:80',
        ]);

        // Mantener un solo esquema activo por cliente (histórico queda inactivo)
        LiqEsquemaTarifario::where('cliente_id', $cliente->id)->where('activo', true)->update(['activo' => false]);

        $esquema = LiqEsquemaTarifario::create([
            'cliente_id' => $cliente->id,
            'nombre' => $data['nombre'],
            'descripcion' => $data['descripcion'] ?? null,
            'dimensiones' => $data['dimensiones'],
            'activo' => true,
        ]);
        return response()->json(['data' => $esquema, 'message' => 'Esquema creado'], 201);
    }

    // GET /liq/clientes/{cliente}/mapeos-concepto
    public function mapeosConcepto(LiqCliente $cliente): JsonResponse
    {
        $mapeos = LiqMapeoConcepto::where('cliente_id', $cliente->id)->orderBy('valor_excel')->get();
        return response()->json(['data' => $mapeos]);
    }

    // POST /liq/clientes/{cliente}/mapeos-concepto - bulk upsert
    public function storeMapeosConcepto(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'mapeos' => 'required|array',
            'mapeos.*.valor_excel' => 'required|string|max:200',
            'mapeos.*.dimension_destino' => 'required|string|max:80',
            'mapeos.*.valor_tarifa' => 'required|string|max:150',
        ]);
        $created = [];
        foreach ($data['mapeos'] as $m) {
            $created[] = LiqMapeoConcepto::updateOrCreate(
                ['cliente_id' => $cliente->id, 'valor_excel' => $m['valor_excel'], 'dimension_destino' => $m['dimension_destino']],
                ['valor_tarifa' => $m['valor_tarifa'], 'activo' => true]
            );
        }
        return response()->json(['data' => $created, 'message' => count($created) . ' mapeos guardados'], 201);
    }

    // PUT /liq/mapeos-concepto/{id}/desactivar
    public function desactivarMapeoConcepto(Request $request, int $id): JsonResponse
    {
        $mapeo = LiqMapeoConcepto::findOrFail($id);
        $mapeo->update(['activo' => false]);
        return response()->json(['message' => 'Mapeo desactivado']);
    }

    // GET /liq/clientes/{cliente}/mapeos-sucursal
    public function mapeosSucursal(LiqCliente $cliente): JsonResponse
    {
        $mapeos = LiqMapeoSucursal::where('cliente_id', $cliente->id)->orderBy('patron_archivo')->get();
        return response()->json(['data' => $mapeos]);
    }

    // POST /liq/clientes/{cliente}/mapeos-sucursal - bulk upsert
    public function storeMapeosSucursal(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'mapeos' => 'required|array',
            'mapeos.*.patron_archivo' => 'required|string|max:200',
            'mapeos.*.sucursal_tarifa' => 'required|string|max:150',
            'mapeos.*.tipo_operacion' => 'nullable|string|max:80',
        ]);
        $created = [];
        foreach ($data['mapeos'] as $m) {
            $created[] = LiqMapeoSucursal::updateOrCreate(
                ['cliente_id' => $cliente->id, 'patron_archivo' => $m['patron_archivo']],
                ['sucursal_tarifa' => $m['sucursal_tarifa'], 'tipo_operacion' => $m['tipo_operacion'] ?? null, 'activo' => true]
            );
        }
        return response()->json(['data' => $created, 'message' => count($created) . ' mapeos guardados'], 201);
    }

    // PUT /liq/mapeos-sucursal/{id}/desactivar
    public function desactivarMapeoSucursal(Request $request, int $id): JsonResponse
    {
        $mapeo = LiqMapeoSucursal::findOrFail($id);
        $mapeo->update(['activo' => false]);
        return response()->json(['message' => 'Mapeo desactivado']);
    }

    // GET /liq/clientes/{cliente}/gastos
    public function gastos(LiqCliente $cliente): JsonResponse
    {
        $gastos = LiqConfiguracionGastos::where('cliente_id', $cliente->id)->orderBy('vigencia_desde', 'desc')->get();
        return response()->json(['data' => $gastos]);
    }

    // POST /liq/clientes/{cliente}/gastos
    public function storeGastos(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'concepto_gasto' => 'required|string|max:150',
            'monto' => 'required|numeric|min:0',
            'tipo' => 'required|in:fijo,porcentual',
            'vigencia_desde' => 'required|date',
            'vigencia_hasta' => 'nullable|date|after_or_equal:vigencia_desde',
        ]);
        // Deactivate previous open-ended config for same concept
        LiqConfiguracionGastos::where('cliente_id', $cliente->id)
            ->where('concepto_gasto', $data['concepto_gasto'])
            ->whereNull('vigencia_hasta')
            ->where('activo', true)
            ->update(['activo' => false]);
        $gasto = LiqConfiguracionGastos::create(array_merge($data, ['cliente_id' => $cliente->id, 'activo' => true]));
        return response()->json(['data' => $gasto, 'message' => 'Configuración de gastos guardada'], 201);
    }

    // GET /liq/clientes/{cliente}/tarifa?vigencia=YYYY-MM-DD
    public function tarifaVigente(Request $request, LiqCliente $cliente): JsonResponse
    {
        $fecha = $request->input('vigencia') ? Carbon::parse((string) $request->input('vigencia')) : Carbon::today();

        $esquema = LiqEsquemaTarifario::where('cliente_id', $cliente->id)
            ->where('activo', true)
            ->latest()
            ->first();
        if (!$esquema) {
            return response()->json(['error' => 'El cliente no tiene un esquema tarifario activo'], 404);
        }

        $lineas = LiqLineaTarifa::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->whereNotNull('aprobado_por')
            ->where('vigencia_desde', '<=', $fecha->toDateString())
            ->where(function ($q) use ($fecha) {
                $q->whereNull('vigencia_hasta')->orWhere('vigencia_hasta', '>=', $fecha->toDateString());
            })
            ->orderBy('vigencia_desde', 'desc')
            ->get();

        $dimensionesCatalogo = LiqDimensionValor::where('esquema_id', $esquema->id)
            ->where('activo', true)
            ->orderBy('nombre_dimension')
            ->orderBy('orden_display')
            ->get()
            ->groupBy('nombre_dimension')
            ->map(fn($items) => $items->values());

        return response()->json([
            'data' => [
                'cliente' => $cliente->only(['id', 'distriapp_cliente_id', 'razon_social', 'nombre_corto', 'cuit']),
                'fecha' => $fecha->toDateString(),
                'esquema' => $esquema,
                'dimensiones' => $dimensionesCatalogo,
                'lineas' => $lineas,
            ],
        ]);
    }

    // GET /liq/clientes/{cliente}/tarifa/historial
    public function tarifaHistorial(Request $request, LiqCliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'accion' => 'sometimes|in:creacion,modificacion,desactivacion,aprobacion',
            'desde' => 'sometimes|date',
            'hasta' => 'sometimes|date|after_or_equal:desde',
        ]);

        $query = LiqAuditoriaTarifa::query()
            ->with([
                'usuario:id,name,email',
                'lineaTarifa:id,esquema_id,dimensiones_valores,precio_original,porcentaje_agencia,precio_distribuidor,vigencia_desde,vigencia_hasta,creado_por,aprobado_por,fecha_aprobacion,activo',
                'lineaTarifa.esquema:id,cliente_id,nombre,dimensiones,activo',
            ])
            ->whereHas('lineaTarifa.esquema', function ($q) use ($cliente) {
                $q->where('cliente_id', $cliente->id);
            })
            ->orderByDesc('id');

        if (!empty($data['accion'])) {
            $query->where('accion', $data['accion']);
        }
        if (!empty($data['desde'])) {
            $query->where('created_at', '>=', Carbon::parse($data['desde'])->startOfDay());
        }
        if (!empty($data['hasta'])) {
            $query->where('created_at', '<=', Carbon::parse($data['hasta'])->endOfDay());
        }

        $historial = $query->paginate(50);
        return response()->json(['data' => $historial]);
    }
}
