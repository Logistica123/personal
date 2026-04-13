<?php

namespace App\Services\Liq\Banco;

use App\DTOs\EstadoTransferencia;
use App\DTOs\ResultadoTransferencia;
use App\DTOs\TransferenciaDTO;
use App\Models\LiqConfigBanco;
use App\Models\LiqOrdenPago;
use Illuminate\Support\Facades\Log;
use RobRichards\WsePhp\WSSESoap;
use RobRichards\XMLSecLibs\XMLSecurityDSig;
use RobRichards\XMLSecLibs\XMLSecurityKey;

/**
 * Adapter ICBC Multipay H2H - SOAP con WS-Security.
 *
 * Protocolo: SOAP 1.1 + WS-Security (firma X.509 + encripción)
 * Servicio: CollectionPPService (Pago a Proveedores)
 * Formato items: PPV4 (CSV en ZIP)
 */
class ICBCMultipayAdapter implements BancoAdapterInterface
{
    private string $endpointUrl;
    private ?string $wsdlUrl;
    private ?string $certBancoPath;   // WebServices.cer (pub ICBC) - para encriptar
    private ?string $certEmpresaPath; // empresa.cer (pub empresa) - se envía con el mensaje
    private ?string $keyEmpresaPath;  // empresa.key (priv empresa) - para firmar
    private int $timeout;

    // Datos del RequestHeader
    private string $docType;
    private string $docNumber;
    private string $userId;

    // Datos del servicio
    private string $serviceId;
    private string $productType;
    private string $deliveryBranch;

    private ICBCCsvHelper $csvHelper;

    public function __construct(LiqConfigBanco $config)
    {
        $this->endpointUrl    = rtrim($config->url_base, '/');
        $this->wsdlUrl        = $config->wsdl_url;
        $this->certBancoPath  = $config->certificado_path ? storage_path('app/' . $config->certificado_path) : null;
        $this->certEmpresaPath = $config->cert_empresa_path ? storage_path('app/' . $config->cert_empresa_path) : null;
        $this->keyEmpresaPath = $config->clave_privada_path ? storage_path('app/' . $config->clave_privada_path) : null;
        $this->timeout        = $config->timeout_segundos ?? 30;

        $this->docType        = $config->doc_type ?? '06';
        $this->docNumber      = $config->doc_number ?? preg_replace('/\D/', '', $config->cuil_empresa ?? '');
        $this->userId         = $this->docType . '_' . $this->docNumber;

        $this->serviceId      = $config->service_id ?? $config->ordenante_id ?? '';
        $this->productType    = $config->product_type ?? '';
        $this->deliveryBranch = $config->delivery_branch ?? '';

        $this->csvHelper = new ICBCCsvHelper();
    }

    // =========================================================================
    // Interface methods
    // =========================================================================

