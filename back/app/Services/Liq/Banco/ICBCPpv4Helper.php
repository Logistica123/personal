<?php

namespace App\Services\Liq\Banco;

use App\Models\LiqOrdenPago;
use App\Models\LiqOrdenPagoDetalle;
use App\Models\Persona;

/**
 * Genera el archivo TXT en formato PPV4 (ancho fijo) para ICBC Multipay.
 *
 * Basado en: "Diseño de Implementación // Pago a Proveedores" de ICBC.
 * Sección E.2: Pago con transferencia interbancaria (Forma de pago = "2", CBU).
 *
 * Cada línea = 1 pago (item). Ancho fijo, NO delimitado por comas.
 * Encoding: ISO-8859-1. Líneas separadas por CR+LF (ASCII 13 + ASCII 10).
 * Posiciones 504-6103 = retenciones simples (espacios si no hay).
 * Posición 6104+ = XML retenciones múltiples / parámetros (opcional).
 */
class ICBCPpv4Helper
{
    /**
     * Genera el contenido TXT completo del archivo PPV4.
     *
     * @return string Contenido del TXT en ISO-8859-1
     */
    public function generarTxt(LiqOrdenPago $op): string
    {
        $op->loadMissing(['detalles', 'beneficiario']);

        $lines = [];

        foreach ($op->detalles as $detalle) {
            if ($detalle->medio_pago && $detalle->medio_pago !== 'Transferencia') {
                continue;
            }

            $persona = $this->resolverBeneficiario($op, $detalle);
            if (!$persona) continue;

            $datos = $persona->datosBeneficiario();
            $cuil = preg_replace('/\D/', '', $datos['cuil'] ?? '');
            $cbu = preg_replace('/\D/', '', $datos['cbu'] ?? '');
            $nombre = $datos['nombre'] ?? '';
            $importeCentavos = intval(round((float) $detalle->importe_final * 100));
            $fechaPago = $op->fecha_emision ? $op->fecha_emision->format('Ymd') : now()->format('Ymd');
            $nroComprobante = str_pad((string) $detalle->id, 12, '0', STR_PAD_LEFT);
            $nroBeneficiario = str_pad((string) $persona->id, 14, '0', STR_PAD_LEFT);

            $line = $this->buildLine(
                importeCentavos: $importeCentavos,
                fechaPago: $fechaPago,
                nroComprobante: $nroComprobante,
                cbu: $cbu,
                nombre: $nombre,
                tipoDoc: '06',
                nroDoc: $cuil,
                nroBeneficiario: $nroBeneficiario,
            );

            $lines[] = $line;
        }

        if (empty($lines)) {
            throw new \RuntimeException('No hay items de transferencia para generar el archivo PPV4.');
        }

        $content = implode("\r\n", $lines);

        // Convertir a ISO-8859-1
        return mb_convert_encoding($content, 'ISO-8859-1', 'UTF-8');
    }

    /**
     * Genera el archivo PPV4 comprimido en ZIP (para createListUpload).
     */
    public function generarZip(LiqOrdenPago $op): string
    {
        $txt = $this->generarTxt($op);

        $zipPath = tempnam(sys_get_temp_dir(), 'icbc_ppv4_');
        $zip = new \ZipArchive();

        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('No se pudo crear el archivo ZIP.');
        }

        $zip->addFromString('pagos.txt', $txt);
        $zip->close();

        $content = file_get_contents($zipPath);
        unlink($zipPath);

