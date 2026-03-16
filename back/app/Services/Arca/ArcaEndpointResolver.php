<?php

namespace App\Services\Arca;

use App\Support\Facturacion\AmbienteArca;

class ArcaEndpointResolver
{
    public function wsaaWsdl(AmbienteArca|string $ambiente): string
    {
        $target = $ambiente instanceof AmbienteArca ? $ambiente : AmbienteArca::fromMixed((string) $ambiente);

        return $target === AmbienteArca::HOMO
            ? (string) config('services.arca.wsaa.homo_wsdl')
            : (string) config('services.arca.wsaa.prod_wsdl');
    }

    public function wsfeWsdl(AmbienteArca|string $ambiente): string
    {
        $target = $ambiente instanceof AmbienteArca ? $ambiente : AmbienteArca::fromMixed((string) $ambiente);

        return $target === AmbienteArca::HOMO
            ? (string) config('services.arca.wsfe.homo_wsdl')
            : (string) config('services.arca.wsfe.prod_wsdl');
    }

    public function serviceName(): string
    {
        return (string) config('services.arca.service_name', 'wsfe');
    }
}
