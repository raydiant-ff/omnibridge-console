#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/console"
KEY_FILE="$ROOT_DIR/docs/shadcn-version/shadcn_blocks_api_key"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing shadcnblocks API key file: $KEY_FILE" >&2
  exit 1
fi

SHADCNBLOCKS_API_KEY="$(tr -d '\r\n' < "$KEY_FILE")"

if [[ -z "$SHADCNBLOCKS_API_KEY" ]]; then
  echo "Shadcnblocks API key file is empty: $KEY_FILE" >&2
  exit 1
fi

cd "$APP_DIR"
export SHADCNBLOCKS_API_KEY

exec npx shadcn@latest add --cwd "$APP_DIR" "$@"
