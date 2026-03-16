<?php

namespace App\Services\Arca\Wsaa;

use App\Models\ArcaCertificado;
use App\Services\Arca\ArcaCertificateStorage;
use App\Services\Arca\ArcaEndpointResolver;
use App\Services\Arca\Exceptions\WsaaException;
use Carbon\CarbonImmutable;
use SoapClient;
use SoapFault;
use SimpleXMLElement;

class WsaaClient
{
    public function __construct(
        private readonly ArcaEndpointResolver $endpointResolver,
        private readonly ArcaCertificateStorage $certificateStorage,
        private readonly TraXmlBuilder $traXmlBuilder,
        private readonly CmsSigner $cmsSigner,
    ) {
    }

    public function login(ArcaCertificado $certificado, ?string $serviceName = null): WsaaToken
    {
        $service = $serviceName ?: $this->endpointResolver->serviceName();
        $certificatePem = $this->certificateStorage->readCertificatePem($certificado);
        $privateKeyPem = $this->certificateStorage->readPrivateKeyPem($certificado);
        $password = $this->certificateStorage->decryptPasswordReference($certificado->password_ref);

        $traXml = $this->traXmlBuilder->build($service);
        $cms = $this->cmsSigner->sign($traXml, $certificatePem, $privateKeyPem, $password);
        $wsdl = $this->endpointResolver->wsaaWsdl($certificado->ambiente);

        try {
            $client = new SoapClient($wsdl, $this->soapOptions());

            try {
                $response = $client->__soapCall('loginCms', [['in0' => $cms]]);
            } catch (SoapFault) {
                $response = $client->__soapCall('loginCms', [$cms]);
            }
        } catch (SoapFault $exception) {
            throw new WsaaException('WSAA rechazó el loginCms: ' . $exception->getMessage(), 0, $exception);
        }

        $rawXml = $this->extractRawXml($response);
        if ($rawXml === '') {
            throw new WsaaException('WSAA devolvió una respuesta vacía.');
        }

        try {
            $xml = new SimpleXMLElement($rawXml);
            $header = $xml->header ?? null;
            $credentials = $xml->credentials ?? null;
            if (! $header || ! $credentials) {
                throw new WsaaException('La respuesta WSAA no contiene header/credentials.');
            }

            $token = trim((string) ($credentials->token ?? ''));
            $sign = trim((string) ($credentials->sign ?? ''));
            $generationTime = trim((string) ($header->generationTime ?? ''));
            $expirationTime = trim((string) ($header->expirationTime ?? ''));

            if ($token === '' || $sign === '' || $generationTime === '' || $expirationTime === '') {
                throw new WsaaException('La respuesta WSAA no contiene token/sign o vigencia.');
            }

            return new WsaaToken(
                $token,
                $sign,
                CarbonImmutable::parse($generationTime),
                CarbonImmutable::parse($expirationTime),
                $rawXml
            );
        } catch (\Throwable $exception) {
            if ($exception instanceof WsaaException) {
                throw $exception;
            }

            throw new WsaaException('No se pudo parsear la respuesta de WSAA.', 0, $exception);
        }
    }

    private function extractRawXml(mixed $response): string
    {
        if (is_string($response)) {
            return trim($response);
        }

        foreach (['loginCmsReturn', 'LoginCmsReturn', 'return'] as $candidate) {
            $value = data_get($response, $candidate);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
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
