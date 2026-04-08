<?php

namespace App\Services\Kommo;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KommoClient
{
    private string $baseUrl;
    private string $accessToken;

    public function __construct()
    {
        $subdomain = config('kommo.subdomain');
        $this->baseUrl = "https://{$subdomain}.kommo.com";
        $this->accessToken = config('kommo.access_token', '');
    }

    /**
     * Fetch all leads from Kommo for one or more pipelines.
     *
     * @param  int[]  $pipelineIds  Empty array = all pipelines.
     */
    public function fetchAllLeads(array $pipelineIds = []): array
    {
        $allLeads = [];
        $page = 1;
        $limit = 250;

        do {
            $query = [
                'page' => $page,
                'limit' => $limit,
                'with' => 'contacts,tags',
            ];

            if (count($pipelineIds) === 1) {
                $query['filter[pipeline_id]'] = $pipelineIds[0];
            } elseif (count($pipelineIds) > 1) {
                foreach ($pipelineIds as $i => $id) {
                    $query["filter[pipeline_id][{$i}]"] = $id;
                }
            }

            $response = $this->request('GET', '/api/v4/leads', $query);

            if ($response === null) {
                break;
            }

            $leads = $response['_embedded']['leads'] ?? [];

            if (empty($leads)) {
                break;
            }

            $allLeads = array_merge($allLeads, $leads);
            $page++;
        } while (count($leads) === $limit);

        return $allLeads;
    }

    /**
     * Fetch pipeline statuses to map status_id -> status name.
     */
    public function fetchPipelines(): array
    {
        $response = $this->request('GET', '/api/v4/leads/pipelines');

        return $response['_embedded']['pipelines'] ?? [];
    }

    /**
     * Fetch users to map responsible_user_id -> user name.
     */
    public function fetchUsers(): array
    {
        $allUsers = [];
        $page = 1;

        do {
            $response = $this->request('GET', '/api/v4/users', [
                'page' => $page,
                'limit' => 250,
            ]);

            if ($response === null) {
                break;
            }

            $users = $response['_embedded']['users'] ?? [];
            if (empty($users)) {
                break;
            }

            $allUsers = array_merge($allUsers, $users);
            $page++;
        } while (count($users) === 250);

        return $allUsers;
    }

    /**
     * Fetch custom fields for a given entity (leads, contacts, companies).
     */
    public function fetchCustomFields(string $entity = 'leads'): array
    {
        $response = $this->request('GET', "/api/v4/{$entity}/custom_fields");

        return $response['_embedded']['custom_fields'] ?? [];
    }

    /**
     * Make an authenticated request to Kommo API.
     */
    private function request(string $method, string $path, array $query = []): ?array
    {
        $response = Http::withToken($this->accessToken)
            ->timeout(30)
            ->baseUrl($this->baseUrl)
            ->acceptJson()
            ->withoutVerifying()
            ->send($method, $path, ['query' => $query]);

        if ($response->status() === 204) {
            return null;
        }

        if (! $response->successful()) {
            Log::error('Kommo API error', [
                'status' => $response->status(),
                'body' => $response->body(),
                'path' => $path,
            ]);
            return null;
        }

        return $response->json();
    }
}
