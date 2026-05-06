"""Parser perfil La Segunda — Certificado de Cobertura de vehículos (Autos / Motos).

El layout multi-línea del PDF dificulta `extract_tables()`: los datos vienen
mergeados en una sola celda. Estrategia: barrer texto plano y, por cada línea
que contenga una patente, extraer los campos de esa fila.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from app.parsers.polizas.common import (
    RE_PATENTE,
    normalizar_patente,
    parse_date,
    parse_money,
)


RE_NUMERO_POLIZA = re.compile(r'\b(\d{2}\.\d{3}\.\d{3})\b')


def parse(text_paginas: list[str]) -> dict[str, Any]:
    text_full = '\n'.join(text_paginas)
    warnings: list[str] = []

    poliza: dict[str, Any] = {}

    m = RE_NUMERO_POLIZA.search(text_full)
    if m:
        poliza['numero_poliza'] = m.group(1)

    # En La Segunda los labels "desde las 12h del" y "hasta las 12h del" aparecen en
    # la misma línea y las fechas vienen después en otra línea contigua.
    m = re.search(
        r'desde las 12h del\s+hasta las 12h del[\s\S]*?(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})',
        text_full,
    )
    if m:
        poliza['vigencia_desde'] = parse_date(m.group(1))
        poliza['vigencia_hasta'] = parse_date(m.group(2))

    m = re.search(r'C\.U\.I\.T\.?\s*(\d{11}|\d{2}-\d{8}-\d)', text_full)
    if m:
        poliza['tomador_cuit'] = m.group(1)

    m = re.search(r'(LOGISTICA ARGENTINA[^\n]*)', text_full)
    if m:
        poliza['tomador_razon_social'] = m.group(1).strip()

    # Identificar autos vs motos por header.
    if 'Póliza para el seguro de motovehículos' in text_full:
        subtipo = 'motos'
    elif 'seguro de vehículos automotores' in text_full:
        subtipo = 'autos'
    else:
        subtipo = None
        warnings.append('La Segunda: no se pudo determinar autos vs motos por header')

    asegurados = _parse_vehiculos(text_paginas, subtipo, warnings)

    return {
        'tipo_documento': 'constancia',
        'poliza': poliza,
        'endoso': None,
        'asegurados': asegurados,
        'warnings': warnings,
    }


def _parse_vehiculos(text_paginas: list[str], subtipo: Optional[str], warnings: list[str]) -> list[dict[str, Any]]:
    """Por cada línea con una patente, extrae año, tipo, suma y premio.

    Las filas en el texto aparecen así (auto, N° de 1 dígito):
        1 Ignis L2 (ex 34) IWK373 ATEGO 1418-48 2009 CAMIONES SEMI-PESADOS COMERCIAL LARGA $53.800.000 $0 NO $0 50% $830.404
    Para motos:
        2 A009PHB 2016 MOTO COMERCIAL CORRIENTES $1.051.000 $0 NO $0 AJUSTE $28.950

    BUGFIX 01: con N° de 2+ dígitos pdfplumber merge celdas y la línea queda
    apelmazada (`57Ignis L2 (ex 34)AA788ZUEXPRESS 1 PLC CON.2016 ...`):
      - El N° pega con el plan ("57Ignis"). El regex de N° ya no puede exigir
        un espacio después.
      - La patente pega con el modelo ("AA788ZUEXPRESS"). RE_PATENTE en
        common.py ahora acepta ese caso (sin `\b` final).
      - El año puede aparecer pegado a otro token ("CON.2016"). El regex de
        año pasa a no exigir word boundary izquierdo.

    Para reducir falsos positivos (sin contexto la patente puede aparecer en
    cabeceras, notas al pie, etc.) se exige que la línea contenga al menos un
    monto `$` o un año 19xx/20xx.
    """
    vistas: dict[str, dict[str, Any]] = {}

    for text in text_paginas:
        for linea in text.split('\n'):
            m_pat = RE_PATENTE.search(linea)
            if not m_pat:
                continue

            # Filtro de contexto: aceptar solo líneas con datos económicos o de
            # año — descarta encabezados / pies de página / notas que mencionan
            # una patente sin ser fila de detalle.
            if '$' not in linea and not re.search(r'(?<![\d])(19\d{2}|20\d{2})', linea):
                continue

            patente = normalizar_patente(m_pat.group(1))
            if not patente or patente in vistas:
                continue

            datos: dict[str, Any] = {
                'tipo': 'vehiculo',
                'identificador': patente,
                'identificador_tipo': 'patente',
                'numero_orden_aseguradora': None,
                'nombre_apellido': None,
                'fecha_nacimiento': None,
                'marca_modelo': None,
                'tipo_vehiculo': None,
                'año': None,
                'localidad': None,
                'suma_asegurada': None,
                'premio_individual': None,
            }

            # Número de orden: dígitos al comienzo de la línea (puede o no
            # haber un espacio antes del próximo token — caso "57Ignis").
            m_orden = re.match(r'^\s*(\d+)', linea)
            if m_orden:
                datos['numero_orden_aseguradora'] = m_orden.group(1)

            # Año: 4 dígitos 19xx/20xx después de la patente. Aceptamos que
            # venga pegado a un punto/coma/letras (caso "CON.2016") usando
            # un lookbehind que sólo descarta otro dígito previo.
            tras_patente = linea[m_pat.end():]
            m_anio = re.search(r'(?<!\d)(19\d{2}|20\d{2})(?!\d)', tras_patente)
            if m_anio:
                datos['año'] = int(m_anio.group(1))

            # Tipo de vehículo: palabras clave que aparecen tras el año.
            for tipo_kw in ('MOTO', 'CAMIONES SEMI-PESADOS', 'CAMIONES', 'FURGONES GRANDES',
                            'FURGONES', 'AUTOMOVIL', 'PICK-UP', 'UTILITARIO'):
                if tipo_kw in tras_patente:
                    datos['tipo_vehiculo'] = tipo_kw
                    break

            # Suma asegurada: primer "$X.XXX.XXX" tras la patente.
            montos = re.findall(r'\$\s*([\d\.]+(?:,\d{2})?)', linea)
            if montos:
                datos['suma_asegurada'] = parse_money(montos[0])
                # Premio: típicamente el último monto de la línea.
                if len(montos) >= 2:
                    datos['premio_individual'] = parse_money(montos[-1])

            # Localidad: heurística — buscar nombre en mayúsculas tras tipo, antes del primer "$".
            antes_monto = linea.split('$')[0] if '$' in linea else linea
            m_loc = re.search(r'\b(CORRIENTES|SAN CAYETANO|TUCUMAN|RESISTENCIA|BUENOS AIRES|ADROGUE|RAFAEL CASTILLO)\b',
                              antes_monto)
            if m_loc:
                datos['localidad'] = m_loc.group(1)

            vistas[patente] = datos

    asegurados = list(vistas.values())

    if not asegurados:
        warnings.append('La Segunda: no se encontraron patentes en el PDF')
    elif subtipo == 'motos':
        # Forzar tipo_vehiculo='MOTO' si quedó vacío y el header indica motos.
        for a in asegurados:
            if not a['tipo_vehiculo']:
                a['tipo_vehiculo'] = 'MOTO'

    return asegurados
