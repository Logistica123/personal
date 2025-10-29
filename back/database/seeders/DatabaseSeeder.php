<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
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

        User::factory()->count(1)->create();
    }
}
