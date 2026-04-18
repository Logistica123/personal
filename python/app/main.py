"""FastAPI microservicio para procesamiento de PDFs OCA.

Usa las funciones probadas de procesar_oca.py como motor principal.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from collections import defaultdict
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.procesar_oca import (
    parse_main_pdf,
    parse_distributor_pdf,
    parse_combined_distributor_pdf,
    find_best_partition,
    build_excel,
    detect_files,
    CODIGOS_CONTRATO_CONOCIDOS,
)
from app.parsers.pdf_ocasa import parse_pdf_ocasa

app = FastAPI(
    title="OCA PDF Processor",
    description="Microservicio para parseo y vinculacion de PDFs OCA",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "oca_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "oca-processor"}


# ---------------------------------------------------------------------------
# Procesar carpeta local (dev/testing)
# ---------------------------------------------------------------------------

@app.post("/api/oca/procesar-carpeta")
def procesar_carpeta(carpeta: str = Form(...)):
    """Procesa una carpeta local con PDFs OCA."""
    try:
        return _procesar_carpeta(carpeta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Upload y procesar (produccion, llamado desde Laravel)
# ---------------------------------------------------------------------------

@app.post("/api/oca/procesar")
async def procesar_pdfs(
    sucursal: str = Form(...),
    main_pdf: UploadFile = File(...),
    distrib_pdfs: list[UploadFile] = File(default=[]),
):
    """Recibe PDFs subidos y ejecuta el pipeline completo."""
    proceso_id = str(uuid.uuid4())[:8]
    carpeta = UPLOAD_DIR / proceso_id
    carpeta.mkdir(parents=True, exist_ok=True)

    try:
        # Guardar PDF principal
        main_path = carpeta / main_pdf.filename
        with open(main_path, "wb") as f:
            content = await main_pdf.read()
            f.write(content)

        # Guardar PDFs de distribuidores
        for pdf in distrib_pdfs:
            dest = carpeta / pdf.filename
            with open(dest, "wb") as f:
                content = await pdf.read()
                f.write(content)

        # Procesar usando la logica probada de procesar_oca.py
        return _procesar_carpeta(str(carpeta))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(carpeta, ignore_errors=True)


# ---------------------------------------------------------------------------
# Parsear solo PDF principal (debug)
# ---------------------------------------------------------------------------

# BUGFIX 22 A: Parser de PDFs facturables OCASA
@app.post("/api/ocasa/parse-pdf")
async def parse_pdf_ocasa_endpoint(pdf: UploadFile = File(...)):
    """Parsea un PDF OCASA y devuelve las operaciones con Imp.Grav/Imp.NoGrav."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await pdf.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = parse_pdf_ocasa(tmp_path, nombre_archivo=pdf.filename)
        return result
    finally:
        os.unlink(tmp_path)


