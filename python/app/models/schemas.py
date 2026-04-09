"""Pydantic schemas for OCA PDF processing."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EstadoMatch(str, Enum):
    EXACTO = "EXACTO"
    APROXIMADO = "APROXIMADO"
    SIN_ASIGNAR = "SIN_ASIGNAR"


class FormatoDistribuidor(str, Enum):
    INDIVIDUAL = "INDIVIDUAL"
    COMBINADO = "COMBINADO"


# ---------------------------------------------------------------------------
# PDF principal - planilla parseada
# ---------------------------------------------------------------------------

class PlanillaOCA(BaseModel):
    fecha: date
    hora: Optional[str] = None
    nro_planilla: str
    cod_contrato: str
    descripcion: str
    precio_unitario: float
    cantidad: float
    importe_total: float


# ---------------------------------------------------------------------------
# PDF distribuidor - total diario
# ---------------------------------------------------------------------------

class TotalDiarioDistribuidor(BaseModel):
    fecha: date
    cantidad: float
    importe: float


class DistribuidorPDF(BaseModel):
    nombre: str
    archivo: Optional[str] = None
    totales_diarios: list[TotalDiarioDistribuidor] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Resultado vinculacion
# ---------------------------------------------------------------------------

class PlanillaAsignada(BaseModel):
    planilla: PlanillaOCA
    distribuidor_nombre: str
    score: float = 0.0
    estado: EstadoMatch = EstadoMatch.EXACTO


class ResultadoDia(BaseModel):
    fecha: date
    estado: EstadoMatch
    diff_importe: float = 0.0
    asignaciones: list[PlanillaAsignada] = Field(default_factory=list)
    sin_asignar: list[PlanillaOCA] = Field(default_factory=list)


class ResultadoVinculacion(BaseModel):
    sucursal: str
    formato_distribuidor: FormatoDistribuidor
    total_planillas: int = 0
    total_distribuidores: int = 0
    dias: list[ResultadoDia] = Field(default_factory=list)
    distribuidores: list[DistribuidorPDF] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Request / Response API
# ---------------------------------------------------------------------------

class ProcesarRequest(BaseModel):
    sucursal: str


class ProcesarResponse(BaseModel):
    success: bool
    mensaje: Optional[str] = None
    resultado: Optional[ResultadoVinculacion] = None
