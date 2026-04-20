@php
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

  // Determinar si hay operaciones con KM o Productividad
  $hasKm = collect($operaciones)->contains(fn ($op) => ($op['modelo'] ?? '') === 'JORNADA_KM' && ($op['km_excedente'] ?? 0) > 0);
  $hasProd = collect($operaciones)->contains(fn ($op) => ($op['modelo'] ?? '') === 'PRODUCTIVIDAD');
@endphp
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Liquidacion OCASA</title>
    <style>
      @page { margin: 22px 26px; }
      body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111827; }
      .header { width: 100%; margin-bottom: 12px; }
      .header-table { width: 100%; border-collapse: collapse; }
      .logo { width: 150px; }
      .title { font-size: 17px; font-weight: 700; text-align: right; }
      .subtitle { font-size: 11px; color: #4b5563; text-align: right; margin-top: 3px; }
      .meta { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; margin-bottom: 12px; }
      .meta-grid { width: 100%; border-collapse: collapse; }
      .meta-grid td { padding: 2px 0; vertical-align: top; }
      .label { color: #6b7280; width: 100px; }
      .value { font-weight: 600; }
      .section-title { font-weight: 700; margin: 8px 0 4px; font-size: 11px; }
      table.ops { width: 100%; border-collapse: collapse; }
      table.ops th { background: #f3f4f6; text-align: left; padding: 5px 4px; border: 1px solid #e5e7eb; font-size: 9px; }
      table.ops td { padding: 4px 4px; border: 1px solid #e5e7eb; font-size: 9px; }
      .right { text-align: right; }
      .center { text-align: center; }
      .totals { width: 100%; margin-top: 8px; border-collapse: collapse; }
      .totals td { padding: 4px 0; }
      .totals .k { color: #6b7280; }
      .totals .v { font-weight: 700; text-align: right; }
      .totals .grand { font-size: 13px; }
      .footer { margin-top: 12px; font-size: 8px; color: #6b7280; }
      .tag { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 8px; font-weight: 600; }
      .tag-j { background: #dbeafe; color: #1e40af; }
      .tag-jk { background: #fef3c7; color: #92400e; }
      .tag-p { background: #d1fae5; color: #065f46; }
    </style>
  </head>
  <body>
    <div class="header">
      <table class="header-table">
        <tr>
          <td class="logo">
            @if(!empty($logoDataUri))
              <img src="{{ $logoDataUri }}" style="height: 40px;" alt="Logo" />
            @endif
          </td>
          <td>
            <div class="title">Liquidacion OCASA</div>
            <div class="subtitle">{{ $fmtText($cliente['nombre'] ?? null) }} - {{ $periodoStr }}</div>
          </td>
        </tr>
      </table>
    </div>

    <div class="meta">
      <table class="meta-grid">
        <tr>
          <td style="width: 55%;">
            <div class="section-title">Distribuidor</div>
            <table class="meta-grid">
              <tr><td class="label">Nombre</td><td class="value">{{ $fmtText($distribuidor['nombre'] ?? null) }}</td></tr>
              <tr><td class="label">CUIT/CUIL</td><td>{{ $fmtText($distribuidor['cuil'] ?? null) }}</td></tr>
              <tr><td class="label">Patente</td><td>{{ $fmtText($distribuidor['patente'] ?? null) }}</td></tr>
            </table>
          </td>
          <td style="width: 45%;">
            <div class="section-title">Datos</div>
            <table class="meta-grid">
              <tr><td class="label">Sucursal</td><td class="value">{{ $fmtText($liq['sucursal'] ?? null) }}</td></tr>
              <tr><td class="label">Operaciones</td><td>{{ $fmtText($liq['cantidad_operaciones'] ?? null) }}</td></tr>
              <tr><td class="label">Periodo</td><td class="value">{{ $periodoStr }}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <div class="section-title">Detalle de Operaciones</div>
    <table class="ops">
      <thead>
        <tr>
          <th style="width: 22px;">#</th>
          <th style="width: 62px;">Fecha</th>
          <th style="width: 70px;">Transporte</th>
          <th>Ruta</th>
          <th style="width: 38px;" class="center">Fracc.</th>
          <th style="width: 74px;" class="right">$/Jornada</th>
          @if($hasKm)
            <th style="width: 44px;" class="right">KM Exc.</th>
            <th style="width: 56px;" class="right">$/KM</th>
            <th style="width: 64px;" class="right">Valor KM</th>
          @endif
          @if($hasProd)
            <th style="width: 42px;" class="center">Paradas</th>
            <th style="width: 68px;" class="right">$/Prod</th>
          @endif
          <th style="width: 78px;" class="right">Importe</th>
        </tr>
      </thead>
      <tbody>
        @forelse($operaciones as $i => $op)
          <tr>
            <td>{{ $i + 1 }}</td>
            <td>{{ $fmtText($op['fecha'] ?? null) }}</td>
            <td>{{ $fmtText($op['transporte'] ?? null) }}</td>
            <td>{{ $fmtText($op['ruta'] ?? null) }}</td>
            <td class="center">{{ $fmtFraccion($op['fraccion'] ?? 1.0) }}</td>
            <td class="right">{{ ($op['modelo'] ?? '') !== 'PRODUCTIVIDAD' ? $fmtMoney($op['tarifa_jornada'] ?? null) : '-' }}</td>
            @if($hasKm)
              <td class="right">{{ ($op['km_excedente'] ?? 0) > 0 ? $fmtNum($op['km_excedente'], 0) : '-' }}</td>
              <td class="right">{{ ($op['tarifa_km'] ?? 0) > 0 ? $fmtMoney($op['tarifa_km']) : '-' }}</td>
              <td class="right">{{ ($op['valor_km'] ?? 0) > 0 ? $fmtMoney($op['valor_km']) : '-' }}</td>
            @endif
            @if($hasProd)
              <td class="center">{{ ($op['modelo'] ?? '') === 'PRODUCTIVIDAD' ? $fmtNum($op['paradas'] ?? 0, 0) : '-' }}</td>
              <td class="right">{{ ($op['modelo'] ?? '') === 'PRODUCTIVIDAD' ? $fmtMoney($op['tarifa_prod'] ?? null) : '-' }}</td>
            @endif
            <td class="right">{{ $fmtMoney($op['importe'] ?? null) }}</td>
          </tr>
        @empty
          <tr>
            <td colspan="{{ 6 + ($hasKm ? 3 : 0) + ($hasProd ? 2 : 0) }}">No hay operaciones para mostrar.</td>
          </tr>
        @endforelse
      </tbody>
    </table>

    {{-- BUGFIX 24 C: Eficiencia del Período --}}
    @if(!empty($liq['mostrar_eficiencia']) && isset($liq['eficiencia_pct']) && $liq['eficiencia_pct'] !== null)
      @php
        $ef = (float) $liq['eficiencia_pct'];
        if ($ef > 100)      { $efColor='#1e40af'; $efBg='#dbeafe'; $efLabel='Sobrecumplimiento'; }
        elseif ($ef >= 90)  { $efColor='#166534'; $efBg='#dcfce7'; $efLabel='Excelente'; }
        elseif ($ef >= 75)  { $efColor='#3f6212'; $efBg='#ecfccb'; $efLabel='Bueno'; }
        elseif ($ef >= 50)  { $efColor='#92400e'; $efBg='#fef3c7'; $efLabel='Regular'; }
        elseif ($ef >= 25)  { $efColor='#9a3412'; $efBg='#ffedd5'; $efLabel='Área de mejora'; }
        else                { $efColor='#991b1b'; $efBg='#fee2e2'; $efLabel='Crítico'; }
        $detalle = $liq['eficiencia_detalle'] ?? [];
      @endphp
      <div style="margin:18px 0; padding:14px; border-radius:8px; background:{{ $efBg }}; border:1px solid {{ $efColor }}22;">
        <div style="font-size:11px; color:{{ $efColor }}; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Eficiencia del Período</div>
        <div style="display:flex; align-items:baseline; gap:12px; margin-top:4px;">
          <div style="font-size:28px; font-weight:700; color:{{ $efColor }};">{{ number_format($ef, 2, ',', '.') }}%</div>
          <div style="font-size:13px; color:{{ $efColor }}; font-weight:600;">{{ $efLabel }}</div>
        </div>
        @if(!empty($detalle['formula']))
          <div style="font-size:10px; color:#374151; margin-top:6px;">{{ $detalle['formula'] }}</div>
        @endif
        @if(isset($detalle['ops_contables']) && isset($detalle['ops_total']))
          <div style="font-size:10px; color:#374151; margin-top:2px;">
            Basado en {{ $detalle['ops_contables'] }} de {{ $detalle['ops_total'] }} operaciones del período
            @if(!empty($detalle['ops_fraccion_alta'])) — {{ $detalle['ops_fraccion_alta'] }} excluidas (fracción > 1) @endif
            @if(!empty($detalle['ops_productividad'])) — {{ $detalle['ops_productividad'] }} productividad (no medidas en v1) @endif
          </div>
        @endif
      </div>
    @endif

    <table class="totals">
      <tr>
        <td class="k">SubTotal Operaciones</td>
        <td class="v">{{ $fmtMoney($liq['subtotal'] ?? null) }}</td>
      </tr>
      @if(($liq['reembolso_peajes'] ?? 0) > 0)
        <tr>
          <td class="k">Reembolso de peajes autorizados</td>
          <td class="v">{{ $fmtMoney($liq['reembolso_peajes']) }}</td>
        </tr>
      @elseif(($liq['peajes'] ?? 0) > 0)
        <tr>
          <td class="k" style="color:#888">Peajes informados (no autorizados)</td>
          <td class="v" style="color:#888">{{ $fmtMoney($liq['peajes']) }}</td>
        </tr>
      @endif
      <tr>
        <td class="k">Gastos Administrativos</td>
        <td class="v">- {{ $fmtMoney($liq['gastos'] ?? null) }}</td>
      </tr>
      @if(($liq['beneficio_seguro'] ?? 0) > 0)
        <tr>
          <td class="k">Beneficio Seguro Vehiculo</td>
          <td class="v">- {{ $fmtMoney($liq['beneficio_seguro']) }}</td>
        </tr>
      @endif
      <tr>
        <td class="k grand" style="font-size: 14px; font-weight: 700;">Importe a Facturar</td>
        <td class="v grand" style="font-size: 14px; font-weight: 700;">{{ $fmtMoney($liq['total'] ?? null) }}</td>
      </tr>
    </table>

    <div class="footer">
      Documento generado automaticamente - {{ $fmtText($empresa['razon_social'] ?? 'Logistica Argentina SRL') }}
    </div>
  </body>
</html>
