@php
  // --- Helpers ---
  $fmtMoney = function ($value) {
    if ($value === null || $value === '') return '-';
    $n = is_numeric($value) ? (float) $value : 0.0;
    return '$ ' . number_format($n, 2, ',', '.');
  };
  $fmtText = function ($value) {
    $v = is_string($value) ? trim($value) : $value;
    return ($v === null || $v === '') ? '-' : $v;
  };
  $fmtNum = function ($value, $decimals = 0) {
    if ($value === null || $value === '') return '-';
    $n = (float) $value;
    return number_format($n, $decimals, ',', '.');
  };
  $fmtFraccion = function ($value) {
    if ($value === null) return '1/1';
    $f = (float) $value;
    if (abs($f - 0.25) < 0.01) return '1/4';
    if (abs($f - 0.3333) < 0.01) return '1/3';
    if (abs($f - 0.50) < 0.01) return '1/2';
    if (abs($f - 0.6667) < 0.01) return '2/3';
    if (abs($f - 0.75) < 0.01) return '3/4';
    if (abs($f - 1.0) < 0.01) return '1/1';
    return number_format($f * 100, 0) . '%';
  };
  $meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  $periodoStr = '';
  try {
    $desde = \Carbon\Carbon::parse($liq['periodo_desde'] ?? now());
    $hasta = \Carbon\Carbon::parse($liq['periodo_hasta'] ?? now());
    $mes = $meses[$desde->month - 1] ?? $desde->format('F');
    $anio = $desde->year;
    if ($desde->day == 1 && $hasta->day >= 28 && $desde->month == $hasta->month) {
      $periodoStr = "{$mes} {$anio}";
    } elseif ($desde->day == 1 && $hasta->day <= 15) {
      $periodoStr = "1ra Quincena de {$mes} {$anio}";
    } elseif ($desde->day >= 15 && $hasta->day >= 28) {
      $periodoStr = "2da Quincena de {$mes} {$anio}";
    } else {
      $periodoStr = "{$mes} {$anio}";
    }
  } catch (\Throwable $e) {
    $periodoStr = ($liq['periodo_desde'] ?? '') . ' al ' . ($liq['periodo_hasta'] ?? '');
  }

  // --- Eficiencia (badge compacto, BUGFIX 26.1) ---
  $efPct = $liq['eficiencia_pct'] ?? null;
  $efShow = !empty($liq['mostrar_eficiencia']) && $efPct !== null;
  $efLabel = '-';
  $efColor = '#6b7280';
  $efBg = '#e5e7eb';
  if ($efShow) {
    $ef = (float) $efPct;
    if ($ef >= 90)      { $efColor='#166534'; $efBg='#dcfce7'; $efLabel='Excelente'; }
    elseif ($ef >= 70)  { $efColor='#92400e'; $efBg='#fef3c7'; $efLabel='Bueno'; }
    elseif ($ef >= 50)  { $efColor='#9a3412'; $efBg='#ffedd5'; $efLabel='Regular'; }
    else                { $efColor='#991b1b'; $efBg='#fee2e2'; $efLabel='Bajo'; }
  }
  $efOpsFrac = null;
  if (!empty($liq['eficiencia_detalle']['ops_contables']) && !empty($liq['eficiencia_detalle']['ops_total'])) {
    $efOpsFrac = $liq['eficiencia_detalle']['ops_contables'] . '/' . $liq['eficiencia_detalle']['ops_total'] . ' ops';
  } elseif (!empty($liq['cantidad_operaciones'])) {
    $efOpsFrac = $liq['cantidad_operaciones'] . ' ops';
  }

  // --- Totales ---
  $subtotal = (float) ($liq['subtotal'] ?? 0);
  $gastos = (float) ($liq['gastos'] ?? 0);
  $beneficio = (float) ($liq['beneficio_seguro'] ?? 0);
  $reembolsoPeajes = (float) ($liq['reembolso_peajes'] ?? 0);
  $clientePagaPeajes = !empty($liq['cliente_paga_peajes']);
  $total = (float) ($liq['total'] ?? 0);
