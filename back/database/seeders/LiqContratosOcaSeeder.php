<?php

namespace Database\Seeders;

use App\Models\LiqCliente;
use App\Models\LiqContratoOca;
use Illuminate\Database\Seeder;

class LiqContratosOcaSeeder extends Seeder
{
    public function run(): void
    {
        $oca = LiqCliente::where('codigo_corto', 'OCA')->orWhere('nombre_corto', 'OCA')->first();
        if (!$oca) {
            $this->command->warn('Cliente OCA no encontrado — skip seed de contratos');
            return;
        }

        $contratos = [
            ['170', 'PAQ. ENTREGADO', 'Paquete Entregado', 'paquete'],
            ['171', 'PAQ. MOVISTAR', 'Paquete Movistar', 'paquete'],
            ['152', 'GRAL PICKUP', 'Pickup General', 'pickup'],
            ['181', 'PQN COMP ALTA', 'PQN Complemento Alta', 'paquete'],
            ['183', 'PQN SERV MOVISTAR', 'PQN Servicio Movistar', 'paquete'],
            ['186', 'PQN PICKUP PRINC', 'PQN Pickup Principal', 'pickup'],
            ['187', 'PQN PICKUP ADIC', 'PQN Pickup Adicional', 'pickup'],
            ['190', 'ADG COMPL ALTA', 'ADG Complemento Alta', 'paquete'],
            ['192', 'ADG SERV MOVISTAR', 'ADG Servicio Movistar', 'paquete'],
            ['195', 'ADG PICKUP PRINC', 'ADG Pickup Principal', 'pickup'],
            ['197', 'ROS TDC/CLEARING', 'TDC/Clearing (Rosario)', 'clearing'],  // BUGFIX 19
            ['198', 'GRAL PAQ. INTERIOR', 'Paquete Interior', 'paquete'],
            ['199', 'GRAL HORAS UTILITARIO', 'Horas Utilitario', 'horas'],
            ['200', 'GRAL KM UTILITARIO', 'Kilómetros Utilitario', 'kilometros'], // BUGFIX 19
        ];

        foreach ($contratos as [$cod, $crudo, $amigable, $unidad]) {
            LiqContratoOca::updateOrCreate(
                ['cliente_id' => $oca->id, 'codigo' => $cod],
                [
                    'descripcion_cruda' => $crudo,
                    'descripcion_amigable' => $amigable,
                    'unidad_recorrido' => $unidad,
                    'activo' => true,
                ]
            );
        }

        $this->command->info("Seed liq_contratos_oca: 14 códigos cargados para cliente OCA id={$oca->id}");
    }
}
