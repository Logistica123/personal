<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class EnsureAdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'morellfrancisco@gmail.com'],
            [
                'name' => 'Francisco Morell',
                'password' => Hash::make('Pancho17'),
                'role' => 'admin',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'superadmin@logistica.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('Logistica#2024'),
                'role' => 'admin',
            ]
        );
    }
}
