<?php

use App\Models\User;
use App\Models\WorkflowTask;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflow_tasks', function (Blueprint $table) {
            if (! Schema::hasColumn('workflow_tasks', 'creator_email')) {
                $table->string('creator_email')->nullable()->after('creator_id');
            }

            if (! Schema::hasColumn('workflow_tasks', 'responsable_email')) {
                $table->string('responsable_email')->nullable()->after('responsable_id');
            }
        });

        if (Schema::hasColumn('workflow_tasks', 'creator_email')) {
            WorkflowTask::query()->chunkById(100, function ($tasks) {
                $tasks->each(function (WorkflowTask $task) {
                    $creatorEmail = $task->creator_email;
                    if (! $creatorEmail && $task->creator_id) {
                        $creatorEmail = User::query()->where('id', $task->creator_id)->value('email');
                    }

                    $responsableEmail = $task->responsable_email;
                    if (! $responsableEmail && $task->responsable_id) {
                        $responsableEmail = User::query()->where('id', $task->responsable_id)->value('email');
                    }

                    if ($creatorEmail || $responsableEmail) {
                        DB::table('workflow_tasks')
                            ->where('id', $task->id)
                            ->update([
                                'creator_email' => $creatorEmail,
                                'responsable_email' => $responsableEmail,
                            ]);
                    }
                });
            });
        }
    }

    public function down(): void
    {
        Schema::table('workflow_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('workflow_tasks', 'creator_email')) {
                $table->dropColumn('creator_email');
            }

            if (Schema::hasColumn('workflow_tasks', 'responsable_email')) {
                $table->dropColumn('responsable_email');
            }
        });
    }
};
