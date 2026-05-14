<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('users')
            ->whereNotNull('permissions')
            ->orderBy('id')
            ->chunkById(200, function ($users) {
                foreach ($users as $user) {
                    $decoded = json_decode($user->permissions, true);
                    if (! is_array($decoded)) {
                        continue;
                    }

                    $hasPersonal = in_array('personal', $decoded, true)
                        || in_array('proveedores', $decoded, true);

                    if (! $hasPersonal || in_array('personal-editar', $decoded, true)) {
                        continue;
                    }

                    $decoded[] = 'personal-editar';

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['permissions' => json_encode(array_values(array_unique($decoded)))]);
                }
            });
    }

    public function down(): void
    {
        DB::table('users')
            ->whereNotNull('permissions')
            ->orderBy('id')
            ->chunkById(200, function ($users) {
                foreach ($users as $user) {
                    $decoded = json_decode($user->permissions, true);
                    if (! is_array($decoded) || ! in_array('personal-editar', $decoded, true)) {
                        continue;
                    }

                    $filtered = array_values(array_filter(
                        $decoded,
                        fn ($p) => $p !== 'personal-editar'
                    ));

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['permissions' => json_encode($filtered)]);
                }
            });
    }
};