        return $content;
    }

    /**
     * Cuenta items de transferencia.
     */
    public function contarItems(LiqOrdenPago $op): int
    {
        $op->loadMissing('detalles');
        return $op->detalles->filter(fn ($d) => !$d->medio_pago || $d->medio_pago === 'Transferencia')->count();
    }

    /**
     * Suma importe total en centavos.
     */
    public function importeTotalCentavos(LiqOrdenPago $op): int
    {
        $op->loadMissing('detalles');
        $total = $op->detalles
            ->filter(fn ($d) => !$d->medio_pago || $d->medio_pago === 'Transferencia')
            ->sum('importe_final');
        return intval(round((float) $total * 100));
    }

    // =========================================================================
    // Construcción de la línea PPV4 ancho fijo
    // =========================================================================

    /**
     * Construye una línea PPV4 para pago por transferencia CBU.
     * Layout según sección E.2 del Diseño de Implementación ICBC.
     *
     * Posiciones 1-503 = datos del pago (ancho fijo)
     * Posiciones 504-6103 = retenciones simples (5600 chars, espacios)
     * Posición 6104+ = XML opcional (retenciones múltiples / params)
     */
    private function buildLine(
        int $importeCentavos,
        string $fechaPago,
        string $nroComprobante,
        string $cbu,
        string $nombre,
        string $tipoDoc,
        string $nroDoc,
        string $nroBeneficiario,
        ?string $email = null,
    ): string {
        $line = '';

        // Pos 1-4: Versión (4 chars)
        $line .= 'PPV4';

        // Pos 5: Forma de pago (1 char) = "2" (Transferencia CBU)
        $line .= '2';

        // Pos 6-8: Moneda (3 chars) = "ARP"
        $line .= 'ARP';

        // Pos 9-26: Monto en centavos (18 chars numérico, pad left zeros)
        $line .= str_pad((string) $importeCentavos, 18, '0', STR_PAD_LEFT);

        // Pos 27-34: Fecha pago AAAAMMDD (8 chars)
        $line .= str_pad($fechaPago, 8, '0', STR_PAD_LEFT);

        // Pos 35-46: Número comprobante (12 chars numérico)
        $line .= str_pad($nroComprobante, 12, '0', STR_PAD_LEFT);

        // Pos 47: Forma de cuenta = "C" (CBU)
        $line .= 'C';

        // Pos 48-49: Tipo de cuenta = "00" (CBU)
        $line .= '00';

        // Pos 50-71: Número de cuenta = CBU (22 chars)
        $line .= str_pad($cbu, 22, '0', STR_PAD_LEFT);

        // Pos 72-121: Beneficiario del pago (50 chars alfanumérico, pad right spaces)
        $line .= $this->padRight($this->sanitize($nombre), 50);

        // Pos 122-123: Tipo documento beneficiario (2 chars)
        $line .= str_pad($tipoDoc, 2, '0', STR_PAD_LEFT);

        // Pos 124-134: Número documento beneficiario (11 chars)
        $line .= str_pad($nroDoc, 11, '0', STR_PAD_LEFT);

        // Pos 135-164: Dirección calle (30 chars) - obligatorio, espacios si no hay
        $line .= $this->padRight('', 30);

        // Pos 165-169: Dirección altura (5 chars numérico)
        $line .= str_pad('0', 5, '0', STR_PAD_LEFT);

        // Pos 170-188: Localidad (19 chars)
        $line .= $this->padRight('', 19);

        // Pos 189-196: Código postal (8 chars)
        $line .= $this->padRight('', 8);

        // Pos 197: Provincia (1 char) - "C" = CABA por defecto
        $line .= 'C';

        // Pos 198-217: Teléfono (20 chars numérico)
        $line .= str_pad('0', 20, '0', STR_PAD_LEFT);

        // Pos 218-231: Número de beneficiario (14 chars numérico)
        $line .= str_pad($nroBeneficiario, 14, '0', STR_PAD_LEFT);

        // Pos 232-294: Proveedor original (63 chars) - espacios (no aplica)
        $line .= $this->padRight('', 63);

        // Pos 295-423: Autorizados 1,2,3 (43 chars x 3 = 129 chars) - espacios
        $line .= $this->padRight('', 129);

        // Pos 424-503: Observaciones (80 chars) - espacios
        $line .= $this->padRight('', 80);

        // Pos 504-6103: Retenciones simples (5600 chars) - espacios
        $line .= $this->padRight('', 5600);

        // Pos 6104+: XML parámetros opcionales (email notificación)
        if ($email) {
            $line .= '<?xml version="1.0" encoding="ISO-8859-1"?><PARAM><MAIL>' . $email . '</MAIL></PARAM>';
        }

        return $line;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function resolverBeneficiario(LiqOrdenPago $op, LiqOrdenPagoDetalle $detalle): ?Persona
    {
        // El beneficiario viene de la OP (ya resuelto distribuidor/cobrador)
        if ($op->beneficiario_id) {
            return Persona::find($op->beneficiario_id);
        }
        return null;
    }

    /**
     * Pad right con espacios hasta el largo indicado.
     */
    private function padRight(string $value, int $length): string
    {
        return str_pad(mb_substr($value, 0, $length), $length, ' ', STR_PAD_RIGHT);
    }

    /**
     * Sanitiza texto: quita caracteres no válidos para ISO-8859-1.
     */
    private function sanitize(string $value): string
    {
        // Reemplazar caracteres problemáticos
        $value = str_replace(["\n", "\r", "\t"], ' ', $value);
        return trim($value);
    }
}
