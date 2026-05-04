<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaEmailConfig;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Renderiza el email de una solicitud de alta/baja resolviendo todos los placeholders.
 *
 * Placeholders globales:
 *   {numero_poliza}, {numero_cuenta}, {contacto_nombre}, {cuit_logarg},
 *   {admin_nombre}, {admin_email}, {asegurados_block}
 *
 * Placeholders por asegurado (en `asegurado_template`):
 *   {nombre_apellido}, {dni}, {cuil}, {cuil_sin_guiones}, {fecha_nac}, {patente}
 */
class EmailRenderService
{
    /**
     * @return array{asunto:string, body:string, destinatarios_to:array, destinatarios_cc:array, destinatarios_bcc:array}
     */
    public function render(
        Poliza $poliza,
        PolizaEmailConfig $config,
        Collection $asegurados,
        User $admin
    ): array {
        $bloque = $asegurados
            ->map(fn (PolizaAsegurado $a) => $this->renderAsegurado($a, $config->asegurado_template))
            ->implode("\n");

        $globales = $this->placeholdersGlobales($poliza, $config, $admin, $bloque, $asegurados);

        $asunto = $this->aplicar($config->asunto_template, $globales);
        $body   = $this->aplicar($config->body_template, $globales);

        return [
            'asunto'             => $asunto,
            'body'               => $body,
            'destinatarios_to'   => $config->destinatarios_to ?? [],
            'destinatarios_cc'   => $config->destinatarios_cc ?? [],
            'destinatarios_bcc'  => $config->destinatarios_bcc ?? [],
        ];
    }

    private function renderAsegurado(PolizaAsegurado $a, string $template): string
    {
        $cuil = $this->resolverCuil($a);
        $dni  = $this->resolverDni($a);
        $patente = $a->identificador_tipo === 'patente' ? strtoupper($a->identificador) : '';

        $nombre = $a->nombre_apellido_pdf;
        if (!$nombre && $a->persona) {
            $nombre = trim(($a->persona->apellidos ?? '') . ' ' . ($a->persona->nombres ?? ''));
        }

        $fechaNac = $a->fecha_nacimiento_pdf
            ? Carbon::parse($a->fecha_nacimiento_pdf)->format('d/m/Y')
            : '';

        return $this->aplicar($template, [
            '{nombre_apellido}'  => $nombre ?? '',
            '{dni}'              => $dni ?? '',
            '{cuil}'             => $cuil ?? '',
            '{cuil_sin_guiones}' => preg_replace('/\D/', '', $cuil ?? ''),
            '{fecha_nac}'        => $fechaNac,
            '{patente}'          => $patente,
        ]);
    }

    private function placeholdersGlobales(
        Poliza $poliza,
        PolizaEmailConfig $config,
        User $admin,
        string $bloqueAsegurados,
        Collection $asegurados
    ): array {
        // Si hay 1 sólo asegurado y es vehículo, exponer su patente como placeholder global
        // (algunos templates de La Segunda usan {patente} en el ASUNTO, no sólo en el bloque).
        $patente = '';
        if ($asegurados->count() === 1 && $asegurados->first()->identificador_tipo === 'patente') {
            $patente = strtoupper($asegurados->first()->identificador);
        }

        return [
            '{numero_poliza}'    => $poliza->numero_poliza ?? '',
            '{numero_cuenta}'    => $poliza->numero_cuenta_cliente ?? '',
            '{contacto_nombre}'  => $config->contacto_nombre ?? '',
            '{cuit_logarg}'      => $poliza->tomador_cuit ?? '',
            '{admin_nombre}'     => $admin->name ?? '',
            '{admin_email}'      => $admin->email ?? '',
            '{patente}'          => $patente,
            '{asegurados_block}' => $bloqueAsegurados,
        ];
    }

    private function aplicar(string $template, array $reemplazos): string
    {
        return str_replace(array_keys($reemplazos), array_values($reemplazos), $template);
    }

    private function resolverCuil(PolizaAsegurado $a): ?string
    {
        if ($a->identificador_tipo === 'cuil') return $a->identificador;
        return $a->persona?->cuil;
    }

    private function resolverDni(PolizaAsegurado $a): ?string
    {
        if ($a->identificador_tipo === 'dni') return $a->identificador;
        $cuil = $this->resolverCuil($a);
        return MatchingService::extraerDniDeCuil($cuil);
    }
}
