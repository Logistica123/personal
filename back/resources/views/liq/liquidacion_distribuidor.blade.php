@php
  $fmtMoney = function ($value) {
    if ($value === null || $value === '') return '—';
    $n = is_numeric($value) ? (float) $value : 0.0;
    return '$ ' . number_format($n, 2, ',', '.');
  };
  $fmtText = function ($value) {
    $v = is_string($value) ? trim($value) : $value;
    return ($v === null || $v === '') ? '—' : $v;
  };
@endphp
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Liquidación</title>
    <style>
      @page { margin: 22px 26px; }
      body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111827; }
      .header { width: 100%; margin-bottom: 14px; }
      .header-table { width: 100%; border-collapse: collapse; }
      .logo { width: 150px; }
      .title { font-size: 18px; font-weight: 700; text-align: right; }
      .subtitle { font-size: 11px; color: #4b5563; text-align: right; margin-top: 4px; }
      .meta { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; }
      .meta-grid { width: 100%; border-collapse: collapse; }
      .meta-grid td { padding: 2px 0; vertical-align: top; }
      .label { color: #6b7280; width: 140px; }
      .value { font-weight: 600; }
      .section-title { font-weight: 700; margin: 10px 0 6px; font-size: 12px; }
      table.ops { width: 100%; border-collapse: collapse; }
      table.ops th { background: #f3f4f6; text-align: left; padding: 7px 6px; border: 1px solid #e5e7eb; font-size: 10px; }
      table.ops td { padding: 6px 6px; border: 1px solid #e5e7eb; font-size: 10px; }
      .right { text-align: right; }
      .totals { width: 100%; margin-top: 10px; border-collapse: collapse; }
      .totals td { padding: 5px 0; }
      .totals .k { color: #6b7280; }
      .totals .v { font-weight: 700; text-align: right; }
      .totals .grand { font-size: 13px; }
      .footer { margin-top: 14px; font-size: 9px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="header">
      <table class="header-table">
        <tr>
          <td class="logo">
            @if(!empty($logoDataUri))
              <img src="{{ $logoDataUri }}" style="height: 44px;" alt="Logo" />
            @endif
          </td>
          <td>
            <div class="title">Liquidación</div>
            <div class="subtitle">
              {{ $fmtText($cliente['nombre'] ?? null) }} — {{ $fmtText($liq['periodo_desde'] ?? null) }} al {{ $fmtText($liq['periodo_hasta'] ?? null) }}
            </div>
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
              <tr><td class="label">Email</td><td>{{ $fmtText($distribuidor['email'] ?? null) }}</td></tr>
            </table>
          </td>
          <td style="width: 45%;">
            <div class="section-title">Datos de liquidación</div>
            <table class="meta-grid">
              <tr><td class="label">Liquidación cliente ID</td><td>{{ $fmtText($liq['liquidacion_cliente_id'] ?? null) }}</td></tr>
              <tr><td class="label">Liquidación distribuidor ID</td><td>{{ $fmtText($liq['id'] ?? null) }}</td></tr>
              <tr><td class="label">Operaciones</td><td>{{ $fmtText($liq['cantidad_operaciones'] ?? null) }}</td></tr>
              <tr><td class="label">Generado</td><td>{{ $fmtText($liq['fecha_generacion'] ?? null) }}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <div class="section-title">Operaciones</div>
    <table class="ops">
      <thead>
        <tr>
          <th style="width: 26px;">#</th>
          <th style="width: 82px;">ID Viaje</th>
          <th style="width: 74px;">Fecha</th>
          <th>Origen</th>
          <th>Destino</th>
          <th style="width: 120px;">Concepto</th>
          <th style="width: 92px;" class="right">Importe</th>
        </tr>
      </thead>
      <tbody>
        @forelse($operaciones as $i => $op)
          <tr>
            <td>{{ $i + 1 }}</td>
            <td>{{ $fmtText($op['idViaje'] ?? null) }}</td>
            <td>{{ $fmtText($op['fecha'] ?? null) }}</td>
            <td>{{ $fmtText($op['origen'] ?? null) }}</td>
            <td>{{ $fmtText($op['destino'] ?? null) }}</td>
            <td>{{ $fmtText($op['concepto'] ?? null) }}</td>
            <td class="right">{{ $fmtMoney($op['importe'] ?? null) }}</td>
          </tr>
        @empty
          <tr>
            <td colspan="7">No hay operaciones para mostrar.</td>
          </tr>
        @endforelse
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td class="k">Subtotal</td>
        <td class="v">{{ $fmtMoney($liq['subtotal'] ?? null) }}</td>
      </tr>
      <tr>
        <td class="k">Gastos administrativos</td>
        <td class="v">{{ $fmtMoney($liq['gastos'] ?? null) }}</td>
      </tr>
      <tr>
        <td class="k grand">Total a pagar</td>
        <td class="v grand">{{ $fmtMoney($liq['total'] ?? null) }}</td>
      </tr>
    </table>

    <div class="footer">
      Documento generado automáticamente. Si encontrás diferencias, revisá tarifa/mapeos y volvé a generar.
    </div>
  </body>
</html>

