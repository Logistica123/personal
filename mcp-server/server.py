"""MCP Server que expone la API read-only de DistriApp como herramientas para Claude."""

import json
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("distriapp-readonly")

API_BASE = "https://personal.distriapp.com.ar/api/distriapp/readonly"
API_KEY = "a45a16e45dbf0441c430201d031fa2648ed0cc2a4cd1037d1b008e721df2e524"
TIMEOUT = 15

HEADERS = {"X-Distriapp-Key": API_KEY, "Accept": "application/json"}


def _get(path: str, params: dict | None = None) -> str:
    url = f"{API_BASE}/{path.lstrip('/')}"
    resp = httpx.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    return json.dumps(resp.json(), ensure_ascii=False, indent=2)


@mcp.tool()
def dashboard() -> str:
    """Obtiene el resumen general con conteos por estado: activos, pre-activos, pausados, no citados, sin estado, bajas."""
    return _get("dashboard")


@mcp.tool()
def activos(per_page: int = 100, page: int = 1) -> str:
    """Lista los distribuidores con estado Activo. Paginado."""
    return _get("activos", {"per_page": per_page, "page": page})


@mcp.tool()
def pre_activos(per_page: int = 100, page: int = 1) -> str:
    """Lista los distribuidores con estado Pre-Activo. Paginado."""
    return _get("pre-activos", {"per_page": per_page, "page": page})


@mcp.tool()
def pausados(per_page: int = 100, page: int = 1) -> str:
    """Lista los distribuidores con estado Pausado. Paginado."""
    return _get("pausados", {"per_page": per_page, "page": page})


@mcp.tool()
def no_citados(per_page: int = 100, page: int = 1) -> str:
    """Lista los distribuidores con estado No Citado. Paginado."""
    return _get("no-citados", {"per_page": per_page, "page": page})


@mcp.tool()
def sin_estado(per_page: int = 100, page: int = 1) -> str:
    """Lista los distribuidores sin estado asignado. Paginado."""
    return _get("sin-estado", {"per_page": per_page, "page": page})


@mcp.tool()
def bajas(per_page: int = 100, page: int = 1) -> str:
    """Lista los distribuidores dados de baja. Paginado."""
    return _get("bajas", {"per_page": per_page, "page": page})


@mcp.tool()
def semanas(fecha: str | None = None, asesor_comercial: str | None = None) -> str:
    """Obtiene tendencias semanales de cierres diarios. Filtrable por fecha y asesor comercial."""
    params = {}
    if fecha:
        params["fecha"] = fecha
    if asesor_comercial:
        params["asesor_comercial"] = asesor_comercial
    return _get("semanas", params or None)


@mcp.tool()
def cierres_diarios(
    fecha: str | None = None,
    asesor_comercial: str | None = None,
    sucursal: str | None = None,
    per_page: int = 200,
    page: int = 1,
) -> str:
    """Obtiene los cierres diarios importados de Kommo. Filtrable por fecha, asesor y sucursal."""
    params: dict = {"per_page": per_page, "page": page}
    if fecha:
        params["fecha"] = fecha
    if asesor_comercial:
        params["asesor_comercial"] = asesor_comercial
    if sucursal:
        params["sucursal"] = sucursal
    return _get("cierres-diarios", params)


@mcp.tool()
def cierres_fechas() -> str:
    """Obtiene las fechas de importacion disponibles en cierres diarios."""
    return _get("cierres-diarios/fechas")
