#!/usr/bin/env bash
# Installs Playwright browsers for a .NET test project's build output, without
# requiring PowerShell (the official playwright.ps1 wrapper just loads
# Microsoft.Playwright.dll and forwards args to it; this calls the same
# bundled node driver directly).
set -euo pipefail

output_dir="$1"
shift

node_bin=$(find "$output_dir/.playwright/node" -maxdepth 2 -type f \( -name node -o -name node.exe \) | head -n1)
if [ -z "$node_bin" ]; then
  echo "Could not find bundled Playwright node driver under $output_dir/.playwright/node" >&2
  exit 1
fi

"$node_bin" "$output_dir/.playwright/package/cli.js" "$@"
