#!/usr/bin/env bash
set -euo pipefail

echo "=== REPO STATUS ==="
echo "Repo: $(basename "$(git rev-parse --show-toplevel)")"
echo "Branch: $(git branch --show-current)"
echo "Package manager: pnpm $(pnpm --version 2>/dev/null || echo 'not found')"
echo

echo "--- Working tree ---"
git status --short
echo

echo "--- Changed files (unstaged) ---"
git diff --name-only
echo

echo "--- Changed files (staged) ---"
git diff --cached --name-only
echo

echo "--- Recent commits ---"
git log --oneline -n 10
echo

echo "--- Staged diff summary ---"
git diff --cached --stat || true
echo

echo "--- Unstaged diff summary ---"
git diff --stat || true
echo

echo "--- Workspace packages ---"
if command -v pnpm >/dev/null 2>&1; then
  pnpm -r exec -- sh -c 'echo "  $(basename "$PWD"): $(node -p "require(\"./package.json\").name")"' 2>/dev/null \
    || echo "(could not list workspaces)"
fi
