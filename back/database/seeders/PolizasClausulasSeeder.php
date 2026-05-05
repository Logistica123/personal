<?php

namespace Database\Seeders;

use App\Models\Poliza;
use App\Models\PolizaAseguradora;
use App\Models\PolizaClausula;
use App\Models\PolizaClausulaAplicada;
use App\Models\PolizaEmailConfig;
use Illuminate\Database\Seeder;

/**
 * Seeder consolidado de los addendums 10/11/12 (cláusulas):
 *  - 6 cláusulas en el catálogo (con alias).
 *  - 2 pólizas MAPFRE adicionales (URBANO y NEWSAN) + sus email_configs.
 *  - Aplicaciones de cláusulas a las 3 pólizas MAPFRE.
 *  - Templates MAPFRE/SC/La Segunda actualizados con los nuevos placeholders.
 *  - Separador `\n\n` para SC alta.
 */
class PolizasClausulasSeeder extends Seeder
{
    public function run(): void
    {
        $clausulas = $this->seedClausulas();
        $polizasMapfre = $this->seedPolizasMapfreAdicionales();
        $this->seedEmailConfigsMapfreAdicionales($polizasMapfre);
        $this->aplicarClausulasIniciales($clausulas);
        $this->actualizarTemplatesConClausulas();
    }

    /** @return array<string,PolizaClausula> */
    private function seedClausulas(): array
    {
        $rows = [
            ['nombre_corto' => 'OCASA',                                'alias' => 'OCASA',
             'cuit_titular' => '30-66204961-8', 'razon_social_titular' => 'OCASA',
             'descripcion_corta' => 'Con clausula de Ocasa CUIT N 30 66204961 8'],

            ['nombre_corto' => 'URBANO Suc. Moreno - NEWSAN',          'alias' => 'URBANO',
             'cuit_titular' => '30-64261755-5', 'razon_social_titular' => 'NEWSAN S.A.',
             'descripcion_corta' => 'Con clausula de NEWSAN S.A. CUIT N 30 64261755 5'],

            ['nombre_corto' => 'NEWSAN La Tablada - CBN',              'alias' => 'NEWSAN',
             'cuit_titular' => '30-71159690-5', 'razon_social_titular' => 'CBN',
             'descripcion_corta' => 'Con clausula de CBN CUIT N 30 71159690 5'],

            ['nombre_corto' => 'NEWSAN La Tablada - ID Supply Chain',  'alias' => 'NEWSAN',
             'cuit_titular' => '30-71069830-5', 'razon_social_titular' => 'ID Supply Chain S.A.',
             'descripcion_corta' => 'Con clausula de ID Supply Chain S.A. CUIT N 30 71069830 5'],

            ['nombre_corto' => 'OCA Parque Norte / Avellaneda',        'alias' => 'OCA',
             'cuit_titular' => '30-71702439-3', 'razon_social_titular' => 'OCA',
             'descripcion_corta' => 'Con clausula de No Repetición a nombre de OCA CUIT N 30 71702439 3'],

            ['nombre_corto' => 'NEWSAN',                                'alias' => 'NEWSAN',
             'cuit_titular' => '30-64261755-5', 'razon_social_titular' => 'NEWSAN S.A.',
             'descripcion_corta' => 'Con clausula de NEWSAN S.A. CUIT N 30 64261755 5'],
        ];

        $result = [];
        foreach ($rows as $r) {
            $result[$r['nombre_corto']] = PolizaClausula::updateOrCreate(
                ['nombre_corto' => $r['nombre_corto']],
                array_merge($r, ['tipo' => 'no_repeticion', 'activa' => true])
            );
        }
        return $result;
    }

    /** @return array<string,Poliza> */
    private function seedPolizasMapfreAdicionales(): array
    {
        $mapfreId = PolizaAseguradora::where('parser_perfil', 'mapfre')->value('id');

        $base = [
            'aseguradora_id'        => $mapfreId,
            'ramo'                  => 'accidentes_personales',
            'subramo'               => 'AP Ámbito Laboral + In Itinere',
            'tipo_asegurado'        => 'persona',
            'vigencia_desde'        => '2025-04-08',
            'vigencia_hasta'        => '2026-04-08',
            'tomador_cuit'          => '30-71706098-5',
            'tomador_razon_social'  => 'LOGISTICA ARGENTINA S.R.L.',
            'tomador_domicilio'     => 'Patagonia 1475, Corrientes',
            'alerta_dias_antes_vencimiento' => 15,
            'activa'                => true,
        ];

        $urbano = Poliza::updateOrCreate(
            ['aseguradora_id' => $mapfreId, 'numero_poliza' => '2297847'],
            array_merge($base, [
                'nombre_descriptivo' => 'MAPFRE - AP URBANO / Otras Empresas',
                'numero_poliza'      => '2297847',
            ])
        );

        $newsan = Poliza::updateOrCreate(
            ['aseguradora_id' => $mapfreId, 'numero_poliza' => '2298721'],
            array_merge($base, [
                'nombre_descriptivo' => 'MAPFRE - AP NEWSAN',
                'numero_poliza'      => '2298721',
            ])
        );

        return ['urbano' => $urbano, 'newsan' => $newsan];
    }

