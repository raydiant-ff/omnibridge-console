#!/usr/bin/env bash
set -euo pipefail

echo "=== DEBUG CONTEXT ==="
echo "Branch: $(git branch --show-current)"
echo

echo "--- Status ---"
git status --short
echo

echo "--- Last 10 commits ---"
git log --oneline -n 10
echo

echo "--- Current diff (stat) ---"
git diff --stat || true
echo

echo "--- Recently modified files (last 5 min) ---"
find apps/console/src packages -name '*.ts' -o -name '*.tsx' 2>/dev/null \
  | xargs ls -lt 2>/dev/null \
  | head -15 || true
echo

if [ -f .ai/.last-test-failure.txt ]; then
  echo "--- Last captured test/lint failure ---"
  tail -n 150 .ai/.last-test-failure.txt
else
  echo "(No captured test failure in .ai/.last-test-failure.txt)"
fi
