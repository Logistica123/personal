<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PersonasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('personas')->insert([
            [
                'nombres' => 'Juan',
                'apellidos' => 'Pérez',
                'cuil' => '20-12345678-9',
                'telefono' => '1122334455',
                'email' => 'juan.perez@example.com',
                'pago' => false,
                'cliente_id' => null,
                'fecha_alta' => Carbon::now(),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'nombres' => 'María',
                'apellidos' => 'Gómez',
                'cuil' => '27-98765432-1',
                'telefono' => '1166778899',
                'email' => 'maria.gomez@example.com',
                'pago' => true,
                'cliente_id' => null,
                'fecha_alta' => Carbon::now(),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
        ]);
    }
}
