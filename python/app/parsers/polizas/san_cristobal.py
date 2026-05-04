"""Parser perfil San Cristóbal — Frente de Endoso (incorporación/baja/modificación)."""

from __future__ import annotations

import re
from typing import Any

from app.parsers.polizas.common import parse_date


# Asegurado en bloque "Incorporación de Asegurados".
# La ocupación puede ocupar varias líneas que continúan con espacios al inicio.
RE_INCORPORACION_LINEA = re.compile(
    r'^\s*(\d+)\s+'                          # N° orden
    r'([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s\.]+?)\s+'  # Apellido y nombre
    r'(\d{2}-\d{8}-\d)\s+'                   # CUIL
    r'(\d{2}/\d{2}/\d{4})\s+'                # Fecha nacimiento
    r'(.+?)$',                               # Ocupación (puede continuar abajo)
    re.MULTILINE,
)


def parse(text_paginas: list[str]) -> dict[str, Any]:
    text_full = '\n'.join(text_paginas)
    warnings: list[str] = []

    poliza: dict[str, Any] = {}
    endoso: dict[str, Any] = {}

    m = re.search(r'(\d{2}-\d{2}-\d{2}-\d{8})', text_full)
    if m:
        poliza['numero_poliza'] = m.group(1)

    m = re.search(r'N°\s*cuenta:\s*(\d{2}-\d{8})', text_full, re.IGNORECASE)
    if m:
        poliza['numero_cuenta_cliente'] = m.group(1)

    # Vigencia: las dos ocurrencias de "00HS DEL" en orden.
    vigencias = re.findall(r'00HS\s+DEL\s+(\d{2}/\d{2}/\d{4})', text_full)
    if len(vigencias) >= 1:
        poliza['vigencia_desde'] = parse_date(vigencias[0])
    if len(vigencias) >= 2:
        poliza['vigencia_hasta'] = parse_date(vigencias[1])

    # CUIT del tomador: el primer CUIT del documento que no sea de una aseguradora conocida.
    cuits_aseguradoras = {'34-50004533-9', '33-70089372-9', '30-50001770-4'}
    for cuit in re.findall(r'\b(\d{2}-\d{8}-\d)\b', text_full):
        if cuit not in cuits_aseguradoras:
            poliza['tomador_cuit'] = cuit
            break

    # Tomador: aparece debajo del header "TOMADOR" en la primera tabla.
    m = re.search(r'TOMADOR\s+RAMO[\s\S]*?\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)\s+Accidentes', text_full)
    if m:
        poliza['tomador_razon_social'] = m.group(1).strip()

    # Subramo: lista cerrada de subramos AP conocidos.
    m = re.search(r'\b(AP\s+Colectivo|AP\s+Ámbito\s+Laboral|AP\s+Individual)\b', text_full)
    if m:
        poliza['subramo'] = re.sub(r'\s+', ' ', m.group(1)).strip()

    # N° endoso: en la línea de detalle aparece adyacente al N° de póliza
    # (formato: "... 01-06-06-30035710 118 00HS DEL ..."). El header "ENDOSO" sin
    # valor también está antes, por eso buscamos por contexto.
    m = re.search(r'\d{2}-\d{2}-\d{2}-\d{8}\s+(\d+)\s+00HS', text_full)
    if m:
        endoso['numero_endoso'] = m.group(1)

    # Fecha emisión: "Resistencia, DD/MM/YYYY".
    m = re.search(r'(?:Resistencia|EMISIÓN)[^\n]*?(\d{2}/\d{2}/\d{4})', text_full)
    if m:
        endoso['fecha_emision'] = parse_date(m.group(1))

    m = re.search(r'Suma Asegurada Total\s*\$\s*([\d\.]+,\d{2})', text_full)
    if m:
        from app.parsers.polizas.common import parse_money
        poliza['suma_asegurada_total'] = parse_money(m.group(1))

    # Detección de tipo: priorizar incorporación > baja > modificación.
    tiene_incorp = 'Incorporación de Asegurados' in text_full
    tiene_baja = re.search(r'Anulación de Asegurados|Bajas?\s+de\s+Asegurados', text_full, re.IGNORECASE)
    tiene_modif = 'Otras Modificaciones' in text_full

    asegurados: list[dict[str, Any]] = []
    if tiene_incorp:
        endoso['tipo'] = 'incorporacion'
        asegurados = _parse_asegurados_incorporacion(text_full, warnings)
    elif tiene_baja:
        endoso['tipo'] = 'baja'
        asegurados = _parse_asegurados_incorporacion(text_full, warnings)
    elif tiene_modif:
        endoso['tipo'] = 'modificacion'
    else:
        endoso['tipo'] = 'modificacion'
        warnings.append('SC: no se detectó sección de Incorporación / Baja / Modificación')

    return {
        'tipo_documento': f"endoso_{endoso['tipo']}",
        'poliza': poliza,
        'endoso': endoso,
        'asegurados': asegurados,
        'warnings': warnings,
    }


def _parse_asegurados_incorporacion(text: str, warnings: list[str]) -> list[dict[str, Any]]:
    asegurados: list[dict[str, Any]] = []
    for orden, nombre, cuil, fecha_nac, ocupacion in RE_INCORPORACION_LINEA.findall(text):
        nombre_norm = re.sub(r'\s+', ' ', nombre).strip()
        if not nombre_norm or nombre_norm.upper() in ('APELLIDO Y NOMBRE',):
            continue
        asegurados.append({
            'tipo': 'persona',
            'identificador': cuil,
            'identificador_tipo': 'cuil',
            'numero_orden_aseguradora': orden,
            'nombre_apellido': nombre_norm,
            'fecha_nacimiento': parse_date(fecha_nac),
            'ocupacion': ocupacion.strip(),
            'marca_modelo': None,
            'tipo_vehiculo': None,
            'localidad': None,
            'suma_asegurada': None,
            'premio_individual': None,
        })

    if not asegurados:
        warnings.append('SC: sección de incorporación detectada pero sin filas parseables')

    return asegurados
