<?php

namespace App\Services\Facturacion;

use App\Repositories\Facturacion\ClientesFacturacionRepository;

class ClientesFacturacionQueryService
{
    public function __construct(private readonly ClientesFacturacionRepository $repository)
    {
    }

    public function summary(array $filters = [])
    {
        return $this->repository->summaryQuery($filters)->get();
    }

    public function groupByEncodedId(string $groupId)
    {
        [$clienteId, $sucursalId, $anio, $mes, $periodo] = $this->decodeGroupId($groupId);

        return $this->repository->groupInvoices($clienteId, $sucursalId, $anio, $mes, $periodo);
    }

    public function encodeGroupId(int $clienteId, int $sucursalId, int $anio, int $mes, string $periodo): string
    {
        return rtrim(strtr(base64_encode(implode(':', [$clienteId, $sucursalId, $anio, $mes, $periodo])), '+/', '-_'), '=');
    }

    /**
     * @return array{0:int,1:int,2:int,3:int,4:string}
     */
    public function decodeGroupId(string $groupId): array
    {
        $decoded = base64_decode(strtr($groupId, '-_', '+/'), true);
        if ($decoded === false) {
            throw new \InvalidArgumentException('El group_id no es válido.');
        }

        $parts = explode(':', $decoded, 5);
        if (count($parts) !== 5) {
            throw new \InvalidArgumentException('El group_id no tiene el formato esperado.');
        }

        return [(int) $parts[0], (int) $parts[1], (int) $parts[2], (int) $parts[3], (string) $parts[4]];
    }
}
