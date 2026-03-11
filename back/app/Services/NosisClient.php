<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class NosisClient
{
    public function validateCbu(string $documento, string $cbu, ?int $grupoVid = null, ?string $fechaNacimiento = null): array
    {
        $groupId = $grupoVid ?? config('nosis.group_id');

        return $this->requestValidation([
            'documento' => $documento,
            'CBU' => $cbu,
            'NroGrupoVID' => $groupId,
            'FechaNacimiento' => $fechaNacimiento ?: null,
        ]);
    }

    public function lookupDocumento(string $documento, ?int $grupoVid = null, ?string $fechaNacimiento = null): array
    {
        $groupId = $grupoVid ?? config('nosis.group_id');

        try {
            return $this->requestVariables([
                'documento' => $documento,
                'VR' => $groupId,
            ]);
        } catch (RuntimeException $exception) {
            if (!config('nosis.variables.fallback_to_validation', true)) {
                throw $exception;
            }
        }

        return $this->requestValidation([
            'documento' => $documento,
            'NroGrupoVID' => $groupId,
            'FechaNacimiento' => $fechaNacimiento ?: null,
        ]);
    }

    private function requestValidation(array $params): array
    {
        $baseUrl = config('nosis.validation.base_url', config('nosis.base_url'));
        $username = config('nosis.validation.username', config('nosis.username'));
        $token = config('nosis.validation.token', config('nosis.token'));
        $timeout = config('nosis.timeout', 10);
        $isCbuValidation = isset($params['CBU']) && $params['CBU'] !== null && $params['CBU'] !== '';

        if (!$baseUrl || !$username || !$token) {
            throw new RuntimeException('Faltan credenciales de Nosis (NOSIS_BASE_URL, NOSIS_USERNAME, NOSIS_TOKEN).');
        }

        $query = array_filter(
            [
                'usuario' => $username,
                'token' => $token,
                ...$params,
            ],
            static fn ($value) => $value !== null && $value !== ''
        );

        try {
            $response = Http::timeout($timeout)
                ->retry(1, 300)
                ->get($baseUrl, $query);
        } catch (\Throwable $exception) {
            throw new RuntimeException($exception->getMessage(), previous: $exception);
        }

        if (!$response->ok()) {
            throw new RuntimeException("Nosis devolvió HTTP {$response->status()}");
        }

        return $this->resolveResponse($response, $isCbuValidation);
    }

    private function requestVariables(array $params): array
    {
        $baseUrl = config('nosis.variables.base_url');
        $timeout = config('nosis.timeout', 10);
        $format = config('nosis.variables.format', 'XML');
        $fex = config('nosis.variables.fex');

        if (!$baseUrl) {
            throw new RuntimeException('Falta la URL del servicio WS01 Variables (NOSIS_VARIABLES_BASE_URL).');
        }

        $query = array_filter(
            [
                ...$params,
                'Format' => $format ?: null,
                'FEX' => $fex ?: null,
            ],
            static fn ($value) => $value !== null && $value !== ''
        );

        $attempts = $this->buildVariablesAuthAttempts($query);
        if ($attempts === []) {
            throw new RuntimeException(
                'Faltan credenciales para WS01 Variables (NOSIS_API_KEY o NOSIS_VARIABLES_USERNAME/NOSIS_VARIABLES_TOKEN).'
            );
        }

        $url = $this->resolveVariablesUrl($baseUrl);
        $lastError = null;

        foreach ($attempts as $attempt) {
            try {
                $response = Http::timeout($timeout)
                    ->retry(1, 300)
                    ->withHeaders($attempt['headers'])
                    ->get($url, $attempt['query']);
            } catch (\Throwable $exception) {
                $lastError = $exception->getMessage();
                continue;
            }

            if ($response->ok()) {
                return $this->resolveResponse($response, false);
            }

            $lastError = "Nosis WS01 devolvió HTTP {$response->status()}";
        }

        throw new RuntimeException($lastError ?? 'No se pudo consultar el servicio WS01 Variables de Nosis.');
    }

    private function resolveResponse(Response $response, bool $isCbuValidation): array
    {
        $raw = $response->json();

        if ($raw === null) {
            $raw = $response->body();
        }

        $message = null;
        $valid = false;

        if (is_array($raw)) {
            $raw = $this->expandVariablesArrayPayload($raw);
            $message = Arr::get($raw, 'Mensaje')
                ?? Arr::get($raw, 'mensaje')
                ?? Arr::get($raw, 'Message')
                ?? Arr::get($raw, 'message')
                ?? Arr::get($raw, 'Contenido.Resultado.Novedad')
                ?? Arr::get($raw, 'Resultado.Novedad')
                ?? Arr::get($raw, 'resultado.novedad')
                ?? Arr::get($raw, 'ResultadoNovedad');

            $valid = $this->isSuccessfulArrayPayload($raw, $message, $isCbuValidation);
        } elseif (is_string($raw)) {
            $parsedXml = $this->parseXmlMessage($raw, $isCbuValidation);
            if ($parsedXml) {
                $message = $parsedXml['message'];
                $valid = $parsedXml['valid'];
            } else {
                $message = $raw;
                $valid = $this->isValidMessage($message);
            }
        }

        $resolvedMessage = $message ?: 'Respuesta recibida de Nosis.';
        $parsed = $this->buildParsedPayload($raw, $resolvedMessage, $valid, $isCbuValidation);

        return [
            'valid' => $valid,
            'message' => $resolvedMessage,
            'raw' => $raw,
            'parsed' => $parsed,
        ];
    }

    private function buildVariablesAuthAttempts(array $query): array
    {
        $apiKey = trim((string) config('nosis.variables.api_key', ''));
        $username = trim((string) config('nosis.variables.username', ''));
        $token = trim((string) config('nosis.variables.token', ''));
        $attempts = [];

        if ($apiKey !== '') {
            $attempts[] = [
                'headers' => ['X-API-KEY' => $apiKey],
                'query' => $query,
            ];
        }

        if ($username !== '' && $token !== '') {
            $attempts[] = [
                'headers' => [],
                'query' => array_merge([
                    'usuario' => $username,
                    'token' => $token,
                ], $query),
            ];
        }

        return $attempts;
    }

    private function resolveVariablesUrl(string $baseUrl): string
    {
        $trimmedBaseUrl = rtrim($baseUrl, '/');

        return Str::endsWith($trimmedBaseUrl, '/variables')
            ? $trimmedBaseUrl
            : $trimmedBaseUrl . '/variables';
    }

    private function isSuccessfulArrayPayload(array $raw, ?string $message, bool $isCbuValidation): bool
    {
        $resultadoEstado = $this->firstArrayValue($raw, [
            'ResultadoEstado',
            'Estado',
            'estado',
            'status',
            'Contenido.Resultado.Estado',
            'Resultado.Estado',
            'resultado.estado',
        ]);
        $resultadoNovedad = $this->firstArrayValue($raw, [
            'ResultadoNovedad',
            'Novedad',
            'novedad',
            'detail',
            'Contenido.Resultado.Novedad',
            'Resultado.Novedad',
            'resultado.novedad',
        ]);

        if ($resultadoEstado !== null && trim($resultadoEstado) !== '200') {
            return false;
        }

        if ($isCbuValidation) {
            $cbuStatus = $this->firstArrayValue($raw, [
                'CbuEstado',
                'cbuEstado',
                'Datos.Cbu.Estado',
                'cbu.estado',
            ]);

            return $this->isValidMessage($cbuStatus ?: $resultadoNovedad ?: $message);
        }

        if ($this->firstArrayValue($raw, [
            'VI_RazonSocial',
            'RazonSocial',
            'razonSocial',
            'VI_Nombre',
            'VI_Apellido',
        ]) !== null) {
            return true;
        }

        return $this->isSuccessfulLookupMessage($resultadoNovedad ?: $message);
    }

    private function isValidMessage(?string $message): bool
    {
        if (!$message) {
            return false;
        }

        $normalized = Str::lower($message);

        return Str::contains($normalized, 'validado') || Str::contains($normalized, 'aprobado');
    }

    private function parseXmlMessage(string $payload, bool $isCbuValidation): ?array
    {
        $parsed = $this->parseXmlPayload($payload, $isCbuValidation);
        if (!$parsed) {
            return null;
        }

        return [
            'message' => (string) ($parsed['message'] ?? trim($payload)),
            'valid' => (bool) ($parsed['valid'] ?? false),
        ];
    }

    private function buildParsedPayload(mixed $raw, string $message, bool $valid, bool $isCbuValidation): ?array
    {
        if (is_string($raw)) {
            $parsed = $this->parseXmlPayload($raw, $isCbuValidation);
            if ($parsed) {
                return $parsed;
            }

            return [
                'rawFormat' => 'text',
                'message' => $message,
                'valid' => $valid,
            ];
        }

        if (is_array($raw)) {
            $raw = $this->expandVariablesArrayPayload($raw);
            $activities = $this->extractActivitiesFromArray($raw);
            $nombre = $this->firstArrayValue($raw, ['VI_Nombre', 'nombre', 'Nombre']);
            $apellido = $this->firstArrayValue($raw, ['VI_Apellido', 'apellido', 'Apellido']);
            $fechaNacimiento = $this->firstArrayValue($raw, [
                'FechaNacimiento',
                'fechaNacimiento',
                'VI_FecNacimiento',
                'Contenido.Pedido.FechaNacimiento',
            ]);
            $razonSocial = $this->firstArrayValue($raw, [
                'RazonSocial',
                'razonSocial',
                'nombre',
                'VI_RazonSocial',
            ]) ?: $this->combineName($nombre, $apellido);

            return $this->filterEmptyValues([
                'rawFormat' => 'json',
                'message' => $message,
                'valid' => $valid,
                'resultadoEstado' => $this->firstArrayValue($raw, [
                    'ResultadoEstado',
                    'Estado',
                    'estado',
                    'status',
                    'Contenido.Resultado.Estado',
                    'Resultado.Estado',
                ]),
                'resultadoNovedad' => $this->firstArrayValue($raw, [
                    'ResultadoNovedad',
                    'Novedad',
                    'novedad',
                    'detail',
                    'Contenido.Resultado.Novedad',
                    'Resultado.Novedad',
                ]),
                'documento' => $this->firstArrayValue($raw, [
                    'Documento',
                    'documento',
                    'VI_DNI',
                    'VI_Identificacion',
                    'Contenido.Pedido.Documento',
                    'Pedido.Documento',
                ]),
                'documentoNormalizado' => $this->normalizeDigits($this->firstArrayValue($raw, [
                    'Documento',
                    'documento',
                    'VI_DNI',
                    'VI_Identificacion',
                    'Contenido.Pedido.Documento',
                    'Pedido.Documento',
                ])),
                'razonSocial' => $razonSocial,
                'nombre' => $nombre,
                'apellido' => $apellido,
                'sexo' => $this->firstArrayValue($raw, ['VI_Sexo', 'sexo', 'Sexo']),
                'fechaNacimiento' => $fechaNacimiento,
                'fechaNacimientoNormalizada' => $this->normalizeDate($fechaNacimiento),
                'arcaStatus' => $this->firstArrayValue($raw, [
                    'ArcaEstado',
                    'arcaEstado',
                    'EstadoArca',
                    'estadoArca',
                    'AfipEstado',
                    'afipEstado',
                    'EstadoAfip',
                    'estadoAfip',
                    'CondicionFiscal',
                    'condicionFiscal',
                    'EstadoFiscal',
                    'estadoFiscal',
                ]),
                'dgrStatus' => $this->firstArrayValue($raw, [
                    'DgrEstado',
                    'dgrEstado',
                    'EstadoDgr',
                    'estadoDgr',
                    'CondicionDgr',
                    'condicionDgr',
                    'IngresosBrutosEstado',
                    'ingresosBrutosEstado',
                ]),
                'bankOwnerName' => $this->firstArrayValue($raw, [
                    'Titular',
                    'titular',
                    'TitularCuenta',
                    'titularCuenta',
                    'NombreTitular',
                    'nombreTitular',
                    'RazonSocialTitular',
                    'razonSocialTitular',
                ]),
                'bankOwnerDocument' => $this->normalizeDigits($this->firstArrayValue($raw, [
                    'DocumentoTitular',
                    'documentoTitular',
                    'TitularDocumento',
                    'titularDocumento',
                    'CuitTitular',
                    'cuitTitular',
                    'CuilTitular',
                    'cuilTitular',
                ])),
                'cbuEstado' => $this->firstArrayValue($raw, ['CbuEstado', 'cbuEstado']),
                'cbuNovedad' => $this->firstArrayValue($raw, ['CbuNovedad', 'cbuNovedad']),
                'cbu' => $this->normalizeDigits($this->firstArrayValue($raw, ['CBU', 'cbu'])),
                'fiscalAddressStreet' => $this->firstArrayValue($raw, ['VI_DomAF_Calle', 'domicilioFiscalCalle']),
                'fiscalAddressNumber' => $this->firstArrayValue($raw, ['VI_DomAF_Nro', 'domicilioFiscalNumero']),
                'fiscalAddressFloor' => $this->firstArrayValue($raw, ['VI_DomAF_Piso', 'domicilioFiscalPiso']),
                'fiscalAddressUnit' => $this->firstArrayValue($raw, ['VI_DomAF_Dto', 'domicilioFiscalDepartamento']),
                'fiscalAddressLocality' => $this->firstArrayValue($raw, ['VI_DomAF_Loc', 'domicilioFiscalLocalidad']),
                'fiscalAddressPostalCode' => $this->firstArrayValue($raw, ['VI_DomAF_CP', 'domicilioFiscalCodigoPostal']),
                'fiscalAddressProvince' => $this->firstArrayValue($raw, ['VI_DomAF_Prov', 'domicilioFiscalProvincia']),
                'activityMainCode' => $this->firstArrayValue($raw, ['VI_Act01_Cod', 'actividadPrincipalCodigo']),
                'activityMainDescription' => $this->firstArrayValue($raw, ['VI_Act01_Descrip', 'actividadPrincipalDescripcion']),
                'activityMainSector' => $this->firstArrayValue($raw, ['VI_Act01_Sector', 'actividadPrincipalSector']),
                'activityMainStartDate' => $this->normalizeDate($this->firstArrayValue($raw, ['VI_Act01_FecInicio', 'actividadPrincipalFechaInicio'])),
                'activities' => $activities,
                'afipKeyStatus' => $this->firstArrayValue($raw, ['VI_Inscrip_EstadoClave', 'estadoClaveAfip']),
                'afipKeyStatusDate' => $this->normalizeDate($this->firstArrayValue($raw, ['VI_Inscrip_EstadoClave_Fecha', 'estadoClaveAfipFecha'])),
                'ivaRegistered' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Inscrip_IVA', 'inscripcionIva'])),
                'ivaWithholdingExclusion' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Inscrip_IVA_Excluido', 'exclusionRetencionIva'])),
                'ivaRegisteredAt' => $this->normalizeDate($this->firstArrayValue($raw, ['VI_Inscrip_IVA_Fec', 'inscripcionIvaFecha'])),
                'ivaCondition' => $this->firstArrayValue($raw, ['VI_Inscrip_IVA_Condicion', 'condicionIva']),
                'gananciasRegistered' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Inscrip_GCIA', 'inscripcionGanancias'])),
                'gananciasWithholdingExclusion' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Inscrip_Gcia_Excluido', 'exclusionRetencionGanancias'])),
                'gananciasRegisteredAt' => $this->normalizeDate($this->firstArrayValue($raw, ['VI_Inscrip_Gcia_Fec', 'inscripcionGananciasFecha'])),
                'gananciasCondition' => $this->firstArrayValue($raw, ['VI_Inscrip_GCIA_Condicion', 'condicionGanancias']),
                'monotributoRegistered' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Inscrip_Monotributo_Es', 'monotributoInscripto'])),
                'monotributoRegisteredAt' => $this->normalizeDate($this->firstArrayValue($raw, ['VI_Inscrip_Monotributo_Fec', 'monotributoFechaAlta'])),
                'monotributoCategory' => $this->firstArrayValue($raw, ['VI_Inscrip_Monotributo', 'monotributoCategoria']),
                'monotributoType' => $this->firstArrayValue($raw, ['VI_Inscrip_Monotributo_Tipo', 'monotributoTipo']),
                'monotributoActivity' => $this->firstArrayValue($raw, ['VI_Inscrip_Monotributo_Act', 'monotributoActividad']),
                'monotributoSeniorityMonths' => $this->normalizeInteger($this->firstArrayValue($raw, ['VI_Inscrip_Monotributo_Antiguedad', 'monotributoAntiguedadMeses'])),
                'isEmployee' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Empleado_Es', 'esEmpleado'])),
                'isEmployer' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Empleador_Es', 'esEmpleador'])),
                'isRetired' => $this->normalizeBoolean($this->firstArrayValue($raw, ['VI_Jubilado_Es', 'esJubilado'])),
            ]);
        }

        return null;
    }

    private function parseXmlPayload(string $payload, bool $isCbuValidation = false): ?array
    {
        if (!str_contains($payload, '<')) {
            return null;
        }

        try {
            $xml = simplexml_load_string($payload);
            if (!$xml) {
                return null;
            }

            $variablesPayload = $this->parseVariablesXmlPayload($xml);
            if ($variablesPayload !== null) {
                return $variablesPayload;
            }

            $resultado = $xml->Contenido->Resultado ?? null;
            $datos = $xml->Contenido->Datos ?? null;
            $persona = $datos->Persona ?? null;
            $cbu = $datos->Cbu ?? null;

            $resultadoEstado = $this->xmlText($resultado?->Estado);
            $resultadoNovedad = $this->xmlText($resultado?->Novedad);
            $razonSocial = $this->xmlText($persona?->RazonSocial);
            $documento = $this->xmlText($persona?->Documento);
            $fechaNacimiento = $this->xmlText($persona?->FechaNacimiento);
            $cbuEstado = $this->xmlText($cbu?->Estado);
            $cbuNovedad = $this->xmlText($cbu?->Novedad);
            $cbuNumero = $this->xmlText($cbu?->Numero) ?: $this->xmlText($cbu?->CBU);
            $arcaStatus = $this->xmlSearchText($xml, [
                'ArcaEstado',
                'EstadoArca',
                'AfipEstado',
                'EstadoAfip',
                'CondicionFiscal',
                'EstadoFiscal',
                'SituacionFiscal',
            ]);
            $dgrStatus = $this->xmlSearchText($xml, [
                'DgrEstado',
                'EstadoDgr',
                'CondicionDgr',
                'SituacionDgr',
                'IngresosBrutosEstado',
                'EstadoIngresosBrutos',
            ]);
            $bankOwnerName = $this->xmlSearchText($xml, [
                'Titular',
                'TitularCuenta',
                'NombreTitular',
                'RazonSocialTitular',
                'TitularRazonSocial',
            ]);
            $bankOwnerDocument = $this->normalizeDigits($this->xmlSearchText($xml, [
                'DocumentoTitular',
                'TitularDocumento',
                'CuitTitular',
                'CuilTitular',
                'TitularCuit',
                'TitularCuil',
            ]));
            $fiscalAddressStreet = $this->xmlSearchText($xml, ['VI_DomAF_Calle']);
            $fiscalAddressNumber = $this->xmlSearchText($xml, ['VI_DomAF_Nro']);
            $fiscalAddressFloor = $this->xmlSearchText($xml, ['VI_DomAF_Piso']);
            $fiscalAddressUnit = $this->xmlSearchText($xml, ['VI_DomAF_Dto']);
            $fiscalAddressLocality = $this->xmlSearchText($xml, ['VI_DomAF_Loc']);
            $fiscalAddressPostalCode = $this->xmlSearchText($xml, ['VI_DomAF_CP']);
            $fiscalAddressProvince = $this->xmlSearchText($xml, ['VI_DomAF_Prov']);
            $activityMainCode = $this->xmlSearchText($xml, ['VI_Act01_Cod']);
            $activityMainDescription = $this->xmlSearchText($xml, ['VI_Act01_Descrip']);
            $activityMainSector = $this->xmlSearchText($xml, ['VI_Act01_Sector']);
            $activityMainStartDate = $this->normalizeDate($this->xmlSearchText($xml, ['VI_Act01_FecInicio']));
            $activities = $this->extractActivitiesFromXml($xml);
            $afipKeyStatus = $this->xmlSearchText($xml, ['VI_Inscrip_EstadoClave']);
            $afipKeyStatusDate = $this->normalizeDate($this->xmlSearchText($xml, ['VI_Inscrip_EstadoClave_Fecha']));
            $ivaRegistered = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Inscrip_IVA']));
            $ivaWithholdingExclusion = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Inscrip_IVA_Excluido']));
            $ivaRegisteredAt = $this->normalizeDate($this->xmlSearchText($xml, ['VI_Inscrip_IVA_Fec']));
            $ivaCondition = $this->xmlSearchText($xml, ['VI_Inscrip_IVA_Condicion']);
            $gananciasRegistered = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Inscrip_GCIA']));
            $gananciasWithholdingExclusion = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Inscrip_Gcia_Excluido']));
            $gananciasRegisteredAt = $this->normalizeDate($this->xmlSearchText($xml, ['VI_Inscrip_Gcia_Fec']));
            $gananciasCondition = $this->xmlSearchText($xml, ['VI_Inscrip_GCIA_Condicion']);
            $monotributoRegistered = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Inscrip_Monotributo_Es']));
            $monotributoRegisteredAt = $this->normalizeDate($this->xmlSearchText($xml, ['VI_Inscrip_Monotributo_Fec']));
            $monotributoCategory = $this->xmlSearchText($xml, ['VI_Inscrip_Monotributo']);
            $monotributoType = $this->xmlSearchText($xml, ['VI_Inscrip_Monotributo_Tipo']);
            $monotributoActivity = $this->xmlSearchText($xml, ['VI_Inscrip_Monotributo_Act']);
            $monotributoSeniorityMonths = $this->normalizeInteger($this->xmlSearchText($xml, ['VI_Inscrip_Monotributo_Antiguedad']));
            $isEmployee = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Empleado_Es']));
            $isEmployer = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Empleador_Es']));
            $isRetired = $this->normalizeBoolean($this->xmlSearchText($xml, ['VI_Jubilado_Es']));

            $messageParts = $isCbuValidation
                ? array_values(array_filter([$resultadoNovedad, $cbuNovedad, $cbuEstado]))
                : array_values(array_filter([$resultadoNovedad]));
            $message = count($messageParts) > 0 ? implode(' · ', $messageParts) : trim($payload);
            $valid = $resultadoEstado === '200'
                && (
                    $isCbuValidation
                        ? $this->isValidMessage($cbuEstado ?: $resultadoNovedad ?: $message)
                        : $this->isSuccessfulLookupMessage($resultadoNovedad ?: $message)
                );

            return $this->filterEmptyValues([
                'rawFormat' => 'xml',
                'message' => $message,
                'valid' => $valid,
                'resultadoEstado' => $resultadoEstado,
                'resultadoNovedad' => $resultadoNovedad,
                'razonSocial' => $razonSocial,
                'documento' => $documento,
                'documentoNormalizado' => $this->normalizeDigits($documento),
                'fechaNacimiento' => $fechaNacimiento,
                'fechaNacimientoNormalizada' => $this->normalizeDate($fechaNacimiento),
                'arcaStatus' => $arcaStatus,
                'dgrStatus' => $dgrStatus,
                'bankOwnerName' => $bankOwnerName,
                'bankOwnerDocument' => $bankOwnerDocument,
                'cbuEstado' => $cbuEstado,
                'cbuNovedad' => $cbuNovedad,
                'cbu' => $cbuNumero,
                'cbuNormalizado' => $this->normalizeDigits($cbuNumero),
                'fiscalAddressStreet' => $fiscalAddressStreet,
                'fiscalAddressNumber' => $fiscalAddressNumber,
                'fiscalAddressFloor' => $fiscalAddressFloor,
                'fiscalAddressUnit' => $fiscalAddressUnit,
                'fiscalAddressLocality' => $fiscalAddressLocality,
                'fiscalAddressPostalCode' => $fiscalAddressPostalCode,
                'fiscalAddressProvince' => $fiscalAddressProvince,
                'activityMainCode' => $activityMainCode,
                'activityMainDescription' => $activityMainDescription,
                'activityMainSector' => $activityMainSector,
                'activityMainStartDate' => $activityMainStartDate,
                'activities' => $activities,
                'afipKeyStatus' => $afipKeyStatus,
                'afipKeyStatusDate' => $afipKeyStatusDate,
                'ivaRegistered' => $ivaRegistered,
                'ivaWithholdingExclusion' => $ivaWithholdingExclusion,
                'ivaRegisteredAt' => $ivaRegisteredAt,
                'ivaCondition' => $ivaCondition,
                'gananciasRegistered' => $gananciasRegistered,
                'gananciasWithholdingExclusion' => $gananciasWithholdingExclusion,
                'gananciasRegisteredAt' => $gananciasRegisteredAt,
                'gananciasCondition' => $gananciasCondition,
                'monotributoRegistered' => $monotributoRegistered,
                'monotributoRegisteredAt' => $monotributoRegisteredAt,
                'monotributoCategory' => $monotributoCategory,
                'monotributoType' => $monotributoType,
                'monotributoActivity' => $monotributoActivity,
                'monotributoSeniorityMonths' => $monotributoSeniorityMonths,
                'isEmployee' => $isEmployee,
                'isEmployer' => $isEmployer,
                'isRetired' => $isRetired,
            ]);
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseVariablesXmlPayload(\SimpleXMLElement $xml): ?array
    {
        $variables = $this->extractXmlVariables($xml);
        if ($variables === []) {
            return null;
        }

        $resultado = $xml->Contenido->Resultado ?? null;
        $pedido = $xml->Contenido->Pedido ?? null;
        $resultadoEstado = $this->xmlText($resultado?->Estado);
        $resultadoNovedad = $this->xmlText($resultado?->Novedad);
        $documento = $this->xmlText($pedido?->Documento) ?: ($variables['VI_DNI'] ?? $variables['VI_Identificacion'] ?? null);
        $rawPayload = array_merge(
            [
                'ResultadoEstado' => $resultadoEstado,
                'ResultadoNovedad' => $resultadoNovedad,
                'Documento' => $documento,
            ],
            $variables
        );
        $message = $resultadoNovedad ?: 'Respuesta recibida de Nosis.';
        $valid = ($resultadoEstado === null || trim($resultadoEstado) === '200')
            && ($variables !== [] || $this->isSuccessfulLookupMessage($resultadoNovedad ?: $message));

        $parsed = $this->buildParsedPayload($rawPayload, $message, $valid, false);
        if ($parsed === null) {
            return null;
        }

        $parsed['rawFormat'] = 'xml';

        return $parsed;
    }

    private function extractActivitiesFromArray(array $payload): array
    {
        $indexes = [];

        foreach (array_keys($payload) as $key) {
            if (!is_string($key)) {
                continue;
            }

            if (preg_match('/^VI_Act(\d{2})_(Cod|Descrip|Sector|FecInicio)$/', $key, $matches) !== 1) {
                continue;
            }

            $indexes[(int) $matches[1]] = true;
        }

        if ($indexes === []) {
            return [];
        }

        ksort($indexes);
        $activities = [];

        foreach (array_keys($indexes) as $index) {
            $suffix = str_pad((string) $index, 2, '0', STR_PAD_LEFT);
            $code = $this->firstArrayValue($payload, ["VI_Act{$suffix}_Cod"]);
            $description = $this->firstArrayValue($payload, ["VI_Act{$suffix}_Descrip"]);
            $sector = $this->firstArrayValue($payload, ["VI_Act{$suffix}_Sector"]);
            $startDate = $this->normalizeDate($this->firstArrayValue($payload, ["VI_Act{$suffix}_FecInicio"]));

            if ($code === null && $description === null && $sector === null && $startDate === null) {
                continue;
            }

            $activities[] = $this->filterEmptyValues([
                'index' => $index,
                'code' => $code,
                'description' => $description,
                'sector' => $sector,
                'startDate' => $startDate,
            ]);
        }

        return $activities;
    }

    private function extractActivitiesFromXml(\SimpleXMLElement $xml): array
    {
        $activities = [];

        for ($index = 1; $index <= 20; $index++) {
            $suffix = str_pad((string) $index, 2, '0', STR_PAD_LEFT);
            $code = $this->xmlSearchText($xml, ["VI_Act{$suffix}_Cod"]);
            $description = $this->xmlSearchText($xml, ["VI_Act{$suffix}_Descrip"]);
            $sector = $this->xmlSearchText($xml, ["VI_Act{$suffix}_Sector"]);
            $startDate = $this->normalizeDate($this->xmlSearchText($xml, ["VI_Act{$suffix}_FecInicio"]));

            if ($code === null && $description === null && $sector === null && $startDate === null) {
                continue;
            }

            $activities[] = $this->filterEmptyValues([
                'index' => $index,
                'code' => $code,
                'description' => $description,
                'sector' => $sector,
                'startDate' => $startDate,
            ]);
        }

        return $activities;
    }

    private function extractXmlVariables(\SimpleXMLElement $xml): array
    {
        $variables = [];
        $nodes = $xml->xpath('//*[local-name()="Variable"]');
        if (!is_array($nodes)) {
            return $variables;
        }

        foreach ($nodes as $node) {
            $name = $this->xmlSearchText($node, ['Nombre']);
            $value = $this->xmlSearchText($node, ['Valor']);
            if ($name === null || $value === null) {
                continue;
            }

            $variables[$name] = $value;
        }

        return $variables;
    }

    private function expandVariablesArrayPayload(array $payload): array
    {
        $variablesNode = Arr::get($payload, 'Contenido.Datos.Variables.Variable')
            ?? Arr::get($payload, 'Contenido.Datos.Variables')
            ?? Arr::get($payload, 'Datos.Variables.Variable')
            ?? Arr::get($payload, 'Datos.Variables')
            ?? Arr::get($payload, 'Variables.Variable')
            ?? Arr::get($payload, 'Variables');

        if (!is_array($variablesNode)) {
            return $payload;
        }

        $variables = [];

        foreach ($this->normalizeArrayEntries($variablesNode) as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $name = $this->firstArrayValue($entry, ['Nombre', 'nombre']);
            $value = $this->firstArrayValue($entry, ['Valor', 'valor']);
            if ($name === null || $value === null) {
                continue;
            }

            $variables[$name] = $value;
        }

        if ($variables === []) {
            return $payload;
        }

        return array_merge($payload, [
            'ResultadoEstado' => $this->firstArrayValue($payload, [
                'ResultadoEstado',
                'Contenido.Resultado.Estado',
                'Resultado.Estado',
                'Estado',
            ]),
            'ResultadoNovedad' => $this->firstArrayValue($payload, [
                'ResultadoNovedad',
                'Contenido.Resultado.Novedad',
                'Resultado.Novedad',
                'Novedad',
            ]),
            'Documento' => $this->firstArrayValue($payload, [
                'Documento',
                'Contenido.Pedido.Documento',
                'Pedido.Documento',
            ]),
        ], $variables);
    }

    private function normalizeArrayEntries(array $value): array
    {
        if (Arr::isAssoc($value) && (
            array_key_exists('Nombre', $value)
            || array_key_exists('nombre', $value)
        )) {
            return [$value];
        }

        return $value;
    }

    private function xmlText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text !== '' ? $text : null;
    }

    private function normalizeDigits(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value) ?: '';

        return $digits !== '' ? $digits : null;
    }

    private function normalizeDate(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed;
        }

        if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $trimmed, $matches) === 1) {
            return "{$matches[1]}-{$matches[2]}-{$matches[3]}";
        }

        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $trimmed, $matches) === 1) {
            return "{$matches[3]}-{$matches[2]}-{$matches[1]}";
        }

        return null;
    }

    private function normalizeBoolean(mixed $value): ?bool
    {
        if ($value === null) {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        $normalized = Str::lower(trim((string) $value));
        if ($normalized === '') {
            return null;
        }

        if (in_array($normalized, ['si', 'sí', 's', 'true', '1', 'activo', 'validado'], true)) {
            return true;
        }

        if (in_array($normalized, ['no', 'false', '0', '-', 'inactivo', 'rechazado'], true)) {
            return false;
        }

        return null;
    }

    private function normalizeInteger(?string $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/[^\d\-]+/', '', trim($value)) ?: '';
        if ($digits === '' || $digits === '-') {
            return null;
        }

        return (int) $digits;
    }

    private function combineName(?string $nombre, ?string $apellido): ?string
    {
        $parts = array_values(array_filter([$nombre, $apellido], static fn (?string $value) => $value !== null && trim($value) !== ''));
        if ($parts === []) {
            return null;
        }

        return implode(' ', $parts);
    }

    private function isSuccessfulLookupMessage(?string $message): bool
    {
        if (!$message) {
            return false;
        }

        $normalized = Str::lower(trim($message));

        return $this->isValidMessage($message)
            || in_array($normalized, ['ok', 'correcto', 'sin novedades'], true);
    }

    private function firstArrayValue(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = Arr::get($payload, $key);
            if (!is_scalar($value)) {
                continue;
            }

            $text = trim((string) $value);
            if ($text !== '') {
                return $text;
            }
        }

        return null;
    }

    private function xmlSearchText(\SimpleXMLElement $xml, array $tagNames): ?string
    {
        foreach ($tagNames as $tagName) {
            $nodes = $xml->xpath(sprintf('.//*[local-name()="%1$s"] | ./*[local-name()="%1$s"]', $tagName));
            if (!is_array($nodes)) {
                continue;
            }

            foreach ($nodes as $node) {
                $text = $this->xmlText($node);
                if ($text !== null) {
                    return $text;
                }
            }
        }

        return null;
    }

    private function filterEmptyValues(array $payload): array
    {
        return array_filter($payload, static function ($value) {
            return $value !== null && $value !== '' && $value !== [];
        });
    }
}