@app.post("/api/oca/parsear-principal")
async def parsear_principal(pdf: UploadFile = File(...)):
    """Parsea solo el PDF principal y devuelve las planillas."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await pdf.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        planillas = parse_main_pdf(tmp_path)
        return {
            "total": len(planillas),
            "planillas": planillas,
        }
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Logica principal: usa funciones de procesar_oca.py
# ---------------------------------------------------------------------------

def _procesar_carpeta(folder: str) -> dict:
    """Ejecuta el pipeline completo de procesamiento OCA."""
    main_pdf_name, dist_pdfs_or_combined, sucursal = detect_files(folder)

    if not main_pdf_name:
        return {"success": False, "mensaje": "No se encontro PDF principal"}

    # Parsear PDF principal
    planillas = parse_main_pdf(os.path.join(folder, main_pdf_name))

    by_date = defaultdict(list)
    for p in planillas:
        by_date[p['fecha']].append(p)

    # Parsear distribuidores
    is_combined = isinstance(dist_pdfs_or_combined, str)
    distributors = {}

    if is_combined:
        combined_path = os.path.join(folder, dist_pdfs_or_combined)
        distributors = parse_combined_distributor_pdf(combined_path)
        dist_names = sorted(distributors.keys())
        formato = "COMBINADO"
    else:
        dist_names = sorted(dist_pdfs_or_combined.keys())
        for name in dist_names:
            filepath = os.path.join(folder, dist_pdfs_or_combined[name])
            distributors[name] = parse_distributor_pdf(filepath)
        formato = "INDIVIDUAL"

    # Matching dia por dia
    all_dates = sorted(by_date.keys())
    all_matches = {}
    exact_days = 0

    for date in all_dates:
        day_items = by_date[date]
        targets = [
            (name, distributors[name][date]['qty'], distributors[name][date]['amount'])
            for name in dist_names if date in distributors[name]
        ]
        if not targets:
            continue
        result, score = find_best_partition(day_items, targets)
        if result:
            all_matches[date] = result
            if score < 1:
                exact_days += 1

    # Construir planilla_distributor
    planilla_distributor = {}
    for date, partition in all_matches.items():
        day_items = by_date[date]
        for name, indices in partition.items():
            for idx in indices:
                p = day_items[idx]
                key = (p['fecha'], p['nro_planilla'], p['cod_contrato'])
                planilla_distributor[key] = name

    # Generar Excel
    output_path = os.path.join(folder, f"{sucursal}_Vinculacion_Planillas.xlsx")
    build_excel(planillas, by_date, distributors, dist_names, all_matches,
                planilla_distributor, output_path, sucursal)

    # Construir respuesta para Laravel
    dias_resultado = []
    for date in all_dates:
        day_items = by_date[date]
        asignaciones = []
        sin_asignar_list = []

        if date in all_matches:
            assigned_indices = set()
            for name, indices in all_matches[date].items():
                for idx in indices:
                    assigned_indices.add(idx)
                    p = day_items[idx]
                    asignaciones.append({
                        "planilla": {
                            "fecha": p['fecha'],
                            "nro_planilla": p['nro_planilla'],
                            "cod_contrato": p['cod_contrato'],
                            "descripcion": p['desc'],
                            "precio_unitario": p['precio'],
                            "cantidad": p['qty'],
                            "importe_total": p['total'],
                        },
                        "distribuidor_nombre": name,
                        "score": 0.0,
                        "estado": "EXACTO",
                    })
            # Sin asignar
            for idx in range(len(day_items)):
                if idx not in assigned_indices:
                    p = day_items[idx]
                    sin_asignar_list.append({
                        "fecha": p['fecha'],
                        "nro_planilla": p['nro_planilla'],
                        "cod_contrato": p['cod_contrato'],
                        "descripcion": p['desc'],
                        "precio_unitario": p['precio'],
                        "cantidad": p['qty'],
                        "importe_total": p['total'],
                    })
        else:
            for p in day_items:
                sin_asignar_list.append({
                    "fecha": p['fecha'],
                    "nro_planilla": p['nro_planilla'],
                    "cod_contrato": p['cod_contrato'],
                    "descripcion": p['desc'],
                    "precio_unitario": p['precio'],
                    "cantidad": p['qty'],
                    "importe_total": p['total'],
                })

        estado_dia = "EXACTO" if date in all_matches and not sin_asignar_list else "SIN_ASIGNAR"
        dias_resultado.append({
            "fecha": date,
            "estado": estado_dia,
            "diff_importe": 0.0,
            "asignaciones": asignaciones,
            "sin_asignar": sin_asignar_list,
        })

    # BUGFIX 19 Feature 4: warnings de codigos nuevos detectados en el PDF
    codigos_encontrados = getattr(parse_main_pdf, '_ultimos_codigos', set())
    codigos_nuevos = []
    if codigos_encontrados:
        # Contar apariciones de cada codigo
        conteo = {}
        for p in planillas:
            cod = p.get('cod_contrato')
            if cod:
                conteo[cod] = conteo.get(cod, 0) + 1

        for cod in codigos_encontrados:
            if cod not in CODIGOS_CONTRATO_CONOCIDOS:
                # Buscar descripcion cruda de la primera aparicion
                desc_cruda = next((p['desc'] for p in planillas if p.get('cod_contrato') == cod), '')
                codigos_nuevos.append({
                    'codigo': cod,
                    'descripcion_cruda': desc_cruda,
                    'cantidad_apariciones': conteo.get(cod, 0),
                })

    resultado = {
        "sucursal": sucursal,
        "formato_distribuidor": formato,
        "total_planillas": len(planillas),
        "total_distribuidores": len(dist_names),
        "dias_exactos": exact_days,
        "dias_totales": len(all_dates),
        "dias": dias_resultado,
    }

    response = {"success": True, "resultado": resultado}

    if codigos_nuevos:
        response["warnings"] = {"codigos_nuevos": codigos_nuevos}

    return response
