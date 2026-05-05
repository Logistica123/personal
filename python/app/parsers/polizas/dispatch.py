"""Dispatcher principal del parser de pólizas.

Recibe la ruta de un PDF, extrae texto con pdfplumber, detecta la aseguradora
por header y delega al perfil correspondiente.
"""

from __future__ import annotations

from typing import Any

import pdfplumber

from app.parsers.polizas.common import detectar_aseguradora
from app.parsers.polizas import mapfre, san_cristobal, la_segunda


_PROFILES = {
    'mapfre': mapfre.parse,
    'san_cristobal': san_cristobal.parse,   # acepta pdf_path opcional para Anexo de Adherentes
    'la_segunda': la_segunda.parse,
}


def parse_pdf_polizas(path: str) -> dict[str, Any]:
    """Parsea un PDF de póliza y devuelve datos estructurados.

    Estructura del retorno:
        {
            'aseguradora_detectada': 'mapfre' | 'san_cristobal' | 'la_segunda' | None,
            'tipo_documento': 'constancia' | 'endoso_incorporacion' | 'endoso_baja' | 'endoso_modificacion' | None,
            'poliza': {...},
            'endoso': {...} | None,
            'asegurados': [...],
            'warnings': [...]
        }
    """
    text_paginas: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text_paginas.append(page.extract_text() or '')

    text_full = '\n'.join(text_paginas)
    aseguradora = detectar_aseguradora(text_full)

    if aseguradora is None:
        return {
            'aseguradora_detectada': None,
            'tipo_documento': None,
            'poliza': {},
            'endoso': None,
            'asegurados': [],
            'warnings': ['Aseguradora no detectada por header — seleccionar manualmente'],
        }

    parser_fn = _PROFILES[aseguradora]
    # SC necesita el path del PDF para extract_words con coords (Anexo Adherentes).
    if aseguradora == 'san_cristobal':
        result = parser_fn(text_paginas, path)
    else:
        result = parser_fn(text_paginas)
    result['aseguradora_detectada'] = aseguradora
    return result
