#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 18 or newer is required. Install the current LTS from https://nodejs.org/, then run this installer again.' >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo 'npm was not found. Reinstall Node.js from https://nodejs.org/ and make sure npm is included.' >&2
  exit 1
fi

node "$SCRIPT_DIR/scripts/install.mjs"
