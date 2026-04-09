"""Motor de vinculación OCA: orquesta parseo + matching.

Flujo:
1. Detectar archivos en carpeta
2. Parsear PDF principal -> planillas
3. Parsear PDFs distribuidores (individual o combinado) -> totales diarios
4. Ejecutar subset-sum día por día
5. Devolver resultado completo
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.models.schemas import (
    DistribuidorPDF,
    FormatoDistribuidor,
    PlanillaOCA,
    ResultadoDia,
    ResultadoVinculacion,
)
from app.parsers.detector import ArchivosDetectados, detectar_archivos
from app.parsers.pdf_distribuidor import parsear_pdf_combinado, parsear_pdf_individual
from app.parsers.pdf_principal import parsear_pdf_principal

from .subset_sum import Target, vincular_dia


def procesar_sucursal(carpeta: str) -> ResultadoVinculacion:
    """Procesa una sucursal OCA completa.

    Args:
        carpeta: Ruta a la carpeta con los PDFs.

    Returns:
        ResultadoVinculacion con toda la información de la vinculación.
    """
    # 1. Detectar archivos
    archivos = detectar_archivos(carpeta)

    # 2. Parsear PDF principal
    planillas = parsear_pdf_principal(archivos.main_pdf)

    # 3. Parsear distribuidores
    distribuidores = _parsear_distribuidores(archivos)

    # 4. Agrupar planillas por día
    planillas_por_dia: dict[date, list[PlanillaOCA]] = defaultdict(list)
    for p in planillas:
        planillas_por_dia[p.fecha].append(p)

    # 5. Ejecutar matching día por día
    dias: list[ResultadoDia] = []
    for fecha in sorted(planillas_por_dia.keys()):
        planillas_dia = planillas_por_dia[fecha]

        # Construir targets del día
        targets = _build_targets(distribuidores, fecha)

        if not targets:
            # Sin distribuidores para este día -> todas sin asignar
            from app.models.schemas import EstadoMatch
            dias.append(ResultadoDia(
                fecha=fecha,
                estado=EstadoMatch.SIN_ASIGNAR,
                sin_asignar=planillas_dia,
            ))
            continue

        resultado_dia = vincular_dia(planillas_dia, targets)
        dias.append(resultado_dia)

    return ResultadoVinculacion(
        sucursal=archivos.sucursal,
        formato_distribuidor=archivos.formato,
        total_planillas=len(planillas),
        total_distribuidores=len(distribuidores),
        dias=dias,
        distribuidores=distribuidores,
    )


def procesar_desde_archivos(
    main_pdf_path: str,
    distrib_paths: dict[str, str] | None = None,
    combinado_path: str | None = None,
    sucursal: str = "",
) -> ResultadoVinculacion:
    """Procesa usando rutas de archivos directas (sin detección automática).

    Útil cuando Laravel ya sabe las rutas de los archivos subidos.

    Args:
        main_pdf_path: Ruta al PDF principal.
        distrib_paths: Dict nombre_distribuidor -> ruta PDF (Formato A).
        combinado_path: Ruta al PDF combinado (Formato B).
        sucursal: Código de sucursal.

    Returns:
        ResultadoVinculacion.
    """
    # Parsear PDF principal
    planillas = parsear_pdf_principal(main_pdf_path)

    # Parsear distribuidores según formato
    if distrib_paths:
        formato = FormatoDistribuidor.INDIVIDUAL
        distribuidores = [
            parsear_pdf_individual(path, nombre)
            for nombre, path in distrib_paths.items()
        ]
    elif combinado_path:
        formato = FormatoDistribuidor.COMBINADO
        distribuidores = parsear_pdf_combinado(combinado_path)
    else:
        raise ValueError("Se requiere distrib_paths o combinado_path")

    # Agrupar planillas por día
    planillas_por_dia: dict[date, list[PlanillaOCA]] = defaultdict(list)
    for p in planillas:
        planillas_por_dia[p.fecha].append(p)

    # Matching día por día
    dias: list[ResultadoDia] = []
    for fecha in sorted(planillas_por_dia.keys()):
        planillas_dia = planillas_por_dia[fecha]
        targets = _build_targets(distribuidores, fecha)

        if not targets:
            from app.models.schemas import EstadoMatch
            dias.append(ResultadoDia(
                fecha=fecha,
                estado=EstadoMatch.SIN_ASIGNAR,
                sin_asignar=planillas_dia,
            ))
            continue

        resultado_dia = vincular_dia(planillas_dia, targets)
        dias.append(resultado_dia)

    return ResultadoVinculacion(
        sucursal=sucursal,
        formato_distribuidor=formato,
        total_planillas=len(planillas),
        total_distribuidores=len(distribuidores),
        dias=dias,
        distribuidores=distribuidores,
    )


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _parsear_distribuidores(archivos: ArchivosDetectados) -> list[DistribuidorPDF]:
    """Parsea los PDFs de distribuidores según el formato detectado."""
    if archivos.formato == FormatoDistribuidor.INDIVIDUAL:
        return [
            parsear_pdf_individual(path, nombre)
            for nombre, path in archivos.pdfs_individuales.items()
        ]
    elif archivos.formato == FormatoDistribuidor.COMBINADO and archivos.pdf_combinado:
        return parsear_pdf_combinado(archivos.pdf_combinado)
    else:
        return []


def _build_targets(distribuidores: list[DistribuidorPDF], fecha: date) -> list[Target]:
    """Construye targets para un día específico desde los distribuidores."""
    targets = []
    for distrib in distribuidores:
        for total in distrib.totales_diarios:
            if total.fecha == fecha:
                targets.append(Target(
                    nombre=distrib.nombre,
                    cantidad_esperada=total.cantidad,
                    importe_esperado=total.importe,
                ))
                break
    return targets
