"""Parser de PDFs facturables OCASA.

BUGFIX 22 Feature A: extrae las operaciones de los PDFs que OCASA envía,
capturando ID Liquidacion, Transporte, Fecha, Ruta, Importe, Imp.Grav, Imp.NoGrav.

Patrón de nombre del archivo:
    OCA{CUIT_OCASA}T{YYYYMM}A{COD_SUC}{CUIT_LA}.pdf
    Ej: OCA30717060985T202603A00530717060985.pdf
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

import pdfplumber


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_RE_MONTO = re.compile(r'[\d.,]+')


def _parse_monto_ar(raw: str) -> float:
    """Convierte '1.234,56' o '1234.56' a float."""
    s = (raw or '').replace('$', '').replace(' ', '').strip()
    if not s:
        return 0.0
    if ',' in s and '.' in s:
        # ambos → asumir formato es-AR (punto miles, coma decimal)
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_fecha(raw: str) -> Optional[str]:
    """Parsea fecha argentina → YYYY-MM-DD. Acepta DD.MM.YYYY (OCASA), DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD."""
    raw = (raw or '').strip()
    if not raw:
        return None
    for fmt in ('%d.%m.%Y', '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _extraer_sucursal_de_nombre(nombre_archivo: str) -> Optional[str]:
    """Extrae código de sucursal del nombre del archivo.

    Patrón: OCA{CUIT}T{YYYYMM}A{COD_SUC}{CUIT}.pdf
    """
    m = re.search(r'T\d{6}A(\d{3})', nombre_archivo)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Parser principal
# ---------------------------------------------------------------------------

# Regex para una línea de operación OCASA real.
# Ejemplo:
#   202603A00530717060985 10054722 30717060985 03.2026 02.03.2026 102008890 LOGISTICA ARGENTINA SRL DTC856 COR301 153.542,56 153.542,56 0,00
# Orden: ID_LIQ TRANSPORTE CUIT PERIODO FECHA ID_SAP RAZON_SOCIAL DOMINIO RUTA IMPORTE IMP_GRAV IMP_NOGRAV
# Periodo acepta MM.YYYY, MM/YYYY o YYYYMM. Fecha acepta DD.MM.YYYY, DD/MM/YYYY o DD-MM-YYYY.
_RE_LINEA = re.compile(
    r'^(\S+)\s+'                                  # 1: ID Liquidacion (alfanumérico: 202603A00530717060985)
    r'(\d+)\s+'                                   # 2: Transporte (numérico)
    r'(\d{2}-\d{8}-\d|\d{11})\s+'                 # 3: CUIT (con o sin guión)
    r'(\d{2}[./]\d{4}|\d{6})\s+'                  # 4: Periodo MM.YYYY / MM/YYYY / YYYYMM
    r'(\d{2}[./-]\d{2}[./-]\d{4})\s+'             # 5: Fecha DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
    r'(\S+)\s+'                                   # 6: ID SAP
    r'(.+?)\s+'                                   # 7: Razon Social (lazy, acepta "LOGISTICA ARGENTINA SRL")
    r'([A-Z0-9]{5,8})\s+'                         # 8: Dominio (patente)
    r'([A-Z0-9]{3,10})\s+'                        # 9: Ruta (COR301, ROS001, etc.)
    r'\$?([\d.,]+)\s+'                            # 10: Importe
    r'\$?([\d.,]+)\s+'                            # 11: Imp.Grav
    r'\$?([\d.,]+)\s*$'                           # 12: Imp.NoGrav
)


def _normalizar_periodo(raw: str) -> str:
    """Normaliza periodo a YYYYMM canónico. Acepta MM.YYYY, MM/YYYY, YYYYMM."""
    s = (raw or '').strip()
    if re.fullmatch(r'\d{6}', s):
        return s
    m = re.fullmatch(r'(\d{2})[./](\d{4})', s)
    if m:
        return f"{m.group(2)}{m.group(1)}"
    return s


def parse_pdf_ocasa(filepath: str, nombre_archivo: Optional[str] = None) -> dict:
    """Parsea un PDF de OCASA y devuelve las operaciones extraidas.

    Args:
        filepath: ruta absoluta al PDF.
        nombre_archivo: nombre original del archivo (para extraer sucursal).

    Returns:
        {
            'sucursal': 'XXX' | None,
            'total_operaciones': N,
            'total_importe': float,
            'total_gravado': float,
            'total_no_gravado': float,
            'operaciones': [
                {
                    'id_liquidacion': str,
                    'transporte': str,
                    'cuit': str,
                    'periodo': 'YYYYMM',
                    'fecha': 'YYYY-MM-DD',
                    'id_sap': str,
                    'razon_social': str,
                    'dominio': str,
                    'ruta': str,
                    'importe': float,
                    'imp_gravado': float,
                    'imp_no_gravado': float,
                }, ...
            ],
            'warnings': [...]
        }
    """
    sucursal = _extraer_sucursal_de_nombre(nombre_archivo or filepath)
    operaciones = []
    warnings = []
    lineas_no_parseadas = 0
    muestras_no_parseadas: list[str] = []

    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                for raw_line in text.split('\n'):
                    line = raw_line.strip()
                    if not line or len(line) < 50:
                        continue

                    # Filtrar líneas de encabezado/total
                    if any(kw in line.upper() for kw in ['TOTAL', 'LIQUIDACION', 'FECHA DE', 'SUB TOTAL', 'IVA']):
                        continue

                    m = _RE_LINEA.match(line)
                    if not m:
                        # Probable línea de encabezado o subtotal; sólo reportar como no parseada si tiene pinta de datos
                        if re.search(r'\d{2}[./-]\d{2}[./-]\d{4}', line):
                            lineas_no_parseadas += 1
                            if len(muestras_no_parseadas) < 5:
                                muestras_no_parseadas.append(line[:200])
                        continue

                    try:
                        op = {
                            'id_liquidacion': m.group(1),
                            'transporte': m.group(2),
                            'cuit': m.group(3),
                            'periodo': _normalizar_periodo(m.group(4)),
                            'fecha': _parse_fecha(m.group(5)),
                            'id_sap': m.group(6),
                            'razon_social': m.group(7).strip(),
                            'dominio': m.group(8),
                            'ruta': m.group(9),
                            'importe': _parse_monto_ar(m.group(10)),
                            'imp_gravado': _parse_monto_ar(m.group(11)),
                            'imp_no_gravado': _parse_monto_ar(m.group(12)),
                        }
                        operaciones.append(op)
                    except (ValueError, IndexError) as e:
                        warnings.append(f"Error parseando línea: {str(e)[:100]}")
                        continue
    except Exception as e:
        return {
            'success': False,
            'error': f'No se pudo abrir el PDF: {str(e)}',
            'sucursal': sucursal,
            'operaciones': [],
        }

    if lineas_no_parseadas > 0:
        warnings.append(f"{lineas_no_parseadas} línea(s) con pinta de datos no se pudieron parsear")
        for i, muestra in enumerate(muestras_no_parseadas, start=1):
            warnings.append(f"Muestra #{i} no parseada: {muestra}")

    total_importe = sum(op['importe'] for op in operaciones)
    total_grav = sum(op['imp_gravado'] for op in operaciones)
    total_nograv = sum(op['imp_no_gravado'] for op in operaciones)

    return {
        'success': True,
        'sucursal': sucursal,
        'total_operaciones': len(operaciones),
        'total_importe': round(total_importe, 2),
        'total_gravado': round(total_grav, 2),
        'total_no_gravado': round(total_nograv, 2),
        'operaciones': operaciones,
        'warnings': warnings,
    }
