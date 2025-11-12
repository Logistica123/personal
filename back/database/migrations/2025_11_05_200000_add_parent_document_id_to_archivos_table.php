<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_document_id')->nullable()->after('persona_id');
            $table->index('parent_document_id');
            $table->foreign('parent_document_id')->references('id')->on('archivos')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('archivos', function (Blueprint $table) {
            $table->dropForeign(['parent_document_id']);
            $table->dropIndex(['parent_document_id']);
            $table->dropColumn('parent_document_id');
        });
    }
};
