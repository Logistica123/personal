<?php

namespace App\Support\Facturacion;

enum CobranzaEstado: string
{
    case PENDIENTE = 'PENDIENTE';
    case A_VENCER = 'A_VENCER';
    case VENCIDA = 'VENCIDA';
    case COBRADA = 'COBRADA';
    case PARCIAL = 'PARCIAL';
}
