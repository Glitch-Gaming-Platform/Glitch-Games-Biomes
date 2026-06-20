#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-/Users/devindixon/Development/biomes-game}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3017}"
INSTALL_ID="${INSTALL_ID:-f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-biomes-local}"
ARTIFACTS_DIR="${E2E_ARTIFACTS_DIR:-/tmp/harthmere-playboot-e2e}"
SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cd "$REPO"
mkdir -p "$ARTIFACTS_DIR"

printf 'E2E repo=%s\n' "$REPO"
printf 'E2E base=%s\n' "$BASE_URL"
printf 'E2E install_id=%s\n' "$INSTALL_ID"
printf 'E2E artifacts=%s\n' "$ARTIFACTS_DIR"
printf 'E2E HEADLESS=%s STRICT_RENDER=%s\n' "${HEADLESS:-1}" "${STRICT_RENDER:-0}"

test -f package.json
test -f src/client/components/Game.tsx
test -f src/client/game/load_progress.ts
test -f src/client/game/client_config.ts
test -f src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx

echo 'Preflight 0: current source validator (install_id flow patch must be in place)'
node "$REPO/scripts/harthmere/validate-harthmere-install-id-flow.cjs" "$REPO"

echo 'Preflight 1: current unit tests'
node "$REPO/scripts/harthmere/test-harthmere-install-id-flow-unit.cjs" "$REPO"

echo 'Preflight 2: web responds'
curl -fsS "$BASE_URL/api/bikkie" >/tmp/harthmere-e2e-bikkie.json

echo 'Preflight 3: install autoLogin and auth check via isolated cookie jar'
COOKIE_JAR="$(mktemp /tmp/harthmere-e2e-cookies.XXXXXX)"
AUTOLOGIN_BODY="$(mktemp /tmp/harthmere-e2e-autologin.XXXXXX.json)"
AUTHCHECK_BODY="$(mktemp /tmp/harthmere-e2e-authcheck.XXXXXX.json)"
trap 'rm -f "$COOKIE_JAR" "$AUTOLOGIN_BODY" "$AUTHCHECK_BODY"' EXIT

curl -fsS \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"op\":\"autoLogin\",\"install_id\":\"$INSTALL_ID\"}" \
  "$BASE_URL/api/glitch/harthmere" \
  > "$AUTOLOGIN_BODY"

cat "$AUTOLOGIN_BODY"
echo
node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!j.auto_login || !j.biomes_user_id){ console.error("autoLogin response missing auto_login/biomes_user_id", j); process.exit(1); }' "$AUTOLOGIN_BODY"

curl -fsS \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{}' \
  "$BASE_URL/api/auth/check" \
  > "$AUTHCHECK_BODY"
cat "$AUTHCHECK_BODY"
echo
node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!j.userId){ console.error("auth/check missing userId after autoLogin", j); process.exit(1); }' "$AUTHCHECK_BODY"

echo 'Browser E2E current: install_id to player-in-game (headless WebGL graceful)'
E2E_ARTIFACTS_DIR="$ARTIFACTS_DIR" \
INSTALL_ID="$INSTALL_ID" \
BASE_URL="$BASE_URL" \
HEADLESS="${HEADLESS:-1}" \
STRICT_RENDER="${STRICT_RENDER:-0}" \
node "$REPO/scripts/harthmere/test-harthmere-install-player-ingame-e2e.cjs" "$REPO" \
  --base-url "$BASE_URL" \
  --install-id "$INSTALL_ID"

echo 'Postflight: scan fresh container logs for known playboot blockers'
if docker ps --format '{{.Names}}' | grep -qx "$DOCKER_CONTAINER"; then
  docker logs --since "$SINCE" "$DOCKER_CONTAINER" > "$ARTIFACTS_DIR/docker-since.log" 2>&1 || true
  if grep -Eiq 'assert\(secrets\)|getGlobalSecrets|/sync/createPlayer.*(UNKNOWN|Not supported)|/sync/oob: Bad JSON|Bad JSON errorCode=404|Asset server not enabled|ModuleNotFoundError|No module named|Empty reply from server|ClientLongLoad|Load screen stuck|https://biomes\.gg/api/assets/player_mesh\.glb|player_mesh\.glb.*(301|404|500)' "$ARTIFACTS_DIR/docker-since.log"; then
    echo 'FAIL: known blocker found in fresh container logs.' >&2
    grep -Ein 'assert\(secrets\)|getGlobalSecrets|/sync/createPlayer.*(UNKNOWN|Not supported)|/sync/oob: Bad JSON|Bad JSON errorCode=404|Asset server not enabled|ModuleNotFoundError|No module named|Empty reply from server|ClientLongLoad|Load screen stuck|https://biomes\.gg/api/assets/player_mesh\.glb|player_mesh\.glb.*(301|404|500)' "$ARTIFACTS_DIR/docker-since.log" >&2 || true
    exit 1
  fi
else
  echo "WARN: docker container $DOCKER_CONTAINER is not running; skipped log scan."
fi

echo "PASS: install_id login flow verified end-to-end."
echo "Artifacts: $ARTIFACTS_DIR"
echo ""
echo "To verify the rendered game with your real browser on this Mac:"
echo "  HEADLESS=0 bash scripts/harthmere/test-harthmere-install-player-ingame-e2e.sh $REPO"
