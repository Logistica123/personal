"""Detección automática de archivos OCA en una carpeta.

Detecta:
1. PDF principal: nombre corto sin espacio ({SUCURSAL}.pdf)
2. PDFs distribuidores individuales: {SUCURSAL} {Nombre}.pdf (Formato A)
3. PDF combinado: contiene 'desglose' en el nombre (Formato B)
"""

from __future__ import annotations

import os
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from app.models.schemas import FormatoDistribuidor


@dataclass
class ArchivosDetectados:
    sucursal: str
    main_pdf: str
    formato: FormatoDistribuidor
    # Formato A: dict nombre_distribuidor -> ruta PDF
    pdfs_individuales: dict[str, str] = field(default_factory=dict)
    # Formato B: ruta al PDF combinado
    pdf_combinado: str | None = None


def detectar_archivos(carpeta: str) -> ArchivosDetectados:
    """Detecta automáticamente los archivos OCA en una carpeta.

    Args:
        carpeta: Ruta a la carpeta con los PDFs de la sucursal.

    Returns:
        ArchivosDetectados con la información de los archivos encontrados.

    Raises:
        ValueError: Si no se encuentra PDF principal o distribuidores.
    """
    carpeta_path = Path(carpeta)
    if not carpeta_path.is_dir():
        raise ValueError(f"Carpeta no encontrada: {carpeta}")

    pdfs = [f for f in carpeta_path.iterdir() if f.suffix.lower() == ".pdf"]
    if not pdfs:
        raise ValueError(f"No se encontraron archivos PDF en: {carpeta}")

    # Paso 1: Detectar sucursal como el prefijo más frecuente
    # PDFs cortos (sin espacio) son candidatos a PDF principal
    pdfs_cortos = []
    pdfs_con_espacio = []
    pdfs_desglose = []

    for pdf in pdfs:
        nombre = pdf.stem  # nombre sin extensión
        if "desglose" in nombre.lower():
            pdfs_desglose.append(pdf)
        elif " " in nombre:
            pdfs_con_espacio.append(pdf)
        else:
            pdfs_cortos.append(pdf)

    # La sucursal se detecta como el prefijo más común
    sucursal = _detectar_sucursal(pdfs_cortos, pdfs_con_espacio, pdfs_desglose)
    if not sucursal:
        raise ValueError(
            "No se pudo detectar la sucursal. "
            "Asegurate de que haya un PDF principal con formato {SUCURSAL}.pdf"
        )

    # Paso 2: Encontrar PDF principal
    main_pdf = None
    for pdf in pdfs_cortos:
        if pdf.stem.upper() == sucursal.upper():
            main_pdf = str(pdf)
            break

    if not main_pdf:
        raise ValueError(
            f"No se encontró PDF principal: {sucursal}.pdf en {carpeta}"
        )

    # Paso 3: Detectar formato de distribuidores
    # Buscar PDFs individuales con prefijo sucursal + espacio + nombre
    pdfs_individuales: dict[str, str] = {}
    prefijo = sucursal.upper()
    for pdf in pdfs_con_espacio:
        nombre = pdf.stem
        if nombre.upper().startswith(prefijo + " "):
            nombre_distrib = nombre[len(prefijo) + 1:].strip()
            if nombre_distrib:
                pdfs_individuales[nombre_distrib] = str(pdf)

    if pdfs_individuales:
        return ArchivosDetectados(
            sucursal=sucursal,
            main_pdf=main_pdf,
            formato=FormatoDistribuidor.INDIVIDUAL,
            pdfs_individuales=pdfs_individuales,
        )

    # Si no hay individuales, buscar combinado
    if pdfs_desglose:
        return ArchivosDetectados(
            sucursal=sucursal,
            main_pdf=main_pdf,
            formato=FormatoDistribuidor.COMBINADO,
            pdf_combinado=str(pdfs_desglose[0]),
        )

    raise ValueError(
        f"No se encontraron PDFs de distribuidores para sucursal {sucursal}. "
        "Se esperan PDFs individuales ({SUCURSAL} Nombre.pdf) "
        "o un PDF combinado con 'desglose' en el nombre."
    )


def _detectar_sucursal(
    pdfs_cortos: list[Path],
    pdfs_con_espacio: list[Path],
    pdfs_desglose: list[Path],
) -> str | None:
    """Detecta la sucursal basándose en los nombres de archivo."""
    # Opción 1: si hay un solo PDF corto, ese es la sucursal
    if len(pdfs_cortos) == 1:
        return pdfs_cortos[0].stem.upper()

    # Opción 2: contar prefijos en PDFs con espacio
    prefijos = Counter()
    for pdf in pdfs_con_espacio:
        parts = pdf.stem.split(" ", 1)
        if parts:
            prefijos[parts[0].upper()] += 1

    # Contar prefijos en PDFs desglose
    for pdf in pdfs_desglose:
        parts = pdf.stem.split(" ", 1)
        if parts:
            prefijos[parts[0].upper()] += 1

    if prefijos:
        # El prefijo más común es la sucursal
        sucursal = prefijos.most_common(1)[0][0]
        return sucursal

    # Opción 3: si hay PDFs cortos, elegir el primero
    if pdfs_cortos:
        return pdfs_cortos[0].stem.upper()

    return None
