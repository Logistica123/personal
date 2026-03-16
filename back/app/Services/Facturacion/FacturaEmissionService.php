<?php

namespace App\Services\Facturacion;

use App\Models\FacturaCabecera;
use App\Repositories\Arca\ArcaCertificadoRepository;
use App\Repositories\Facturacion\FacturaCabeceraRepository;
use App\Services\Arca\Wsaa\TaCacheService;
use App\Services\Arca\Wsfe\EmissionLockService;
use App\Services\Arca\Wsfe\InvoiceNumberResolver;
use App\Services\Arca\Wsfe\WsfeClient;
use App\Services\Arca\Wsfe\WsfeRequestBuilder;
use App\Support\Facturacion\FacturaEstado;
use Illuminate\Support\Facades\DB;

class FacturaEmissionService
{
    public function __construct(
        private readonly FacturaCabeceraRepository $facturaRepository,
        private readonly ArcaCertificadoRepository $certificadoRepository,
        private readonly FacturaValidator $validator,
        private readonly FacturaIdempotencyService $idempotencyService,
        private readonly FacturacionAuditService $auditService,
        private readonly TaCacheService $taCacheService,
        private readonly WsfeClient $wsfeClient,
        private readonly WsfeRequestBuilder $requestBuilder,
        private readonly InvoiceNumberResolver $invoiceNumberResolver,
        private readonly EmissionLockService $lockService,
        private readonly FacturaXmlStorageService $xmlStorageService,
        private readonly FacturaPdfService $pdfService,
    ) {
    }

    /**
     * @return array{factura:FacturaCabecera,reused:bool}
     */
    public function emit(FacturaCabecera $factura, ?int $usuarioId = null, ?string $ip = null): array
    {
        $factura->loadMissing(['emisor', 'certificado', 'ivaItems', 'tributos', 'detallePdf']);
        $this->validator->validateOrFail($factura);

        $factura->hash_idempotencia = $this->idempotencyService->buildHashForFactura($factura);
        $factura->save();

        $authorized = $this->facturaRepository->findAuthorizedByHash($factura->hash_idempotencia);
        if ($authorized && $authorized->id !== $factura->id) {
            return ['factura' => $authorized, 'reused' => true];
        }

        $ambiente = $factura->ambiente?->value ?? (string) $factura->ambiente;

        return $this->lockService->runWithLock(
            (int) $factura->emisor_id,
            $ambiente,
            (int) $factura->pto_vta,
            (int) $factura->cbte_tipo,
            function () use ($factura, $usuarioId, $ip) {
                return DB::transaction(function () use ($factura, $usuarioId, $ip) {
                    $fresh = FacturaCabecera::query()
                        ->with(['emisor', 'certificado', 'ivaItems', 'tributos', 'detallePdf'])
                        ->lockForUpdate()
                        ->findOrFail($factura->id);

                    $alreadyAuthorized = $this->facturaRepository->findAuthorizedByHash($fresh->hash_idempotencia);
                    if ($alreadyAuthorized && $alreadyAuthorized->id !== $fresh->id) {
                        return ['factura' => $alreadyAuthorized, 'reused' => true];
                    }

                    if ($fresh->estado instanceof FacturaEstado && $fresh->estado->isFiscallyLocked()) {
                        return ['factura' => $fresh, 'reused' => false];
                    }

                    $certificado = $this->certificadoRepository->findActiveForEmisor(
                        (int) $fresh->emisor_id,
                        $fresh->ambiente?->value ?? (string) $fresh->ambiente
                    );
                    if (! $certificado) {
                        throw new \RuntimeException('No hay certificado activo para el emisor y ambiente seleccionados.');
                    }

                    $fresh->certificado_id = $certificado->id;
                    $fresh->estado = FacturaEstado::ENVIANDO_ARCA;
                    $fresh->save();

                    $ta = $this->taCacheService->getValidTa($certificado);
                    $nextNumber = $this->invoiceNumberResolver->resolveNextNumber($fresh, $certificado, $ta);
                    $request = $this->requestBuilder->buildCaeRequest($fresh, $nextNumber);
                    $response = $this->wsfeClient->caeSolicitar($certificado, $request, $ta);
                    $xmlPaths = $this->xmlStorageService->store(
                        $fresh,
                        (string) ($response['request_xml'] ?? ''),
                        (string) ($response['response_xml'] ?? '')
                    );

                    $before = $fresh->toArray();
                    $fresh->request_xml_path = $xmlPaths['request'];
                    $fresh->response_xml_path = $xmlPaths['response'];
                    $fresh->resultado_arca = $response['resultado'] ?? null;
                    $fresh->observaciones_arca_json = $response['observaciones'] ?? [];
                    $fresh->errores_arca_json = $response['errores'] ?? [];

                    if (($response['resultado'] ?? '') === 'A') {
                        $fresh->cbte_numero = (int) ($response['cbte_desde'] ?? $nextNumber);
                        $fresh->cae = (string) ($response['cae'] ?? '');
                        $fresh->cae_vto = $this->normalizeArcaDate($response['cae_vto'] ?? null);
                        $fresh->estado = FacturaEstado::AUTORIZADA;
                        $fresh->pdf_path = $this->pdfService->generate($fresh);
                        $fresh->estado = FacturaEstado::PDF_GENERADO;
                    } elseif (($response['resultado'] ?? '') === 'R') {
                        $fresh->estado = FacturaEstado::RECHAZADA_ARCA;
                    } else {
                        $fresh->estado = FacturaEstado::ERROR_TECNICO;
                    }

                    $fresh->save();

                    $this->auditService->record(
                        'factura_cabecera',
                        $fresh->id,
                        'factura.emitida',
                        $before,
                        $fresh->fresh()->toArray(),
                        $usuarioId,
                        $ip
                    );

                    return ['factura' => $fresh->fresh(['emisor', 'certificado', 'cliente', 'sucursal', 'ivaItems', 'tributos', 'detallePdf']), 'reused' => false];
                });
            }
        );
    }

    private function normalizeArcaDate(mixed $value): ?string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^\d{8}$/', $normalized) === 1) {
            return substr($normalized, 0, 4) . '-' . substr($normalized, 4, 2) . '-' . substr($normalized, 6, 2);
        }

        return $normalized;
    }
}
