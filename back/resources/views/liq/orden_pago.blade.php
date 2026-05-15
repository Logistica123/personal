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
  $meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  $mesNombre = $meses[($op['mes'] ?? 1) - 1] ?? '';

  // Numero a letras (simplificado para importes en ARS)
  $numberToWords = function ($n) {
    $unidades = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
    $especiales = ['diez','once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve'];
    $decenas = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
    $centenas = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];

    if ($n == 0) return 'cero';
    if ($n == 100) return 'cien';

    $partes = [];
    $entero = (int) floor(abs($n));
    $decimales = round((abs($n) - $entero) * 100);

    // Miles de millones, millones, miles, unidades
    if ($entero >= 1000000) {
      $millones = (int) floor($entero / 1000000);
      $partes[] = ($millones == 1 ? 'un millon' : $millones . ' millones');
      $entero %= 1000000;
    }
    if ($entero >= 1000) {
      $miles = (int) floor($entero / 1000);
      if ($miles == 1) {
        $partes[] = 'mil';
      } else {
        // simplificado: solo el numero + mil
        $partes[] = $miles . ' mil';
      }
      $entero %= 1000;
    }
    if ($entero >= 100) {
      $c = (int) floor($entero / 100);
      $partes[] = ($entero == 100) ? 'cien' : ($centenas[$c] ?? $c . '00');
      $entero %= 100;
    }
    if ($entero >= 20) {
      $d = (int) floor($entero / 10);
      $u = $entero % 10;
      if ($u > 0) {
        $partes[] = ($decenas[$d] ?? '') . ' y ' . ($unidades[$u] ?? '');
      } else {
        $partes[] = $decenas[$d] ?? '';
      }
    } elseif ($entero >= 10) {
      $partes[] = $especiales[$entero - 10] ?? '';
    } elseif ($entero > 0) {
      $partes[] = $unidades[$entero] ?? '';
    }

    $texto = implode(' ', array_filter($partes));
    if ($decimales > 0) {
      $texto .= ' con ' . $decimales . '/100';
    }
    return $texto;
  };

  $totalFloat = is_numeric($op['total_a_pagar'] ?? null) ? (float) $op['total_a_pagar'] : 0;
  $totalLetras = ucfirst($numberToWords($totalFloat)) . ' pesos';
