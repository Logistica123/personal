<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TeamGroup;
use App\Models\TeamGroupMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeamGroupController extends Controller
{
    public function index(): JsonResponse
    {
        $teams = TeamGroup::query()
            ->with('members')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $teams]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'color' => ['nullable', 'string', 'max:32'],
            'members' => ['nullable', 'array'],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.email' => ['nullable', 'email', 'max:255'],
        ]);

        $team = TeamGroup::create([
            'name' => $data['name'],
            'color' => $data['color'] ?? null,
        ]);

        $members = collect($data['members'] ?? [])
            ->filter(fn ($member) => is_array($member) && ! empty(trim((string) ($member['name'] ?? ''))))
            ->map(fn ($member) => [
                'name' => trim((string) $member['name']),
                'email' => isset($member['email']) ? trim((string) $member['email']) : null,
            ])
            ->values();

        if ($members->isNotEmpty()) {
            $team->members()->createMany($members->all());
        }

        return response()->json(['data' => $team->load('members')], 201);
    }

    public function update(Request $request, TeamGroup $teamGroup): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'color' => ['nullable', 'string', 'max:32'],
            'members' => ['nullable', 'array'],
            'members.*.id' => ['nullable', 'integer', Rule::exists('team_group_members', 'id')->where('team_group_id', $teamGroup->id)],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.email' => ['nullable', 'email', 'max:255'],
        ]);

        $teamGroup->update([
            'name' => $data['name'],
            'color' => $data['color'] ?? null,
        ]);

        $teamGroup->members()->delete();

        $members = collect($data['members'] ?? [])
            ->filter(fn ($member) => is_array($member) && ! empty(trim((string) ($member['name'] ?? ''))))
            ->map(fn ($member) => [
                'name' => trim((string) $member['name']),
                'email' => isset($member['email']) ? trim((string) $member['email']) : null,
            ])
            ->values();

        if ($members->isNotEmpty()) {
            $teamGroup->members()->createMany($members->all());
        }

        return response()->json(['data' => $teamGroup->load('members')]);
    }

    public function destroy(TeamGroup $teamGroup): JsonResponse
    {
        $teamGroup->delete();

        return response()->json(['message' => 'Equipo eliminado correctamente.']);
    }
}
