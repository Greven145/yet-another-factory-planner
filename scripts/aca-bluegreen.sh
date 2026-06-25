#!/usr/bin/env bash
# aca-bluegreen.sh — Blue-green deployment driver for Azure Container Apps.
#
# Subcommands:
#   deploy-green   Identify the newly deployed revision and label it "green".
#                  The currently active revision is labeled "blue".
#                  Leaves traffic 100% on blue until "shift" is called.
#
#   smoke          Run the smoke-api.sh script against the green revision's
#                  revision-specific FQDN (bypasses blue, targets green only).
#
#   shift          Shift 100% of ingress traffic from blue → green, then remove
#                  the "blue" label from the old revision.
#
#   rollback       Restore 100% of ingress traffic to the revision labeled "blue"
#                  (i.e., undo a shift that has not yet been finalized).
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
# Revision labels used:
#   blue   The currently serving revision (traffic target before shift).
#   green  The candidate revision being validated.
#
# Example workflow:
#   # 1. Deploy new image via azd or az containerapp update --image ...
#   #    (this creates a new inactive revision in Multiple mode)
#   ./scripts/aca-bluegreen.sh deploy-green
#
#   # 2. Smoke-test the new revision before it receives live traffic
#   ./scripts/aca-bluegreen.sh smoke
#
#   # 3. If smoke passes, shift traffic to green
#   ./scripts/aca-bluegreen.sh shift
#
#   # OR if something is wrong, roll back immediately (restores blue)
#   ./scripts/aca-bluegreen.sh rollback

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

# Returns the default domain for the container app environment (used to build FQDNs).
app_fqdn() {
  az containerapp show \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "properties.configuration.ingress.fqdn" \
    -o tsv
}

# ── Subcommands ───────────────────────────────────────────────────────────────

cmd_deploy_green() {
  echo "[deploy-green] Identifying blue and green revisions..."

  # The currently active revision (highest traffic weight) becomes blue.
  BLUE_REV=$(az containerapp ingress traffic show \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --query "sort_by([], &weight)[-1].revisionName" \
    -o tsv)

  if [ -z "$BLUE_REV" ]; then
    echo "ERROR: Could not determine the current (blue) revision." >&2
    exit 1
  fi
  echo "[deploy-green] Current (blue) revision: $BLUE_REV"

  # The latest revision is the one just deployed (green candidate).
  GREEN_REV=$(latest_revision)
  if [ -z "$GREEN_REV" ]; then
    echo "ERROR: Could not determine the latest (green) revision." >&2
    exit 1
  fi
  if [ "$GREEN_REV" = "$BLUE_REV" ]; then
    echo "ERROR: The latest revision is the same as the current serving revision." >&2
    echo "  Deploy a new revision first (e.g. via 'azd deploy api' or" >&2
    echo "  'az containerapp update --image ...')." >&2
    exit 1
  fi
  echo "[deploy-green] New (green) revision: $GREEN_REV"

  # Label blue and green revisions. Labels are used by 'smoke', 'shift', and 'rollback'.
  echo "[deploy-green] Labeling revisions..."
  az containerapp revision label add \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision "$BLUE_REV" \
    --label "blue" \
    --no-prompt 2>/dev/null || true   # ignore if label already exists

  az containerapp revision label add \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision "$GREEN_REV" \
    --label "green" \
    --no-prompt 2>/dev/null || true

  # Traffic stays 100% on blue. Green receives 0% until 'shift' is called.
  echo "[deploy-green] Setting traffic: blue=100%, green=0%..."
  az containerapp ingress traffic set \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision-weight "blue=100"

  echo "[deploy-green] Done. blue=$BLUE_REV, green=$GREEN_REV"
  echo "[deploy-green] Run './scripts/aca-bluegreen.sh smoke' to validate the green revision."
}

cmd_smoke() {
  echo "[smoke] Locating green revision..."
  GREEN_REV=$(revision_for_label "green")
  if [ -z "$GREEN_REV" ]; then
    echo "ERROR: No revision labeled 'green' found." >&2
    echo "  Run 'deploy-green' first." >&2
    exit 1
  fi
  echo "[smoke] Green revision: $GREEN_REV"

  # Build the revision-specific FQDN. ACA exposes each revision at:
  #   https://<revision-name>.<env-default-domain>
  # where <revision-name> is already "<app-name>--<suffix>" (as returned by Azure),
  # and the app's default FQDN is "<app-name>.<env-default-domain>". So we strip the
  # "<app-name>." prefix off the app FQDN to get the env domain, then prepend the
  # full revision name. This targets the green revision directly, bypassing blue.
  APP_FQDN=$(app_fqdn)
  ENV_DOMAIN="${APP_FQDN#"${ACA_APP_NAME}."}"
  GREEN_FQDN="https://${GREEN_REV}.${ENV_DOMAIN}"

  echo "[smoke] Running smoke tests against: $GREEN_FQDN"
  if ! bash "$SMOKE_SCRIPT" "$GREEN_FQDN"; then
    echo "[smoke] FAILED — smoke tests did not pass against the green revision." >&2
    echo "[smoke] Run './scripts/aca-bluegreen.sh rollback' to restore blue." >&2
    exit 1
  fi
  echo "[smoke] All smoke checks passed."
  echo "[smoke] Run './scripts/aca-bluegreen.sh shift' to promote green to production."
}

