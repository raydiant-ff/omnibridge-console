#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-HEAD~1}"

echo "Comparing against: $BASE_REF"
echo
git diff --name-status "$BASE_REF"...HEAD
echo
git diff --stat "$BASE_REF"...HEAD
