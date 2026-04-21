#!/usr/bin/env bash
set -euo pipefail

OUT_FILE=".ai/.last-test-failure.txt"
: > "$OUT_FILE"

echo "Capturing focused test output..."
if [ $# -gt 0 ]; then
  "$@" > "$OUT_FILE" 2>&1 || true
else
  echo "No test command provided" > "$OUT_FILE"
fi

echo "Saved output to $OUT_FILE"
tail -n 120 "$OUT_FILE" || true
