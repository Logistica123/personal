"""Parsers de PDFs de pólizas (MAPFRE, San Cristóbal, La Segunda).

Punto de entrada: `parse_pdf_polizas(path)` detecta la aseguradora por header
y dispatcha al perfil correspondiente.
"""

from app.parsers.polizas.dispatch import parse_pdf_polizas

__all__ = ['parse_pdf_polizas']