cmd_shift() {
  echo "[shift] Shifting traffic: 0% blue → 100% green..."

  GREEN_REV=$(revision_for_label "green")
  BLUE_REV=$(revision_for_label "blue")

  if [ -z "$GREEN_REV" ]; then
    echo "ERROR: No revision labeled 'green' found." >&2
    echo "  Run 'deploy-green' and 'smoke' first." >&2
    exit 1
  fi
  if [ -z "$BLUE_REV" ]; then
    echo "WARNING: No revision labeled 'blue' found; shifting all traffic to green." >&2
  fi

  echo "[shift] green=$GREEN_REV, blue=${BLUE_REV:-<none>}"

  az containerapp ingress traffic set \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision-weight "green=100"

  echo "[shift] Traffic is now 100% on green ($GREEN_REV)."

  # Remove the "blue" label from the old revision to clean up.
  if [ -n "$BLUE_REV" ]; then
    echo "[shift] Removing 'blue' label from $BLUE_REV..."
    az containerapp revision label remove \
      "${AZ_FLAGS[@]}" \
      --resource-group "$ACA_RESOURCE_GROUP" \
      --name "$ACA_APP_NAME" \
      --label "blue" 2>/dev/null || true
  fi

  echo "[shift] Done. Green revision is now serving 100% of traffic."
  echo "[shift] To roll back: relabel the old revision as 'blue' and run 'rollback'."
}

cmd_rollback() {
  echo "[rollback] Restoring 100% traffic to the 'blue' revision..."

  BLUE_REV=$(revision_for_label "blue")
  if [ -z "$BLUE_REV" ]; then
    echo "ERROR: No revision labeled 'blue' found." >&2
    echo "  Cannot roll back: the blue revision has already been removed or was never labeled." >&2
    exit 1
  fi
  echo "[rollback] Blue revision: $BLUE_REV"

  az containerapp ingress traffic set \
    "${AZ_FLAGS[@]}" \
    --resource-group "$ACA_RESOURCE_GROUP" \
    --name "$ACA_APP_NAME" \
    --revision-weight "blue=100"

  echo "[rollback] Traffic is now 100% on blue ($BLUE_REV)."
  echo "[rollback] The green revision is still active but receives 0% traffic."
  echo "[rollback] To deactivate the green revision, run:"
  echo "[rollback]   az containerapp revision deactivate --name $ACA_APP_NAME \\"
  echo "[rollback]     --resource-group $ACA_RESOURCE_GROUP \\"
  echo "[rollback]     --revision \$(az containerapp ingress traffic show --name $ACA_APP_NAME \\"
  echo "[rollback]       --resource-group $ACA_RESOURCE_GROUP \\"
  echo "[rollback]       --query \"[?label=='green'].revisionName | [0]\" -o tsv)"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "$SUBCOMMAND" in
  deploy-green) cmd_deploy_green ;;
  smoke)        cmd_smoke ;;
  shift)        cmd_shift ;;
  rollback)     cmd_rollback ;;
  "")
    echo "Usage: $0 {deploy-green|smoke|shift|rollback}" >&2
    echo "" >&2
    echo "Required env vars:" >&2
    echo "  ACA_RESOURCE_GROUP   Azure resource group (e.g. rg-myenv)" >&2
    echo "  ACA_APP_NAME         Container app name (e.g. api)" >&2
    echo "" >&2
    echo "Optional env vars:" >&2
    echo "  ACA_SUBSCRIPTION     Azure subscription ID or name" >&2
    echo "  SMOKE_SCRIPT         Path to smoke-api.sh (default: <script-dir>/smoke-api.sh)" >&2
    exit 1
    ;;
  *)
    echo "ERROR: Unknown subcommand '$SUBCOMMAND'" >&2
    echo "Usage: $0 {deploy-green|smoke|shift|rollback}" >&2
    exit 1
    ;;
esac
