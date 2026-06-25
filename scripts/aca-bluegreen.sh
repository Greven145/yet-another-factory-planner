#!/usr/bin/env bash
# aca-bluegreen.sh — Blue-green deployment driver for Azure Container Apps.
#
# Traffic model: ingress traffic is pinned to the "blue" label in IaC
# (api-containerapp.module.bicep -> ingress.traffic: [{ label: 'blue', weight: 100 }]).
# "blue" is therefore a STABLE ALIAS for the current production revision — it always
# receives 100% of traffic. Promotion is just moving the "blue" label onto the green
# revision after smoke passes; the template stays consistent across azd provisions, so
# azd never resets traffic to "latest".
#
# Subcommands:
#   ensure-blue    Bootstrap: if no revision carries the "blue" label yet, assign it to
#                  the current serving revision. Idempotent. Run before `azd provision`
#                  so the IaC traffic block (which references the "blue" label) applies
#                  cleanly on the first deploy.
#
#   deploy-green   Identify the just-deployed revision (latest) and label it "green".
#                  No traffic change: with traffic pinned to "blue", green sits at 0%.
#
#   smoke          Run smoke-api.sh against the green revision's revision-specific FQDN
#                  (targets green directly, bypassing the blue-served production traffic).
#
#   shift          Promote: move the "blue" label from the old revision onto green. Since
#                  traffic is pinned to the "blue" label, this atomically shifts 100% of
#                  traffic to green. Removes the now-redundant "green" label.
#
#   rollback       Safety net for the CI failure path. Smoke runs BEFORE shift, so a
#                  pre-shift failure leaves "blue" untouched and production unaffected —
#                  rollback then just reports the still-serving blue revision (no-op).
#
# Required environment variables:
#   ACA_RESOURCE_GROUP     Azure resource group containing the Container App.
#   ACA_APP_NAME           Name of the Azure Container App (e.g. "api").
#
# Optional:
#   SMOKE_SCRIPT           Path to the smoke-api.sh script.
#                          Default: <script-dir>/smoke-api.sh
#   ACA_SUBSCRIPTION       Azure subscription ID or name (passed to az --subscription).
#                          If empty, the az CLI's current subscription is used.
#
# Example workflow (mirrors .github/workflows/ci.yml):
#   ./scripts/aca-bluegreen.sh ensure-blue   # before: azd provision
#   #   azd provision ; azd deploy api       # provision pins traffic to blue; deploy makes green
#   ./scripts/aca-bluegreen.sh deploy-green  # label the new revision "green" (stays at 0%)
#   ./scripts/aca-bluegreen.sh smoke         # validate green on its own FQDN
#   ./scripts/aca-bluegreen.sh shift         # move "blue" onto green -> 100% traffic
#   #   on failure before shift: rollback is a no-op; production stayed on blue

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

# Returns the revision name for a given traffic label, or empty string if not found.
# Labels live on the app-level ingress traffic array (ingress.traffic[].label),
# NOT on revision objects, so we query the ingress traffic config here.
revision_for_label() {
  local label="$1"
  az containerapp ingress traffic show \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "[?label=='${label}'].revisionName | [0]" \
    -o tsv 2>/dev/null || true
}

# Returns the latest (most recently created) revision name.
latest_revision() {
  az containerapp revision list \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "sort_by([], &properties.createdTime)[-1].name" \
    -o tsv
}

# Returns the revision name currently receiving the most traffic. When traffic is on
# the latestRevision pointer (pre-bootstrap), no revisionName is present, so fall back
# to the latest revision.
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

# Returns the default ingress FQDN for the container app (used to derive the env domain).
app_fqdn() {
  az containerapp show \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "properties.configuration.ingress.fqdn" \
    -o tsv
}

# Assigns a label to a revision, moving it from any other revision (--no-prompt
# suppresses the "label is in use, move it?" confirmation).
assign_label() {
  local label="$1" revision="$2"
  az containerapp revision label add \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision "$revision" \
    --label "$label" \
    --no-prompt
}

# ── Subcommands ───────────────────────────────────────────────────────────────

cmd_ensure_blue() {
  local blue
  blue=$(revision_for_label "blue")
  if [ -n "$blue" ]; then
    echo "[ensure-blue] 'blue' label already on $blue — nothing to do."
    return 0
  fi

  local serving
  serving=$(current_serving_revision)
  if [ -z "$serving" ]; then
    echo "ERROR: Could not determine a revision to bootstrap the 'blue' label onto." >&2
    exit 1
  fi

  echo "[ensure-blue] Bootstrapping 'blue' label onto current serving revision: $serving"
  assign_label "blue" "$serving"
  echo "[ensure-blue] Done. The IaC ingress traffic block can now pin to 'blue'."
}

