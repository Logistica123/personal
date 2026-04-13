<?php

namespace App\Services\Liq\Banco;

use App\DTOs\EstadoTransferencia;
use App\DTOs\ResultadoTransferencia;
use App\DTOs\TransferenciaDTO;
use App\Models\LiqConfigBanco;
use Illuminate\Support\Facades\Log;

/**
 * Adapter para ICBC Multipay H2H (Host-to-Host).
 *
 * Usa mTLS (mutual TLS) con certificado digital para autenticarse.
 * Los detalles del formato XML/SOAP dependen de la doc técnica de ICBC (pendiente).
 *
 * Endpoints y formato de request/response son PROVISIONALES.
 * Se completarán cuando se reciba la documentación técnica del WS.
 */
class ICBCMultipayAdapter implements BancoAdapterInterface
{
    private string $baseUrl;
    private ?string $certServidor;
    private ?string $certCliente;
    private ?string $clavePrivada;
    private int $timeout;
    private string $ordenanteId;
    private string $cuit;

    public function __construct(LiqConfigBanco $config)
    {
        $this->baseUrl      = rtrim($config->url_base, '/');
        $this->certServidor = $config->certificado_path ? storage_path('app/' . $config->certificado_path) : null;
        $this->certCliente  = $config->certificado_cliente_path ? storage_path('app/' . $config->certificado_cliente_path) : null;
        $this->clavePrivada = $config->clave_privada_path ? storage_path('app/' . $config->clave_privada_path) : null;
        $this->timeout      = $config->timeout_segundos ?? 30;
        $this->ordenanteId  = $config->ordenante_id ?? '';
        $this->cuit         = $config->cuil_empresa ?? '';
    }

    // -------------------------------------------------------------------------
    // Interface methods
    // -------------------------------------------------------------------------

    public function testConexion(): bool
    {
        try {
            // Intentar conectar vía mTLS al endpoint base
            $response = $this->request('/test', '<ping/>');
            return !empty($response);
        } catch (\Exception $e) {
            Log::warning('ICBC test conexión falló', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function enviarTransferencia(TransferenciaDTO $dto): ResultadoTransferencia
    {
        // TODO: Completar con formato XML/SOAP real de ICBC cuando se tenga la doc técnica
        $xml = $this->buildTransferenciaXml($dto);

        try {
            $response = $this->request('/pagos/proveedores', $xml);
            return $this->parseTransferenciaResponse($response);
        } catch (\Exception $e) {
            Log::error('ICBC enviar transferencia falló', [
                'referencia' => $dto->referencia,
                'error'      => $e->getMessage(),
            ]);

            return new ResultadoTransferencia(
                exitoso:     false,
                codigo:      'ERROR',
                mensaje:     $e->getMessage(),
                responseRaw: null,
            );
        }
    }

    public function consultarEstado(string $referencia): EstadoTransferencia
    {
        // TODO: Completar con endpoint real de ICBC
        $xml = "<consultaEstado><referencia>{$referencia}</referencia></consultaEstado>";

        try {
            $response = $this->request('/consulta/estado', $xml);
            return $this->parseEstadoResponse($response);
        } catch (\Exception $e) {
            return new EstadoTransferencia(
                estado:  'error',
                mensaje: $e->getMessage(),
            );
        }
    }

    // -------------------------------------------------------------------------
    // HTTP con mTLS via cURL
    // -------------------------------------------------------------------------

    private function request(string $endpoint, string $xmlBody): string
    {
        $url = $this->baseUrl . $endpoint;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $xmlBody,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: text/xml; charset=utf-8',
                'Accept: text/xml',
            ],

            // mTLS: certificado del cliente
            CURLOPT_SSLCERT        => $this->certCliente,
            CURLOPT_SSLKEY         => $this->clavePrivada,

            // Verificar certificado del servidor ICBC
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        // Si tenemos el certificado del servidor como CA
        if ($this->certServidor && file_exists($this->certServidor)) {
            curl_setopt($ch, CURLOPT_CAINFO, $this->certServidor);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        $errno    = curl_errno($ch);
        curl_close($ch);

        if ($errno) {
            throw new \RuntimeException("Error mTLS (curl {$errno}): {$error}");
        }

        if ($httpCode >= 400) {
            throw new \RuntimeException("HTTP {$httpCode} de ICBC: " . substr((string) $response, 0, 500));
        }

        return (string) $response;
    }

    // -------------------------------------------------------------------------
    // XML builders (PROVISORIOS - completar con doc ICBC)
    // -------------------------------------------------------------------------

    private function buildTransferenciaXml(TransferenciaDTO $dto): string
    {
        // TODO: Reemplazar con el formato XML/SOAP real de ICBC
        return <<<XML
        <pagoProveedor>
            <ordenante>{$this->ordenanteId}</ordenante>
            <cuit>{$this->cuit}</cuit>
            <cbuOrigen>{$dto->cbuOrigen}</cbuOrigen>
            <cbuDestino>{$dto->cbuDestino}</cbuDestino>
            <importe>{$dto->importe}</importe>
            <moneda>{$dto->moneda}</moneda>
            <concepto>{$dto->concepto}</concepto>
            <referencia>{$dto->referencia}</referencia>
            <beneficiario>{$dto->beneficiario}</beneficiario>
            <cuitBeneficiario>{$dto->cuitBenef}</cuitBeneficiario>
        </pagoProveedor>
        XML;
    }

    private function parseTransferenciaResponse(string $xml): ResultadoTransferencia
    {
        // TODO: Parsear respuesta real de ICBC
        // Por ahora, intentar extraer campos básicos del XML
        $exitoso = str_contains($xml, '<estado>OK</estado>') || str_contains($xml, '<codigo>00</codigo>');

        $referencia = null;
        if (preg_match('/<referencia>(.*?)<\/referencia>/s', $xml, $m)) {
            $referencia = $m[1];
        }

        $codigo = null;
        if (preg_match('/<codigo>(.*?)<\/codigo>/s', $xml, $m)) {
            $codigo = $m[1];
        }

        $mensaje = null;
        if (preg_match('/<mensaje>(.*?)<\/mensaje>/s', $xml, $m)) {
            $mensaje = $m[1];
        }

        return new ResultadoTransferencia(
            exitoso:         $exitoso,
            referenciaBanco: $referencia,
            codigo:          $codigo,
            mensaje:         $mensaje,
            responseRaw:     $xml,
        );
    }

    private function parseEstadoResponse(string $xml): EstadoTransferencia
    {
        // TODO: Parsear respuesta real de ICBC
        $estado = 'pendiente';
        if (preg_match('/<estado>(.*?)<\/estado>/s', $xml, $m)) {
            $estado = strtolower($m[1]);
        }

        $mensaje = null;
        if (preg_match('/<mensaje>(.*?)<\/mensaje>/s', $xml, $m)) {
            $mensaje = $m[1];
        }

        return new EstadoTransferencia(
            estado:       $estado,
            mensaje:      $mensaje,
            fechaProceso: null,
        );
    }
}
