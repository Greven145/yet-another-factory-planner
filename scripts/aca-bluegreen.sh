#!/usr/bin/env bash
# aca-bluegreen.sh — Blue-green deployment driver for Azure Container Apps.
#
# Traffic model: ingress traffic is pinned by REVISION NAME in IaC
# (api-containerapp.module.bicep -> ingress.traffic: [{ revisionName: api_blue_revision,
# weight: 100 }]). CI resolves the current production ("blue") revision with
# `current-revision` and passes it to azd as BLUE_REVISION before `azd deploy api`. The
# deploy then creates the new ("green") revision while keeping 100% of traffic on blue, so
# green lands at 0% and can be smoke-tested before any shift. ACA/ARM rejects a traffic
# weight without a revisionName (when latestRevision is false), which is why we pin by name
# rather than by label.
#
# Subcommands:
#   current-revision  Print the revision name currently serving production traffic. CI feeds
#                     this to `azd env set BLUE_REVISION` so the deploy keeps traffic on it.
#                     Falls back to the latest revision when traffic is on the latestRevision
#                     pointer (greenfield / pre-pin). Prints nothing if there are no revisions.
#
#   deploy-green      Verify a new revision (latest) exists and differs from the current
#                     production revision. No traffic change (green is already at 0%).
#
#   smoke             Run smoke-api.sh against the green revision's revision-specific FQDN
#                     (targets green directly, bypassing blue-served production traffic).
#
#   shift             Promote green: set ingress traffic 100% to the latest (green) revision.
#
#   rollback          Restore 100% traffic to the previous production revision. Prefers
#                     $BLUE_REVISION (the value CI pinned for this deploy); otherwise the
#                     revision currently serving the most traffic. Smoke runs before shift,
#                     so on a pre-shift failure this is effectively a no-op (blue unchanged).
#
# Required environment variables:
#   ACA_RESOURCE_GROUP     Azure resource group containing the Container App.
#   ACA_APP_NAME           Name of the Azure Container App (e.g. "api").
#
# Optional:
#   BLUE_REVISION          Production revision name pinned for this deploy (used by rollback).
#   SMOKE_SCRIPT           Path to smoke-api.sh. Default: <script-dir>/smoke-api.sh
#   ACA_SUBSCRIPTION       Azure subscription ID or name (passed to az --subscription).

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

: "${ACA_RESOURCE_GROUP:?ERROR: ACA_RESOURCE_GROUP must be set}"
: "${ACA_APP_NAME:?ERROR: ACA_APP_NAME must be set}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SMOKE_SCRIPT="${SMOKE_SCRIPT:-${SCRIPT_DIR}/smoke-api.sh}"

AZ_FLAGS=()
if [ -n "${ACA_SUBSCRIPTION:-}" ]; then
  AZ_FLAGS+=(--subscription "$ACA_SUBSCRIPTION")
fi

SUBCOMMAND="${1:-}"

# ── Helpers ───────────────────────────────────────────────────────────────────

# Latest (most recently created) revision name, or empty if there are none.
latest_revision() {
  az containerapp revision list \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "sort_by([], &properties.createdTime)[-1].name" \
    -o tsv 2>/dev/null || true
}

# Revision currently receiving the most traffic. When traffic is on the latestRevision
# pointer (no revisionName present), fall back to the latest revision.
current_serving_revision() {
  local rev
  rev=$(az containerapp ingress traffic show \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "sort_by([?revisionName!=null], &weight)[-1].revisionName" \
    -o tsv 2>/dev/null || true)
  if [ -z "$rev" ]; then
    rev=$(latest_revision)
  fi
  echo "$rev"
}

# Default ingress FQDN for the container app (used to derive the env domain).
app_fqdn() {
  az containerapp show \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "properties.configuration.ingress.fqdn" \
    -o tsv
}

set_traffic_to() {
  local revision="$1"
  az containerapp ingress traffic set \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision-weight "${revision}=100"
}

# ── Subcommands ───────────────────────────────────────────────────────────────

cmd_current_revision() {
  # Plain stdout (no log noise) so CI can capture it directly.
  current_serving_revision
}

