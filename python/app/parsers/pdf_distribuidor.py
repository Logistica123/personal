"""Parsers de PDFs de distribuidores OCA.

Formato A (Individual): un PDF por distribuidor con totales diarios.
Formato B (Combinado/Desglose): un PDF único con todos los distribuidores.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

import pdfplumber

from app.models.schemas import DistribuidorPDF, TotalDiarioDistribuidor

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_monto(raw: str) -> float:
    clean = raw.replace("$", "").replace(" ", "").strip()
    if "," in clean and "." in clean:
        clean = clean.replace(".", "").replace(",", ".")
    elif "," in clean:
        clean = clean.replace(",", ".")
    return float(clean)


def _parse_cantidad(raw: str) -> float:
    clean = raw.replace(" ", "").strip()
    if "," in clean:
        clean = clean.replace(".", "").replace(",", ".")
    return float(clean)


def _parse_fecha(raw: str) -> date:
    return datetime.strptime(raw.strip(), "%d/%m/%Y").date()


# ---------------------------------------------------------------------------
# Secciones a ignorar (multi-sección en PDFs individuales)
# ---------------------------------------------------------------------------

_SECCIONES_STOP = [
    "Total Sucursal",
    "OEP",
    "Planillas Manuales",
    "Recorridos Fijos",
]

# Patrones a ignorar en PDF combinado (no son nombres de distribuidor)
_PATRONES_IGNORAR_COMBINADO = [
    "Detalle de Unidades",
    "Fecha de impresion",
    "Periodo:",
    "OCA",
    "LOGISTICA ARGENTINA",
    "Total Unidades",
    "Cantidad Importe",
    "Pagina",
    "Total Sucursal",
    "OEP",
    "Planillas Manuales",
    "Recorridos Fijos",
]

# Regex para línea de dato en PDF distribuidor: fecha - descripcion - cantidad - $importe
_RE_LINEA_DISTRIB = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+"  # fecha
    r"(.+?)\s+"                 # descripcion
    r"([\d.,]+)\s+"             # cantidad
    r"\$?([\d.,]+)\s*$"         # importe
)

# Regex para total global (línea que empieza con $ seguido de importe)
_RE_TOTAL_GLOBAL = re.compile(r"^\$\s*[\d.,]+\s*$")

# Regex para nombre de distribuidor en PDF combinado (MAYÚSCULAS, >3 chars)
_RE_NOMBRE_DISTRIB = re.compile(r"^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.]+$")


# ---------------------------------------------------------------------------
# Formato A: PDF Individual
# ---------------------------------------------------------------------------

def parsear_pdf_individual(pdf_path: str, nombre_distribuidor: str) -> DistribuidorPDF:
    """Parsea un PDF individual de distribuidor.

    Solo procesa la primera sección de datos para evitar duplicados
    por secciones repetidas (OCA, OEP, Planillas Manuales, etc.).

    Args:
        pdf_path: Ruta al PDF del distribuidor.
        nombre_distribuidor: Nombre extraído del nombre de archivo.

    Returns:
        DistribuidorPDF con totales diarios acumulados.
    """
    totales: dict[date, TotalDiarioDistribuidor] = {}
    en_seccion_datos = False

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            for line in text.split("\n"):
                stripped = line.strip()
                if not stripped:
                    continue

                # Detectar inicio de sección de datos
                if "Total Unidades" in stripped:
                    en_seccion_datos = True
                    continue

                # Detectar fin de primera sección (stop en secciones secundarias)
                if en_seccion_datos:
                    # Total global -> fin
                    if _RE_TOTAL_GLOBAL.match(stripped):
                        en_seccion_datos = False
                        break

                    # Encabezado de sección secundaria -> fin
                    if any(sec in stripped for sec in _SECCIONES_STOP):
                        en_seccion_datos = False
                        break

                if not en_seccion_datos:
                    continue

                # Parsear línea de dato
                m = _RE_LINEA_DISTRIB.match(stripped)
                if not m:
                    continue

                try:
                    fecha = _parse_fecha(m.group(1))
                    cantidad = _parse_cantidad(m.group(3))
                    importe = _parse_monto(m.group(4))
                except (ValueError, IndexError):
                    continue

                # Filtrar monto cero
                if abs(importe) < 0.001:
                    continue

                if fecha in totales:
                    totales[fecha].cantidad += cantidad
                    totales[fecha].importe += importe
                else:
                    totales[fecha] = TotalDiarioDistribuidor(
                        fecha=fecha,
                        cantidad=cantidad,
                        importe=importe,
                    )

            # Si ya salimos de la sección, no seguir con más páginas para datos
            if not en_seccion_datos and totales:
                break

    return DistribuidorPDF(
        nombre=nombre_distribuidor,
        archivo=pdf_path,
        totales_diarios=sorted(totales.values(), key=lambda t: t.fecha),
    )


# ---------------------------------------------------------------------------
# Formato B: PDF Combinado (Desglose)
# ---------------------------------------------------------------------------

def _es_nombre_distribuidor(line: str) -> bool:
    """Detecta si una línea es un nombre de distribuidor en el PDF combinado."""
    stripped = line.strip()
    if len(stripped) <= 3:
        return False
    if not _RE_NOMBRE_DISTRIB.match(stripped):
        return False
    # Filtrar patrones conocidos que no son nombres
    upper = stripped.upper()
    for patron in _PATRONES_IGNORAR_COMBINADO:
        if patron.upper() in upper:
            return False
    return True


def parsear_pdf_combinado(pdf_path: str) -> list[DistribuidorPDF]:
    """Parsea un PDF combinado (desglose) con todos los distribuidores.

    Detecta nombres de distribuidor como encabezados en MAYÚSCULA y agrupa
    las líneas de datos bajo cada distribuidor.

    Args:
        pdf_path: Ruta al PDF combinado de desglose.

    Returns:
        Lista de DistribuidorPDF, uno por cada distribuidor encontrado.
    """
    # Extraer todo el texto
    all_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                all_text += text + "\n"

    distribuidores: dict[str, dict[date, TotalDiarioDistribuidor]] = {}
    distribuidor_actual: Optional[str] = None

    for line in all_text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        # Detectar nombre de distribuidor
        if _es_nombre_distribuidor(stripped):
            distribuidor_actual = stripped.strip()
            if distribuidor_actual not in distribuidores:
                distribuidores[distribuidor_actual] = {}
            continue

        if distribuidor_actual is None:
            continue

        # Parsear línea de dato
        m = _RE_LINEA_DISTRIB.match(stripped)
        if not m:
            continue

        try:
            fecha = _parse_fecha(m.group(1))
            cantidad = _parse_cantidad(m.group(3))
            importe = _parse_monto(m.group(4))
        except (ValueError, IndexError):
            continue

        # Filtrar monto cero
        if abs(importe) < 0.001:
            continue

        totales = distribuidores[distribuidor_actual]
        if fecha in totales:
            totales[fecha].cantidad += cantidad
            totales[fecha].importe += importe
        else:
            totales[fecha] = TotalDiarioDistribuidor(
                fecha=fecha,
                cantidad=cantidad,
                importe=importe,
            )

    # Convertir a lista de DistribuidorPDF
    resultado = []
    for nombre, totales in distribuidores.items():
        resultado.append(DistribuidorPDF(
            nombre=nombre,
            archivo=pdf_path,
            totales_diarios=sorted(totales.values(), key=lambda t: t.fecha),
        ))

    return resultado
