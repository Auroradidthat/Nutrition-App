#!/usr/bin/env bash
# Builds a self-contained Docker image from a committed branch and serves it,
# so you can check a change before merging. Nothing is mounted from your working
# folder except .dev.vars, so what you see is exactly what is committed.
#
#   scripts/preview.sh [branch] [port]   build and run (default: current branch, 8799)
#   scripts/preview.sh --stop [port]     stop and remove the preview container
#
# Open it at http://127.0.0.1:<port> (localhost or 127.0.0.1 only; any other
# hostname is treated as signed out).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ "${1:-}" = "--stop" ]; then
  port="${2:-8799}"
  docker rm -f "grocery-preview-$port" >/dev/null 2>&1 && echo "Stopped grocery-preview-$port" || echo "Nothing running on $port"
  exit 0
fi

branch="${1:-$(git branch --show-current)}"
port="${2:-8799}"
name="grocery-preview-$port"
image="grocery-preview:$port"

git rev-parse --verify --quiet "$branch^{commit}" >/dev/null || { echo "Unknown branch: $branch" >&2; exit 1; }
[ -f .dev.vars ] || { echo "Missing .dev.vars (see README); the preview would show 'signed out'." >&2; exit 1; }
if [ -n "$(git status --porcelain)" ] && [ "$branch" = "$(git branch --show-current)" ]; then
  echo "Note: uncommitted changes are NOT included. Commit first to preview them."
fi

# Git Bash on Windows needs a Windows-style path for the bind mount.
if pwd -W >/dev/null 2>&1; then root="$(pwd -W)"; else root="$(pwd)"; fi

echo "Building $branch ($(git rev-parse --short "$branch"))..."
git archive "$branch" | docker build -q -t "$image" - >/dev/null

docker rm -f "$name" >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name "$name" \
  -p "127.0.0.1:$port:8787" \
  -v "$root/.dev.vars:/app/.dev.vars:ro" \
  "$image" >/dev/null

printf "Starting"
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/items" || true)"
  [ "$code" = "200" ] && break
  printf "."; sleep 2
done
echo
if [ "$code" = "200" ]; then
  echo "Ready: http://127.0.0.1:$port  (branch $branch)"
else
  echo "Not ready (last status $code). Logs: docker logs $name" >&2; exit 1
fi
