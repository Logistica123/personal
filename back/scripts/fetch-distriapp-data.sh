#!/bin/bash
# Descarga todos los datos de la API readonly y los guarda en un archivo
# para copiar/pegar en Claude.ai

API_KEY="a45a16e45dbf0441c430201d031fa2648ed0cc2a4cd1037d1b008e721df2e524"
BASE="https://personal.distriapp.com.ar/api/distriapp/readonly"
OUT="/tmp/distriapp-data.txt"

echo "Descargando datos de DistriApp API..." >&2

{
echo "=== DASHBOARD ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/dashboard"

echo -e "\n\n=== ACTIVOS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/activos?per_page=500"

echo -e "\n\n=== PRE-ACTIVOS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/pre-activos?per_page=500"

echo -e "\n\n=== PAUSADOS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/pausados?per_page=500"

echo -e "\n\n=== NO CITADOS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/no-citados?per_page=500"

echo -e "\n\n=== SIN ESTADO ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/sin-estado?per_page=500"

echo -e "\n\n=== BAJAS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/bajas?per_page=500"

echo -e "\n\n=== SEMANAS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/semanas"

echo -e "\n\n=== CIERRES DIARIOS ==="
curl -s -H "X-Distriapp-Key: $API_KEY" "$BASE/cierres-diarios?per_page=500"
} > "$OUT"

echo "Datos guardados en $OUT ($(wc -c < "$OUT") bytes)" >&2
echo "Copiá el contenido y pegalo en Claude.ai" >&2
