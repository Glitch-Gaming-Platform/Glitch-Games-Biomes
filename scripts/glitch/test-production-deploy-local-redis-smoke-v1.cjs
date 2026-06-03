#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const scriptPath = path.join(
  root,
  "scripts/glitch/deploy-production-local-redis-smoke-v1.sh"
);
const script = fs.readFileSync(scriptPath, "utf8");

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

ok(
  script.includes("redis:6.0.16-alpine"),
  "local smoke matches the production Redis 6 stream command surface"
);
ok(
  script.includes('--save ""'),
  "local smoke Redis disables RDB snapshots so snapshot import cannot trip stop-writes-on-bgsave-error"
);
ok(
  script.includes("--appendonly no"),
  "local smoke Redis disables AOF persistence for disposable smoke data"
);
ok(
  script.includes("--stop-writes-on-bgsave-error no"),
  "local smoke Redis keeps accepting writes even if disposable persistence fails"
);
ok(
  script.includes("GLITCH_POPULATE_SNAPSHOT_REDIS=1"),
  "local smoke explicitly bootstraps only the local Redis snapshot"
);
ok(
  script.includes("GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1"),
  "local smoke uses the explicit bootstrap role"
);
ok(
  script.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1"),
  "local smoke allows flush only for the local Redis container"
);
ok(
  script.includes("GLITCH_IDLE_SESSION_MS"),
  "local smoke sets the short idle-session window expected by the auth smoke test"
);
ok(
  script.includes('RUN_LOCAL_SMOKE="${RUN_LOCAL_SMOKE:-0}"'),
  "local production-image HTTP smoke is disabled by default"
);
ok(
  script.includes("--local-smoke"),
  "script exposes an explicit opt-in flag for memory-heavy local HTTP smoke"
);
ok(
  script.includes("--bootstrap-prod-redis-snapshot"),
  "script exposes an explicit production Redis snapshot bootstrap flag"
);
ok(
  script.includes("--redis-health-check-only"),
  "script exposes a production Redis AOF health-check-only mode"
);
ok(
  script.includes("Skipping local production-image HTTP smoke"),
  "default deploy path does not wait for the local HTTP server"
);
ok(
  script.includes("node scripts/glitch/test-glitch-container.cjs"),
  "script runs the Glitch container smoke test locally"
);
ok(
  script.includes(
    "node scripts/glitch/assert-glitch-build-artifacts-current.cjs ."
  ),
  "script rejects stale build artifacts before Docker packaging"
);
ok(
  script.includes("test-production-redis6-stream-compat-v1.cjs"),
  "script guards Redis 6 stream command compatibility"
);
ok(
  script.includes("check-harthmere-mission-critical-suite-v112.cjs"),
  "script runs the Grove mission-critical suite"
);
ok(
  script.includes("test-glitch-prod-bucket-asset-proxy-v146.cjs"),
  "script runs the production asset proxy check"
);
ok(
  script.includes("test-glitch-player-mesh-runtime-v144.cjs"),
  "script runs the production player mesh check"
);
ok(
  script.includes("test-production-redis-shared-world-v1.cjs"),
  "script runs the shared production Redis guardrail"
);
ok(
  script.includes("test-harthmere-no-google-npc-text-v1.cjs"),
  "script runs no-Google NPC text fallback guardrail"
);
ok(
  script.includes("test-glitch-aegis-telemetry-mucker-clearance-v138.cjs"),
  "script runs Glitch telemetry endpoint guardrail"
);
ok(
  script.includes(
    "test-harthmere-third-party-combat-ai-production-hardening-v1.cjs"
  ),
  "script runs hostile combat AI hardening"
);
ok(
  script.includes("test-harthmere-attacked-npc-retaliation-v1.cjs"),
  "script runs attacked-NPC retaliation hardening"
);
ok(
  script.includes("test-harthmere-live-mode-backend-production-v1.cjs"),
  "script runs production MMO backend coverage"
);
ok(
  script.includes("test-harthmere-live-mode-backend-reducer-v1.cjs"),
  "script runs production MMO backend reducer behavior"
);
ok(
  script.includes("check-biomes-snapshot-bucket-conversion-v1.cjs"),
  "script verifies snapshot bucket asset conversion before packaging"
);
ok(
  script.includes('NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$PROD_ORIGIN"'),
  "Next build bakes the production web origin"
);
ok(
  script.includes('--platform "$DOCKER_PLATFORM"'),
  "Docker build is production-platform aware"
);
ok(
  script.includes("--load"),
  "Docker build loads the tested image locally before push"
);
ok(
  !/^\s*az acr build\b/m.test(script),
  "script avoids expensive remote ACR source uploads"
);
ok(
  script.includes('docker push "$IMAGE"'),
  "production upload reuses the built local image"
);
ok(script.includes("PUSH_PRODUCTION=0"), "production push is opt-in");
ok(script.includes("--push"), "script exposes an explicit push flag");
ok(
  script.includes("GLITCH_POPULATE_SNAPSHOT_REDIS=0"),
  "production app startup does not repopulate shared Redis"
);
ok(
  script.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0"),
  "production app startup cannot flush shared Redis"
);
ok(
  script.includes('REDIS_HOST="$PROD_REDIS_HOST"'),
  "production update uses the shared Redis host"
);
ok(
  script.includes("10.0.0.12"),
  "production Redis default is the private shared-world Redis VM"
);
ok(
  script.includes(
    'PROD_REDIS_HEALTH_HOST="${PROD_REDIS_HEALTH_HOST:-$PROD_REDIS_PUBLIC_HOST}"'
  ),
  "deploy checks production Redis through the public health host by default"
);
ok(
  script.includes('PROD_REDIS_AOF_AUTOFIX="${PROD_REDIS_AOF_AUTOFIX:-1}"'),
  "deploy enables Redis AOF auto-repair by default"
);
ok(
  script.includes(
    'check_production_redis_aof_health_v186 "production image push"'
  ),
  "deploy checks Redis AOF/write health before the expensive image push"
);
ok(
  script.includes(
    'check_production_redis_snapshot_hash_v187 "production image push"'
  ),
  "deploy checks production Redis snapshot hash before image push"
);
ok(
  script.includes(
    'check_production_redis_aof_health_v186 "Azure Container App update"'
  ),
  "deploy re-checks Redis AOF/write health before creating the Azure revision"
);
ok(
  script.includes(
    'check_production_redis_snapshot_hash_v187 "Azure Container App update"'
  ),
  "deploy re-checks production Redis snapshot hash before Azure update"
);
ok(
  script.includes(
    'check_production_redis_aof_health_v186 "manual Redis health check"'
  ),
  "Redis health-check-only mode uses the same AOF repair logic"
);
ok(
  script.includes("snapshot_backup_hash_v187"),
  "deploy computes the packaged snapshot_backup.json hash"
);
ok(
  script.includes("production_snapshot_hash_key_v187"),
  "deploy checks the title-scoped production Redis snapshot hash key"
);
ok(
  script.includes("biomes_data_snapshot_hash"),
  "deploy preserves the legacy production Redis snapshot hash key"
);
ok(
  script.includes(
    "refusing to deploy an image whose snapshot does not match production Redis"
  ),
  "deploy fails fast on production Redis snapshot mismatch"
);
ok(
  script.includes("FLUSHALL"),
  "production Redis snapshot bootstrap is explicit and destructive"
);
ok(
  script.includes("BOOTSTRAP_PROD_REDIS_SNAPSHOT"),
  "production Redis snapshot bootstrap is guarded by an opt-in flag"
);
ok(
  script.includes("CONFIG SET appendonly no"),
  "deploy repair disables broken production Redis AOF"
);
ok(
  script.includes("CONFIG SET stop-writes-on-bgsave-error no"),
  "deploy repair unblocks writes after persistence failure"
);
ok(
  script.includes("CONFIG SET dbfilename dump.rdb"),
  "deploy repair restores the safe Redis RDB filename"
);
ok(
  script.includes('CONFIG SET save ""'),
  "deploy repair disables RDB snapshots for the shared Redis runtime"
);
ok(
  script.includes("CONFIG REWRITE"),
  "deploy persists the Redis persistence guardrail config"
);
ok(
  script.includes("MISCONF\\|AOF file\\|No space left on device"),
  "deploy detects the Redis AOF disk-full MISCONF signature"
);
ok(
  script.includes("production_redis_write_probe_v186"),
  "deploy proves Redis writes before continuing"
);
ok(
  script.includes(
    "BIOMES_PLAYER_START_POSITION=484.24980838010384,53,-207.51197432867897"
  ),
  "production update keeps the requested Grove start coordinate"
);
ok(
  script.includes("HARTHMERE_SKIP_BUSINESS_OUTPOST_MATERIALIZATION"),
  "deploy can explicitly skip business outpost reconciliation only by request"
);
ok(
  script.includes(
    "Reconciling Harthmere business outpost terrain against production Redis."
  ),
  "production deploy automatically reconciles business outpost terrain"
);
ok(
  script.includes(
    "node scripts/harthmere/materialize-business-outposts-redis-v1.cjs"
  ),
  "production deploy runs the idempotent business outpost materializer"
);
ok(
  script.includes(
    "HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_REDIS_HOST:-$PROD_REDIS_PUBLIC_HOST"
  ),
  "business outpost reconciliation defaults to the production Redis public host"
);

if (failed) {
  process.exit(1);
}
console.log("OK production deploy local Redis smoke script v1");
