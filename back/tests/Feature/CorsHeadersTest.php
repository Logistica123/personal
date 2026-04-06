<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsHeadersTest extends TestCase
{
    public function test_options_includes_actor_cuil_header_for_capacitor_origin(): void
    {
        $response = $this->options('/api/login', [], [
            'Origin' => 'capacitor://localhost',
            'Access-Control-Request-Method' => 'GET',
            'Access-Control-Request-Headers' => 'X-Actor-Cuil',
        ]);

        $response->assertNoContent(204);

        $allowHeaders = strtolower((string) $response->headers->get('Access-Control-Allow-Headers'));
        $this->assertStringContainsString('x-actor-cuil', $allowHeaders);
    }
}