@endphp
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Liquidacion {{ $fmtText($cliente['nombre'] ?? 'Cliente') }}</title>
    <style>
      @page { margin: 14mm 14mm; }
      body { font-family: DejaVu Sans, sans-serif; font-size: 8.5pt; color: #111827; }

      /* ---------- HEADER: logo (izq) + cartel (der) ---------- */
      .header { width: 100%; margin-bottom: 6mm; }
      .header-table { width: 100%; border-collapse: collapse; }
      .header-table td { vertical-align: middle; padding: 0; }
      .logo-cell { width: 62mm; }
      .logo-cell img { width: 60mm; display: block; }
      .cartel-cell { text-align: right; }
      .cartel-title { font-size: 12pt; font-weight: 700; color: #1F3864; line-height: 1.1; }
      .cartel-sub { font-size: 10pt; color: #595959; margin-top: 1mm; }

      /* ---------- META: datos distribuidor (izq) + badge eficiencia (der) ---------- */
      .meta-row { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
      .meta-row td { vertical-align: top; padding: 0; }
      .meta-left { width: 140mm; padding-right: 4mm; }
      .meta-right { width: 42mm; }
      .meta-grid { width: 100%; border-collapse: collapse; border: 1px solid #D6DCE7; border-radius: 3mm; background: #FBFCFE; }
      .meta-grid td { padding: 1.8mm 2.5mm; font-size: 8.5pt; vertical-align: top; border-right: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; }
      .meta-grid td:last-child { border-right: none; }
      .meta-grid tr:last-child td { border-bottom: none; }
      .meta-label { color: #6b7280; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
      .meta-value { font-weight: 700; font-size: 9pt; color: #1F2937; margin-top: 0.5mm; }

      /* ---------- Badge eficiencia compacto ---------- */
      .ef-badge { width: 42mm; height: 22mm; border-radius: 3mm; padding: 2mm; text-align: center; color: #fff; }
      .ef-title { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.85; }
      .ef-value { font-size: 18pt; font-weight: 700; line-height: 1; margin-top: 1mm; }
      .ef-sub { font-size: 7pt; margin-top: 0.5mm; }

      /* ---------- Tabla de operaciones ---------- */
      table.ops { width: 100%; border-collapse: collapse; margin-top: 1mm; }
      table.ops thead th {
        background: #1F3864; color: #fff; font-size: 9pt; font-weight: 700;
        padding: 2mm 1.5mm; border: 0.3pt solid #BFBFBF;
      }
      table.ops tbody td { padding: 1.4mm 1.5mm; border: 0.3pt solid #BFBFBF; font-size: 8.5pt; }
      table.ops tbody tr:nth-child(even) td { background: #F7F9FC; }
      .right { text-align: right; }
      .center { text-align: center; }
      .left { text-align: left; }

      /* ---------- Totales ---------- */
      .totals-wrap { margin-top: 5mm; width: 100%; }
      .totals { margin-left: auto; border-collapse: collapse; min-width: 85mm; }
      .totals td { padding: 1.2mm 2mm; font-size: 9.5pt; }
      .totals td.k { color: #4b5563; }
      .totals td.v { font-weight: 700; text-align: right; }
      .totals tr.sep td { border-top: 0.6pt solid #1F3864; }
      .totals tr.grand td { font-size: 11pt; font-weight: 700; color: #1F3864; padding-top: 1.5mm; }

      /* ---------- Footer ---------- */
      .footer { margin-top: 10mm; font-size: 8pt; color: #6b7280; font-style: italic; text-align: center; }
    </style>
  </head>
  <body>

    {{-- ╔════════════════════════════════════════════════════════════╗
         ║  1) HEADER: logo corporativo + cartel con título           ║
         ╚════════════════════════════════════════════════════════════╝ --}}
    <div class="header">
      <table class="header-table">
        <tr>
          <td class="logo-cell">
            @if(!empty($logoDataUri))
              <img src="{{ $logoDataUri }}" alt="Logística Argentina SRL" />
            @else
              <div style="font-size:11pt;font-weight:700;color:#1F3864;">LOGÍSTICA ARGENTINA SRL</div>
            @endif
          </td>
          <td class="cartel-cell">
            <div class="cartel-title">Liquidación {{ strtoupper($fmtText($cliente['nombre'] ?? '')) }}</div>
            <div class="cartel-sub">Período {{ $periodoStr }}</div>
          </td>
        </tr>
      </table>
    </div>

    {{-- ╔════════════════════════════════════════════════════════════╗
         ║  2) META: datos distribuidor (izq) + badge eficiencia (der) ║
         ╚════════════════════════════════════════════════════════════╝ --}}
    <table class="meta-row">
      <tr>
        <td class="meta-left">
          <table class="meta-grid">
            <tr>
              <td>
                <div class="meta-label">Distribuidor</div>
                <div class="meta-value">{{ $fmtText($distribuidor['nombre'] ?? null) }}</div>
              </td>
              <td>
                <div class="meta-label">Sucursal</div>
                <div class="meta-value">{{ $fmtText($liq['sucursal'] ?? null) }}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="meta-label">CUIT/CUIL</div>
                <div class="meta-value">{{ $fmtText($distribuidor['cuil'] ?? null) }}</div>
              </td>
              <td>
                <div class="meta-label">Patente</div>
                <div class="meta-value">{{ $fmtText($distribuidor['patente'] ?? null) }}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="meta-label">Período</div>
                <div class="meta-value">{{ $periodoStr }}</div>
              </td>
              <td>
                <div class="meta-label">Operaciones</div>
                <div class="meta-value">{{ $fmtText($liq['cantidad_operaciones'] ?? null) }}</div>
              </td>
            </tr>
          </table>
        </td>
        <td class="meta-right">
          @if($efShow)
            <div class="ef-badge" style="background: {{ $efColor }};">
              <div class="ef-title">Eficiencia</div>
              <div class="ef-value">{{ number_format((float) $efPct, 1, ',', '.') }}%</div>
              <div class="ef-sub">{{ $efLabel }}</div>
              @if($efOpsFrac)
                <div class="ef-sub" style="opacity:0.85;">{{ $efOpsFrac }}</div>
              @endif
            </div>
          @endif
        </td>
      </tr>
    </table>

    {{-- ╔════════════════════════════════════════════════════════════╗
         ║  3) TABLA de operaciones con columna Sucursal + Modalidad  ║
         ║  SPEC v3: ops de productividad muestran desglose expandido ║
         ╚════════════════════════════════════════════════════════════╝ --}}
    <table class="ops">
      <thead>
        <tr>
          <th style="width: 8mm;"  class="center">#</th>
          <th style="width: 20mm;" class="center">Fecha</th>
          <th style="width: 22mm;" class="center">Transporte</th>
          <th style="width: 32mm;" class="left">Sucursal</th>
          <th style="width: 15mm;" class="center">Ruta</th>
          <th style="width: 22mm;" class="center">Modalidad</th>
          <th style="width: 11mm;" class="center">Paradas</th>
          <th style="width: 28mm;" class="right">$/Jornada</th>
          <th class="right">Importe</th>
        </tr>
      </thead>
      <tbody>
        @forelse($operaciones as $i => $op)
          @php $esProd = ($op['modo_pago'] ?? '') === 'productividad_paradas'; @endphp
          <tr>
            <td class="center">{{ $i + 1 }}</td>
            <td class="center">{{ $fmtText($op['fecha'] ?? null) }}</td>
            <td class="center">{{ $fmtText($op['transporte'] ?? null) }}</td>
            <td class="left">{{ $fmtText($op['sucursal_op'] ?? null) }}</td>
            <td class="center">{{ $fmtText($op['ruta'] ?? null) }}</td>
            <td class="center" style="font-weight: 600; color: {{ $esProd ? '#7c3aed' : '#1F3864' }};">{{ $fmtText($op['modalidad'] ?? null) }}</td>
            @php
              if ($esProd) {
                  // SPEC v4: solo total (la composición entregadas/visitadas va en Nivel 3)
                  $celdaParadas = $op['paradas_totales'] ?? $op['paradas'] ?? '-';
              } else {
                  $celdaParadas = $fmtFraccion($op['fraccion'] ?? 1.0);
              }
            @endphp
            <td class="center">{{ $celdaParadas }}</td>
            <td class="right">{{ $esProd ? '—' : $fmtMoney($op['tarifa_jornada'] ?? null) }}</td>
            <td class="right">{{ $fmtMoney($op['importe'] ?? null) }}</td>
          </tr>
          {{-- SPEC v4 · Nivel 3 simplificado: desglose por (material × zona × estado) --}}
          @if($esProd && !empty($op['detalle_paradas']))
            <tr>
              <td colspan="9" style="padding: 1mm 2mm 0 2mm; background: #F3E8FF; border-top: 0.4pt solid #C084FC;">
                <div style="font-size: 8pt; color: #6B21A8; font-weight: 600; padding: 0 0 0.5mm 0;">
                  Desglose op #{{ $op['transporte'] }} · {{ $fmtText($op['fecha'] ?? null) }} · {{ $fmtText($op['ruta'] ?? null) }} · {{ $op['paradas_totales'] ?? 0 }} paradas
                </div>
                @if(isset($op['paradas_entregadas']) && isset($op['paradas_totales']))
                  <div style="font-size: 7pt; color: #6B21A8; padding: 0 0 1mm 0; font-style: italic;">
                    ({{ $op['paradas_entregadas'] }} entregadas + {{ ($op['paradas_totales'] - $op['paradas_entregadas']) }} visitadas no entregadas)
                  </div>
                @endif
                <table style="width:100%; border-collapse: collapse; font-size: 7.5pt; color: #4C1D95; background: #FAF5FF;">
                  <thead>
                    <tr style="background: #E9D5FF; font-weight: 600;">
                      <th style="text-align:left;   padding: 0.8mm 2mm;">Material</th>
                      <th style="text-align:center; padding: 0.8mm 1mm; width: 18mm;">Zona</th>
                      <th style="text-align:center; padding: 0.8mm 1mm; width: 24mm;">Estado</th>
                      <th style="text-align:right;  padding: 0.8mm 2mm; width: 18mm;">Paradas</th>
                      <th style="text-align:right;  padding: 0.8mm 2mm; width: 18mm;">Bultos</th>
                      <th style="text-align:right;  padding: 0.8mm 2mm; width: 32mm;">Cobrás</th>
                    </tr>
                  </thead>
                  <tbody>
                    @php $_opParadas = 0; $_opBultos = 0; $_opCobra = 0; @endphp
                    @foreach($op['detalle_paradas'] as $g)
                      <tr>
                        <td style="text-align:left;   padding: 0.6mm 2mm;">{{ $g['material_la'] }}</td>
                        <td style="text-align:center; padding: 0.6mm 1mm;">{{ $g['zona'] }}</td>
                        <td style="text-align:center; padding: 0.6mm 1mm;">{{ $g['estado'] === 'entregado' ? 'Entregado' : 'Visitado' }}</td>
                        <td style="text-align:right;  padding: 0.6mm 2mm;">{{ $g['paradas'] }}</td>
                        <td style="text-align:right;  padding: 0.6mm 2mm;">{{ $g['bultos'] }}</td>
                        <td style="text-align:right;  padding: 0.6mm 2mm; font-weight: 600;">{{ $fmtMoney($g['cobra_la']) }}</td>
                      </tr>
                      @php $_opParadas += $g['paradas']; $_opBultos += $g['bultos']; $_opCobra += $g['cobra_la']; @endphp
                    @endforeach
                    <tr style="background: #E9D5FF; font-weight: 700; color: #6B21A8;">
                      <td colspan="3" style="text-align:right; padding: 0.8mm 2mm;">TOTAL op</td>
                      <td style="text-align:right; padding: 0.8mm 2mm;">{{ $op['paradas_totales'] ?? $_opParadas }}</td>
                      <td style="text-align:right; padding: 0.8mm 2mm;">{{ $_opBultos }}</td>
                      <td style="text-align:right; padding: 0.8mm 2mm;">{{ $fmtMoney($op['importe']) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          @endif
        @empty
          <tr><td colspan="9" class="center" style="padding:6mm;">No hay operaciones para mostrar.</td></tr>
        @endforelse
      </tbody>
    </table>

    {{-- ╔════════════════════════════════════════════════════════════╗
         ║  3b) RESUMEN MENSUAL de paradas (solo si hay productividad) ║
         ╚════════════════════════════════════════════════════════════╝ --}}
    @if(!empty($resumenMensual))
      <div style="margin-top: 6mm;">
        <h3 style="font-size: 10pt; color: #6B21A8; margin: 0 0 2mm 0;">
          Resumen mensual de paradas (productividad)
        </h3>
        <table class="ops" style="margin-top: 0;">
          <thead>
            <tr style="background: #F3E8FF; color: #6B21A8;">
              <th class="left"   style="width: 40mm;">Material</th>
              <th class="center" style="width: 20mm;">Zona</th>
              <th class="center" style="width: 28mm;">Estado</th>
              <th class="right"  style="width: 22mm;">Paradas</th>
              <th class="right"  style="width: 22mm;">Bultos</th>
              <th class="right">Cobrás</th>
            </tr>
          </thead>
          <tbody>
            @php $_totalParadas = 0; $_totalBultos = 0; $_totalImporte = 0.0; @endphp
            @foreach($resumenMensual as $g)
              <tr>
                <td class="left">{{ $g['material_la'] }}</td>
                <td class="center">{{ $g['zona'] }}</td>
                <td class="center">{{ $g['estado'] === 'entregado' ? 'Entregado' : 'Visitado' }}</td>
                <td class="right">{{ $g['paradas'] }}</td>
                <td class="right">{{ $g['bultos'] }}</td>
                <td class="right">{{ $fmtMoney($g['importe']) }}</td>
              </tr>
              @php $_totalParadas += $g['paradas']; $_totalBultos += $g['bultos']; $_totalImporte += $g['importe']; @endphp
            @endforeach
            <tr style="background: #F3E8FF; font-weight: 700; color: #6B21A8; border-top: 0.8pt solid #C084FC;">
              <td colspan="3" class="left">TOTAL MES</td>
              <td class="right">{{ $_totalParadas }}</td>
              <td class="right">{{ $_totalBultos }}</td>
              {{-- Usamos liq.subtotal para evitar diff de centavos por suma de filas redondeadas --}}
              <td class="right">{{ $fmtMoney($liq['subtotal'] ?? $_totalImporte) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    @endif

    {{-- ╔════════════════════════════════════════════════════════════╗
         ║  4) TOTALES                                                ║
         ╚════════════════════════════════════════════════════════════╝ --}}
    <div class="totals-wrap">
      <table class="totals">
        <tr>
          <td class="k">SubTotal Operaciones</td>
          <td class="v">{{ $fmtMoney($subtotal) }}</td>
        </tr>
        {{-- Reembolso de peajes: sólo si el cliente reembolsa peajes (BUGFIX 25) --}}
        @if($clientePagaPeajes && $reembolsoPeajes > 0)
          <tr>
            <td class="k">Reembolso de peajes autorizados</td>
            <td class="v">{{ $fmtMoney($reembolsoPeajes) }}</td>
          </tr>
        @endif
        <tr>
          <td class="k">Gastos Administrativos</td>
          <td class="v">- {{ $fmtMoney($gastos) }}</td>
        </tr>
        @if($beneficio > 0)
          <tr>
            <td class="k">Beneficio Seguro Vehículo</td>
            <td class="v">- {{ $fmtMoney($beneficio) }}</td>
          </tr>
        @endif
        <tr class="sep grand">
          <td class="k">Importe a Facturar</td>
          <td class="v">{{ $fmtMoney($total) }}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      Documento generado automáticamente · {{ strtoupper($fmtText($empresa['razon_social'] ?? 'LOGÍSTICA ARGENTINA SRL')) }}
    </div>
  </body>
</html>
