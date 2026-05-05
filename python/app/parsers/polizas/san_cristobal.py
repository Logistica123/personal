"""Parser perfil San Cristóbal — Frente de Endoso + Anexo de Adherentes."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

import pdfplumber

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


def parse(text_paginas: list[str], pdf_path: str | None = None) -> dict[str, Any]:
    text_full = '\n'.join(text_paginas)
    warnings: list[str] = []

    # ADD 13A — detectar "Anexo de Adherentes" antes de los otros tipos.
    if re.search(r'Anexo\s+de\s+Adherentes\s+\d+\s+de\s+\d+', text_full) and pdf_path:
        return _parse_anexo_adherentes(pdf_path, text_full, warnings)

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


def _parse_anexo_adherentes(pdf_path: str, text_full: str, warnings: list[str]) -> dict[str, Any]:
    """Parser SC tipo 'Anexo de Adherentes' (formato más común que envía la aseguradora).

    Layout: cada asegurado ocupa varias líneas; la "fila ancla" tiene N° + CUIL +
    fecha_nac + fecha_alta. El nombre y la ocupación están repartidos en filas
    arriba y abajo, agrupados por coordenadas X (columnas).
    """
    poliza: dict[str, Any] = {}
    endoso: dict[str, Any] = {'tipo': 'asegurados_adherentes'}

    # ---- Datos de póliza por regex (text_full) ----
    m = re.search(r'(\d{2}-\d{2}-\d{2}-\d{8})', text_full)
    if m:
        poliza['numero_poliza'] = m.group(1)

    vigencias = re.findall(r'00HS\s+DEL\s+(\d{2}/\d{2}/\d{4})', text_full)
    if len(vigencias) >= 1: poliza['vigencia_desde'] = parse_date(vigencias[0])
    if len(vigencias) >= 2: poliza['vigencia_hasta'] = parse_date(vigencias[1])

    cuits_aseguradoras = {'34-50004533-9', '33-70089372-9', '30-50001770-4'}
    for cuit in re.findall(r'\b(\d{2}-\d{8}-\d)\b', text_full):
        if cuit not in cuits_aseguradoras:
            poliza['tomador_cuit'] = cuit
            break

    m = re.search(r'TOMADOR\s+RAMO[\s\S]*?\n([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)\s+Accidentes', text_full)
    if m:
        poliza['tomador_razon_social'] = m.group(1).strip()

    m = re.search(r'\b(AP\s+Colectivo|AP\s+Ámbito\s+Laboral|AP\s+Individual)\b', text_full)
    if m:
        poliza['subramo'] = re.sub(r'\s+', ' ', m.group(1)).strip()

    # N° endoso (puede ser 0 para Anexo nuevo).
    m = re.search(r'ENDOSO[\s\S]*?(\d{2}-\d{2}-\d{2}-\d{8})\s+\d{4}\s*-\s*[^\n]+\s+\S+,\s*\d{2}/\d{2}/\d{4}\s+(\d+)',
                  text_full)
    if not m:
        # Fallback: buscar línea con N° póliza + ENDOSO en formato corto
        m = re.search(r'\d{2}-\d{2}-\d{2}-\d{8}\s+\d{4}\s+-\s+CORRIENTES\s+CORRIENTES\s+Resistencia,\s+\d{2}/\d{2}/\d{4}\s+(\d+)', text_full)
        if m:
            endoso['numero_endoso'] = m.group(1)
    elif m:
        endoso['numero_endoso'] = m.group(2)

    m = re.search(r'Resistencia,\s*(\d{2}/\d{2}/\d{4})', text_full)
    if m:
        endoso['fecha_emision'] = parse_date(m.group(1))

    # ---- Asegurados por extract_words con agrupación por columnas ----
    asegurados: list[dict[str, Any]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            asegurados.extend(_parse_pagina_adherentes(page))

    if not asegurados:
        warnings.append('SC adherentes: no se encontraron asegurados')

    return {
        'tipo_documento': 'asegurados_adherentes',
        'poliza':         poliza,
        'endoso':         endoso,
        'asegurados':     asegurados,
        'warnings':       warnings,
    }


# Boundaries de columnas (calibrados sobre PDFs muestra 06/07/08).
# `_COL_FALTA` empieza en 485 porque la fecha alta a veces tiene x0=488.x y caía
# por 1 píxel en OCUPACIÓN.
_COL_NUM   = (0, 110)
_COL_NOM   = (110, 240)
_COL_DOC   = (240, 320)
_COL_FNAC  = (320, 410)
_COL_OCUP  = (410, 485)
_COL_FALTA = (485, 9999)

# CUITs de aseguradoras — para descartar como "CUIL de asegurado" en Y bajos.
_CUITS_ASEGURADORAS = {'34-50004533-9', '33-70089372-9', '30-50001770-4'}

_RE_CUIL  = re.compile(r'^\d{2}-\d{8}-\d$')
_RE_FECHA = re.compile(r'^\d{2}/\d{2}/\d{4}$')


def _parse_pagina_adherentes(page) -> list[dict[str, Any]]:
    """Parsea una sola página de Anexo de Adherentes.

    Soporta tanto la primera página (con header "N° ADHERENTE") como las páginas
    siguientes donde la tabla continúa sin header.
    """
    words = page.extract_words(keep_blank_chars=False)
    if not words:
        return []

    # Localizar el header "N° ADHERENTE". Si no está, asumimos que la tabla
    # continúa de una página anterior y usamos un Y de corte tras el header de página.
    header_y = None
    for w in words:
        if w['text'] == 'N°':
            misma_linea = [x for x in words if abs(x['top'] - w['top']) < 3]
            if any('ADHERENTE' in x['text'] for x in misma_linea):
                header_y = w['top']
                break

    if header_y is None:
        # Pag continuación: cuerpo empieza tras el banner repetido + header de "TOMADOR".
        # El primer CUIL de asegurado real (no de SC) marca el inicio del listado.
        primer_cuil = next(
            (w for w in words
             if _RE_CUIL.match(w['text']) and w['text'] not in _CUITS_ASEGURADORAS),
            None
        )
        if not primer_cuil:
            return []
        header_y = primer_cuil['top'] - 15

    # Agrupar words por línea (Y redondeado).
    body = [w for w in words if w['top'] > header_y + 5]
    rows_by_y: dict[int, list] = defaultdict(list)
    for w in body:
        rows_by_y[round(w['top'])].append(w)

    # Identificar filas ancla (tienen N° y CUIL en la misma línea).
    # Descartar líneas donde el CUIL es de la aseguradora (header repetido).
    anclas: list[tuple[int, str, str, str | None, str | None]] = []
    for y in sorted(rows_by_y.keys()):
        ws = rows_by_y[y]
        num = next((w['text'] for w in ws
                    if _COL_NUM[0] <= w['x0'] < _COL_NUM[1] and w['text'].isdigit()), None)
        cuil = next((w['text'] for w in ws
                     if _RE_CUIL.match(w['text']) and w['text'] not in _CUITS_ASEGURADORAS), None)
        if num and cuil:
            fnac = next((w['text'] for w in ws
                         if _COL_FNAC[0] <= w['x0'] < _COL_FNAC[1] and _RE_FECHA.match(w['text'])), None)
            falta = next((w['text'] for w in ws
                          if w['x0'] >= _COL_FALTA[0] and _RE_FECHA.match(w['text'])), None)
            anclas.append((y, num, cuil, fnac, falta))

    asegurados: list[dict[str, Any]] = []
    for i, (y_a, num, cuil, fnac, falta) in enumerate(anclas):
        # Rango Y en el que recolectar nombre/ocupación de filas adyacentes.
        y_prev = anclas[i - 1][0] if i > 0 else int(header_y)
        y_next = anclas[i + 1][0] if i + 1 < len(anclas) else 9999
        y_min = (y_prev + y_a) // 2 if i > 0 else int(header_y) + 5
        y_max = (y_a + y_next) // 2 if i + 1 < len(anclas) else 9999

        nombre_words: list[tuple[int, float, str]] = []
        ocupacion_words: list[tuple[int, float, str]] = []
        for y, ws in rows_by_y.items():
            if not (y_min <= y <= y_max):
                continue
            for w in ws:
                if _COL_NOM[0] <= w['x0'] < _COL_NOM[1]:
                    nombre_words.append((y, w['x0'], w['text']))
                elif _COL_OCUP[0] <= w['x0'] < _COL_OCUP[1]:
                    ocupacion_words.append((y, w['x0'], w['text']))

        nombre = ' '.join(t for _, _, t in sorted(nombre_words))
        ocupacion = ' '.join(t for _, _, t in sorted(ocupacion_words))

        asegurados.append({
            'tipo': 'persona',
            'identificador': cuil,
            'identificador_tipo': 'cuil',
            'numero_orden_aseguradora': num,
            'nombre_apellido': nombre,
            'fecha_nacimiento': parse_date(fnac) if fnac else None,
            'ocupacion': ocupacion,
            'fecha_alta_efectiva': parse_date(falta) if falta else None,
            'marca_modelo': None,
            'tipo_vehiculo': None,
            'localidad': None,
            'suma_asegurada': None,
            'premio_individual': None,
        })

    return asegurados


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
