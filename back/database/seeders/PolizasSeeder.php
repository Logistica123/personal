<?php

namespace Database\Seeders;

use App\Models\Poliza;
use App\Models\PolizaAseguradora;
use App\Models\PolizaEmailConfig;
use Illuminate\Database\Seeder;

class PolizasSeeder extends Seeder
{
    public function run(): void
    {
        $aseguradoras = $this->seedAseguradoras();
        $polizas      = $this->seedPolizas($aseguradoras);
        $this->seedEmailConfigs($polizas);
    }

    /** @return array<string, PolizaAseguradora> */
    private function seedAseguradoras(): array
    {
        $rows = [
            [
                'parser_perfil' => 'mapfre',
                'nombre'        => 'MAPFRE',
                'cuit'          => '33-70089372-9',
                'domicilio'     => 'Alférez H. Bouchard 4191 (B1605BNA) - Munro - Prov. Buenos Aires',
                'web'           => 'www.mapfre.com.ar',
                'email_general' => null, // TODO 3: completar email Carlos contacto MAPFRE
            ],
            [
                'parser_perfil' => 'san_cristobal',
                'nombre'        => 'San Cristóbal',
                'cuit'          => '34-50004533-9',
                'domicilio'     => 'Av. 9 de Julio 451, Resistencia, Chaco',
                'web'           => 'www.sancristobal.com.ar',
                'email_general' => 'resistencia@sancristobal.com.ar',
            ],
            [
                'parser_perfil' => 'la_segunda',
                'nombre'        => 'La Segunda',
                'cuit'          => '30-50001770-4',
                'domicilio'     => 'Brig. Gral. Juan Manuel de Rosas 957, Rosario, Sta. Fe',
                'web'           => 'www.lasegunda.com.ar',
                'email_general' => null, // TODO 3: completar email Ramón Morel contacto La Segunda
            ],
        ];

        $result = [];
        foreach ($rows as $row) {
            $result[$row['parser_perfil']] = PolizaAseguradora::updateOrCreate(
                ['parser_perfil' => $row['parser_perfil']],
                array_merge($row, ['activa' => true])
            );
        }
        return $result;
    }

    /** @param array<string, PolizaAseguradora> $aseguradoras
     *  @return array<string, Poliza> */
    private function seedPolizas(array $aseguradoras): array
    {
        $rows = [
            'mapfre_ap' => [
                'aseguradora_id'        => $aseguradoras['mapfre']->id,
                'nombre_descriptivo'    => 'MAPFRE - AP Distribuidores',
                'ramo'                  => 'accidentes_personales',
                'subramo'               => 'AP Ámbito Laboral + In Itinere',
                'tipo_asegurado'        => 'persona',
                'numero_poliza'         => '2297608',
                'numero_cuenta_cliente' => null,
                'vigencia_desde'        => '2025-04-08',
                'vigencia_hasta'        => '2026-04-08',
                'tomador_cuit'          => '30-71706098-5',
                'tomador_razon_social'  => 'LOGISTICA ARGENTINA S.R.L.',
                'tomador_domicilio'     => 'Patagonia 1475, Corrientes',
                'clausulas_especiales'  => 'Cláusulas OCASA',
            ],
            'sc_ap' => [
                'aseguradora_id'        => $aseguradoras['san_cristobal']->id,
                'nombre_descriptivo'    => 'San Cristóbal - AP Colectivo',
                'ramo'                  => 'accidentes_personales',
                'subramo'               => 'AP Colectivo',
                'tipo_asegurado'        => 'persona',
                'numero_poliza'         => '01-06-06-30035710',
                'numero_cuenta_cliente' => '01-02297625',
                'vigencia_desde'        => '2026-03-30',
                'vigencia_hasta'        => '2026-12-05',
                'tomador_cuit'          => '30-71706098-5',
                'tomador_razon_social'  => 'LOGISTICA ARGENTINA SRL',
                'tomador_domicilio'     => 'Av. Tte. Ibáñez 735, Corrientes',
            ],
            'la_autos' => [
                'aseguradora_id'        => $aseguradoras['la_segunda']->id,
                'nombre_descriptivo'    => 'La Segunda - Vehículos Autos',
                'ramo'                  => 'vehiculos',
                'subramo'               => 'Autos',
                'tipo_asegurado'        => 'vehiculo',
                'numero_poliza'         => '67.743.063',
                'vigencia_desde'        => '2026-01-23',
                'vigencia_hasta'        => '2027-01-23',
                'tomador_cuit'          => '30-71706098-5',
                'tomador_razon_social'  => 'LOGISTICA ARGENTINA S.R.L',
                'tomador_domicilio'     => 'Av. Tte. Ibáñez 735, Corrientes',
                'clausulas_especiales'  => 'Cláusulas OCA',
            ],
            'la_motos' => [
                'aseguradora_id'        => $aseguradoras['la_segunda']->id,
                'nombre_descriptivo'    => 'La Segunda - Vehículos Motos',
                'ramo'                  => 'vehiculos',
                'subramo'               => 'Motos',
                'tipo_asegurado'        => 'vehiculo',
                'numero_poliza'         => '45.597.407',
                'vigencia_desde'        => '2026-02-28',
                'vigencia_hasta'        => '2026-05-31',
                'tomador_cuit'          => '30-71706098-5',
                'tomador_razon_social'  => 'LOGISTICA ARGENTINA S.R.L',
                'tomador_domicilio'     => 'Av. Tte. Ibáñez 735, Corrientes',
                'clausulas_especiales'  => 'Cláusulas OCA',
            ],
        ];

        $result = [];
        foreach ($rows as $key => $row) {
            $result[$key] = Poliza::updateOrCreate(
                [
                    'aseguradora_id' => $row['aseguradora_id'],
                    'numero_poliza'  => $row['numero_poliza'],
                ],
                array_merge($row, [
                    'alerta_dias_antes_vencimiento' => 15,
                    'activa'                        => true,
                ])
            );
        }
        return $result;
    }

