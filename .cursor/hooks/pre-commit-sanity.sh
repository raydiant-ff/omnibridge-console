#!/usr/bin/env bash
set -euo pipefail

# Cursor beforeShellExecution hook: intercepts `git commit` commands.
# Runs pnpm lint first. If lint fails, asks for user confirmation.

INPUT=$(cat)

LINT_OUTPUT=$(pnpm lint 2>&1) || LINT_EXIT=$?
LINT_EXIT=${LINT_EXIT:-0}

if [ "$LINT_EXIT" -ne 0 ]; then
  # Lint failed -- ask user before proceeding with commit
  ESCAPED_OUTPUT=$(echo "$LINT_OUTPUT" | tail -20 | jq -Rs .)
  cat <<EOF
{
  "permission": "ask",
  "user_message": "Lint failed. Review errors before committing.",
  "agent_message": "pnpm lint failed with exit code $LINT_EXIT. Last 20 lines:\\n${ESCAPED_OUTPUT}\\nConsider fixing lint errors before committing."
}
EOF
else
  # Lint passed -- allow commit
  cat <<EOF
{
  "permission": "allow"
}
EOF
fi
