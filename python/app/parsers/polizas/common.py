"""Helpers compartidos por los 3 perfiles de parser de pólizas."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional


# Formatos de patente argentinos (auto/moto, viejo y Mercosur).
#
# BUGFIX 01: pdfplumber.extract_text() merge celdas adyacentes cuando el N° de
# orden tiene 2+ dígitos. Resultado: la patente queda pegada al modelo del
# vehículo sin espacio (`AA788ZUEXPRESS`). Con `\b` final el match falla
# (entre 'U' y 'E' no hay word boundary). Se reemplaza por:
#
#   - Lookbehind `(?<![A-Z\d])` exigiendo que ANTES de la patente no haya
#     letra ni dígito (acepta espacio, signo, inicio de string).
#   - Sin lookahead final: aceptamos que la patente puede estar pegada a
#     más letras (modelo del vehículo).
#
# Los formatos están ordenados de más específico a menos para que en posiciones
# ambiguas se prefiera el patrón largo.
RE_PATENTE = re.compile(
    r'(?<![A-Z\d])('
    r'[A-Z]{2}\d{3}[A-Z]{2}'   # auto Mercosur: AB123CD
    r'|[A-Z]\d{3}[A-Z]{3}'     # moto Mercosur: A123BCD
    r'|[A-Z]{3}\d{3}'          # auto viejo: ABC123
    r'|\d{3}[A-Z]{3}'          # moto vieja: 123ABC
    r')'
)


def parse_money(raw: Optional[str]) -> Optional[float]:
    """`'$53.800.000'` → `53800000.0`. Asume formato es-AR (punto miles, coma decimal)."""
    if not raw:
        return None
    s = re.sub(r'[\$\s]', '', str(raw))
    if not s:
        return None
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    elif '.' in s:
        # Solo punto: si todos los grupos post-punto tienen 3 dígitos exactos,
        # es separador de miles (es-AR). Si no, decimal.
        partes = s.split('.')
        if len(partes) >= 2 and all(len(p) == 3 for p in partes[1:]):
            s = s.replace('.', '')
    try:
        return float(s)
    except ValueError:
        return None


def parse_date(raw: Optional[str]) -> Optional[str]:
    """`'23/01/2026'` → `'2026-01-23'`. Acepta formatos `DD/MM/YYYY` o `DD-MM-YYYY`."""
    if not raw:
        return None
    s = raw.strip()
    for fmt in ('%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def normalizar_cuil(raw: Optional[str]) -> Optional[str]:
    """`'20-31675826-7'` → `'20316758267'`. Strip de todo lo no-dígito."""
    if not raw:
        return None
    digits = re.sub(r'\D', '', raw)
    return digits or None


def extraer_dni_del_cuil(cuil: Optional[str]) -> Optional[str]:
    """`'20-31675826-7'` → `'31675826'` (los 8 dígitos centrales)."""
    digits = normalizar_cuil(cuil)
    if digits and len(digits) == 11:
        return digits[2:10]
    return None


def normalizar_patente(raw: Optional[str]) -> Optional[str]:
    """Limpia espacios/guiones y pasa a mayúsculas."""
    if not raw:
        return None
    return raw.upper().replace(' ', '').replace('-', '').strip() or None


def detectar_aseguradora(text: str) -> Optional[str]:
    """Detecta perfil por contenido del texto. Devuelve `'mapfre'`, `'san_cristobal'`,
    `'la_segunda'` o None. Coincide con `polizas_aseguradoras.parser_perfil`.
    """
    if re.search(r'MAPFRE\s+ARGENTINA', text, re.IGNORECASE):
        return 'mapfre'
    if re.search(r'SAN\s*CRISTOBAL\s+S\.M\.S\.G\.', text, re.IGNORECASE):
        return 'san_cristobal'
    if re.search(r'lasegunda\.com\.ar', text, re.IGNORECASE):
        return 'la_segunda'
    return None