    /** @param array<string, Poliza> $polizas */
    private function seedEmailConfigs(array $polizas): void
    {
        $configs = [
            // ----- MAPFRE -----
            [
                'poliza_id'           => $polizas['mapfre_ap']->id,
                'tipo'                => 'alta',
                'destinatarios_to'    => ['TODO_email_carlos_mapfre@mapfre.com.ar'],
                'destinatarios_cc'    => [],
                'contacto_nombre'     => 'Carlos',
                'asunto_template'     => 'Solicitud de Alta - Póliza {numero_poliza}',
                'body_template'       => "Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nEn este número de póliza se encuentran las cláusulas correspondientes a OCASA, por lo que solicitamos incluirlas, por favor.\n\nALTAS\n\n{asegurados_block}",
                'asegurado_template'  => "Apellido y Nombre: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
                'adjuntos_requeridos' => [],
            ],
            [
                'poliza_id'           => $polizas['mapfre_ap']->id,
                'tipo'                => 'baja',
                'destinatarios_to'    => ['TODO_email_carlos_mapfre@mapfre.com.ar'],
                'destinatarios_cc'    => [],
                'contacto_nombre'     => 'Carlos',
                'asunto_template'     => 'Solicitud de Baja - Póliza {numero_poliza}',
                'body_template'       => "Buenas {contacto_nombre}\n\nMe comunico para solicitar la baja de los siguientes distribuidores de la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nBAJAS\n\n{asegurados_block}",
                'asegurado_template'  => "Apellido y Nombre: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
                'adjuntos_requeridos' => [],
            ],

            // ----- San Cristóbal — ADDENDUM 16 Parte A: formato tabular (TAB)
            //   Las columnas se separan con `\t` (TAB) para que SC pueda copiar
            //   el bloque y pegarlo en Excel obteniendo cada columna en su celda.
            //   `{indice}` es el correlativo 1..N dentro del correo (no es el
            //   `numero_orden_aseguradora` que asigna la aseguradora al alta).
            [
                'poliza_id'           => $polizas['sc_ap']->id,
                'tipo'                => 'alta',
                'destinatarios_to'    => ['TODO_altas@sancristobal.com.ar'],
                'destinatarios_cc'    => [],
                'contacto_nombre'     => null,
                'asunto_template'     => 'Altas - Póliza {numero_poliza}',
                'body_template'       => "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma Altas\n\nN° orden\tNombre completo\tDNI\tCUIL\tFecha de Nacimiento\n{asegurados_block}",
                'asegurado_template'  => "{indice}\t{nombre_apellido}\t{dni}\t{cuil_sin_guiones}\t{fecha_nac}",
                'adjuntos_requeridos' => [],
            ],
            [
                'poliza_id'           => $polizas['sc_ap']->id,
                'tipo'                => 'baja',
                'destinatarios_to'    => ['TODO_bajas@sancristobal.com.ar'],
                'destinatarios_cc'    => [],
                'contacto_nombre'     => null,
                'asunto_template'     => 'Bajas - Póliza {numero_poliza}',
                'body_template'       => "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma BAJAS\n\nN° orden\tNombre completo\tDNI\tCUIL\n{asegurados_block}",
                'asegurado_template'  => "{indice}\t{nombre_apellido}\t{dni}\t{cuil_sin_guiones}",
                'adjuntos_requeridos' => [],
            ],
            // ADDENDUM 16 Parte B — fila de configuración del correo combinado.
            //   Si existe esta row (tipo='combinado') con `activo=true`, la póliza
            //   soporta combinar altas+bajas en un solo correo. Body template
            //   usa los placeholders {altas_block} y {bajas_block} que el render
            //   service llena con las tablas de altas y bajas respectivamente.
            //   Cada sección reinicia el correlativo {indice} en 1.
            [
                'poliza_id'           => $polizas['sc_ap']->id,
                'tipo'                => 'combinado',
                'destinatarios_to'    => ['TODO_movimientos@sancristobal.com.ar'],
                'destinatarios_cc'    => [],
                'contacto_nombre'     => null,
                'asunto_template'     => 'Altas y Bajas - Póliza {numero_poliza}',
                'body_template'       => "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nALTAS\n\nN° orden\tNombre completo\tDNI\tCUIL\tFecha de Nacimiento\n{altas_block}\n\nBAJAS\n\nN° orden\tNombre completo\tDNI\tCUIL\n{bajas_block}",
                'asegurado_template'  => '', // no se usa: el render compone desde alta + baja
                'adjuntos_requeridos' => [],
            ],

            // ----- La Segunda Autos -----
            [
                'poliza_id'           => $polizas['la_autos']->id,
                'tipo'                => 'alta',
                'destinatarios_to'    => ['TODO_ramon.morel@lasegunda.com.ar'],
                'destinatarios_cc'    => [
                    'TODO_comercial.corrientes@lasegunda.com.ar',
                    'TODO_admin1@logisticaargentina.com.ar',
                    'TODO_admin2@logisticaargentina.com.ar',
                ],
                'contacto_nombre'     => 'Ramón',
                'asunto_template'     => 'NUEVA ALTA - {patente}',
                'body_template'       => "Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.\n\nSolicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.\n\nEstoy atenta a cualquier novedad.\n\nSaludos!",
                'asegurado_template'  => '{patente}',
                'adjuntos_requeridos' => ['foto_frente', 'foto_lateral_der', 'foto_lateral_izq', 'foto_trasera', 'cedula_frente'],
            ],
            [
                'poliza_id'           => $polizas['la_autos']->id,
                'tipo'                => 'baja',
                'destinatarios_to'    => ['TODO_comercial.corrientes@lasegunda.com.ar'],
                'destinatarios_cc'    => [
                    'TODO_ramon.morel@lasegunda.com.ar',
                    'TODO_admin@logisticaargentina.com.ar',
                ],
                'contacto_nombre'     => 'Ramón',
                'asunto_template'     => 'BAJA',
                'body_template'       => "Buenos días {contacto_nombre}\n\nSolicito bajas de las siguientes unidades que se encuentran dentro de la flota de Logística Argentina.\n\n{asegurados_block}\n\nAguardo confirmación\n\nSaludos",
                'asegurado_template'  => '{patente}',
                'adjuntos_requeridos' => [],
            ],

            // ----- La Segunda Motos -----
            [
                'poliza_id'           => $polizas['la_motos']->id,
                'tipo'                => 'alta',
                'destinatarios_to'    => ['TODO_ramon.morel@lasegunda.com.ar'],
                'destinatarios_cc'    => [
                    'TODO_comercial.corrientes@lasegunda.com.ar',
                    'TODO_admin1@logisticaargentina.com.ar',
                ],
                'contacto_nombre'     => 'Ramón',
                'asunto_template'     => 'NUEVA ALTA MOTO - {patente}',
                'body_template'       => "Buenas {contacto_nombre}, solicito el alta de esta moto dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.\n\nSolicito que el seguro de La Segunda tenga las cláusulas de OCA por favor.\n\nEstoy atenta a cualquier novedad.\n\nSaludos!",
                'asegurado_template'  => '{patente}',
                'adjuntos_requeridos' => ['foto_frente', 'foto_lateral_der', 'foto_lateral_izq', 'foto_trasera', 'cedula_frente'],
            ],
            [
                'poliza_id'           => $polizas['la_motos']->id,
                'tipo'                => 'baja',
                'destinatarios_to'    => ['TODO_comercial.corrientes@lasegunda.com.ar'],
                'destinatarios_cc'    => ['TODO_ramon.morel@lasegunda.com.ar'],
                'contacto_nombre'     => 'Ramón',
                'asunto_template'     => 'BAJA MOTO',
                'body_template'       => "Buenos días {contacto_nombre}\n\nSolicito bajas de las siguientes unidades (motos) que se encuentran dentro de la flota de Logística Argentina.\n\n{asegurados_block}\n\nAguardo confirmación\n\nSaludos",
                'asegurado_template'  => '{patente}',
                'adjuntos_requeridos' => [],
            ],
        ];

        foreach ($configs as $config) {
            PolizaEmailConfig::updateOrCreate(
                ['poliza_id' => $config['poliza_id'], 'tipo' => $config['tipo']],
                array_merge($config, ['activo' => true])
            );
        }
    }
}
