<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'totp_secret')) {
                $table->string('totp_secret')->nullable()->after('role');
            }
            if (! Schema::hasColumn('users', 'totp_enabled_at')) {
                $table->timestamp('totp_enabled_at')->nullable()->after('totp_secret');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['totp_secret', 'totp_enabled_at']);
        });
    }
};
