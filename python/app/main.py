"""FastAPI microservicio para procesamiento de PDFs OCA."""

from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.matching.engine import procesar_desde_archivos, procesar_sucursal
from app.models.schemas import (
    FormatoDistribuidor,
    ProcesarResponse,
    ResultadoVinculacion,
)

app = FastAPI(
    title="OCA PDF Processor",
    description="Microservicio para parseo y vinculación de PDFs OCA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio temporal para archivos subidos
UPLOAD_DIR = Path(tempfile.gettempdir()) / "oca_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "oca-processor"}


# ---------------------------------------------------------------------------
# Endpoint 1: Procesar carpeta local (para desarrollo/testing)
# ---------------------------------------------------------------------------

@app.post("/api/oca/procesar-carpeta", response_model=ProcesarResponse)
def procesar_carpeta(carpeta: str = Form(...)):
    """Procesa una carpeta local con PDFs OCA.

    Útil para testing y desarrollo. Detecta automáticamente
    los archivos y el formato de distribuidores.
    """
    try:
        resultado = procesar_sucursal(carpeta)
        return ProcesarResponse(success=True, resultado=resultado)
    except ValueError as e:
        return ProcesarResponse(success=False, mensaje=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Endpoint 2: Upload y procesar (para producción desde Laravel)
# ---------------------------------------------------------------------------

@app.post("/api/oca/procesar", response_model=ProcesarResponse)
async def procesar_pdfs(
    sucursal: str = Form(...),
    main_pdf: UploadFile = File(...),
    distrib_pdfs: list[UploadFile] = File(default=[]),
):
    """Recibe PDFs subidos y ejecuta el pipeline completo.

    Args:
        sucursal: Código de sucursal (ej: GUILLON, PQO, TUC).
        main_pdf: PDF principal de la sucursal.
        distrib_pdfs: PDFs de distribuidores (individuales o combinado).
    """
    # Crear carpeta temporal para este proceso
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
        distrib_paths: dict[str, str] = {}
        combinado_path: str | None = None

        for pdf in distrib_pdfs:
            dest = carpeta / pdf.filename
            with open(dest, "wb") as f:
                content = await pdf.read()
                f.write(content)

            nombre = Path(pdf.filename).stem

            # Detectar si es combinado (desglose)
            if "desglose" in nombre.lower():
                combinado_path = str(dest)
            else:
                # Extraer nombre de distribuidor (quitar prefijo sucursal)
                prefijo = sucursal.upper()
                if nombre.upper().startswith(prefijo + " "):
                    nombre_distrib = nombre[len(prefijo) + 1:].strip()
                else:
                    nombre_distrib = nombre
                distrib_paths[nombre_distrib] = str(dest)

        # Procesar
        resultado = procesar_desde_archivos(
            main_pdf_path=str(main_path),
            distrib_paths=distrib_paths if distrib_paths else None,
            combinado_path=combinado_path,
            sucursal=sucursal,
        )

        return ProcesarResponse(success=True, resultado=resultado)

    except ValueError as e:
        return ProcesarResponse(success=False, mensaje=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Limpiar archivos temporales
        shutil.rmtree(carpeta, ignore_errors=True)


# ---------------------------------------------------------------------------
# Endpoint 3: Solo parsear PDF principal (debug)
# ---------------------------------------------------------------------------

@app.post("/api/oca/parsear-principal")
async def parsear_principal(pdf: UploadFile = File(...)):
    """Parsea solo el PDF principal y devuelve las planillas extraídas."""
    from app.parsers.pdf_principal import parsear_pdf_principal

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await pdf.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        planillas = parsear_pdf_principal(tmp_path)
        return {
            "total": len(planillas),
            "planillas": [p.model_dump(mode="json") for p in planillas],
        }
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Endpoint 4: Solo parsear PDFs distribuidores (debug)
# ---------------------------------------------------------------------------

@app.post("/api/oca/parsear-distribuidores")
async def parsear_distribuidores(
    sucursal: str = Form(...),
    pdfs: list[UploadFile] = File(...),
):
    """Parsea PDFs de distribuidores y devuelve los totales diarios."""
    from app.parsers.pdf_distribuidor import parsear_pdf_combinado, parsear_pdf_individual

    proceso_id = str(uuid.uuid4())[:8]
    carpeta = UPLOAD_DIR / proceso_id
    carpeta.mkdir(parents=True, exist_ok=True)

    try:
        distribuidores = []
        for pdf in pdfs:
            dest = carpeta / pdf.filename
            with open(dest, "wb") as f:
                content = await pdf.read()
                f.write(content)

            nombre = Path(pdf.filename).stem
            if "desglose" in nombre.lower():
                distribuidores.extend(parsear_pdf_combinado(str(dest)))
            else:
                prefijo = sucursal.upper()
                if nombre.upper().startswith(prefijo + " "):
                    nombre_distrib = nombre[len(prefijo) + 1:].strip()
                else:
                    nombre_distrib = nombre
                distribuidores.append(parsear_pdf_individual(str(dest), nombre_distrib))

        return {
            "total": len(distribuidores),
            "distribuidores": [d.model_dump(mode="json") for d in distribuidores],
        }
    finally:
        shutil.rmtree(carpeta, ignore_errors=True)
