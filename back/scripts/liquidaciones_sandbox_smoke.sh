#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
API_TOKEN="${API_TOKEN:-}"
LOGIN_EMAIL="${LOGIN_EMAIL:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
LOGIN_TOTP_CODE="${LOGIN_TOTP_CODE:-}"
CLIENT_CODE="${CLIENT_CODE:-CLI-SMOKE}"
PERIOD_FROM="${PERIOD_FROM:-$(date +%Y-%m-01)}"
PERIOD_TO="${PERIOD_TO:-$(date +%Y-%m-%d)}"
PUBLISH_REAL="${PUBLISH_REAL:-true}"
PUBLISH_QUEUE="${PUBLISH_QUEUE:-false}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-5}"
POLL_TIMEOUT_SECONDS="${POLL_TIMEOUT_SECONDS:-120}"

HTTP_STATUS=""
HTTP_BODY=""

json_get() {
  local json_path="$1"
  php -r '
    $data = json_decode(stream_get_contents(STDIN), true);
    if (!is_array($data)) { fwrite(STDERR, "JSON invalido\n"); exit(1); }
    $path = $argv[1];
    $parts = explode(".", $path);
    $cursor = $data;
    foreach ($parts as $part) {
      if ($part === "") { continue; }
      if (ctype_digit($part)) {
        $index = (int) $part;
        if (!is_array($cursor) || !array_key_exists($index, $cursor)) { exit(2); }
        $cursor = $cursor[$index];
        continue;
      }
      if (!is_array($cursor) || !array_key_exists($part, $cursor)) { exit(2); }
      $cursor = $cursor[$part];
    }
    if (is_array($cursor)) { echo json_encode($cursor); }
    elseif (is_bool($cursor)) { echo $cursor ? "true" : "false"; }
    elseif ($cursor === null) { echo ""; }
    else { echo (string) $cursor; }
  ' "$json_path"
}

api_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local url="${API_BASE_URL%/}${path}"
  local response
  if [[ -n "${body}" ]]; then
    response="$(curl -sS -w "\n%{http_code}" -X "${method}" "${url}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      --data "${body}")"
  else
    response="$(curl -sS -w "\n%{http_code}" -X "${method}" "${url}" \
      -H "Accept: application/json" \
      -H "Authorization: Bearer ${API_TOKEN}")"
  fi

  HTTP_STATUS="${response##*$'\n'}"
  HTTP_BODY="${response%$'\n'*}"
}

assert_status() {
  local expected="$1"
  if [[ "${HTTP_STATUS}" != "${expected}" ]]; then
    echo "ERROR: status HTTP esperado ${expected}, recibido ${HTTP_STATUS}"
    echo "Respuesta:"
    echo "${HTTP_BODY}"
    exit 1
  fi
}

login_if_needed() {
  if [[ -n "${API_TOKEN}" ]]; then
    return
  fi

  if [[ -z "${LOGIN_EMAIL}" || -z "${LOGIN_PASSWORD}" ]]; then
    echo "ERROR: Debes definir API_TOKEN o LOGIN_EMAIL + LOGIN_PASSWORD."
    echo "Ejemplo 1: API_TOKEN=xxxxx API_BASE_URL=http://localhost:8000 $0"
    echo "Ejemplo 2: LOGIN_EMAIL=user@dominio.com LOGIN_PASSWORD=secret API_BASE_URL=http://localhost:8000 $0"
    exit 1
  fi

  echo "Obteniendo API token via /api/login..."
  local login_payload
  if [[ -n "${LOGIN_TOTP_CODE}" ]]; then
    login_payload="$(cat <<JSON
{
  "email": "${LOGIN_EMAIL}",
  "password": "${LOGIN_PASSWORD}",
  "totpCode": "${LOGIN_TOTP_CODE}"
}
JSON
)"
  else
    login_payload="$(cat <<JSON
{
  "email": "${LOGIN_EMAIL}",
  "password": "${LOGIN_PASSWORD}"
}
JSON
)"
  fi

  local response status body
  response="$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE_URL%/}/api/login" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    --data "${login_payload}")"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "${status}" != "200" ]]; then
    echo "ERROR: fallo login (${status})."
    echo "${body}"
    exit 1
  fi

  API_TOKEN="$(printf '%s' "${body}" | json_get "data.token")"
  if [[ -z "${API_TOKEN}" ]]; then
    echo "ERROR: no se pudo extraer data.token del login."
    echo "${body}"
    exit 1
  fi
  echo "Token obtenido correctamente."
}

