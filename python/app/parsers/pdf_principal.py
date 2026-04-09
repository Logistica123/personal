"""Parser del PDF principal de sucursal OCA.

Extrae planillas con 3 patrones de regex:
1. Estándar (paquetes): fecha, hora, nro_planilla, cod_contrato, descripcion, precio, cantidad(int), importe
2. PICKUP (malformado): texto concatenado sin espacios
3. HORAS (contrato 199): cantidad decimal, descripción termina en 'Horas'
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

import pdfplumber

from app.models.schemas import PlanillaOCA

# ---------------------------------------------------------------------------
# Helpers para parsear montos argentinos ($1.234,56 -> 1234.56)
# ---------------------------------------------------------------------------

def _parse_monto(raw: str) -> float:
    """Convierte '$1.234,56' o '1234.56' a float."""
    clean = raw.replace("$", "").replace(" ", "").strip()
    if "," in clean and "." in clean:
        clean = clean.replace(".", "").replace(",", ".")
    elif "," in clean:
        clean = clean.replace(",", ".")
    return float(clean)


def _parse_cantidad(raw: str) -> float:
    """Convierte cantidad: '38' -> 38.0, '9,750' -> 9.75."""
    clean = raw.replace(" ", "").strip()
    if "," in clean:
        clean = clean.replace(".", "").replace(",", ".")
    return float(clean)


def _parse_fecha(raw: str) -> date:
    """Convierte 'DD/MM/YYYY' a date."""
    return datetime.strptime(raw.strip(), "%d/%m/%Y").date()


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Patrón estándar: fecha hora nro_planilla cod_contrato descripcion precio cantidad importe
_RE_ESTANDAR = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+"           # fecha
    r"(\d{2}:\d{2})\s+"                  # hora
    r"([\w][\w\-]*)\s+"                  # nro_planilla (numerico o alfanumerico)
    r"(\d{3})\s+"                        # cod_contrato (3 digitos)
    r"(.+?)\s+"                          # descripcion
    r"\$?([\d.,]+)\s+"                   # precio_unitario
    r"([\d.,]+)\s+"                      # cantidad
    r"\$?([\d.,]+)\s*$"                  # importe_total
)

# Patrón HORAS: la descripción termina en 'Horas' antes del precio
_RE_HORAS = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+"           # fecha
    r"(\d{2}:\d{2})\s+"                  # hora
    r"([\w][\w\-]*)\s+"                  # nro_planilla
    r"(199)\s+"                           # cod_contrato = 199
    r"(.+?Horas?)\s+"                    # descripcion (termina en Horas)
    r"\$?([\d.,]+)\s+"                   # precio_unitario
    r"([\d.,]+)\s+"                      # cantidad (decimal)
    r"\$?([\d.,]+)\s*$"                  # importe_total
)

# Patrón PICKUP malformado: texto concatenado
# Ejemplo: 'PICKUP PRINC$IP2.243,670'
_RE_PICKUP = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+"           # fecha
    r"(\d{2}:\d{2})\s+"                  # hora
    r"([\w][\w\-]*)\s+"                  # nro_planilla
    r"(\d{3})\s+"                        # cod_contrato
    r"(.*?PICKUP\s*\w*)"                 # descripcion con PICKUP
    r"\$?\s*[A-Z]*"                      # posible basura
    r"([\d.,]+)\s+"                      # precio_unitario
    r"(\d+)\s+"                          # cantidad
    r"\$?([\d.,]+)\s*$"                  # importe_total
)

# Patrón PICKUP más agresivo para casos muy malformados
_RE_PICKUP_CONCAT = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+"           # fecha
    r"(\d{2}:\d{2})\s+"                  # hora
    r"([\w][\w\-]*)\s+"                  # nro_planilla
    r"(\d{3})\s+"                        # cod_contrato
    r"(.*?PICKUP.*?)"                    # descripcion
    r"\$?([\d.,]+?)"                     # precio (puede estar pegado)
    r"(\d+)\s*"                          # cantidad
    r"\$?([\d.,]+)\s*$"                  # importe
)


# ---------------------------------------------------------------------------
# Parser principal
# ---------------------------------------------------------------------------

def _try_parse_line(line: str) -> Optional[PlanillaOCA]:
    """Intenta parsear una línea con los 3 patrones en orden de prioridad."""
    line = line.strip()
    if not line:
        return None

    # 1. Primero intentar patrón HORAS (más específico, contrato 199)
    m = _RE_HORAS.match(line)
    if m:
        return PlanillaOCA(
            fecha=_parse_fecha(m.group(1)),
            hora=m.group(2),
            nro_planilla=m.group(3),
            cod_contrato=m.group(4),
            descripcion=m.group(5).strip(),
            precio_unitario=_parse_monto(m.group(6)),
            cantidad=_parse_cantidad(m.group(7)),
            importe_total=_parse_monto(m.group(8)),
        )

    # 2. Patrón estándar
    m = _RE_ESTANDAR.match(line)
    if m:
        return PlanillaOCA(
            fecha=_parse_fecha(m.group(1)),
            hora=m.group(2),
            nro_planilla=m.group(3),
            cod_contrato=m.group(4),
            descripcion=m.group(5).strip(),
            precio_unitario=_parse_monto(m.group(6)),
            cantidad=_parse_cantidad(m.group(7)),
            importe_total=_parse_monto(m.group(8)),
        )

    # 3. Patrón PICKUP
    for pattern in (_RE_PICKUP, _RE_PICKUP_CONCAT):
        m = pattern.match(line)
        if m:
            try:
                return PlanillaOCA(
                    fecha=_parse_fecha(m.group(1)),
                    hora=m.group(2),
                    nro_planilla=m.group(3),
                    cod_contrato=m.group(4),
                    descripcion=m.group(5).strip(),
                    precio_unitario=_parse_monto(m.group(6)),
                    cantidad=_parse_cantidad(m.group(7)),
                    importe_total=_parse_monto(m.group(8)),
                )
            except (ValueError, IndexError):
                continue

    return None


def parsear_pdf_principal(pdf_path: str) -> list[PlanillaOCA]:
    """Extrae todas las planillas del PDF principal de una sucursal OCA.

    Args:
        pdf_path: Ruta al archivo PDF principal ({SUCURSAL}.pdf).

    Returns:
        Lista de PlanillaOCA parseadas.
    """
    planillas: list[PlanillaOCA] = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.split("\n"):
                planilla = _try_parse_line(line)
                if planilla is not None:
                    planillas.append(planilla)

    return planillas