    /** @param array<string,Poliza> $polizas */
    private function seedEmailConfigsMapfreAdicionales(array $polizas): void
    {
        // Templates MAPFRE actualizados (con placeholders de cláusula).
        $bodyAlta = "Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.{texto_clausula_previa}\n\nALTAS\n\n{asegurados_block}";
        $bodyBaja = "Buenas {contacto_nombre}\n\nMe comunico para solicitar la baja del siguiente distribuidor de la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nBAJAS\n\n{asegurados_block}";
        $aseguradoAlta = "Nombre Completo: {nombre_apellido}{clausula_inline}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n";
        $aseguradoBaja = "Nombre Completo: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n";

        foreach ($polizas as $key => $p) {
            PolizaEmailConfig::updateOrCreate(
                ['poliza_id' => $p->id, 'tipo' => 'alta'],
                [
                    'destinatarios_to'    => ['TODO_carlos@mapfre.com.ar'],
                    'destinatarios_cc'    => [],
                    'contacto_nombre'     => 'Carlos',
                    'asunto_template'     => 'Solicitud de Alta - Póliza {numero_poliza}',
                    'body_template'       => $bodyAlta,
                    'asegurado_template'  => $aseguradoAlta,
                    'separador_entre_asegurados' => "\n",
                    'adjuntos_requeridos' => [],
                    'activo'              => true,
                ]
            );
            PolizaEmailConfig::updateOrCreate(
                ['poliza_id' => $p->id, 'tipo' => 'baja'],
                [
                    'destinatarios_to'    => ['TODO_carlos@mapfre.com.ar'],
                    'destinatarios_cc'    => [],
                    'contacto_nombre'     => 'Carlos',
                    'asunto_template'     => 'Solicitud de Baja - Póliza {numero_poliza}',
                    'body_template'       => $bodyBaja,
                    'asegurado_template'  => $aseguradoBaja,
                    'separador_entre_asegurados' => "\n",
                    'adjuntos_requeridos' => [],
                    'activo'              => true,
                ]
            );
        }
    }

    /** @param array<string,PolizaClausula> $clausulas */
    private function aplicarClausulasIniciales(array $clausulas): void
    {
        $polizas = [
            '2297608' => [$clausulas['OCASA']],                                       // OCASA
            '2297847' => [$clausulas['URBANO Suc. Moreno - NEWSAN']],                 // URBANO
            '2298721' => [
                $clausulas['NEWSAN La Tablada - CBN'],
                $clausulas['NEWSAN La Tablada - ID Supply Chain'],
            ],
        ];

        foreach ($polizas as $numero => $cls) {
            $polizaId = Poliza::where('numero_poliza', $numero)->value('id');
            if (!$polizaId) continue;
            foreach ($cls as $cl) {
                PolizaClausulaAplicada::updateOrCreate(
                    [
                        'poliza_id'      => $polizaId,
                        'clausula_id'    => $cl->id,
                        'aplicada_desde' => '2025-04-08',
                    ],
                    ['tipo_aplicacion' => 'global']
                );
            }
        }
    }

    /**
     * Actualiza los templates MAPFRE/SC/La Segunda con los placeholders nuevos.
     *
     * Se ejecuta también sobre la póliza MAPFRE OCASA original (ya creada por
     * PolizasSeeder anterior) para que use la versión universal.
     */
    private function actualizarTemplatesConClausulas(): void
    {
        // ---- MAPFRE Alta (todas las pólizas MAPFRE — incluye OCASA original) ----
        $mapfreId = PolizaAseguradora::where('parser_perfil', 'mapfre')->value('id');
        $polizasMapfre = Poliza::where('aseguradora_id', $mapfreId)->pluck('id');

        PolizaEmailConfig::query()
            ->whereIn('poliza_id', $polizasMapfre)
            ->where('tipo', 'alta')
            ->update([
                'body_template'      => "Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.{texto_clausula_previa}\n\nALTAS\n\n{asegurados_block}",
                'asegurado_template' => "Nombre Completo: {nombre_apellido}{clausula_inline}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
            ]);

        // ---- San Cristóbal Alta — formato addendum 11 ----
        $scId = PolizaAseguradora::where('parser_perfil', 'san_cristobal')->value('id');
        PolizaEmailConfig::query()
            ->whereIn('poliza_id', Poliza::where('aseguradora_id', $scId)->pluck('id'))
            ->where('tipo', 'alta')
            ->update([
                'body_template'      => "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_N° cuenta: {numero_cuenta}\n\n{texto_intro_alta}\n{clausula_global_block}\n{asegurados_block}",
                'asegurado_template' => '{numero_asegurado})_: {nombre_apellido}{clausula_inline} DNI: {dni_con_puntos} FECHA DE NACIMIENTO: {fecha_nac}',
                'separador_entre_asegurados' => "\n\n",
            ]);

        // ---- La Segunda Alta — placeholder texto_clausula_la_segunda ----
        $laId = PolizaAseguradora::where('parser_perfil', 'la_segunda')->value('id');
        PolizaEmailConfig::query()
            ->whereIn('poliza_id', Poliza::where('aseguradora_id', $laId)->pluck('id'))
            ->where('tipo', 'alta')
            ->update([
                'body_template' => "Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.{texto_clausula_la_segunda}\n\nEstoy atenta a cualquier novedad.\n\nSaludos!",
                'asegurado_template' => '{patente}{clausula_inline}',
            ]);
    }
}