login_if_needed

bool_json() {
  local value="${1:-false}"
  if [[ "${value}" == "true" || "${value}" == "1" ]]; then
    echo "true"
  else
    echo "false"
  fi
}

PUBLISH_QUEUE_JSON="$(bool_json "${PUBLISH_QUEUE}")"

echo "1) Creando run de prueba..."
RUN_SUFFIX="$(date +%s)"
CREATE_PAYLOAD="$(cat <<JSON
{
  "source_system": "powerbi",
  "client_code": "${CLIENT_CODE}",
  "period_from": "${PERIOD_FROM}",
  "period_to": "${PERIOD_TO}",
  "source_file_name": "smoke-${RUN_SUFFIX}.xlsx",
  "status": "RECEIVED",
  "staging_rows": [
    {
      "external_row_id": "SMOKE-${RUN_SUFFIX}-1",
      "row_number": 1,
      "domain_norm": "AA123BB",
      "distributor_code": "DIST-SMOKE",
      "distributor_name": "Distribuidor Smoke",
      "liters": 40.5,
      "amount": 51000.25,
      "validation_status": "OK"
    }
  ],
  "validation_results": [
    {
      "external_row_id": "SMOKE-${RUN_SUFFIX}-1",
      "rule_code": "TARIFA_MATCH",
      "severity": "INFO",
      "result": "PASS"
    }
  ]
}
JSON
)"
api_request "POST" "/api/liquidaciones/runs" "${CREATE_PAYLOAD}"
assert_status "201"
RUN_ID="$(printf '%s' "${HTTP_BODY}" | json_get "data.id")"
if [[ -z "${RUN_ID}" ]]; then
  echo "ERROR: no se obtuvo run_id en la respuesta de creacion."
  echo "${HTTP_BODY}"
  exit 1
fi
echo "   Run creado: #${RUN_ID}"

echo "2) Upsert incremental..."
UPSERT_PAYLOAD="$(cat <<JSON
{
  "replace_validation_results": false,
  "staging_rows": [
    {
      "external_row_id": "SMOKE-${RUN_SUFFIX}-2",
      "row_number": 2,
      "domain_norm": "CC456DD",
      "distributor_code": "DIST-SMOKE",
      "distributor_name": "Distribuidor Smoke",
      "liters": 12.0,
      "amount": 15000.00,
      "validation_status": "OK"
    }
  ],
  "validation_results": [
    {
      "external_row_id": "SMOKE-${RUN_SUFFIX}-2",
      "rule_code": "TOTAL_MATCH",
      "severity": "INFO",
      "result": "PASS"
    }
  ]
}
JSON
)"
api_request "POST" "/api/liquidaciones/runs/${RUN_ID}/upsert" "${UPSERT_PAYLOAD}"
assert_status "200"
echo "   Upsert OK"

echo "3) Aprobando run..."
APPROVE_PAYLOAD='{"force":false,"note":"Smoke test sandbox"}'
api_request "POST" "/api/liquidaciones/runs/${RUN_ID}/approve" "${APPROVE_PAYLOAD}"
assert_status "200"
APPROVE_STATUS="$(printf '%s' "${HTTP_BODY}" | json_get "data.status")"
echo "   Estado luego de aprobar: ${APPROVE_STATUS}"

