<?php

namespace App\Http\Controllers\Api\Liq;

use App\Http\Controllers\Controller;
use App\Models\Archivo;
use App\Models\LiqAjusteImporte;
use App\Models\LiqHistorialAuditoria;
use App\Models\LiqLiquidacionDistribuidor;
use App\Models\Persona;
use App\Support\Liq\LiqV2DocumentoHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiqDistribuidorLiquidacionesController extends Controller
{
    // GET /liq/distribuidores/{persona}/liquidaciones - lista liquidaciones generadas (v2) para un proveedor
    public function index(Request $request, Persona $persona): JsonResponse
    {
        $items = LiqLiquidacionDistribuidor::where('distribuidor_id', $persona->id)
            ->with([
                'liquidacionCliente:id,cliente_id,periodo_desde,periodo_hasta,estado',
                'liquidacionCliente.cliente:id,nombre_corto,razon_social',
            ])
            ->orderByDesc('periodo_desde')
            ->orderByDesc('id')
            ->get();

        $disk = LiqV2DocumentoHelper::disk();
        $paths = $items
            ->flatMap(function (LiqLiquidacionDistribuidor $item) use ($persona) {
                return [
                    LiqV2DocumentoHelper::buildStoredPath((int) $persona->id, $item),
                    LiqV2DocumentoHelper::buildLegacyTxtStoredPath((int) $persona->id, $item),
                ];
            })
            ->unique()
            ->values();

        $documentosByPath = Archivo::query()
            ->where('persona_id', (int) $persona->id)
            ->where('disk', $disk)
            ->whereIn('ruta', $paths->all())
            ->get(['id', 'ruta'])
            ->keyBy('ruta');

        $data = $items->map(function (LiqLiquidacionDistribuidor $item) use ($documentosByPath, $persona) {
            $pdfPath = LiqV2DocumentoHelper::buildStoredPath((int) $persona->id, $item);
            $legacyTxtPath = LiqV2DocumentoHelper::buildLegacyTxtStoredPath((int) $persona->id, $item);
            $doc = $documentosByPath->get($pdfPath) ?: $documentosByPath->get($legacyTxtPath);
            $docPath = $doc ? (string) $doc->ruta : $pdfPath;
            $isPdf = str_ends_with(strtolower($docPath), '.pdf');

            $payload = $item->toArray();
            $payload['documento_id'] = $doc ? (int) $doc->id : null;
            $payload['documento_preparado'] = (bool) $doc;
            $payload['documento_ruta'] = $docPath;
            $payload['documento_es_pdf'] = $doc ? $isPdf : false;

            return $payload;
        })->values();

        return response()->json(['data' => $data]);
    }

    /**
     * PUT /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/editar
     *
     * Edita importe, estado u observaciones de una liquidacion de distribuidor.
     * Registra auditoria con valores anteriores/nuevos y motivo obligatorio.
     */
    public function editar(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para editar liquidaciones.'], 403);
        }

        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json(['error' => 'Esta liquidacion ya fue pagada y no puede modificarse.'], 422);
        }

        $data = $request->validate([
            'total_a_pagar' => 'nullable|numeric|min:0',
            'subtotal' => 'nullable|numeric|min:0',
            'estado' => 'nullable|string|in:generada,aprobada,pagada,anulada',
            'observaciones' => 'nullable|string|max:1000',
            'motivo' => 'required|string|min:5|max:1000',
        ]);

        $anteriores = [];
        $nuevos = [];
        $cambios = false;

        // Edicion de importe
        if (isset($data['total_a_pagar']) && (float) $data['total_a_pagar'] !== (float) $liquidacionDistribuidor->total_a_pagar) {
            $anteriores['total_a_pagar'] = (float) $liquidacionDistribuidor->total_a_pagar;
            $nuevos['total_a_pagar'] = (float) $data['total_a_pagar'];
            $liquidacionDistribuidor->total_a_pagar = $data['total_a_pagar'];
            $cambios = true;
        }

        if (isset($data['subtotal']) && (float) $data['subtotal'] !== (float) $liquidacionDistribuidor->subtotal) {
            $anteriores['subtotal'] = (float) $liquidacionDistribuidor->subtotal;
            $nuevos['subtotal'] = (float) $data['subtotal'];
            $liquidacionDistribuidor->subtotal = $data['subtotal'];
            $cambios = true;
        }

        // Edicion de estado
        if (isset($data['estado']) && $data['estado'] !== $liquidacionDistribuidor->estado) {
            $anteriores['estado'] = $liquidacionDistribuidor->estado;
            $nuevos['estado'] = $data['estado'];
            $liquidacionDistribuidor->estado = $data['estado'];
            $cambios = true;
        }

        if (!$cambios) {
            return response()->json(['error' => 'No se detectaron cambios.'], 422);
        }

        $liquidacionDistribuidor->save();

        // Determinar accion de auditoria
        $accion = isset($nuevos['total_a_pagar']) || isset($nuevos['subtotal'])
            ? 'edicion_importe'
            : 'edicion_estado';

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            $accion,
            $anteriores,
            $nuevos,
            $data['motivo'],
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'data' => $liquidacionDistribuidor->fresh(),
            'message' => 'Liquidacion actualizada correctamente',
        ]);
    }

    /**
     * POST /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/marcar-factura-a
     *
     * Marca la liq como Factura A: snapshot del neto en importe_base, calcula IVA
     * y deja total_a_pagar = base + IVA. Si ya es 'A' devuelve 422.
     */
    public function marcarFacturaA(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para cambiar el tipo de comprobante.'], 403);
        }

        if ($liquidacionDistribuidor->tieneOrdenPagoActiva()) {
            return response()->json(['error' => 'La liquidacion esta incluida en una OP activa. Sacala de la OP primero.'], 422);
        }
        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json(['error' => 'La liquidacion ya fue pagada.'], 422);
        }
        if ($liquidacionDistribuidor->tipo_comprobante === 'A') {
            return response()->json(['error' => 'La liquidacion ya esta marcada como Factura A. Usa revertir para volver atras.'], 422);
        }

        $data = $request->validate([
            'iva_porcentaje' => 'required|numeric|in:21,10.5,0',
        ]);

        $pct = (float) $data['iva_porcentaje'];
        $base = round((float) $liquidacionDistribuidor->total_a_pagar, 2);
        $iva = round($base * ($pct / 100), 2);
        $totalNuevo = round($base + $iva, 2);

        $anteriores = [
            'tipo_comprobante' => $liquidacionDistribuidor->tipo_comprobante,
            'total_a_pagar'    => $base,
        ];
        $nuevos = [
            'tipo_comprobante' => 'A',
            'iva_porcentaje'   => $pct,
            'importe_base'     => $base,
            'importe_iva'      => $iva,
            'total_a_pagar'    => $totalNuevo,
        ];

        $liquidacionDistribuidor->update($nuevos);

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            'marcar_factura_a',
            $anteriores,
            $nuevos,
            "Marcada como Factura A (IVA {$pct}%)",
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'data'    => $liquidacionDistribuidor->fresh(),
            'message' => sprintf('Marcada como Factura A. IVA %s%% = $%s. Nuevo total $%s.',
                rtrim(rtrim(number_format($pct, 2, '.', ''), '0'), '.'),
                number_format($iva, 2, ',', '.'),
                number_format($totalNuevo, 2, ',', '.')
            ),
        ]);
    }

    /**
     * POST /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/revertir-factura-a
     *
     * Vuelve la liq al tipo 'C', restaurando total_a_pagar = importe_base.
     */
    public function revertirFacturaA(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para cambiar el tipo de comprobante.'], 403);
        }

        if ($liquidacionDistribuidor->tieneOrdenPagoActiva()) {
            return response()->json(['error' => 'La liquidacion esta incluida en una OP activa. Sacala de la OP primero.'], 422);
        }
        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json(['error' => 'La liquidacion ya fue pagada.'], 422);
        }
        if ($liquidacionDistribuidor->tipo_comprobante !== 'A' || $liquidacionDistribuidor->importe_base === null) {
            return response()->json(['error' => 'La liquidacion no esta marcada como Factura A.'], 422);
        }

        $anteriores = [
            'tipo_comprobante' => 'A',
            'iva_porcentaje'   => (float) $liquidacionDistribuidor->iva_porcentaje,
            'importe_iva'      => (float) $liquidacionDistribuidor->importe_iva,
            'total_a_pagar'    => (float) $liquidacionDistribuidor->total_a_pagar,
        ];
        $totalRestaurado = round((float) $liquidacionDistribuidor->importe_base, 2);
        $nuevos = [
            'tipo_comprobante' => 'C',
            'iva_porcentaje'   => null,
            'importe_iva'      => 0,
            'importe_base'     => null,
            'total_a_pagar'    => $totalRestaurado,
        ];

        $liquidacionDistribuidor->update($nuevos);

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            'revertir_factura_a',
            $anteriores,
            $nuevos,
            'Revertida Factura A',
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'data'    => $liquidacionDistribuidor->fresh(),
            'message' => 'Factura A revertida. Total restaurado: $' . number_format($totalRestaurado, 2, ',', '.'),
        ]);
    }

    /**
     * POST /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/cobrador-override
     *
     * Aplica un override de cobrador puntual para ESTA liquidacion (sin tocar la ficha
     * del distribuidor). El TXT ICBC va a usar nombre/CUIT/CBU del override.
     */
    public function aplicarCobradorOverride(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para cambiar el cobrador.'], 403);
        }
        if ($liquidacionDistribuidor->tieneOrdenPagoActiva()) {
            return response()->json(['error' => 'La liquidacion esta incluida en una OP activa. Sacala de la OP primero.'], 422);
        }
        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json(['error' => 'La liquidacion ya fue pagada.'], 422);
        }

        $data = $request->validate([
            'nombre'    => 'required|string|max:200',
            'cuit'      => 'required|string|max:20',
            'cbu'       => 'required|string|max:50',
            'alias_cbu' => 'nullable|string|max:50',
            'motivo'    => 'required|string|min:5|max:300',
        ]);

        $cbuDigits = preg_replace('/\D+/', '', (string) $data['cbu']);
        $cuitDigits = preg_replace('/\D+/', '', (string) $data['cuit']);
        if (strlen($cbuDigits) !== 22) {
            return response()->json(['error' => 'El CBU debe tener 22 digitos.'], 422);
        }
        if (strlen($cuitDigits) !== 11) {
            return response()->json(['error' => 'El CUIT debe tener 11 digitos.'], 422);
        }

        $anteriores = [
            'cobrador_override_nombre' => $liquidacionDistribuidor->cobrador_override_nombre,
            'cobrador_override_cuit'   => $liquidacionDistribuidor->cobrador_override_cuit,
            'cobrador_override_cbu'    => $liquidacionDistribuidor->cobrador_override_cbu,
            'cobrador_override_motivo' => $liquidacionDistribuidor->cobrador_override_motivo,
        ];
        $nuevos = [
            'cobrador_override_nombre'    => $data['nombre'],
            'cobrador_override_cuit'      => $cuitDigits,
            'cobrador_override_cbu'       => $cbuDigits,
            'cobrador_override_alias_cbu' => $data['alias_cbu'] ?? null,
            'cobrador_override_motivo'    => $data['motivo'],
            'cobrador_override_at'        => now(),
            'cobrador_override_por'       => $request->user()?->id,
        ];

        $liquidacionDistribuidor->update($nuevos);

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            'cobrador_override_aplicado',
            $anteriores,
            $nuevos,
            $data['motivo'],
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'data'    => $liquidacionDistribuidor->fresh(),
            'message' => "Override aplicado. El pago va a {$data['nombre']} (CBU {$cbuDigits}).",
        ]);
    }

    /**
     * DELETE /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/cobrador-override
     *
     * Quita el override y vuelve al beneficiario por defecto (cobrador del distribuidor o el propio).
     */
    public function quitarCobradorOverride(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para cambiar el cobrador.'], 403);
        }
        if ($liquidacionDistribuidor->tieneOrdenPagoActiva()) {
            return response()->json(['error' => 'La liquidacion esta incluida en una OP activa. Sacala de la OP primero.'], 422);
        }
        if (!$liquidacionDistribuidor->tieneOverrideCobrador()) {
            return response()->json(['error' => 'Esta liquidacion no tiene override de cobrador.'], 422);
        }

        $anteriores = [
            'cobrador_override_nombre' => $liquidacionDistribuidor->cobrador_override_nombre,
            'cobrador_override_cuit'   => $liquidacionDistribuidor->cobrador_override_cuit,
            'cobrador_override_cbu'    => $liquidacionDistribuidor->cobrador_override_cbu,
        ];
        $nuevos = [
            'cobrador_override_nombre'    => null,
            'cobrador_override_cuit'      => null,
            'cobrador_override_cbu'       => null,
            'cobrador_override_alias_cbu' => null,
            'cobrador_override_motivo'    => null,
            'cobrador_override_at'        => null,
            'cobrador_override_por'       => null,
        ];

        $liquidacionDistribuidor->update($nuevos);

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            'cobrador_override_quitado',
            $anteriores,
            $nuevos,
            'Override de cobrador removido',
            $request->user(),
            $request->ip()
        );

        return response()->json([
            'data'    => $liquidacionDistribuidor->fresh(),
            'message' => 'Override de cobrador removido. La OP vuelve al beneficiario por defecto.',
        ]);
    }

    /**
     * POST /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/ajustar-importe
     *
     * Ajuste manual del total_a_pagar con motivo obligatorio. Si la diferencia supera
     * el 20%, marca la liq como requiere_revision_dual para que un 2do admin apruebe
     * antes de generar la OP. Cada ajuste queda en liq_ajustes_importe (tooltip historial).
     */
    public function ajustarImporte(Request $request, LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $role = strtolower(trim((string) ($request->user()?->role ?? '')));
        if (!in_array($role, ['admin', 'admin2'], true)) {
            return response()->json(['error' => 'No tenes permisos para ajustar importes.'], 403);
        }
        if ($liquidacionDistribuidor->tieneOrdenPagoActiva()) {
            return response()->json(['error' => 'La liquidacion esta incluida en una OP activa. Sacala de la OP primero.'], 422);
        }
        if ($liquidacionDistribuidor->estado === LiqLiquidacionDistribuidor::ESTADO_PAGADA) {
            return response()->json(['error' => 'La liquidacion ya fue pagada.'], 422);
        }

        $data = $request->validate([
            'nuevo_importe' => 'required|numeric|min:0',
            'motivo'        => 'required|string|min:10|max:500',
        ]);

        $importeAntes = round((float) $liquidacionDistribuidor->total_a_pagar, 2);
        $importeDespues = round((float) $data['nuevo_importe'], 2);
        $diferencia = round($importeDespues - $importeAntes, 2);

        if ($importeAntes <= 0 && $importeDespues > 0) {
            $diferenciaPct = 100.0; // de 0 a algo: forzar revision dual
        } elseif ($importeAntes <= 0) {
            $diferenciaPct = 0.0;
        } else {
            $diferenciaPct = round(abs($diferencia) / $importeAntes * 100, 2);
        }
        $requiereRevision = $diferenciaPct > 20;

        $liquidacionDistribuidor->update([
            'total_a_pagar'             => $importeDespues,
            'total_a_pagar_overridido'  => true,
            'requiere_revision_dual'    => $requiereRevision,
        ]);

        $ajuste = LiqAjusteImporte::create([
            'liq_id'                 => $liquidacionDistribuidor->id,
            'importe_antes'          => $importeAntes,
            'importe_despues'        => $importeDespues,
            'diferencia'             => $diferencia,
            'diferencia_pct'         => $diferenciaPct,
            'motivo'                 => $data['motivo'],
            'user_id'                => $request->user()?->id,
            'requiere_revision_dual' => $requiereRevision,
        ]);

        LiqHistorialAuditoria::registrar(
            'liquidacion_distribuidor',
            $liquidacionDistribuidor->id,
            'ajuste_importe',
            ['total_a_pagar' => $importeAntes],
            ['total_a_pagar' => $importeDespues, 'diferencia_pct' => $diferenciaPct],
            $data['motivo'],
            $request->user(),
            $request->ip()
        );

        $msg = sprintf(
            'Importe ajustado: $%s → $%s (%s%s%%)',
            number_format($importeAntes, 2, ',', '.'),
            number_format($importeDespues, 2, ',', '.'),
            $diferencia >= 0 ? '+' : '',
            number_format($diferencia >= 0 ? $diferenciaPct : -$diferenciaPct, 2, ',', '.')
        );
        if ($requiereRevision) {
            $msg .= '. ⚠ Ajuste >20% — requiere aprobacion de un 2do admin antes de generar la OP.';
        }

        return response()->json([
            'data'    => $liquidacionDistribuidor->fresh(),
            'ajuste'  => $ajuste,
            'message' => $msg,
        ]);
    }

    /**
     * GET /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/ajustes-importe
     *
     * Lista los ajustes historicos de importe de esta liquidacion (para tooltip en UI).
     */
    public function ajustesImporte(LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $ajustes = LiqAjusteImporte::where('liq_id', $liquidacionDistribuidor->id)
            ->with('usuario:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($a) => [
                'id'               => $a->id,
                'importe_antes'    => (float) $a->importe_antes,
                'importe_despues'  => (float) $a->importe_despues,
                'diferencia'       => (float) $a->diferencia,
                'diferencia_pct'   => (float) $a->diferencia_pct,
                'motivo'           => $a->motivo,
                'usuario'          => $a->usuario?->name,
                'requiere_revision_dual' => (bool) $a->requiere_revision_dual,
                'aprobado_at'      => $a->aprobado_at?->toIso8601String(),
                'created_at'       => $a->created_at?->toIso8601String(),
            ]);
        return response()->json(['data' => $ajustes]);
    }

    /**
     * GET /liq/liquidaciones-distribuidor/{liquidacionDistribuidor}/historial
     *
     * Historial de auditoria de una liquidacion distribuidor especifica.
     */
    public function historial(LiqLiquidacionDistribuidor $liquidacionDistribuidor): JsonResponse
    {
        $historial = LiqHistorialAuditoria::where('entidad_tipo', 'liquidacion_distribuidor')
            ->where('entidad_id', $liquidacionDistribuidor->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $historial]);
    }

    /**
     * GET /liq/distribuidores/{persona}/historial-auditoria
     *
     * Historial completo de todas las liquidaciones de un distribuidor.
     */
    public function historialDistribuidor(Persona $persona): JsonResponse
    {
        $liqIds = LiqLiquidacionDistribuidor::where('distribuidor_id', $persona->id)
            ->pluck('id');

        $historial = LiqHistorialAuditoria::where('entidad_tipo', 'liquidacion_distribuidor')
            ->whereIn('entidad_id', $liqIds)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json(['data' => $historial]);
    }
}
