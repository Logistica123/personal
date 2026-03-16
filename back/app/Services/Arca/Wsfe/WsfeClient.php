<?php

namespace App\Services\Arca\Wsfe;

use App\Models\ArcaCertificado;
use App\Services\Arca\ArcaEndpointResolver;
use App\Services\Arca\Exceptions\WsfeException;
use App\Services\Arca\Wsaa\TaCacheService;
use App\Services\Arca\Wsaa\WsaaToken;
use SoapClient;
use SoapFault;

class WsfeClient
{
    public function __construct(
        private readonly ArcaEndpointResolver $endpointResolver,
        private readonly TaCacheService $taCacheService,
    ) {
    }

    /**
     * @return array{points:array<int,array<string,mixed>>,request_xml:string,response_xml:string}
     */
    public function paramGetPtosVenta(ArcaCertificado $certificado, ?WsaaToken $token = null): array
    {
        $auth = $this->authPayload($certificado, $token);
        [$client, $response] = $this->call($certificado, 'FEParamGetPtosVenta', [['Auth' => $auth]]);
        $payload = $this->normalize($response);
        $result = data_get($payload, 'FEParamGetPtosVentaResult.ResultGet', []);
        $points = data_get($result, 'PtoVenta', []);
        if ($points !== [] && array_is_list($points) === false) {
            $points = [$points];
        }

        return [
            'points' => is_array($points) ? $points : [],
            'request_xml' => (string) $client->__getLastRequest(),
            'response_xml' => (string) $client->__getLastResponse(),
        ];
    }

    /**
     * @return array{units:array<int,array<string,mixed>>,request_xml:string,response_xml:string}
     */
    public function paramGetTiposUnidad(ArcaCertificado $certificado, ?WsaaToken $token = null): array
    {
        $auth = $this->authPayload($certificado, $token);
        [$client, $response] = $this->call($certificado, 'FEParamGetTiposUnidad', [['Auth' => $auth]]);
        $payload = $this->normalize($response);
        $result = data_get($payload, 'FEParamGetTiposUnidadResult.ResultGet', []);
        $units = data_get($result, 'Unidad', []);
        if ($units !== [] && array_is_list($units) === false) {
            $units = [$units];
        }

        return [
            'units' => is_array($units) ? $units : [],
            'request_xml' => (string) $client->__getLastRequest(),
            'response_xml' => (string) $client->__getLastResponse(),
        ];
    }

    public function compUltimoAutorizado(ArcaCertificado $certificado, int $ptoVta, int $cbteTipo, ?WsaaToken $token = null): array
    {
        $auth = $this->authPayload($certificado, $token);
        [$client, $response] = $this->call($certificado, 'FECompUltimoAutorizado', [[
            'Auth' => $auth,
            'PtoVta' => $ptoVta,
            'CbteTipo' => $cbteTipo,
        ]]);
        $payload = $this->normalize($response);
        $result = data_get($payload, 'FECompUltimoAutorizadoResult', []);

        return [
            'cbte_nro' => (int) data_get($result, 'CbteNro', 0),
            'errors' => data_get($result, 'Errors.Err', []),
            'events' => data_get($result, 'Events.Evt', []),
            'request_xml' => (string) $client->__getLastRequest(),
            'response_xml' => (string) $client->__getLastResponse(),
        ];
    }

    public function caeSolicitar(ArcaCertificado $certificado, array $request, ?WsaaToken $token = null): array
    {
        $auth = $this->authPayload($certificado, $token);
        [$client, $response] = $this->call($certificado, 'FECAESolicitar', [[
            'Auth' => $auth,
            'FeCAEReq' => $request['FeCAEReq'] ?? $request,
        ]]);

        $payload = $this->normalize($response);
        $result = data_get($payload, 'FECAESolicitarResult', []);
        $detail = data_get($result, 'FeDetResp.FECAEDetResponse', []);
        if ($detail !== [] && array_is_list($detail) === false) {
            $detail = [$detail];
        }
        $firstDetail = is_array($detail) && isset($detail[0]) && is_array($detail[0]) ? $detail[0] : [];

        return [
            'resultado' => (string) data_get($result, 'FeCabResp.Resultado', ''),
            'cae' => data_get($firstDetail, 'CAE'),
            'cae_vto' => data_get($firstDetail, 'CAEFchVto'),
            'cbte_desde' => data_get($firstDetail, 'CbteDesde'),
            'cbte_hasta' => data_get($firstDetail, 'CbteHasta'),
            'observaciones' => data_get($firstDetail, 'Observaciones.Obs', []),
            'errores' => data_get($result, 'Errors.Err', []),
            'eventos' => data_get($result, 'Events.Evt', []),
            'raw' => $result,
            'request_xml' => (string) $client->__getLastRequest(),
            'response_xml' => (string) $client->__getLastResponse(),
        ];
    }

    /**
     * @return array{0:SoapClient,1:mixed}
     */
    private function call(ArcaCertificado $certificado, string $method, array $arguments): array
    {
        try {
            $client = new SoapClient(
                $this->endpointResolver->wsfeWsdl($certificado->ambiente),
                $this->soapOptions()
            );

            return [$client, $client->__soapCall($method, $arguments)];
        } catch (SoapFault $exception) {
            throw new WsfeException(sprintf('WSFEv1 falló en %s: %s', $method, $exception->getMessage()), 0, $exception);
        }
    }

    /**
     * @return array{Token:string,Sign:string,Cuit:int}
     */
    private function authPayload(ArcaCertificado $certificado, ?WsaaToken $token = null): array
    {
        $resolvedToken = $token ?? $this->taCacheService->getValidTa($certificado, $this->endpointResolver->serviceName());
        $cuit = (int) ($certificado->emisor?->cuit ?? config('services.arca.cuit_emisor_default'));

        return [
            'Token' => $resolvedToken->token,
            'Sign' => $resolvedToken->sign,
            'Cuit' => $cuit,
        ];
    }

    private function normalize(mixed $value): array
    {
        return json_decode(json_encode($value, JSON_UNESCAPED_UNICODE), true) ?: [];
    }

    /**
     * @return array<string, mixed>
     */
    private function soapOptions(): array
    {
        $timeout = (int) config('services.arca.ws_timeout', 30);
        $options = [
            'trace' => true,
            'exceptions' => true,
            'cache_wsdl' => WSDL_CACHE_NONE,
            'connection_timeout' => $timeout,
        ];

        $context = $this->buildStreamContext($timeout);
        if ($context !== null) {
            $options['stream_context'] = $context;
        }

        return $options;
    }

    /**
     * @return resource|null
     */
    private function buildStreamContext(int $timeout)
    {
        $caBundle = config('services.arca.ca_bundle');
        if (! $caBundle || ! is_string($caBundle) || ! is_file($caBundle)) {
            $defaultBundle = '/etc/ssl/certs/ca-certificates.crt';
            $caBundle = is_file($defaultBundle) ? $defaultBundle : null;
        }

        $ssl = [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
            'crypto_method' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT,
        ];
        if ($caBundle) {
            $ssl['cafile'] = $caBundle;
        }
        $ciphers = config('services.arca.ssl_ciphers');
        if (is_string($ciphers) && $ciphers !== '') {
            $ssl['ciphers'] = $ciphers;
        }

        $http = [
            'timeout' => $timeout,
            'user_agent' => 'LogisticaERP/ARCA',
        ];

        return stream_context_create([
            'ssl' => $ssl,
            'http' => $http,
        ]);
    }
}