echo "4) Publicacion dry-run..."
api_request "POST" "/api/liquidaciones/runs/${RUN_ID}/publicar-erp" "{\"dry_run\":true,\"force\":false,\"queue\":${PUBLISH_QUEUE_JSON}}"
assert_status "200"
DRY_STATUS="$(printf '%s' "${HTTP_BODY}" | json_get "data.status")"
if [[ "${DRY_STATUS}" != "DRY_RUN" ]]; then
  echo "ERROR: se esperaba status DRY_RUN y se obtuvo ${DRY_STATUS}"
  echo "${HTTP_BODY}"
  exit 1
fi
echo "   Dry-run OK"

if [[ "${PUBLISH_REAL}" == "true" ]]; then
  echo "5) Publicacion real ERP..."
  api_request "POST" "/api/liquidaciones/runs/${RUN_ID}/publicar-erp" "{\"dry_run\":false,\"force\":false,\"queue\":${PUBLISH_QUEUE_JSON}}"

  if [[ "${PUBLISH_QUEUE_JSON}" == "true" ]]; then
    assert_status "202"
    QUEUED_STATUS="$(printf '%s' "${HTTP_BODY}" | json_get "data.status" || true)"
    echo "   Job encolado con estado: ${QUEUED_STATUS:-QUEUED}"

    elapsed=0
    final_job_status=""
    final_run_status=""
    while [[ "${elapsed}" -lt "${POLL_TIMEOUT_SECONDS}" ]]; do
      sleep "${POLL_INTERVAL_SECONDS}"
      elapsed=$((elapsed + POLL_INTERVAL_SECONDS))

      api_request "GET" "/api/liquidaciones/runs/${RUN_ID}"
      assert_status "200"
      final_job_status="$(printf '%s' "${HTTP_BODY}" | json_get "latest_publish_job.status" || true)"
      final_run_status="$(printf '%s' "${HTTP_BODY}" | json_get "data.status" || true)"

      if [[ "${final_job_status}" == "CONFIRMED" || "${final_job_status}" == "FAILED" || "${final_job_status}" == "PARTIAL" ]]; then
        break
      fi
    done

    echo "   Job status: ${final_job_status:-desconocido}"
    echo "   Run status: ${final_run_status:-desconocido}"
    if [[ "${final_job_status}" != "CONFIRMED" || "${final_run_status}" != "PUBLISHED" ]]; then
      echo "ERROR: se esperaba CONFIRMED/PUBLISHED."
      api_request "GET" "/api/liquidaciones/runs/${RUN_ID}"
      echo "${HTTP_BODY}"
      exit 1
    fi
  else
    assert_status "200"
    JOB_STATUS="$(printf '%s' "${HTTP_BODY}" | json_get "data.status")"
    RUN_STATUS="$(printf '%s' "${HTTP_BODY}" | json_get "run.status")"
    echo "   Job status: ${JOB_STATUS}"
    echo "   Run status: ${RUN_STATUS}"
    if [[ "${JOB_STATUS}" != "CONFIRMED" || "${RUN_STATUS}" != "PUBLISHED" ]]; then
      echo "ERROR: se esperaba CONFIRMED/PUBLISHED."
      echo "${HTTP_BODY}"
      exit 1
    fi
  fi
else
  echo "5) Publicacion real omitida (PUBLISH_REAL=${PUBLISH_REAL})."
fi

echo "6) Verificacion final de run..."
api_request "GET" "/api/liquidaciones/runs/${RUN_ID}"
assert_status "200"
FINAL_STATUS="$(printf '%s' "${HTTP_BODY}" | json_get "data.status")"
echo "   Estado final del run #${RUN_ID}: ${FINAL_STATUS}"

if [[ "${PUBLISH_REAL}" == "true" && "${FINAL_STATUS}" != "PUBLISHED" ]]; then
  echo "ERROR: estado final esperado PUBLISHED."
  exit 1
fi

echo "Smoke test completado correctamente."
echo "Run validado: #${RUN_ID}"
