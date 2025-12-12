<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NosisClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class NosisController extends Controller
{
    public function __construct(private readonly NosisClient $client)
    {
    }

    public function validarCbu(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'documento' => ['required', 'string', 'max:20'],
            'cbu' => ['required', 'digits:22'],
            'grupoVid' => ['nullable', 'integer'],
        ]);

        try {
            $result = $this->client->validateCbu(
                $validated['documento'],
                $validated['cbu'],
                $validated['grupoVid'] ?? null,
            );
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 502);
        }

        return response()->json([
            'message' => $result['message'],
            'valid' => $result['valid'],
            'data' => [
                'raw' => $result['raw'],
            ],
        ]);
    }
}
