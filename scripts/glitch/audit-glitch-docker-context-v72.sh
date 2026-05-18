#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

cat <<MSG
== Glitch Docker context audit v72 ==
This shows the directories most likely to bloat the Docker context. Dockerfile.glitch.dockerignore
will exclude .git, node_modules, backups, archives, caches, and local env files.
MSG

for path in .git node_modules .next .harthmere-backups public public/assets src scripts; do
  if [[ -e "$path" ]]; then
    du -sh "$path" 2>/dev/null || true
  fi
done

cat <<MSG

Largest top-level paths:
MSG

du -sh ./* ./.??* 2>/dev/null | sort -h | tail -30 || true
