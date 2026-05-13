"""Parser perfil MAPFRE — soporta Constancia de Cobertura y Endoso/Suplemento.

Constancia: listado completo de vidas vigentes con formato `DU/CL <num> NOMBRE`.
Endoso: nómina con formato `<orden> NOMBRE DU/CL <num> <fecha_nac> (ALTA|BAJA)`.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from app.parsers.polizas.common import parse_date, parse_money


# Constancia: línea por asegurado (todo en mayúsculas).
RE_CONSTANCIA_LINEA = re.compile(
    r'^(DU|CL)\s+(\d{6,12})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)\s*$',
    re.MULTILINE,
)

# Endoso: cada alta/baja en una línea con número de orden, nombre, doc, fecha y marcador.
RE_ENDOSO_LINEA = re.compile(
    r'^\s*(\d+)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)\s+(DU|CL)\s+(\d{6,12})\s+(\d{2}/\d{2}/\d{4})\s+\((ALTA|BAJA)\)\s*$',
    re.MULTILINE,
)


def parse(text_paginas: list[str]) -> dict[str, Any]:
    """Parsea texto extraído de un PDF MAPFRE.

    Args:
        text_paginas: lista con el texto extraído de cada página, en orden.

    Returns:
        Dict con `tipo_documento`, `poliza`, `endoso`, `asegurados`, `warnings`.
    """
    text_full = '\n'.join(text_paginas)
    warnings: list[str] = []

    es_constancia = 'CONSTANCIA DE COBERTURA' in text_full
    es_endoso = 'SUPLEMENTO N°' in text_full or re.search(r'ENDOSO\s*:\s*\d+', text_full)

    if es_constancia:
        return _parse_constancia(text_full, warnings)
    if es_endoso:
        return _parse_endoso(text_paginas, warnings)

    warnings.append('MAPFRE: no se pudo detectar tipo (constancia ni endoso)')
    return {
        'tipo_documento': None,
        'poliza': {},
        'endoso': None,
        'asegurados': [],
        'warnings': warnings,
    }


def _parse_constancia(text: str, warnings: list[str]) -> dict[str, Any]:
    poliza: dict[str, Any] = {}

    m = re.search(r'Póliza N°\s*:\s*(\d+)', text)
    if m:
        poliza['numero_poliza'] = m.group(1)

    m = re.search(r'Vigencia desde el\s+(\d{2}/\d{2}/\d{4})\s+hasta el\s+(\d{2}/\d{2}/\d{4})', text)
    if m:
        poliza['vigencia_desde'] = parse_date(m.group(1))
        poliza['vigencia_hasta'] = parse_date(m.group(2))

    m = re.search(r'Tomador:\s*([^\n]+)', text)
    if m:
        poliza['tomador_razon_social'] = m.group(1).strip()

    m = re.search(r'CUIT/CUIL/DU:\s*(\d+)', text)
    if m:
        poliza['tomador_cuit'] = m.group(1).strip()

    m = re.search(r'Vidas vigentes:\s*(\d+)', text)
    if m:
        poliza['cantidad_vidas_unidades'] = int(m.group(1))

    m = re.search(r'MUERTE E INCAPACIDAD\s*-\s*\$\s*([\d,\.]+)', text)
    if m:
        # MAPFRE usa formato americano: $2,520,000 (comas para miles, sin decimales).
        raw = m.group(1).replace(',', '').replace('.', '')
        try:
            poliza['suma_asegurada_total'] = float(raw)
        except ValueError:
            warnings.append(f'MAPFRE: suma asegurada no parseable ({m.group(1)})')

    # ADDENDUM 15 Bloque 2 — premio total de la póliza (anual). Es lo que LA paga
    # por TODA la póliza; se divide entre vidas_vigentes en el backend para
    # obtener importe mensual por asegurado.
    for label in ('Premio Total', 'Premio'):
        m = re.search(rf'{label}\s*:?\s*\$\s*([\d\.\,]+)', text, re.IGNORECASE)
        if m:
            val = parse_money(m.group(1))
            if val is not None:
                poliza['premio_anual'] = val
                break

    m = re.search(r'Plan:\s*([^\n]+)', text)
    if m:
        poliza['plan'] = m.group(1).strip()

    asegurados: list[dict[str, Any]] = []
    for tipo_doc, numero, nombre in RE_CONSTANCIA_LINEA.findall(text):
        nombre_norm = re.sub(r'\s+', ' ', nombre).strip()
        # Filtrar falsos positivos: encabezados o texto que no es nómina.
        if nombre_norm in ('SEGUROS DE VIDA S A', 'TOMADOR LOGISTICA ARGENTINA S R L'):
            continue
        asegurados.append({
            'tipo': 'persona',
            'identificador': numero,
            'identificador_tipo': 'dni' if tipo_doc == 'DU' else 'cuil',
            'numero_orden_aseguradora': None,
            'nombre_apellido': nombre_norm,
            'fecha_nacimiento': None,
            'marca_modelo': None,
            'tipo_vehiculo': None,
            'localidad': None,
            'suma_asegurada': None,
            'premio_individual': None,
        })

    if not asegurados:
        warnings.append('MAPFRE constancia: no se encontraron asegurados (regex sin matches)')

    return {
        'tipo_documento': 'constancia',
        'poliza': poliza,
        'endoso': None,
        'asegurados': asegurados,
        'warnings': warnings,
    }


def _parse_endoso(text_paginas: list[str], warnings: list[str]) -> dict[str, Any]:
    text_full = '\n'.join(text_paginas)
    poliza: dict[str, Any] = {}
    endoso: dict[str, Any] = {}

    m = re.search(r'POLIZA N°\s*:\s*([\d\-]+)', text_full)
    if m:
        # MAPFRE endoso usa formato 152-02228604-04 → guardamos sin guiones también.
        poliza['numero_poliza'] = m.group(1).strip()

    m = re.search(r'SUPLEMENTO N°\s*:?\s*\n?\s*(\d+)', text_full)
    if not m:
        m = re.search(r'ENDOSO\s*:\s*(\d+)', text_full)
    if m:
        endoso['numero_endoso'] = m.group(1)

    m = re.search(r'EMISION\s*:?\s*(\d{2}/\d{2}/\d{4})', text_full)
    if m:
        endoso['fecha_emision'] = parse_date(m.group(1))

    # Vigencia (encabezados "Desde las 12 hs del" y "Hasta las 12 hs del").
    fechas = re.findall(r'(\d{2}/\d{2}/\d{4})', text_full)
    if len(fechas) >= 2 and 'fecha_emision' not in endoso:
        endoso['fecha_emision'] = parse_date(fechas[0])

    # OCR de MAPFRE puede duplicar letras: "CC..UU..II..TT..30-71706098-5".
    # Toleramos cualquier secuencia de C/U/I/T y puntos como etiqueta.
    m = re.search(r'TOMADOR:\s*([^\n]+?)\s+[CUIT\.]+\s*(\d{2}[-\d]{8,11})', text_full)
    if m:
        poliza['tomador_razon_social'] = m.group(1).strip()
        poliza['tomador_cuit'] = m.group(2).strip()

    # ADDENDUM 15 Bloque 2 — premio del endoso (cuando el endoso tiene importe propio).
    for label in ('Premio Total', 'Premio del Endoso', 'Premio'):
        m = re.search(rf'{label}\s*:?\s*\$\s*([\d\.\,]+)', text_full, re.IGNORECASE)
        if m:
            val = parse_money(m.group(1))
            if val is not None:
                endoso['premio_endoso'] = val
                break

    asegurados: list[dict[str, Any]] = []
    tiene_alta = False
    tiene_baja = False
    for orden, nombre, tipo_doc, numero, fecha_nac, marcador in RE_ENDOSO_LINEA.findall(text_full):
        nombre_norm = re.sub(r'\s+', ' ', nombre).strip()
        asegurados.append({
            'tipo': 'persona',
            'identificador': numero,
            'identificador_tipo': 'dni' if tipo_doc == 'DU' else 'cuil',
            'numero_orden_aseguradora': orden,
            'nombre_apellido': nombre_norm,
            'fecha_nacimiento': parse_date(fecha_nac),
            'marcador': marcador.lower(),  # 'alta' | 'baja' — info adicional para el backend
            'marca_modelo': None,
            'tipo_vehiculo': None,
            'localidad': None,
            'suma_asegurada': None,
            'premio_individual': None,
        })
        if marcador == 'ALTA':
            tiene_alta = True
        elif marcador == 'BAJA':
            tiene_baja = True

    # Tipo del endoso según los marcadores presentes.
    if tiene_alta and tiene_baja:
        endoso['tipo'] = 'modificacion'
    elif tiene_alta:
        endoso['tipo'] = 'incorporacion'
    elif tiene_baja:
        endoso['tipo'] = 'baja'
    else:
        endoso['tipo'] = 'modificacion'
        warnings.append('MAPFRE endoso: no se detectaron filas (ALTA)/(BAJA)')

    return {
        'tipo_documento': f"endoso_{endoso['tipo']}",
        'poliza': poliza,
        'endoso': endoso,
        'asegurados': asegurados,
        'warnings': warnings,
    }
