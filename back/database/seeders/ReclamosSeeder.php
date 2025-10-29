<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Reclamo;

class ReclamosSeeder extends Seeder
{
    public function run(): void
    {
        Reclamo::create([
            'titulo' => 'Reclamo de prueba 1',
            'descripcion' => 'El usuario reporta un problema con el sistema de carga.',
            'estado' => 'pendiente',
            'fecha_alta' => now(),
        ]);

        Reclamo::create([
            'titulo' => 'Reclamo de prueba 2',
            'descripcion' => 'El cliente solicita una revisión del servicio de transporte.',
            'estado' => 'resuelto',
            'fecha_alta' => now(),
        ]);
    }
}
