<?php

namespace App\Support\Facturacion;

enum FacturaEstado: string
{
    case BORRADOR = 'BORRADOR';
    case VALIDADA_LOCAL = 'VALIDADA_LOCAL';
    case LISTA_PARA_ENVIO = 'LISTA_PARA_ENVIO';
    case ENVIANDO_ARCA = 'ENVIANDO_ARCA';
    case AUTORIZADA = 'AUTORIZADA';
    case RECHAZADA_ARCA = 'RECHAZADA_ARCA';
    case ERROR_TECNICO = 'ERROR_TECNICO';
    case PDF_GENERADO = 'PDF_GENERADO';

    public function isFiscallyLocked(): bool
    {
        return in_array($this, [self::AUTORIZADA, self::PDF_GENERADO], true);
    }
}