@endphp
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Orden de Pago {{ $fmtText($op['numero_display'] ?? null) }}</title>
    <style>
      @page { margin: 22px 26px; }
      body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111827; }
      .header { width: 100%; margin-bottom: 14px; }
      .header-table { width: 100%; border-collapse: collapse; }
      .logo { width: 150px; }
      .title { font-size: 18px; font-weight: 700; text-align: right; }
      .subtitle { font-size: 12px; color: #4b5563; text-align: right; margin-top: 4px; }
      .op-number { font-size: 14px; font-weight: 700; color: #2563eb; text-align: right; margin-top: 2px; }
      .meta { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; }
      .meta-grid { width: 100%; border-collapse: collapse; }
      .meta-grid td { padding: 2px 0; vertical-align: top; }
      .label { color: #6b7280; width: 130px; }
      .value { font-weight: 600; }
      .section-title { font-weight: 700; margin: 10px 0 6px; font-size: 12px; }
      table.detalle { width: 100%; border-collapse: collapse; }
      table.detalle th { background: #f3f4f6; text-align: left; padding: 6px 5px; border: 1px solid #e5e7eb; font-size: 9px; }
      table.detalle td { padding: 5px 5px; border: 1px solid #e5e7eb; font-size: 9px; }
      .right { text-align: right; }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .totals { width: 100%; margin-top: 10px; border-collapse: collapse; }
      .totals td { padding: 5px 0; }
      .totals .k { color: #6b7280; }
      .totals .v { font-weight: 700; text-align: right; }
      .totals .grand { font-size: 13px; }
      .total-letras { margin-top: 6px; font-size: 10px; color: #374151; font-style: italic; text-align: right; }
      .footer { margin-top: 18px; font-size: 9px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
    </style>
  </head>
  <body>
    {{-- Cabecera --}}
    <div class="header">
      <table class="header-table">
        <tr>
          <td class="logo">
            @if(!empty($logoDataUri))
              <img src="{{ $logoDataUri }}" style="height: 44px;" alt="Logo" />
            @endif
          </td>
          <td>
            <div class="title">Orden de Pago</div>
            <div class="op-number">{{ $fmtText($op['numero_display'] ?? null) }}</div>
            <div class="subtitle">{{ $mesNombre }} {{ $op['anio'] ?? '' }} — {{ $fmtText($op['concepto'] ?? null) }}</div>
          </td>
        </tr>
      </table>
    </div>

    {{-- Datos de la OP. El bloque "Beneficiario" solo se muestra en OP individual
         (1 beneficiario distinto); para OP global con N beneficiarios distintos no
         tiene sentido y confunde (era un bug que copiaba el primer beneficiario). --}}
    <div class="meta">
      @if(empty($op['es_global']))
        <table class="meta-grid">
          <tr>
            <td style="width: 50%;">
              <div class="section-title">Datos de la Orden</div>
              <table class="meta-grid">
                <tr><td class="label">Fecha de emisión</td><td class="value">{{ $fmtText($op['fecha_emision'] ?? null) }}</td></tr>
                <tr><td class="label">Concepto</td><td class="value">{{ $fmtText($op['concepto'] ?? null) }}</td></tr>
                <tr><td class="label">Periodo</td><td class="value">{{ $mesNombre }} {{ $op['anio'] ?? '' }}</td></tr>
                <tr><td class="label">Liquidaciones</td><td>{{ $op['cantidad_liquidaciones'] ?? 0 }}</td></tr>
                <tr><td class="label">Estado</td><td class="value">{{ $fmtText($op['estado'] ?? null) }}</td></tr>
              </table>
            </td>
            <td style="width: 50%;">
              <div class="section-title">Beneficiario</div>
              <table class="meta-grid">
                <tr><td class="label">Nombre</td><td class="value">{{ $fmtText($beneficiario['nombre'] ?? null) }}</td></tr>
                <tr><td class="label">CUIL</td><td>{{ $fmtText($beneficiario['cuil'] ?? null) }}</td></tr>
                <tr><td class="label">CBU</td><td>{{ $fmtText($beneficiario['cbu'] ?? null) }}</td></tr>
                <tr><td class="label">Tipo</td><td>{{ $fmtText($beneficiario['tipo'] ?? null) }}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      @else
        <table class="meta-grid">
          <tr>
            <td style="width: 100%;">
              <div class="section-title">Datos de la Orden</div>
              <table class="meta-grid">
                <tr>
                  <td class="label">Fecha de emisión</td><td class="value">{{ $fmtText($op['fecha_emision'] ?? null) }}</td>
                  <td class="label">Concepto</td><td class="value">{{ $fmtText($op['concepto'] ?? null) }}</td>
                </tr>
                <tr>
                  <td class="label">Periodo</td><td class="value">{{ $mesNombre }} {{ $op['anio'] ?? '' }}</td>
                  <td class="label">Estado</td><td class="value">{{ $fmtText($op['estado'] ?? null) }}</td>
                </tr>
                <tr>
                  <td class="label">Liquidaciones</td><td>{{ $op['cantidad_liquidaciones'] ?? 0 }}</td>
                  <td class="label">Beneficiarios distintos</td><td>{{ $op['cantidad_beneficiarios_distintos'] ?? 0 }}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      @endif
    </div>

    {{-- Tabla de detalle. Para OP global usamos el formato extendido (estilo OP 393)
         con Forma de Pago, IVA 2da fact (si la liq es Factura A) y Observaciones (que
         incluye "COBRA X" cuando hay cobrador real). Para OP individual mantenemos las
         columnas compactas que ya estaban. --}}
    <div class="section-title">Detalle de liquidaciones</div>
    <table class="detalle">
      <thead>
        <tr>
          <th style="width: 22px;">#</th>
          <th>Cliente</th>
          <th>Sucursal</th>
          <th>Distribuidor</th>
          <th>Periodo</th>
          @if(!empty($op['es_global']))
            <th style="width: 70px;">Forma Pago</th>
          @endif
          <th class="right" style="width: 72px;">Subtotal</th>
          <th class="right" style="width: 56px;">Gastos Adm.</th>
          <th class="right" style="width: 60px;">Desc. Comb.</th>
          <th class="right" style="width: 60px;">Desc. Deuda</th>
          <th class="right" style="width: 56px;">Ajuste</th>
          @if(!empty($op['es_global']))
            <th class="right" style="width: 56px;">IVA 2da Fact.</th>
          @else
            <th class="right" style="width: 56px;">Otros</th>
          @endif
          <th class="right bold" style="width: 78px;">Monto a Pagar</th>
          @if(!empty($op['es_global']))
            <th style="width: 130px;">Observaciones</th>
          @endif
        </tr>
      </thead>
      <tbody>
        @forelse($detalles as $i => $d)
          <tr>
            <td>{{ $i + 1 }}</td>
            <td>{{ $fmtText($d['cliente_nombre'] ?? null) }}</td>
            <td>{{ $fmtText($d['sucursal'] ?? null) }}</td>
            <td>{{ $fmtText($d['distribuidor_nombre'] ?? null) }}</td>
            <td>{{ $fmtText($d['periodo'] ?? null) }}</td>
            @if(!empty($op['es_global']))
              <td>{{ $fmtText($d['forma_pago'] ?? 'TRANSFERENCIA') }}</td>
            @endif
            <td class="right">{{ $fmtMoney($d['subtotal_liquidacion'] ?? null) }}</td>
            <td class="right">{{ ($d['gastos_admin'] ?? 0) != 0 ? $fmtMoney($d['gastos_admin']) : '—' }}</td>
            <td class="right">{{ ($d['descuento_combustible'] ?? 0) != 0 ? $fmtMoney($d['descuento_combustible']) : '—' }}</td>
            <td class="right">{{ ($d['descuento_paquete'] ?? 0) != 0 ? $fmtMoney($d['descuento_paquete']) : '—' }}</td>
            <td class="right">{{ ($d['descuento_ajuste'] ?? 0) != 0 ? $fmtMoney($d['descuento_ajuste']) : ((!empty($d['importe_overridido'])) ? '✎' : '—') }}</td>
            @if(!empty($op['es_global']))
              <td class="right">{{ ($d['iva_2da_factura'] ?? 0) != 0 ? $fmtMoney($d['iva_2da_factura']) . ' (' . rtrim(rtrim(number_format($d['iva_porcentaje'] ?? 21, 2, '.', ''), '0'), '.') . '%)' : '—' }}</td>
            @else
              <td class="right">{{ ($d['otros_descuentos'] ?? 0) != 0 ? $fmtMoney($d['otros_descuentos']) : '—' }}</td>
            @endif
            <td class="right bold">{{ $fmtMoney($d['importe_final'] ?? null) }}</td>
            @if(!empty($op['es_global']))
              <td style="font-size: 9px;">{{ $fmtText($d['observaciones'] ?? null) }}</td>
            @endif
          </tr>
        @empty
          <tr>
            <td colspan="14">No hay detalles para mostrar.</td>
          </tr>
        @endforelse
      </tbody>
    </table>

    {{-- Totales --}}
    <table class="totals">
      <tr>
        <td class="k">Subtotal</td>
        <td class="v">{{ $fmtMoney($op['subtotal'] ?? null) }}</td>
      </tr>
      <tr>
        <td class="k">Total descuentos</td>
        <td class="v">{{ $fmtMoney($op['total_descuentos'] ?? null) }}</td>
      </tr>
      <tr>
        <td class="k grand">Total a pagar</td>
        <td class="v grand">{{ $fmtMoney($op['total_a_pagar'] ?? null) }}</td>
      </tr>
    </table>
    <div class="total-letras">Son: {{ $totalLetras }}</div>

    @if(!empty($op['observaciones']))
      <div style="margin-top: 10px; font-size: 10px;">
        <strong>Observaciones:</strong> {{ $op['observaciones'] }}
      </div>
    @endif

    <div class="footer">
      Documento generado automáticamente — {{ $empresa['razon_social'] ?? 'Logística Argentina SRL' }}
      &mdash; {{ now()->format('d/m/Y H:i') }}
    </div>
  </body>
</html>
