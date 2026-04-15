"""MCP Server que expone la API read-only de DistriApp como herramientas para Claude."""

import json
import logging
import os
import sys
import traceback
from datetime import datetime

import httpx
from mcp.server.fastmcp import FastMCP

# ── Logging a archivo ────────────────────────────────────────────────
LOG_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(LOG_DIR, "mcp-server.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger("distriapp-mcp")

log.info("=" * 60)
log.info("MCP Server iniciado - %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
log.info("Python: %s", sys.executable)
log.info("Log file: %s", LOG_FILE)
log.info("=" * 60)

mcp = FastMCP("distriapp-readonly")

API_BASE = "https://personal.distriapp.com.ar/api/distriapp/readonly"
API_KEY = os.environ.get("DISTRIAPP_API_KEY", "")
TIMEOUT = 15

if not API_KEY:
    log.error("DISTRIAPP_API_KEY no está configurada. El server no podrá autenticarse.")

HEADERS = {"X-Distriapp-Key": API_KEY, "Accept": "application/json"}


def _get(path: str, params: dict | None = None) -> str:
    url = f"{API_BASE}/{path.lstrip('/')}"
    log.info("GET %s params=%s", url, params)
    try:
        resp = httpx.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        log.info("OK %s -> %d bytes", path, len(resp.content))
        return json.dumps(resp.json(), ensure_ascii=False, indent=2)
    except Exception as e:
        log.error("ERROR en GET %s: %s", path, e)
        log.error(traceback.format_exc())
        raise


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


@mcp.tool()
def buscar_persona(q: str) -> str:
    """Busca distribuidores por CUIL, apellido, nombre, email o patente. Minimo 3 caracteres."""
    return _get("buscar-persona", {"q": q})


@mcp.tool()
def persona_documentos(persona_id: int, per_page: int = 100, page: int = 1) -> str:
    """Lista los documentos de un distribuidor por su ID. Incluye tipo, vencimiento, y estado (enviada/recibido/pagado)."""
    return _get(f"persona/{persona_id}/documentos", {"per_page": per_page, "page": page})


@mcp.tool()
def persona_historial(persona_id: int) -> str:
    """Obtiene el historial de cambios de un distribuidor: quién cambió qué campo, valor anterior y nuevo."""
    return _get(f"persona/{persona_id}/historial")


@mcp.tool()
def documentos_vencidos(per_page: int = 100, page: int = 1) -> str:
    """Lista todos los documentos vencidos del sistema con datos del distribuidor."""
    return _get("documentos-vencidos", {"per_page": per_page, "page": page})


@mcp.tool()
def vencimientos(dias: int = 30, estado: str = "todos", per_page: int = 100, page: int = 1) -> str:
    """Consulta vencimientos de documentos. Filtros: dias (próximos N días, default 30), estado ('vencido', 'por_vencer', 'todos'). Incluye resumen con conteo de vencidos y por vencer."""
    return _get("vencimientos", {"dias": dias, "estado": estado, "per_page": per_page, "page": page})


@mcp.tool()
def tipos_documento() -> str:
    """Lista los tipos de documentos disponibles y si requieren fecha de vencimiento."""
    return _get("tipos-documento")