cmd_deploy_green() {
  echo "[deploy-green] Identifying blue and green revisions..."
  local blue green
  blue=$(current_serving_revision)
  green=$(latest_revision)

  if [ -z "$green" ]; then
    echo "ERROR: Could not determine the latest (green) revision." >&2
    exit 1
  fi
  echo "[deploy-green] Current production (blue) revision: ${blue:-<none>}"
  echo "[deploy-green] New (green) revision: $green"

  if [ -n "$blue" ] && [ "$green" = "$blue" ]; then
    echo "ERROR: The latest revision equals the current production revision — no new" >&2
    echo "  revision was deployed. Run 'azd deploy api' first." >&2
    exit 1
  fi
  echo "[deploy-green] Green is at 0% (traffic pinned to blue). Run 'smoke' next."
}

cmd_smoke() {
  echo "[smoke] Locating green revision..."
  local green
  green=$(latest_revision)
  if [ -z "$green" ]; then
    echo "ERROR: Could not determine the green (latest) revision." >&2
    exit 1
  fi
  echo "[smoke] Green revision: $green"

  # Revision-specific FQDN. ACA exposes each revision at
  #   https://<revision-name>.<env-default-domain>
  # where <revision-name> is "<app-name>--<suffix>" and the app FQDN is
  # "<app-name>.<env-default-domain>". Strip the "<app-name>." prefix to get the env
  # domain, then prepend the full revision name to target green directly.
  local app_domain env_domain green_fqdn
  app_domain=$(app_fqdn)
  env_domain="${app_domain#"${ACA_APP_NAME}."}"
  green_fqdn="https://${green}.${env_domain}"

  echo "[smoke] Running smoke tests against: $green_fqdn"
  if ! bash "$SMOKE_SCRIPT" "$green_fqdn"; then
    echo "[smoke] FAILED — green did not pass smoke. Production stays on blue." >&2
    exit 1
  fi
  echo "[smoke] All smoke checks passed. Run 'shift' to promote green."
}

cmd_shift() {
  local green
  green=$(latest_revision)
  if [ -z "$green" ]; then
    echo "ERROR: Could not determine the green (latest) revision." >&2
    exit 1
  fi
  echo "[shift] Promoting green ($green) to 100% of traffic..."
  set_traffic_to "$green"
  echo "[shift] Done. $green is now serving 100% of traffic."
}

cmd_rollback() {
  local blue
  blue="${BLUE_REVISION:-}"
  if [ -z "$blue" ]; then
    blue=$(current_serving_revision)
  fi
  if [ -z "$blue" ]; then
    echo "ERROR: No production (blue) revision to roll back to. Manual intervention needed." >&2
    exit 1
  fi
  echo "[rollback] Restoring 100% traffic to the previous production revision: $blue"
  set_traffic_to "$blue"
  echo "[rollback] Done. Production is on $blue."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 {current-revision|deploy-green|smoke|shift|rollback}" >&2
  echo "" >&2
  echo "Required env vars:" >&2
  echo "  ACA_RESOURCE_GROUP   Azure resource group (e.g. rg-myenv)" >&2
  echo "  ACA_APP_NAME         Container app name (e.g. api)" >&2
  echo "" >&2
  echo "Optional env vars:" >&2
  echo "  BLUE_REVISION        Production revision pinned for this deploy (rollback target)" >&2
  echo "  ACA_SUBSCRIPTION     Azure subscription ID or name" >&2
  echo "  SMOKE_SCRIPT         Path to smoke-api.sh (default: <script-dir>/smoke-api.sh)" >&2
}

case "$SUBCOMMAND" in
  current-revision) cmd_current_revision ;;
  deploy-green)     cmd_deploy_green ;;
  smoke)            cmd_smoke ;;
  shift)            cmd_shift ;;
  rollback)         cmd_rollback ;;
  "")               usage; exit 1 ;;
  *)
    echo "ERROR: Unknown subcommand '$SUBCOMMAND'" >&2
    usage
    exit 1
    ;;
esac
