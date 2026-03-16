<?php

namespace App\Support\Facturacion;

enum PeriodoFacturado: string
{
    case PRIMERA_QUINCENA = 'PRIMERA_QUINCENA';
    case SEGUNDA_QUINCENA = 'SEGUNDA_QUINCENA';
    case MES_COMPLETO = 'MES_COMPLETO';
}
