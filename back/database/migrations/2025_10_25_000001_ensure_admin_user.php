<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('users')->updateOrInsert(
            ['email' => 'morellfrancisco@gmail.com'],
            [
                'name' => 'Francisco Morell',
                'password' => Hash::make('Pancho17'),
                'role' => 'admin',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('users')
            ->where('email', 'morellfrancisco@gmail.com')
            ->update([
                'role' => 'operator',
                'updated_at' => now(),
            ]);
    }
};