    public function testConexion(): bool
    {
        try {
            $client = $this->createSoapClient();
            $params = ['doEcho' => $this->buildRequestHeader()];
            $response = $client->doEcho($params);

            $result = $response->ResponseHeader->Result ?? '';
            Log::info('ICBC doEcho', ['result' => $result]);

            return strtolower($result) === 'ok';
        } catch (\Exception $e) {
            Log::error('ICBC doEcho falló', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function enviarTransferencia(TransferenciaDTO $dto): ResultadoTransferencia
    {
        // Este método no se usa directamente para ICBC.
        // ICBC trabaja con Listas (createListUpload), no transferencias individuales.
        // Se mantiene por compatibilidad con la interface.
        // Para ICBC, usar enviarListaPago().
        return new ResultadoTransferencia(
            exitoso: false,
            mensaje: 'ICBC requiere envío por Lista. Usar enviarListaPago().',
        );
    }

    public function consultarEstado(string $referencia): EstadoTransferencia
    {
        try {
            $client = $this->createSoapClient();
            $params = [
                'getList' => $this->buildRequestHeader(),
                'getList' => ['ListId' => ['ListId' => $referencia]],
            ];

            $response = $client->getList($params);
            $status = $response->ListHeader->Status ?? 'DESCONOCIDO';

            return new EstadoTransferencia(
                estado:       strtolower($status),
                mensaje:      "Estado ICBC: {$status}",
                fechaProceso: $response->ListHeader->ReleaseDate ?? null,
            );
        } catch (\Exception $e) {
            return new EstadoTransferencia(
                estado:  'error',
                mensaje: $e->getMessage(),
            );
        }
    }

    // =========================================================================
    // Método principal: enviar Lista de Pago a ICBC
    // =========================================================================

    /**
     * Crea una Lista de Pago en ICBC con los items de la OP.
     * Usa flujo abreviado: Status=LIB (liberar automáticamente si no hay errores).
     *
     * @return array{list_id: ?string, tx_id: ?string, result: string, error_code: ?string, error_msg: ?string}
     */
    public function enviarListaPago(LiqOrdenPago $op): array
    {
        $itemCount = $this->csvHelper->contarItems($op);
        $totalCentavos = $this->csvHelper->importeTotalCentavos($op);

        if ($itemCount === 0) {
            return ['list_id' => null, 'tx_id' => null, 'result' => 'error', 'error_code' => 'NO_ITEMS', 'error_msg' => 'No hay items de transferencia en la OP.'];
        }

        // Generar ZIP con CSV PPV4
        $zipData = $this->csvHelper->generarZip($op);

        $payDate = now()->format('d/m/Y H:i:s') . ' -0300';
        $observations = mb_substr("OP {$op->numero_display} - {$op->concepto?->nombre}", 0, 100);

        try {
            $client = $this->createSoapClient();

            $params = [
                // RequestHeader
                'createListUpload' => $this->buildRequestHeader(),

                // ListHeader
                'createListUpload' => [
                    'Service' => [
                        'Id'        => $this->serviceId,
                        'DocType'   => $this->docType,
                        'DocNumber' => $this->docNumber,
                        'Number'    => $this->docType . '|' . $this->docNumber,
                    ],
                    'RefId'              => $op->id,
                    'ProductType'        => $this->productType,
                    'PayDate'            => $payDate,
                    'Observations'       => $observations,
                    'DeliveryBranch'     => $this->deliveryBranch,
                    'DeclaredItemCount'  => $itemCount,
                    'DeclaredAmount'     => $totalCentavos,
                ],

                // UploadParameters
                'createListUpload' => [
                    'UploadFormat' => 'PPV4',
                    'UpdateMaster' => 'N',
                ],

                // ListData (ZIP binario)
                'createListUpload' => $zipData,

                // TransactionAction
                'createListUpload' => [
                    'Status'        => 'LIB', // Liberar automáticamente si OK
                    'StatusOnError'  => 'ABR', // Dejar abierta si hay error
                ],
            ];

            $response = $client->createListUpload($params);

            $result    = $response->ResponseHeader->Result ?? 'error';
            $txId      = $response->ResponseHeader->TxId ?? null;
            $errorCode = $response->ResponseHeader->ErrorCode ?? null;
            $errorMsg  = $response->ResponseHeader->ErrorMsg ?? null;
            $listId    = $response->ListId->ListId ?? null;

            Log::info('ICBC createListUpload', [
                'op_id'   => $op->id,
                'result'  => $result,
                'list_id' => $listId,
                'tx_id'   => $txId,
                'error'   => $errorCode . ' ' . $errorMsg,
            ]);

            return [
                'list_id'    => $listId,
                'tx_id'      => $txId,
                'result'     => strtolower($result),
                'error_code' => $errorCode,
                'error_msg'  => $errorMsg,
            ];
        } catch (\Exception $e) {
            Log::error('ICBC createListUpload falló', ['op_id' => $op->id, 'error' => $e->getMessage()]);

            return [
                'list_id'    => null,
                'tx_id'      => null,
                'result'     => 'error',
                'error_code' => 'EXCEPTION',
                'error_msg'  => $e->getMessage(),
            ];
        }
    }

    /**
     * Consulta el estado de una Lista en ICBC via getList.
     */
    public function consultarLista(string $listId): array
    {
        try {
            $client = $this->createSoapClient();

            $response = $client->getList([
                'getList' => $this->buildRequestHeader(),
                'getList' => ['ListId' => ['ListId' => $listId]],
            ]);

            return [
                'status'              => $response->ListHeader->Status ?? null,
                'status_upload'       => $response->ListHeader->StatusUpload ?? null,
                'accepted_count'      => $response->ListHeader->AcceptedItemCount ?? 0,
                'rejected_count'      => $response->ListHeader->RejectedItemCount ?? 0,
                'release_date'        => $response->ListHeader->ReleaseDate ?? null,
                'collection_account'  => $response->ListHeader->CollectionAccount ?? null,
            ];
        } catch (\Exception $e) {
            Log::error('ICBC getList falló', ['list_id' => $listId, 'error' => $e->getMessage()]);
            return ['status' => 'ERROR', 'error' => $e->getMessage()];
        }
    }

    /**
     * Obtiene los servicios/ordenantes disponibles via getServices.
     */
    public function obtenerServicios(): array
    {
        try {
            $client = $this->createSoapClient();
            $response = $client->getServices(['getServices' => $this->buildRequestHeader()]);

            $servicios = [];
            $services = $response->Service ?? [];
            if (!is_array($services)) $services = [$services];

            foreach ($services as $svc) {
                $servicios[] = [
                    'id'           => $svc->Id ?? null,
                    'doc_type'     => $svc->DocType ?? null,
                    'doc_number'   => $svc->DocNumber ?? null,
                    'description'  => $svc->Description ?? null,
                    'product_type' => $svc->ProductType ?? null,
                ];
            }

            return $servicios;
        } catch (\Exception $e) {
            Log::error('ICBC getServices falló', ['error' => $e->getMessage()]);
            return [];
        }
    }

    // =========================================================================
    // SOAP Client con WS-Security
    // =========================================================================

    private function createSoapClient(): \SoapClient
    {
        $wsdl = $this->wsdlUrl ?? ($this->endpointUrl . '/WEB-INF/wsdl/CollectionPPService.wsdl');

        $client = new \SoapClient($wsdl, [
            'trace'      => true,
            'exceptions' => true,
            'cache_wsdl' => WSDL_CACHE_NONE,
            'location'   => $this->endpointUrl,
            'connection_timeout' => $this->timeout,
            'stream_context'     => stream_context_create([
                'ssl' => [
                    'verify_peer'      => true,
                    'verify_peer_name' => true,
                ],
            ]),
        ]);

        // TODO: Aplicar WS-Security (firma + encripción) al SoapClient
        // Esto requiere interceptar el XML antes de enviarlo.
        // Se implementará usando un middleware SOAP o sobrecargando __doRequest().
        // Por ahora, el cliente se crea sin WS-Security para pruebas de estructura.

        return $client;
    }

    private function buildRequestHeader(): array
    {
        return [
            'UserId'    => $this->userId,
            'DocType'   => $this->docType,
            'DocNumber' => $this->docNumber,
            'Version'   => '1.0',
        ];
    }

    /**
     * Aplica WS-Security (firma + encripción) a un documento SOAP XML.
     * Se usará cuando se implemente el interceptor de SoapClient.
     */
    public function aplicarWsSecurity(\DOMDocument $doc): \DOMDocument
    {
        if (!$this->keyEmpresaPath || !file_exists($this->keyEmpresaPath)) {
            throw new \RuntimeException('Falta la clave privada de la empresa (empresa.key) para firmar el mensaje SOAP.');
        }
        if (!$this->certEmpresaPath || !file_exists($this->certEmpresaPath)) {
            throw new \RuntimeException('Falta el certificado de la empresa (empresa.cer) para el BinarySecurityToken.');
        }
        if (!$this->certBancoPath || !file_exists($this->certBancoPath)) {
            throw new \RuntimeException('Falta el certificado de ICBC (WebServices.cer) para encriptar el mensaje.');
        }

        $wsse = new WSSESoap($doc);

        // Agregar Timestamp
        $wsse->addTimestamp(300); // 5 minutos de validez

        // Firmar con la clave privada de la empresa
        $key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
        $key->loadKey($this->keyEmpresaPath, true);
        $wsse->signSoapDoc($key);

        // Agregar BinarySecurityToken con el certificado público de la empresa
        $token = $wsse->addBinaryToken(file_get_contents($this->certEmpresaPath));
        $wsse->attachTokentoSig($token);

        // Encriptar con el certificado público de ICBC
        $encKey = new XMLSecurityKey(XMLSecurityKey::AES256_CBC);
        $encKey->generateSessionKey();

        $siteKey = new XMLSecurityKey(XMLSecurityKey::RSA_OAEP_MGF1P, ['type' => 'public']);
        $siteKey->loadKey($this->certBancoPath, true, true);

        $wsse->encryptSoapDoc($siteKey, $encKey);

        return $wsse->saveXML();
    }
}
