#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${BASE_DIR}/out"
ALIAS="logarg-erp-wsfe-pv00011"
CONF="${BASE_DIR}/${ALIAS}.cnf"
KEY="${OUT_DIR}/${ALIAS}.key"
CSR="${OUT_DIR}/${ALIAS}.csr"
SUBJECT_TXT="${OUT_DIR}/${ALIAS}.subject.txt"
CSR_TXT="${OUT_DIR}/${ALIAS}.csr.txt"
mkdir -p "${OUT_DIR}"
if [ -f "${KEY}" ] || [ -f "${CSR}" ]; then
  echo "Ya existen archivos en ${OUT_DIR}. Muevalos o borrelos antes de regenerar." >&2
  exit 1
fi
openssl genrsa -out "${KEY}" 2048
openssl req -new -key "${KEY}" -config "${CONF}" -out "${CSR}"
openssl req -in "${CSR}" -noout -subject -text > "${CSR_TXT}"
openssl req -in "${CSR}" -noout -subject > "${SUBJECT_TXT}"
chmod 600 "${KEY}"
echo "Generado OK:"
echo "- ${KEY}"
echo "- ${CSR}"
echo "- ${SUBJECT_TXT}"
echo "- ${CSR_TXT}"
