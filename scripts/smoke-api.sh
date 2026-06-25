#!/usr/bin/env bash
# smoke-api.sh <base_url>
#
# Functional smoke test for the yet-another-factory-planner API.
# Runs a round-trip against the given base URL to verify the API is healthy and
# Cosmos DB is reachable.
#
# Exit 0 = all checks passed.
# Exit 1 = a check failed (prints which check and the response body).
#
# Usage:
#   ./scripts/smoke-api.sh https://api.my-env.eastus.azurecontainerapps.io
#   ./scripts/smoke-api.sh http://localhost:8080
set -euo pipefail

BASE_URL="${1:-}"
if [ -z "$BASE_URL" ]; then
  echo "ERROR: base URL is required." >&2
  echo "Usage: $0 <base_url>" >&2
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

PASS=0
FAIL=1

# ── helpers ──────────────────────────────────────────────────────────────────

check_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  local body="$4"
  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL [$label]: expected HTTP $expected, got HTTP $actual" >&2
    echo "  Body: $body" >&2
    exit $FAIL
  fi
  echo "PASS [$label]: HTTP $actual"
}

check_body_contains() {
  local label="$1"
  local pattern="$2"
  local body="$3"
  if ! echo "$body" | grep -q "$pattern"; then
    echo "FAIL [$label]: body does not contain '$pattern'" >&2
    echo "  Body: $body" >&2
    exit $FAIL
  fi
  echo "PASS [$label]: body contains '$pattern'"
}

http_get() {
  # Returns "<status_code>|<body>"
  local url="$1"
  curl -s -w "\n%{http_code}" --max-time 30 "$url"
}

http_post_json() {
  # Returns "<status_code>|<body>"
  local url="$1"
  local json="$2"
  curl -s -w "\n%{http_code}" --max-time 30 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$json" \
    "$url"
}

split_response() {
  # Given curl output (body\nstatus_code), sets RESP_STATUS and RESP_BODY
  local raw="$1"
  RESP_STATUS="${raw##*$'\n'}"
  RESP_BODY="${raw%$'\n'*}"
}

# ── 1. GET /health → expect 200 ───────────────────────────────────────────────

echo ""
echo "--- Check 1: GET /health (readiness) ---"
raw=$(http_get "${BASE_URL}/health")
split_response "$raw"
check_status "GET /health" 200 "$RESP_STATUS" "$RESP_BODY"

# ── 2. GET /ping → expect 200 + {"data":{"message":"pong"}} ──────────────────

echo ""
echo "--- Check 2: GET /ping ---"
raw=$(http_get "${BASE_URL}/ping")
split_response "$raw"
check_status "GET /ping" 200 "$RESP_STATUS" "$RESP_BODY"
check_body_contains "GET /ping body" '"pong"' "$RESP_BODY"

# ── 3. POST /share-factory → expect 201 + key ────────────────────────────────
#
# The minimum valid FactoryConfigSchema:
#   - gameVersion: "1.1" (valid game version)
#   - productionItems: at least one entry with itemKey, mode in {per-minute,maximize,rate}, value
#   - weightingOptions: {resources, power, complexity, buildings} (all required, int values)
#   - gameModeOptions: {recipePartsCost > 0, powerConsumption > 0}
#   - allowedRecipes, inputItems, inputResources, nodesPositions: may be empty arrays

echo ""
echo "--- Check 3: POST /share-factory ---"
SHARE_BODY='{
  "factoryConfig": {
    "gameVersion": "1.1",
    "productionItems": [
      { "itemKey": "Desc_IronIngot_C", "mode": "rate", "value": 30 }
    ],
    "inputItems": [],
    "inputResources": [],
    "allowedRecipes": [],
    "nodesPositions": [],
    "weightingOptions": { "resources": 1000, "power": 1, "complexity": 0, "buildings": 0 },
    "gameModeOptions": { "recipePartsCost": 1, "powerConsumption": 1 },
    "allowHandGatheredItems": false
  }
}'
raw=$(http_post_json "${BASE_URL}/share-factory" "$SHARE_BODY")
split_response "$raw"
check_status "POST /share-factory" 201 "$RESP_STATUS" "$RESP_BODY"
check_body_contains "POST /share-factory body" '"key"' "$RESP_BODY"

# Extract the key from the response: {"data":{"key":"<value>"}}
FACTORY_KEY=$(echo "$RESP_BODY" | grep -o '"key":"[^"]*"' | head -1 | sed 's/"key":"//;s/"//')
if [ -z "$FACTORY_KEY" ]; then
  echo "FAIL [POST /share-factory]: could not extract 'key' from response" >&2
  echo "  Body: $RESP_BODY" >&2
  exit $FAIL
fi
echo "PASS [POST /share-factory key extracted]: key=$FACTORY_KEY"

# ── 4. GET /get-factory?factoryKey=<key>&gameVersion=1.1 → expect 200 ────────

echo ""
echo "--- Check 4: GET /get-factory (round-trip through Cosmos) ---"
raw=$(http_get "${BASE_URL}/get-factory?factoryKey=${FACTORY_KEY}&gameVersion=1.1")
split_response "$raw"
check_status "GET /get-factory" 200 "$RESP_STATUS" "$RESP_BODY"
check_body_contains "GET /get-factory body" '"factory"' "$RESP_BODY"

# ── 5. GET /initialize?gameVersion=1.1 → expect 200 + game_data ──────────────

echo ""
echo "--- Check 5: GET /initialize?gameVersion=1.1 ---"
raw=$(http_get "${BASE_URL}/initialize?gameVersion=1.1")
split_response "$raw"
check_status "GET /initialize" 200 "$RESP_STATUS" "$RESP_BODY"
check_body_contains "GET /initialize body" '"game_data"' "$RESP_BODY"

# ── All checks passed ─────────────────────────────────────────────────────────

echo ""
echo "All smoke checks passed for ${BASE_URL}"
exit $PASS
