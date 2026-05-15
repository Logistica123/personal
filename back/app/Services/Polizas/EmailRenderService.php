<?php

namespace App\Services\Polizas;

use App\Models\Poliza;
use App\Models\PolizaAsegurado;
use App\Models\PolizaClausula;
use App\Models\PolizaEmailConfig;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Renderiza el email de una solicitud de alta/baja resolviendo todos los placeholders.
 *
 * Placeholders body:
 *   {numero_poliza}, {numero_cuenta}, {contacto_nombre}, {cuit_logarg},
 *   {admin_nombre}, {admin_email}, {asegurados_block},
 *   {texto_clausula_previa}      (MAPFRE alta — sólo si tipo_clausula_global='previa_existente')
 *   {clausula_global_block}      (SC alta — línea separada con guión)
 *   {texto_intro_alta}           (SC alta — "Informa Altas" o "Informa nuevas altas EN ÍDEM...")
 *   {texto_clausula_la_segunda}  (La Segunda alta — "tenga las cláusulas de {alias}")
 *
 * Placeholders por asegurado:
 *   {nombre_apellido}, {dni}, {dni_con_puntos}, {cuil}, {cuil_sin_guiones},
 *   {fecha_nac}, {patente}, {clausula_inline}, {numero_asegurado}, {indice}
 *   ({indice} es alias de {numero_asegurado} — correlativo 1..N dentro del correo)
 */
