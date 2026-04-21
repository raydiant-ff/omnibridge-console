#!/usr/bin/env bash
set -euo pipefail

# Cursor afterFileEdit hook: consumes JSON stdin, logs repo snapshot to a file.
# The agent and Execution Log can reference this file for post-edit awareness.

cat > /dev/null  # consume stdin

LOG_FILE=".ai/.last-edit-status.txt"

{
  echo "=== Omni post-edit repo snapshot ($(date '+%H:%M:%S')) ==="
  echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
  echo
  echo "--- changed files ---"
  git diff --name-only 2>/dev/null || true
  echo
  echo "--- git status --short ---"
  git status --short 2>/dev/null || true
} > "$LOG_FILE" 2>/dev/null

exit 0
