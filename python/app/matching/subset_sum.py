"""Motor de vinculación OCA: Subset-Sum con Backtracking.

Resuelve el problema de partición de planillas en grupos que coincidan
con los totales diarios de cada distribuidor.

Características:
- Tolerancia float (QTY_TOLERANCE = 0.01) para cantidades decimales (horas)
- Permutaciones de targets para <=5 distribuidores
- Poda de backtracking y factibilidad
- max_results = 500 subconjuntos candidatos por target
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field

from app.models.schemas import (
    DistribuidorPDF,
    EstadoMatch,
    PlanillaAsignada,
    PlanillaOCA,
    ResultadoDia,
)

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

QTY_TOLERANCE = 0.01        # Tolerancia para comparación de cantidades float
IMPORTE_TOLERANCE = 1.00    # Tolerancia para match exacto de importe ($1)
MAX_RESULTS = 500           # Máximo de subconjuntos candidatos por target
MAX_PERMUTACIONES = 5       # Máximo distribuidores para fuerza bruta de permutaciones


@dataclass
class Target:
    """Un target es un distribuidor con su total diario esperado."""
    nombre: str
    cantidad_esperada: float
    importe_esperado: float


@dataclass
class SubsetResult:
    """Resultado de búsqueda de subconjunto."""
    indices: list[int]
    cantidad_sum: float
    importe_sum: float
    importe_diff: float


@dataclass
class AsignacionDia:
    """Resultado de asignación para un día completo."""
    asignaciones: dict[str, list[int]] = field(default_factory=dict)
    score: float = 0.0
    sin_asignar: list[int] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Búsqueda de subconjuntos (subset-sum)
# ---------------------------------------------------------------------------

def _find_subsets(
    items: list[PlanillaOCA],
    available: list[int],
    target_qty: float,
    max_results: int = MAX_RESULTS,
) -> list[SubsetResult]:
    """Encuentra subconjuntos de items cuya cantidad sume el target.

    Usa backtracking con poda de factibilidad.

    Args:
        items: Lista completa de planillas del día.
        available: Índices disponibles (no asignados).
        target_qty: Cantidad objetivo.
        max_results: Máximo de resultados a devolver.

    Returns:
        Lista de SubsetResult ordenados por diferencia de importe.
    """
    results: list[SubsetResult] = []
    n = len(available)

    # Precalcular cantidades e importes para acceso rápido
    qtys = [items[i].cantidad for i in available]
    importes = [items[i].importe_total for i in available]

    # Suma total disponible para poda de factibilidad
    total_qty_disponible = sum(qtys)

    def backtrack(idx: int, current_indices: list[int], qty_sum: float, imp_sum: float):
        if len(results) >= max_results:
            return

        remaining = target_qty - qty_sum

        # Match encontrado (con tolerancia float)
        if abs(remaining) < QTY_TOLERANCE and current_indices:
            results.append(SubsetResult(
                indices=[available[i] for i in current_indices],
                cantidad_sum=qty_sum,
                importe_sum=imp_sum,
                importe_diff=0.0,  # se calcula después
            ))
            return

        # Poda: si no quedan items o remaining es negativo
        if idx >= n or remaining < -QTY_TOLERANCE:
            return

        # Poda de factibilidad: suma de items restantes no alcanza
        remaining_qty = sum(qtys[idx:])
        if remaining_qty + QTY_TOLERANCE < remaining:
            return

        for i in range(idx, n):
            if qtys[i] > remaining + QTY_TOLERANCE:
                continue

            current_indices.append(i)
            backtrack(i + 1, current_indices, qty_sum + qtys[i], imp_sum + importes[i])
            current_indices.pop()

            if len(results) >= max_results:
                return

    backtrack(0, [], 0.0, 0.0)
    return results


# ---------------------------------------------------------------------------
# Asignación con backtracking sobre permutaciones de targets
# ---------------------------------------------------------------------------

def _assign_targets(
    items: list[PlanillaOCA],
    targets: list[Target],
    perm: list[int],
) -> AsignacionDia:
    """Intenta asignar planillas a targets en el orden dado por perm.

    Args:
        items: Planillas del día.
        targets: Lista de targets (distribuidores).
        perm: Orden de índices de targets a intentar.

    Returns:
        AsignacionDia con la mejor asignación encontrada.
    """
    n_items = len(items)
    available = list(range(n_items))
    asignaciones: dict[str, list[int]] = {}
    total_score = 0.0

    for target_idx in perm:
        target = targets[target_idx]

        if not available:
            break

        # Buscar subconjuntos que sumen la cantidad del target
        subsets = _find_subsets(items, available, target.cantidad_esperada)

        if not subsets:
            # No se encontró match -> sin asignar
            continue

        # Calcular diferencia de importe para cada subconjunto
        for ss in subsets:
            ss.importe_diff = abs(ss.importe_sum - target.importe_esperado)

        # Priorizar match exacto de importe (diff < $1)
        exactos = [ss for ss in subsets if ss.importe_diff < IMPORTE_TOLERANCE]

        if exactos:
            best = min(exactos, key=lambda s: s.importe_diff)
        else:
            # Top 50 por mejor diferencia
            subsets.sort(key=lambda s: s.importe_diff)
            best = subsets[0]

        # Asignar
        asignaciones[target.nombre] = best.indices
        total_score += best.importe_diff

        # Remover índices usados de available
        used = set(best.indices)
        available = [i for i in available if i not in used]

    # Items sin asignar
    sin_asignar = available

    return AsignacionDia(
        asignaciones=asignaciones,
        score=total_score,
        sin_asignar=sin_asignar,
    )


def vincular_dia(
    planillas_dia: list[PlanillaOCA],
    distribuidores_dia: list[Target],
) -> ResultadoDia:
    """Vincula las planillas de un día a los distribuidores.

    Prueba todas las permutaciones del orden de distribuidores (hasta MAX_PERMUTACIONES)
    para encontrar la partición óptima global.

    Args:
        planillas_dia: Planillas extraídas del PDF principal para este día.
        distribuidores_dia: Targets (distribuidores con totales esperados).

    Returns:
        ResultadoDia con el estado de la vinculación.
    """
    if not planillas_dia or not distribuidores_dia:
        fecha = planillas_dia[0].fecha if planillas_dia else distribuidores_dia[0].cantidad_esperada if distribuidores_dia else None
        return ResultadoDia(
            fecha=planillas_dia[0].fecha if planillas_dia else distribuidores_dia[0].cantidad_esperada,
            estado=EstadoMatch.SIN_ASIGNAR,
            asignaciones=[],
            sin_asignar=planillas_dia,
        )

    fecha = planillas_dia[0].fecha
    n_targets = len(distribuidores_dia)

    # Generar permutaciones
    if n_targets <= MAX_PERMUTACIONES:
        perms = list(itertools.permutations(range(n_targets)))
    else:
        # Heurísticas: 4 ordenamientos
        indices = list(range(n_targets))
        perms = [
            tuple(indices),                                                    # original
            tuple(sorted(indices, key=lambda i: -distribuidores_dia[i].cantidad_esperada)),  # desc qty
            tuple(sorted(indices, key=lambda i: distribuidores_dia[i].cantidad_esperada)),   # asc qty
            tuple(sorted(indices, key=lambda i: -distribuidores_dia[i].importe_esperado)),   # desc importe
        ]

    best_result: AsignacionDia | None = None
    best_score = float("inf")

    for perm in perms:
        result = _assign_targets(planillas_dia, distribuidores_dia, list(perm))

        # Penalizar items sin asignar fuertemente
        score = result.score + len(result.sin_asignar) * 100000

        if score < best_score:
            best_score = score
            best_result = result

        # Si score es 0 (perfecto), no seguir buscando
        if score < IMPORTE_TOLERANCE and not result.sin_asignar:
            break

    if best_result is None:
        return ResultadoDia(
            fecha=fecha,
            estado=EstadoMatch.SIN_ASIGNAR,
            sin_asignar=planillas_dia,
        )

    # Construir resultado
    asignaciones: list[PlanillaAsignada] = []
    for nombre, indices in best_result.asignaciones.items():
        for idx in indices:
            asignaciones.append(PlanillaAsignada(
                planilla=planillas_dia[idx],
                distribuidor_nombre=nombre,
                score=best_result.score,
                estado=EstadoMatch.EXACTO if best_result.score < IMPORTE_TOLERANCE else EstadoMatch.APROXIMADO,
            ))

    sin_asignar = [planillas_dia[i] for i in best_result.sin_asignar]

    # Estado del día
    if not sin_asignar and best_result.score < IMPORTE_TOLERANCE:
        estado = EstadoMatch.EXACTO
    elif not sin_asignar:
        estado = EstadoMatch.APROXIMADO
    else:
        estado = EstadoMatch.SIN_ASIGNAR

    return ResultadoDia(
        fecha=fecha,
        estado=estado,
        diff_importe=round(best_result.score, 2),
        asignaciones=asignaciones,
        sin_asignar=sin_asignar,
    )
