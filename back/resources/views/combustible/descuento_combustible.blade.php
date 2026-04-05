@php
  $fmtMoney = function ($value) {
    if ($value === null || $value === '') return '—';
    $n = is_numeric($value) ? (float) $value : 0.0;
    return '$ ' . number_format($n, 2, ',', '.');
  };
  $fmtNum = function ($value, int $decimals = 3) {
    if ($value === null || $value === '') return '—';
    $n = is_numeric($value) ? (float) $value : 0.0;
    return number_format($n, $decimals, ',', '.');
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
    <title>Descuento combustible</title>
    <style>
      @page { margin: 22px 26px; }
      body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111827; }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .title { font-size: 18px; font-weight: 700; text-align: right; }
      .subtitle { font-size: 11px; color: #4b5563; text-align: right; margin-top: 4px; }
      .meta { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; }
      .meta-grid { width: 100%; border-collapse: collapse; }
      .meta-grid td { padding: 2px 0; vertical-align: top; }
      .label { color: #6b7280; width: 160px; }
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
    <table class="header-table">
      <tr>
        <td style="width: 160px;">
          @if(!empty($logoDataUri))
            <img src="{{ $logoDataUri }}" style="height: 44px;" alt="Logo" />
          @endif
        </td>
        <td>
          <div class="title">Descuento combustible</div>
          <div class="subtitle">
            {{ $fmtText($clienteNombre ?? null) }} — Reporte #{{ $fmtText($reportId ?? null) }}
          </div>
        </td>
      </tr>
    </table>

    <div class="meta">
      <table class="meta-grid">
        <tr>
          <td style="width: 55%;">
            <div class="section-title">Proveedor</div>
            <table class="meta-grid">
              <tr><td class="label">Nombre</td><td class="value">{{ $fmtText($personaNombre ?? null) }}</td></tr>
              <tr><td class="label">CUIT/CUIL</td><td>{{ $fmtText($personaCuil ?? null) }}</td></tr>
              <tr><td class="label">Patente</td><td>{{ $fmtText($personaPatente ?? null) }}</td></tr>
            </table>
          </td>
          <td style="width: 45%;">
            <div class="section-title">Datos del reporte</div>
            <table class="meta-grid">
              <tr><td class="label">Liquidación ID</td><td>{{ $fmtText($liquidacionId ?? null) }}</td></tr>
              <tr><td class="label">Período</td><td>{{ $fmtText($periodFrom ?? null) }} al {{ $fmtText($periodTo ?? null) }}</td></tr>
              <tr><td class="label">Generado</td><td>{{ $fmtText($generatedAt ?? null) }}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <div class="section-title">Items incluidos</div>
    <table class="ops">
      <thead>
        <tr>
          <th style="width: 26px;">#</th>
          <th style="width: 74px;">Fecha</th>
          <th>Estación</th>
          <th style="width: 120px;">Producto</th>
          <th style="width: 80px;" class="right">Litros</th>
          <th style="width: 92px;" class="right">Importe</th>
        </tr>
      </thead>
      <tbody>
        @forelse($items as $i => $item)
          <tr>
            <td>{{ $i + 1 }}</td>
            <td>{{ $fmtText($item['date'] ?? null) }}</td>
            <td>{{ $fmtText($item['station'] ?? null) }}</td>
            <td>{{ $fmtText($item['product'] ?? null) }}</td>
            <td class="right">{{ $fmtNum($item['liters'] ?? null, 3) }}</td>
            <td class="right">{{ $fmtMoney($item['amount'] ?? null) }}</td>
          </tr>
        @empty
          <tr>
            <td colspan="6">No hay items para mostrar.</td>
          </tr>
        @endforelse
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td class="k">Total consumos</td>
        <td class="v">{{ $fmtMoney($totalAmount ?? null) }}</td>
      </tr>
      <tr>
        <td class="k">Ajustes</td>
        <td class="v">{{ $fmtMoney($adjustmentsTotal ?? null) }}</td>
      </tr>
      <tr>
        <td class="k grand">Total a descontar</td>
        <td class="v grand">{{ $fmtMoney($totalDiscount ?? null) }}</td>
      </tr>
    </table>

    <div class="footer">
      Documento generado automáticamente. Si necesitás recalcular, volvé a aplicar el descuento de combustible.
    </div>
  </body>
</html>

