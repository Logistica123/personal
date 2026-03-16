#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
CSR="${BASE_DIR}/out/logarg-erp-wsfe-pv00011.csr"
if [ ! -f "${CSR}" ]; then
  echo "No existe ${CSR}" >&2
  exit 1
fi
openssl req -in "${CSR}" -noout -subject
openssl req -in "${CSR}" -noout -text | sed -n '/Subject:/,/Attributes:/p'
