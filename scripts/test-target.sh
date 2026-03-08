#!/usr/bin/env bash
set -euo pipefail

# This repo does not yet have a test runner (no vitest/jest/playwright).
# This script provides a validation fallback and is ready for when tests are added.
#
# Usage:
#   scripts/test-target.sh <target>          Run tests matching target (once available)
#   scripts/test-target.sh --lint [filter]   Run lint, optionally for a single workspace
#   scripts/test-target.sh --build           Run full build (includes type checking)

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "Usage:"
  echo "  scripts/test-target.sh <path-or-pattern>   # Run tests (when available)"
  echo "  scripts/test-target.sh --lint [filter]      # Run lint (optionally filtered)"
  echo "  scripts/test-target.sh --build              # Run full build"
  exit 1
fi

case "$TARGET" in
  --lint)
    FILTER="${2:-}"
    if [ -n "$FILTER" ]; then
      echo "Running: pnpm --filter $FILTER lint"
      pnpm --filter "$FILTER" lint
    else
      echo "Running: pnpm lint"
      pnpm lint
    fi
    ;;
  --build)
    echo "Running: pnpm build"
    pnpm build
    ;;
  *)
    if command -v jq >/dev/null 2>&1 && jq -e '.scripts.test' package.json >/dev/null 2>&1; then
      pnpm test -- "$TARGET"
    else
      echo "No test runner configured in this repo."
      echo "Available validations: --lint, --build"
      echo "To add tests, install vitest and add a 'test' script to turbo.json."
      exit 1
    fi
    ;;
esac
