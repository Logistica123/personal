<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Certificado de Cobertura — {{ $persona->apellidos }} {{ $persona->nombres }}</title>
    <style>
        @page { margin: 18mm 16mm; }
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 11pt;
            color: #222;
            margin: 0;
        }
        .header {
            border-bottom: 2px solid #1d74f5;
            padding-bottom: 8px;
            margin-bottom: 16px;
        }
        .header h1 {
            font-size: 16pt;
            margin: 0 0 4px 0;
            color: #1d74f5;
        }
        .header .empresa {
            font-size: 10pt;
            color: #555;
        }
        .seccion {
            margin-bottom: 14px;
        }
        .seccion h2 {
            font-size: 11pt;
            margin: 0 0 6px 0;
            border-bottom: 1px solid #ccc;
            padding-bottom: 3px;
            color: #1d74f5;
        }
        table.datos {
            width: 100%;
            border-collapse: collapse;
        }
        table.datos td {
            padding: 3px 6px;
            vertical-align: top;
        }
        table.datos td.label {
            color: #666;
            width: 38%;
            font-size: 10pt;
        }
        table.datos td.value {
            font-weight: bold;
        }
        .clausulas-list {
            margin: 0;
            padding-left: 18px;
        }
        .clausulas-list li {
            margin-bottom: 4px;
        }
        .footer {
            margin-top: 24px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            font-size: 9pt;
            color: #777;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Certificado de Cobertura de Seguro</h1>
        <div class="empresa">LOGÍSTICA ARGENTINA S.R.L. · CUIT 30-71706098-5</div>
    </div>

    <div class="seccion">
        <h2>Datos del distribuidor</h2>
        <table class="datos">
            <tr>
                <td class="label">Nombre y Apellido</td>
                <td class="value">{{ trim(($persona->apellidos ?? '') . ' ' . ($persona->nombres ?? '')) }}</td>
            </tr>
            <tr>
                <td class="label">CUIL</td>
                <td class="value">{{ $persona->cuil ?? '—' }}</td>
            </tr>
            @if($dni)
            <tr>
                <td class="label">DNI</td>
                <td class="value">{{ $dni }}</td>
            </tr>
            @endif
            @if($fecha_nacimiento)
            <tr>
                <td class="label">Fecha de nacimiento</td>
                <td class="value">{{ $fecha_nacimiento }}</td>
            </tr>
            @endif
        </table>
    </div>

    <div class="seccion">
        <h2>Datos de la cobertura</h2>
        <table class="datos">
            <tr>
                <td class="label">Aseguradora</td>
                <td class="value">{{ $poliza->aseguradora?->nombre ?? '—' }}</td>
            </tr>
            <tr>
                <td class="label">Tipo de cobertura</td>
                <td class="value">{{ $ramo_legible }}@if($poliza->subramo) — {{ $poliza->subramo }}@endif</td>
            </tr>
            <tr>
                <td class="label">N° de póliza</td>
                <td class="value">{{ $poliza->numero_poliza }}</td>
            </tr>
            @if($asegurado->fecha_alta_efectiva)
            <tr>
                <td class="label">Vigencia desde</td>
                <td class="value">{{ \Illuminate\Support\Carbon::parse($asegurado->fecha_alta_efectiva)->format('d/m/Y') }}</td>
            </tr>
            @endif
            <tr>
                <td class="label">Vigencia hasta</td>
                <td class="value">{{ \Illuminate\Support\Carbon::parse($poliza->vigencia_hasta)->format('d/m/Y') }}</td>
            </tr>
        </table>
    </div>

    @if($asegurado->tipo_asegurado === 'vehiculo')
    <div class="seccion">
        <h2>Datos del vehículo</h2>
        <table class="datos">
            <tr>
                <td class="label">Patente</td>
                <td class="value">{{ $asegurado->identificador }}</td>
            </tr>
            @if($asegurado->marca_modelo_pdf)
            <tr>
                <td class="label">Marca / Modelo</td>
                <td class="value">{{ $asegurado->marca_modelo_pdf }}</td>
            </tr>
            @endif
            @if($asegurado->tipo_vehiculo_pdf)
            <tr>
                <td class="label">Tipo de vehículo</td>
                <td class="value">{{ $asegurado->tipo_vehiculo_pdf }}</td>
            </tr>
            @endif
        </table>
    </div>
    @endif

    @if(count($clausulas) > 0)
    <div class="seccion">
        <h2>Cláusulas aplicadas</h2>
        <ul class="clausulas-list">
            @foreach($clausulas as $cla)
                <li>{{ $cla->descripcion_corta ?? $cla->nombre_corto }}</li>
            @endforeach
        </ul>
    </div>
    @endif

    <div class="footer">
        Este certificado se emite con fines informativos. Los detalles completos
        de la póliza, incluyendo coberturas y exclusiones, se encuentran en el
        contrato original celebrado con la aseguradora.
        <br>
        Generado el {{ $fecha_generacion }} por DistriApp — Logística Argentina.
    </div>
</body>
</html>