class EmailRenderService
{
    /**
     * @param array $opciones {
     *     tipo_clausula_global?: 'ninguna'|'aplicar'|'previa_existente',
     *     clausula_global?: ?PolizaClausula,
     *     clausulas_individuales?: array<int,PolizaClausula>  // [asegurado_id => clausula]
     * }
     * @return array{asunto:string, body:string, destinatarios_to:array, destinatarios_cc:array, destinatarios_bcc:array}
     */
    public function render(
        Poliza $poliza,
        PolizaEmailConfig $config,
        Collection $asegurados,
        User $admin,
        array $opciones = []
    ): array {
        $tipoClausulaGlobal    = $opciones['tipo_clausula_global']  ?? 'ninguna';
        $clausulaGlobal        = $opciones['clausula_global']       ?? null;
        $clausulasIndividuales = $opciones['clausulas_individuales'] ?? [];

        $perfil = $poliza->aseguradora?->parser_perfil ?? '';

        $bloque = $this->renderBloqueAsegurados(
            $asegurados, $config->asegurado_template,
            $config->separador_entre_asegurados ?: "\n",
            $clausulasIndividuales, $perfil
        );

        $globales = $this->placeholdersGlobales(
            $poliza, $config, $admin, $bloque, $asegurados,
            $tipoClausulaGlobal, $clausulaGlobal, $perfil, $config->tipo
        );

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

    /**
     * ADDENDUM 16 Parte B — render para solicitudes tipo='combinado'.
     *
     * Usa el `body_template` del config combinado (con placeholders
     * `{altas_block}` y `{bajas_block}`) y compone cada sección con el
     * `asegurado_template` del config de alta y baja respectivamente.
     * Cada sección reinicia el correlativo `{indice}` en 1.
     *
     * Cláusulas: por simplicidad, en modo combinado no se aplican cláusulas
     * (ni globales ni individuales). El frontend no permite seleccionarlas
     * para este modo.
     */
    public function renderCombinado(
        Poliza $poliza,
        PolizaEmailConfig $configCombinado,
        PolizaEmailConfig $configAlta,
        PolizaEmailConfig $configBaja,
        Collection $altas,
        Collection $bajas,
        User $admin,
    ): array {
        $perfil = $poliza->aseguradora?->parser_perfil ?? '';

        $altasBlock = $this->renderBloqueAsegurados(
            $altas, $configAlta->asegurado_template,
            $configAlta->separador_entre_asegurados ?: "\n",
            [], $perfil
        );
        $bajasBlock = $this->renderBloqueAsegurados(
            $bajas, $configBaja->asegurado_template,
            $configBaja->separador_entre_asegurados ?: "\n",
            [], $perfil
        );

        // Los globales se calculan con el config combinado (asunto, recipients)
        // pero el {asegurados_block} clásico no aplica acá. Lo dejamos vacío
        // por si alguien usa templates legacy en el wrapper.
        $globales = $this->placeholdersGlobales(
            $poliza, $configCombinado, $admin, '', $altas->merge($bajas),
            'ninguna', null, $perfil, 'combinado'
        );
        $globales['{altas_block}'] = $altasBlock;
        $globales['{bajas_block}'] = $bajasBlock;

        $asunto = $this->aplicar($configCombinado->asunto_template, $globales);
        $body   = $this->aplicar($configCombinado->body_template, $globales);

        return [
            'asunto'             => $asunto,
            'body'               => $body,
            'destinatarios_to'   => $configCombinado->destinatarios_to ?? [],
            'destinatarios_cc'   => $configCombinado->destinatarios_cc ?? [],
            'destinatarios_bcc'  => $configCombinado->destinatarios_bcc ?? [],
        ];
    }

    /**
     * Renderiza el bloque de asegurados (header ya rendido por afuera; acá
     * solo van las filas). El correlativo arranca en 1 y crece de a uno.
     *
     * @param array<int,?PolizaClausula> $clausulasIndividuales [asegurado_id => clausula|null]
     */
    private function renderBloqueAsegurados(
        Collection $asegurados,
        string $aseguradoTemplate,
        string $separador,
        array $clausulasIndividuales,
        string $perfil,
    ): string {
        return $asegurados
            ->values()
            ->map(fn ($a, $i) => $this->renderAsegurado(
                $a,
                $aseguradoTemplate,
                $i + 1,
                $clausulasIndividuales[$a->id] ?? null,
                $perfil,
            ))
            ->implode($separador);
    }

    private function renderAsegurado(
        PolizaAsegurado $a,
        string $template,
        int $numero,
        ?PolizaClausula $clausulaIndividual,
        string $perfil
    ): string {
        $cuil    = $this->resolverCuil($a);
        $dni     = $this->resolverDni($a);
        $patente = $a->identificador_tipo === 'patente' ? strtoupper($a->identificador) : '';

        $nombre = $a->nombre_apellido_pdf;
        if (!$nombre && $a->persona) {
            $nombre = trim(($a->persona->apellidos ?? '') . ' ' . ($a->persona->nombres ?? ''));
        }

        $fechaNac = $a->fecha_nacimiento_pdf
            ? Carbon::parse($a->fecha_nacimiento_pdf)->format('d/m/Y')
            : '';

        $clausulaInline = $clausulaIndividual
            ? $this->formatClausulaInline($clausulaIndividual->descripcion_corta ?? '', $perfil)
            : '';

        return $this->aplicar($template, [
            '{numero_asegurado}'  => (string) $numero,
            '{indice}'            => (string) $numero,
            '{nombre_apellido}'   => $nombre ?? '',
            '{dni}'               => $dni ?? '',
            '{dni_con_puntos}'    => $this->formatDniConPuntos($dni),
            '{cuil}'              => $cuil ?? '',
            '{cuil_sin_guiones}'  => preg_replace('/\D/', '', $cuil ?? ''),
            '{fecha_nac}'         => $fechaNac,
            '{patente}'           => $patente,
            '{clausula_inline}'   => $clausulaInline,
        ]);
    }

    private function placeholdersGlobales(
        Poliza $poliza,
        PolizaEmailConfig $config,
        User $admin,
        string $bloqueAsegurados,
        Collection $asegurados,
        string $tipoClausulaGlobal,
        ?PolizaClausula $clausulaGlobal,
        string $perfil,
        string $tipoOperacion
    ): array {
        // Patente expuesta como placeholder global cuando hay 1 sólo asegurado vehículo
        // (templates de La Segunda usan {patente} en el ASUNTO).
        $patente = '';
        if ($asegurados->count() === 1 && $asegurados->first()?->identificador_tipo === 'patente') {
            $patente = strtoupper($asegurados->first()->identificador);
        }

        return [
            '{numero_poliza}'              => $poliza->numero_poliza ?? '',
            '{numero_cuenta}'              => $poliza->numero_cuenta_cliente ?? '',
            '{contacto_nombre}'            => $config->contacto_nombre ?? '',
            '{cuit_logarg}'                => $poliza->tomador_cuit ?? '',
            '{admin_nombre}'               => $admin->name ?? '',
            '{admin_email}'                => $admin->email ?? '',
            '{patente}'                    => $patente,
            '{asegurados_block}'           => $bloqueAsegurados,
            '{clausula_global_block}'      => $this->renderClausulaGlobalBlock($tipoClausulaGlobal, $clausulaGlobal),
            '{texto_intro_alta}'           => $this->renderTextoIntroAlta($tipoClausulaGlobal, $perfil, $tipoOperacion),
            '{texto_clausula_previa}'      => $this->renderTextoClausulaPrevia($tipoClausulaGlobal, $perfil),
            '{texto_clausula_la_segunda}'  => $this->renderTextoClausulaLaSegunda($tipoClausulaGlobal, $clausulaGlobal, $perfil),
        ];
    }

    /** Formato inline de la cláusula según aseguradora. */
    private function formatClausulaInline(string $descripcion, string $perfil): string
    {
        if ($descripcion === '') return '';
        return match ($perfil) {
            'mapfre'        => ' (' . $descripcion . ')',
            'san_cristobal' => ' -(' . $descripcion . ')',
            'la_segunda'    => ' -(' . $descripcion . ')',
            default         => ' (' . $descripcion . ')',
        };
    }

    /** Bloque de cláusula global (SC alta — línea separada con guión). */
    private function renderClausulaGlobalBlock(string $tipo, ?PolizaClausula $cl): string
    {
        if ($tipo !== 'aplicar' || !$cl) return '';
        return "\n-(" . ($cl->descripcion_corta ?? '') . ")\n";
    }

    /** Texto intro del cuerpo SC alta (cambia si hay cláusula global). */
    private function renderTextoIntroAlta(string $tipo, string $perfil, string $tipoOperacion): string
    {
        if ($perfil !== 'san_cristobal') return '';
        if ($tipoOperacion !== 'alta') return 'Informa Altas';
        if ($tipo === 'aplicar') {
            return 'Informa nuevas altas EN ÍDEM CONDICIONES DE PÓLIZA INCLUIR CLAUSULA DE NO REPETICION A FAVOR DE:';
        }
        return 'Informa Altas';
    }

    /** Párrafo "incluir mismas cláusulas de endosos previos" (MAPFRE alta). */
    private function renderTextoClausulaPrevia(string $tipo, string $perfil): string
    {
        if ($perfil !== 'mapfre') return '';
        if ($tipo === 'previa_existente') {
            return "\n\nPor favor, incluir las mismas cláusulas que figuran en endosos anteriores correspondientes a este número de póliza.";
        }
        return '';
    }

    /** Frase dinámica "tenga las cláusulas de {alias}" en La Segunda. */
    private function renderTextoClausulaLaSegunda(string $tipo, ?PolizaClausula $cl, string $perfil): string
    {
        if ($perfil !== 'la_segunda') return '';
        if ($tipo === 'aplicar' && $cl && $cl->alias) {
            return "\n\nSolicito que el seguro de La Segunda tenga las cláusulas de {$cl->alias} por favor.";
        }
        return '';
    }

    /** `'34451216'` → `'34.451.216'`. Devuelve '' si no se puede. */
    public static function formatDniConPuntos(?string $dni): string
    {
        $digits = preg_replace('/\D/', '', $dni ?? '');
        if (!$digits) return '';
        return number_format((int) $digits, 0, '', '.');
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
