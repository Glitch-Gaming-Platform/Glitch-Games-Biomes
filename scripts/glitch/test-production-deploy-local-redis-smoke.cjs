#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const scriptPath = path.join(
  root,
  "scripts/glitch/deploy-production-local-redis-smoke.sh"
);
const script = fs.readFileSync(scriptPath, "utf8");
const stackRunner = fs.readFileSync(
  path.join(root, "scripts/glitch/run-glitch-local-game-stack.sh"),
  "utf8"
);
const dockerfile = fs.readFileSync(
  path.join(root, "Dockerfile.biomes"),
  "utf8"
);
const deployWorkflow = fs.readFileSync(
  path.join(root, ".github/workflows/azure-production-deploy.yml"),
  "utf8"
);
const cachedYarnAction = fs.readFileSync(
  path.join(root, ".github/actions/cached-yarn-install/action.yml"),
  "utf8"
);
const gitDepsAction = fs.readFileSync(
  path.join(root, ".github/actions/configure-github-git-deps/action.yml"),
  "utf8"
);
const snapshotBucketCheck = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/check-biomes-snapshot-bucket-conversion.cjs"
  ),
  "utf8"
);
const runBuildChecks = script.slice(script.indexOf("run_build_checks()"));
const pushAndDeploy = script.slice(
  script.indexOf("push_and_deploy()"),
  script.indexOf('if [ "$REDIS_HEALTH_CHECK_ONLY"')
);

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
  script.includes("STOP_BEFORE_DOCKER_BUILD=0"),
  "script tracks the explicit pre-Docker-build stop mode"
);
ok(
  script.includes("--stop-before-docker-build"),
  "script exposes a repeatable stop point before the Docker image build"
);
ok(
  script.includes("Stopping before Docker build by request"),
  "pre-Docker-build stop mode exits after refreshed source artifacts"
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
  script.includes("test-production-redis6-stream-compat.cjs"),
  "script guards Redis 6 stream command compatibility"
);
ok(
  script.includes("test-production-deploy-local-redis-smoke.cjs"),
  "script runs its own production deploy guardrail assertions"
);
ok(
  script.includes("ensure_generated_ts_deps") &&
    script.includes("./b --no-check-ts-deps ts-deps build"),
  "script generates ignored TypeScript deps before import-based guardrails"
);
ok(
  script.indexOf("ensure_generated_ts_deps") <
    script.indexOf("test-production-api-route-imports.cjs"),
  "script generates TypeScript deps before sweeping API route imports"
);
ok(
  script.includes("ensure_production_asset_inputs") &&
    script.includes("./b --no-check-ts-deps data-snapshot pull") &&
    script.includes("[ -f snapshot_backup.json ]"),
  "script hydrates production asset inputs before source guardrails"
);
ok(
  runBuildChecks.indexOf("ensure_production_asset_inputs") <
    runBuildChecks.indexOf("ensure_generated_ts_deps"),
  "script prepares production assets before generated TypeScript deps and guardrails"
);
ok(
  deployWorkflow.includes("uses: ./.github/actions/cached-yarn-install") &&
    deployWorkflow.includes("timeout-minutes: 25") &&
    deployWorkflow.includes(
      "token: ${{ secrets.BIOMES_DEPENDENCY_GITHUB_TOKEN }}"
    ) &&
    deployWorkflow.includes("npm install -g @bazel/bazelisk"),
  "production workflow uses the shared cached Yarn install and installs Bazelisk"
);
ok(
  deployWorkflow.includes("Restore production asset cache") &&
    deployWorkflow.includes("public/buckets") &&
    deployWorkflow.includes("snapshot_backup.json"),
  "production workflow caches hydrated snapshot bucket assets"
);
ok(
  deployWorkflow.includes("Restore production compiler cache") &&
    deployWorkflow.includes(".next/cache") &&
    deployWorkflow.includes("node_modules/.cache/webpack"),
  "production workflow caches Next and server Webpack compiler outputs"
);
ok(
  deployWorkflow.includes("uses: ./.github/actions/cached-yarn-install"),
  "production workflow uses the shared Yarn install action with GitHub package URL rewrites"
);
ok(
  cachedYarnAction.includes("./.github/actions/configure-github-git-deps") &&
    cachedYarnAction.includes("token: ${{ inputs.token }}"),
  "shared Yarn install action configures GitHub package URL rewrites"
);
ok(
  cachedYarnAction.includes("actions/cache/restore@v5") &&
    cachedYarnAction.includes("actions/cache/save@v5") &&
    cachedYarnAction.includes("continue-on-error: true") &&
    cachedYarnAction.includes("Save node_modules cache") &&
    cachedYarnAction.includes("Save Yarn tarball cache"),
  "shared Yarn install action saves dependency caches immediately after install"
);
ok(
  gitDepsAction.includes("git+ssh://git@github.com/") &&
    gitDepsAction.includes("ssh://git@github.com/") &&
    gitDepsAction.includes("git@github.com:"),
  "Git dependency rewrite covers Yarn SSH URL variants"
);
ok(
  gitDepsAction.includes("https://x-access-token:") &&
    gitDepsAction.includes("https://github.com/"),
  "Git dependency rewrite supports private-token and public-HTTPS fallback modes"
);
ok(
  script.includes("check-harthmere-mission-critical-suite.cjs"),
  "script runs the Grove mission-critical suite"
);
ok(
  script.includes("test-glitch-prod-bucket-asset-proxy.cjs"),
  "script runs the production asset proxy check"
);
ok(
  script.includes("test-glitch-player-mesh-runtime.cjs"),
  "script runs the production player mesh check"
);
ok(
  script.includes("test-production-redis-shared-world.cjs"),
  "script runs the shared production Redis guardrail"
);
ok(
  script.includes("test-harthmere-no-google-npc-text.cjs"),
  "script runs no-Google NPC text fallback guardrail"
);
ok(
  script.includes("test-glitch-aegis-telemetry-mucker-clearance.cjs"),
  "script runs Glitch telemetry endpoint guardrail"
);
ok(
  script.includes(
    "test-harthmere-third-party-combat-ai-production-hardening.cjs"
  ),
  "script runs hostile combat AI hardening"
);
ok(
  script.includes("test-harthmere-attacked-npc-retaliation.cjs"),
  "script runs attacked-NPC retaliation hardening"
);
ok(
  script.includes("test-harthmere-live-mode-backend-production.cjs"),
  "script runs production MMO backend coverage"
);
ok(
  script.includes("test-harthmere-live-mode-backend-reducer.cjs"),
  "script runs production MMO backend reducer behavior"
);
ok(
  script.includes("check-biomes-snapshot-bucket-conversion.cjs"),
  "script verifies snapshot bucket asset conversion before packaging"
);
ok(
  snapshotBucketCheck.includes('skipDirNames: new Set(["_source"])'),
  "snapshot bucket guardrail ignores local source-pack files in runtime asset counts"
);
ok(
  snapshotBucketCheck.includes("harthmereFiles.length >= 6500") &&
    snapshotBucketCheck.includes("(extCounts.obj || 0) >= 480") &&
    snapshotBucketCheck.includes("(extCounts.png || 0) >= 1300"),
  "snapshot bucket guardrail thresholds match clean checkout runtime assets"
);
ok(
  script.includes('NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$PROD_ORIGIN"'),
  "Next build bakes the production web origin"
);
ok(
  script.includes(
    'GLITCH_TITLE_ID="${GLITCH_TITLE_ID:-42de534c-600f-4228-af9e-b69faef94cce}"'
  ),
  "deploy has an explicit default Glitch title id"
);
ok(
  script.includes(
    'GLITCH_API_BASE_URL="${GLITCH_API_BASE_URL:-https://api.glitch.fun/api}"'
  ),
  "deploy has an explicit Glitch API base URL"
);
ok(
  script.includes('NEXT_PUBLIC_GLITCH_TITLE_ID="$GLITCH_TITLE_ID"'),
  "Next build and Azure runtime include the Glitch title id for client identity"
);
ok(
  script.includes("GLITCH_TITLE_TOKEN=secretref:glitch-title-token"),
  "production app uses the Azure Container App title-token secret reference"
);
ok(
  script.includes(
    "--command ./scripts/glitch/run-glitch-local-game-stack.sh"
  ) && script.includes('--args ""'),
  "production update replaces stale Azure startup command overrides with the unified stack runner"
);
ok(
  script.includes("az containerapp ingress traffic set") &&
    script.includes('--revision-weight "$revision=100"') &&
    script.includes("az containerapp revision deactivate") &&
    script.includes("properties.active==\\`true\\`"),
  "production deploy pins one ready Azure revision and deactivates stale active revisions"
);
ok(
  !/run-glitch-local-game-stack-[A-Za-z0-9_.-]+[.]sh/.test(script),
  "production deploy script no longer references removed versioned stack runners"
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
  script.includes("DOCKER_BUILD_CACHE_FROM") &&
    script.includes("DOCKER_BUILD_CACHE_TO"),
  "Docker build can consume and refresh an external Buildx layer cache"
);
ok(
  deployWorkflow.includes("actions/cache/restore@v5") &&
    deployWorkflow.includes("actions/cache/save@v5") &&
    deployWorkflow.includes("Save Docker layer cache") &&
    deployWorkflow.includes("continue-on-error: true") &&
    deployWorkflow.includes("promote-buildx-cache.outputs.cache_present"),
  "production workflow saves refreshed Buildx cache after the build step"
);
ok(
  script.includes("reset_build_outputs_preserving_caches") &&
    !script.includes("rm -rf .next/cache node_modules/.cache/webpack"),
  "source artifact build keeps restored compiler caches while clearing generated outputs"
);
ok(
  !/^\s*az acr build\b/m.test(script),
  "script avoids expensive remote ACR source uploads"
);
ok(
  dockerfile.includes(
    'CMD ["./scripts/glitch/run-glitch-local-game-stack.sh"]'
  ),
  "Docker image starts the unified Glitch local game stack script"
);
ok(
  !/run-glitch-local-game-stack-[A-Za-z0-9_.-]+[.]sh/.test(dockerfile),
  "Docker image no longer references removed versioned stack scripts"
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
    'PROD_REDIS_HEALTH_MODE="${PROD_REDIS_HEALTH_MODE:-azure-vm}"'
  ),
  "deploy checks production Redis through Azure VM run-command by default"
);
ok(
  script.includes('PROD_REDIS_PUBLIC_HOST="${PROD_REDIS_PUBLIC_HOST:-}"'),
  "deploy does not default to the public Redis IP"
);
ok(
  script.includes("check_production_redis_network_guard"),
  "deploy checks Redis NSG guardrails before production changes"
);
ok(
  script.includes("deny-all rule after the Container Apps subnet allow"),
  "deploy requires an explicit Redis deny-all NSG rule after the subnet allow"
);
ok(
  script.includes(
    "refusing local production Redis bootstrap while Redis is private"
  ),
  "deploy refuses destructive local Redis bootstrap when Redis is private"
);
ok(
  script.includes("do not re-open the public Redis IP"),
  "deploy blocks post-deploy world sync unless it has a private Redis runner"
);
ok(
  script.includes('PROD_REDIS_AOF_AUTOFIX="${PROD_REDIS_AOF_AUTOFIX:-1}"'),
  "deploy enables Redis AOF auto-repair by default"
);
ok(
  script.includes('check_production_redis_aof_health "production image push"'),
  "deploy checks Redis AOF/write health before the expensive image push"
);
ok(
  script.includes(
    'check_production_redis_snapshot_hash "production image push"'
  ),
  "deploy checks production Redis snapshot hash before image push"
);
ok(
  script.includes(
    'check_production_redis_aof_health "Azure Container App update"'
  ),
  "deploy re-checks Redis AOF/write health before creating the Azure revision"
);
ok(
  script.includes(
    'check_production_redis_snapshot_hash "Azure Container App update"'
  ),
  "deploy re-checks production Redis snapshot hash before Azure update"
);
ok(
  script.includes(
    'check_production_redis_aof_health "manual Redis health check"'
  ),
  "Redis health-check-only mode uses the same AOF repair logic"
);
ok(
  script.includes("snapshot_backup_hash"),
  "deploy computes the packaged snapshot_backup.json hash"
);
ok(
  script.includes("production_snapshot_hash_key"),
  "deploy checks the title-scoped production Redis snapshot hash key"
);
ok(
  script.includes("biomes_data_snapshot_hash"),
  "deploy preserves the legacy production Redis snapshot hash key"
);
ok(
  script.includes("check_production_redis_snapshot_materialized"),
  "deploy verifies production Redis has materialized world data, not only a hash marker"
);
ok(
  script.includes("required_seed_keys_present"),
  "deploy reports required production Redis seed-key presence during snapshot checks"
);
ok(
  stackRunner.includes("snapshot_redis_required_seeds_present"),
  "runtime verifies required world seed keys before accepting a snapshot hash"
);
ok(
  stackRunner.includes(
    "dbsize=$dbsize required_seed_keys_present=$required_count/3"
  ),
  "runtime crash diagnostics include Redis dbsize and seed-key presence"
);
ok(
  script.includes("GLITCH_DISABLE_GCP=1") &&
    script.includes("GLITCH_SKIP_GOOGLE_SECRETS=1"),
  "explicit production Redis bootstrap disables Google Secret Manager for local recovery"
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
  script.includes('CONFIG SET dbfilename "$PROD_REDIS_RDB_FILENAME"'),
  "deploy repair restores the safe Redis RDB filename"
);
ok(
  script.includes('CONFIG SET dir "$PROD_REDIS_RDB_DIR"'),
  "deploy repair restores the safe Redis RDB directory"
);
ok(
  script.includes('CONFIG SET save "$PROD_REDIS_SAVE_SCHEDULE"'),
  "deploy repair keeps scheduled RDB snapshots enabled for the shared Redis runtime"
);
ok(
  script.includes(
    'PROD_REDIS_SAVE_SCHEDULE="${PROD_REDIS_SAVE_SCHEDULE:-900 1 300 10 60 10000}"'
  ),
  "deploy uses the production Redis RDB save schedule by default"
);
ok(
  script.includes("force_production_redis_bgsave"),
  "deploy forces a Redis RDB save after persistence repair"
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
  script.includes("production_redis_write_probe"),
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
  script.includes("HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION"),
  "deploy can explicitly skip broad world sync reconciliation only by request"
);
ok(
  script.includes("reconcile_production_world_sync"),
  "production deploy has a named broad world sync reconciliation phase"
);
ok(
  script.includes('check_production_redis_aof_health "post-deploy world sync"'),
  "post-deploy world sync re-checks Redis write health"
);
ok(
  script.includes(
    'check_production_redis_snapshot_hash "post-deploy world sync"'
  ),
  "post-deploy world sync re-checks packaged snapshot hash"
);
ok(
  script.includes(
    "Reconciling Harthmere business outpost terrain against production Redis."
  ),
  "production deploy automatically reconciles business outpost terrain"
);
ok(
  script.includes(
    "node scripts/harthmere/materialize-business-outposts-redis.cjs"
  ),
  "production deploy runs the idempotent business outpost materializer"
);
ok(
  script.includes(
    'HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE:-per-outpost}"'
  ),
  "production deploy defaults business outpost materialization to per-outpost mode"
);
ok(
  script.includes("harthmere_business_outpost_ids"),
  "production deploy reads canonical business outpost ids from shared data"
);
ok(
  script.includes('OUTPOST_ID="$outpost_id"'),
  "production deploy materializes business outpost terrain one outpost at a time"
);
ok(
  script.includes("processed ${materialized_count}/${expected_count} outposts"),
  "production deploy fails when the business terrain materializer does not cover all outposts"
);
ok(
  script.includes(
    'HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE="${HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_APPLY_SHARD_BATCH_SIZE:-2}"'
  ),
  "production deploy uses small shard batches for business outpost terrain materialization"
);
ok(
  script.includes(
    "HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST"
  ),
  "business outpost reconciliation uses the explicitly configured private Redis runner host"
);
ok(
  script.includes("reconcile-production-world-sync.cjs"),
  "production deploy runs the broad Harthmere world sync reconciler"
);
ok(
  script.includes(
    "HARTHMERE_WORLD_SYNC_REDIS_HOST:-$PROD_REDIS_RECONCILE_HOST"
  ),
  "broad world sync reconciliation uses the explicitly configured private Redis runner host"
);
ok(
  script.includes("validate_production_world_sync_http"),
  "production deploy validates live Harthmere world APIs after Redis reconciliation"
);
ok(
  pushAndDeploy.includes(
    [
      'validate_production_bucket_assets "$latest_revision"',
      'validate_production_world_sync_http "$latest_revision"',
      'reconcile_production_world_sync "$latest_revision"',
    ].join("\n  ")
  ),
  "app-only production deploy validates live Harthmere world APIs even when Redis reconciliation is skipped"
);
ok(
  script.includes("audit_production_authored_content"),
  "production deploy audits authored Harthmere content after Redis reconciliation"
);
ok(
  script.includes(
    'force_production_redis_bgsave "post-deploy world sync reconciliation"'
  ),
  "production deploy persists reconciled authored content with a forced RDB save"
);
ok(
  script.includes("/api/harthmere/live_mode_jobs_board_state"),
  "post-deploy world sync validates jobs board shared-state API"
);
ok(
  script.includes("/api/harthmere/live_mode_player_status_state"),
  "post-deploy world sync validates player status API"
);
ok(
  script.includes("/api/glitch/runtime_environment"),
  "post-deploy world sync validates runtime environment API"
);
ok(
  script.includes("/api/world_map/metadata") &&
    script.includes('"fullImageWidth"[[:space:]]*:[[:space:]]*[0-9]'),
  "post-deploy world sync validates map metadata API"
);

if (failed) {
  process.exit(1);
}
console.log("OK production deploy local Redis smoke script");