cmd_deploy_green() {
  echo "[deploy-green] Identifying blue and green revisions..."

  local blue green
  blue=$(revision_for_label "blue")
  if [ -z "$blue" ]; then
    echo "ERROR: No revision carries the 'blue' label. Run 'ensure-blue' (and provision" >&2
    echo "  the IaC traffic block) before deploy-green." >&2
    exit 1
  fi
  echo "[deploy-green] Current production (blue) revision: $blue"

  # The latest revision is the one azd just deployed (green candidate).
  green=$(latest_revision)
  if [ -z "$green" ]; then
    echo "ERROR: Could not determine the latest (green) revision." >&2
    exit 1
  fi
  if [ "$green" = "$blue" ]; then
    echo "ERROR: The latest revision equals the current production revision — no new" >&2
    echo "  revision was deployed. Run 'azd deploy api' first." >&2
    exit 1
  fi
  echo "[deploy-green] New (green) revision: $green"

  # Label green so smoke/shift can find it. No traffic change: traffic is pinned to the
  # "blue" label, so the green revision sits at 0% until 'shift' moves "blue" onto it.
  assign_label "green" "$green"
  echo "[deploy-green] Labeled $green as 'green' (0% traffic). Run 'smoke' next."
}

cmd_smoke() {
  echo "[smoke] Locating green revision..."
  local green
  green=$(revision_for_label "green")
  if [ -z "$green" ]; then
    echo "ERROR: No revision labeled 'green' found. Run 'deploy-green' first." >&2
    exit 1
  fi
  echo "[smoke] Green revision: $green"

  # Build the revision-specific FQDN. ACA exposes each revision at:
  #   https://<revision-name>.<env-default-domain>
  # where <revision-name> is already "<app-name>--<suffix>" (as returned by Azure),
  # and the app's default FQDN is "<app-name>.<env-default-domain>". Strip the
  # "<app-name>." prefix off the app FQDN to get the env domain, then prepend the
  # full revision name. This targets green directly, bypassing blue-served traffic.
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
  echo "[shift] Promoting green to production (moving the 'blue' label)..."

  local green blue
  green=$(revision_for_label "green")
  if [ -z "$green" ]; then
    echo "ERROR: No revision labeled 'green' found. Run 'deploy-green' and 'smoke' first." >&2
    exit 1
  fi
  blue=$(revision_for_label "blue")
  echo "[shift] green=$green, previous blue=${blue:-<none>}"

  # Move the "blue" label onto green. Traffic is pinned to "blue" in IaC, so this
  # atomically shifts 100% of traffic to green. --no-prompt confirms the move.
  assign_label "blue" "$green"
  echo "[shift] 'blue' now points at $green — it is serving 100% of traffic."

  # Drop the now-redundant "green" label (green has been promoted to blue/production).
  az containerapp revision label remove \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --label "green" 2>/dev/null || true

  echo "[shift] Done. $green is the new production (blue) revision."
}

cmd_rollback() {
  echo "[rollback] Checking production traffic state..."

  local blue
  blue=$(revision_for_label "blue")
  if [ -z "$blue" ]; then
    echo "ERROR: No revision carries the 'blue' label. Production traffic target is" >&2
    echo "  unknown — manual intervention required (re-run 'ensure-blue')." >&2
    exit 1
  fi

  # Smoke runs before shift, so a failure that triggers rollback almost always occurs
  # while "blue" still points at the previous (good) production revision: nothing to undo.
  echo "[rollback] 'blue' (production) is on $blue. No traffic shift was committed;"
  echo "[rollback] production is unaffected. The green revision, if any, sits at 0%."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 {ensure-blue|deploy-green|smoke|shift|rollback}" >&2
  echo "" >&2
  echo "Required env vars:" >&2
  echo "  ACA_RESOURCE_GROUP   Azure resource group (e.g. rg-myenv)" >&2
  echo "  ACA_APP_NAME         Container app name (e.g. api)" >&2
  echo "" >&2
  echo "Optional env vars:" >&2
  echo "  ACA_SUBSCRIPTION     Azure subscription ID or name" >&2
  echo "  SMOKE_SCRIPT         Path to smoke-api.sh (default: <script-dir>/smoke-api.sh)" >&2
}

case "$SUBCOMMAND" in
  ensure-blue)  cmd_ensure_blue ;;
  deploy-green) cmd_deploy_green ;;
  smoke)        cmd_smoke ;;
  shift)        cmd_shift ;;
  rollback)     cmd_rollback ;;
  "")           usage; exit 1 ;;
  *)
    echo "ERROR: Unknown subcommand '$SUBCOMMAND'" >&2
    usage
    exit 1
    ;;
esac
