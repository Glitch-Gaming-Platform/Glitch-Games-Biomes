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
const simulationHealth = fs.readFileSync(
  path.join(root, "scripts/glitch/simulation-health-server.cjs"),
  "utf8"
);
const dockerfile = fs.readFileSync(
  path.join(root, "Dockerfile.biomes"),
  "utf8"
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const nextConfig = fs.readFileSync(path.join(root, "next.config.js"), "utf8");
const serverWebpackConfig = fs.readFileSync(
  path.join(root, "server.webpack.config.cjs"),
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
const cachedLfsAction = fs.readFileSync(
  path.join(root, ".github/actions/cached-lfs-pull/action.yml"),
  "utf8"
);
const cachedPipAction = fs.readFileSync(
  path.join(root, ".github/actions/cached-pip-install/action.yml"),
  "utf8"
);
const cachedEslintAction = fs.readFileSync(
  path.join(root, ".github/actions/cached-eslint/action.yml"),
  "utf8"
);
const bazelAction = fs.readFileSync(
  path.join(root, ".github/actions/bazel/action.yml"),
  "utf8"
);
const mergeCiWorkflow = fs.readFileSync(
  path.join(root, ".github/workflows/merge-ci.yml"),
  "utf8"
);
const tsEslintCiWorkflow = fs.readFileSync(
  path.join(root, ".github/workflows/ts-eslint-ci.yml"),
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
const harthmereWorldSync = fs.readFileSync(
  path.join(root, "scripts/harthmere/reconcile-production-world-sync.cjs"),
  "utf8"
);
const harthmereTerrainAudit = fs.readFileSync(
  path.join(root, "scripts/harthmere/audit-production-extension-terrain.cjs"),
  "utf8"
);
const harthmereCreatureGrounding = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/reconcile-production-live-creature-grounding.cjs"
  ),
  "utf8"
);
const harthmereProductionReconciliation = fs.readFileSync(
  path.join(
    root,
    "scripts/glitch/run-harthmere-production-reconciliation.sh"
  ),
  "utf8"
);
const runBuildChecks = script.slice(script.indexOf("run_build_checks()"));
const pushAndDeploy = script.slice(
  script.indexOf("push_and_deploy()"),
  script.indexOf('if [ "$REDIS_HEALTH_CHECK_ONLY"')
);
const waitForAzureRevisionReady = script.slice(
  script.indexOf("wait_for_azure_revision_ready()"),
  script.indexOf("azure_revision_fqdn()")
);
const restoreAzureTrafficWeights = script.slice(
  script.indexOf("restore_azure_traffic_weights()"),
  script.indexOf("AZURE_TRAFFIC_RESTORE_ARMED=0")
);
const mainFlow = script.slice(
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
    script.includes("--local-rehearsal") &&
    script.includes("run_local_full_deployment_rehearsal") &&
    script.includes("run-harthmere-production-reconciliation.sh") &&
    script.includes('["Anima", 4101]') &&
    script.includes('["Gaia", 4201]') &&
    script.includes("OK ${name} local readiness") &&
    script.includes("OK ElevenLabs local production configuration") &&
    script.includes('KEEP_LOCAL_SMOKE=1'),
  "script exposes a complete local production rehearsal that remains running"
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
    deployWorkflow.includes("uses: ./.github/actions/cached-lfs-pull") &&
    deployWorkflow.includes("timeout-minutes: 20") &&
    deployWorkflow.includes(
      "token: ${{ secrets.BIOMES_DEPENDENCY_GITHUB_TOKEN }}"
    ) &&
    deployWorkflow.includes("npm install -g @bazel/bazelisk"),
  "production workflow uses cached LFS, the shared cached Yarn install, and installs Bazelisk"
);
ok(
  deployWorkflow.includes("Restore production Git LFS assets") &&
    deployWorkflow.includes("cache-prefix: production-lfs") &&
    deployWorkflow.includes(
      "include: public/assets/**,public/models/**,public/hud/**,public/splash/**,public/textures/**,public/pwa/**,public/quests/**,src/galois/**,voxeloo/**"
    ) &&
    cachedLfsAction.includes("restore-keys:") &&
    cachedLfsAction.includes("git lfs checkout") &&
    cachedLfsAction.includes("skipping 'git lfs pull'"),
  "production workflow restores filtered LFS assets from cache before contacting GitHub LFS"
);
ok(
  deployWorkflow.includes("Restore production asset cache") &&
    deployWorkflow.includes("actions/cache/restore@v5") &&
    deployWorkflow.includes("Save production asset cache") &&
    deployWorkflow.includes(
      "refreshed-production-asset-cache.outputs.cache_present"
    ) &&
    deployWorkflow.includes("public/buckets") &&
    deployWorkflow.includes("snapshot_backup.json"),
  "production workflow explicitly restores and saves hydrated snapshot bucket assets"
);
ok(
  deployWorkflow.includes("Restore production compiler cache") &&
    deployWorkflow.includes("actions/cache/restore@v5") &&
    deployWorkflow.includes("Save production compiler cache") &&
    deployWorkflow.includes(
      "refreshed-production-compiler-cache.outputs.cache_present"
    ) &&
    deployWorkflow.includes(".next/cache") &&
    deployWorkflow.includes("node_modules/.cache/webpack"),
  "production workflow explicitly restores and saves Next and server Webpack compiler outputs"
);
ok(
  !deployWorkflow.includes("save-always: true"),
  "production workflow does not use deprecated actions/cache save-always"
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
    cachedYarnAction.includes("Validate restored node_modules cache") &&
    cachedYarnAction.includes("Remove unusable node_modules tree") &&
    cachedYarnAction.includes("run: rm -rf node_modules") &&
    cachedYarnAction.includes("node-modules-v2-") &&
    deployWorkflow.includes('PUPPETEER_SKIP_DOWNLOAD: "1"') &&
    deployWorkflow.includes('ELECTRON_SKIP_BINARY_DOWNLOAD: "1"') &&
    cachedYarnAction.includes(
      "hashFiles('./yarn.lock', './package.json', './.github/actions/cached-yarn-install/action.yml')"
    ) &&
    !cachedYarnAction.includes("restore-keys:") &&
    cachedYarnAction.includes(
      "steps.node_modules-validation.outputs.valid != 'true'"
    ) &&
    !cachedYarnAction.includes("yarn-cache"),
  "shared Yarn install action only reuses exact validated dependency trees, cleans misses, and skips unpackaged browser binaries"
);
ok(
  packageJson.dependencies["uWebSockets.js"] ===
    "https://github.com/uNetworking/uWebSockets.js/archive/refs/tags/v20.31.0.tar.gz" &&
    cachedYarnAction.includes("hashFiles('./yarn.lock', './package.json'") &&
    !fs
      .readFileSync(path.join(root, "yarn.lock"), "utf8")
      .includes("uNetworking/uWebSockets.js.git"),
  "dependency install downloads the pinned uWebSockets release without cloning its multi-gigabyte Git history"
);
ok(
  cachedLfsAction.includes("actions/cache/restore@v5") &&
    cachedLfsAction.includes("actions/cache/save@v5") &&
    cachedLfsAction.includes("Save LFS cache") &&
    cachedLfsAction.includes("Capture LFS cache key") &&
    cachedLfsAction.includes("continue-on-error: true"),
  "shared LFS action explicitly restores and saves Git LFS cache"
);
ok(
  cachedPipAction.includes("actions/cache/restore@v5") &&
    cachedPipAction.includes("actions/cache/save@v5") &&
    cachedPipAction.includes("Save pip install cache") &&
    cachedPipAction.includes("continue-on-error: true"),
  "shared pip action explicitly restores and saves virtualenv cache"
);
ok(
  cachedEslintAction.includes("actions/cache/restore@v5") &&
    cachedEslintAction.includes("cache-hit:") &&
    mergeCiWorkflow.includes("Save eslint cache") &&
    tsEslintCiWorkflow.includes("Save eslint cache"),
  "eslint cache is restored in the shared action and saved after lint populates it"
);
ok(
  bazelAction.includes("actions/cache/restore@v5") &&
    bazelAction.includes("actions/cache/save@v5") &&
    bazelAction.includes("Save Bazel 3rd party deps cache") &&
    bazelAction.includes("continue-on-error: true"),
  "shared Bazel action explicitly restores and saves third-party dependency cache"
);
ok(
  ![
    cachedYarnAction,
    cachedLfsAction,
    cachedPipAction,
    cachedEslintAction,
    bazelAction,
    deployWorkflow,
  ].some((source) => source.includes("actions/cache@v5")),
  "shared and production cache steps use explicit restore/save actions"
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
  runBuildChecks.includes(
    './b test -b -p "src/shared/harthmere/test/harthmere_native_bikkie_items.test.ts"'
  ),
  "script runs the restart-safe native Bikkie overlay regression suite before packaging"
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
  script.includes('BIOMES_BUILD_ID="$build_id"') &&
    nextConfig.includes("process.env.BIOMES_BUILD_ID") &&
    serverWebpackConfig.includes("process.env.BIOMES_BUILD_ID"),
  "production client and server bundles receive the exact Git build id"
);
ok(
  nextConfig.includes("productionBrowserSourceMaps: false") &&
    script.includes("find .next/static -type f -name '*.map' -delete") &&
    script.includes("rm -f public/sw.js.map") &&
    !dockerfile.includes("public/sw.js.map"),
  "production browser source maps are removed before image packaging"
);
ok(
  dockerfile.includes("npm prune --omit=dev --ignore-scripts") &&
    !dockerfile.includes("google-chrome-stable") &&
    dockerfile.includes("apt-get purge -y --auto-remove"),
  "production image excludes test browser, dev dependencies, and build toolchains"
);
ok(
  packageJson.dependencies?.["stream-json"] &&
    !packageJson.devDependencies?.["stream-json"] &&
    packageJson.dependencies?.["spark-md5"] &&
    !packageJson.devDependencies?.["spark-md5"] &&
    dockerfile.includes("'stream-json/streamers/StreamArray', 'spark-md5'"),
  "production image keeps and verifies snapshot runtime dependencies after npm prune"
);
const bundledRuntimeExternals = [
  "@ant-design/icons",
  "@google-cloud/bigquery",
  "@google-cloud/storage",
  "chai",
  "discord.js",
  "node-gzip",
  "octokit",
  "source-map",
  "spark-md5",
  "stream-json",
  "ts-command-line-args",
];
ok(
  bundledRuntimeExternals.every(
    (name) =>
      packageJson.dependencies?.[name] && !packageJson.devDependencies?.[name]
  ) &&
    dockerfile.includes(
      "node scripts/glitch/assert-production-runtime-dependencies.cjs ."
    ),
  "production image resolves every external required by the built server bundles after npm prune"
);
ok(
  serverWebpackConfig.includes('entryPoints["apply-mutable-hotfix"]') &&
    stackRunner.includes('node "$APP_ROOT/dist/apply-mutable-hotfix.js"') &&
    !stackRunner.includes("node -r ts-node/register"),
  "production startup uses bundled maintenance tools without TypeScript runtime dependencies"
);
ok(
  stackRunner.indexOf('"$APP_ROOT/dist/web.js"') <
    stackRunner.indexOf("wait_redis_stream_group 4 chat-delivery"),
  "production web ingress binds before non-web worker readiness checks"
);
ok(
  stackRunner.includes(
    'node --max-old-space-size="$GLITCH_WEB_MAX_OLD_SPACE_MB" "$APP_ROOT/dist/web.js"'
  ) &&
    stackRunner.includes(
      'GLITCH_WEB_MAX_OLD_SPACE_MB="${GLITCH_WEB_MAX_OLD_SPACE_MB:-6144}"'
    ) &&
    script.includes(
      'GLITCH_WEB_MAX_OLD_SPACE_MB="${GLITCH_WEB_MAX_OLD_SPACE_MB:-6144}"'
    ),
  "production web process has a bounded larger V8 heap within the 16Gi replica allocation"
);
ok(
  script.includes("GLITCH_TITLE_TOKEN=secretref:glitch-title-token"),
  "production app uses the Azure Container App title-token secret reference"
);
ok(
  script.includes("ELEVENLABS_API_KEY=secretref:elevenlabs-api-key") &&
    script.includes(
      'ELEVENLABS_MODEL_ID="${ELEVENLABS_MODEL_ID:-eleven_multilingual_v2}"'
    ) &&
    deployWorkflow.includes(
      "ELEVENLABS_API_KEY: ${{ secrets.ELEVENLABS_API_KEY }}"
    ) &&
    deployWorkflow.includes(
      '--secrets "elevenlabs-api-key=$ELEVENLABS_API_KEY"'
    ),
  "production deploy syncs the masked GitHub ElevenLabs secret into the Azure Container App"
);
ok(
  script.includes('AZURE_WEB_TARGET_PORT="${AZURE_WEB_TARGET_PORT:-3000}"') &&
    script.includes('AZURE_MIN_REPLICAS="${AZURE_MIN_REPLICAS:-3}"') &&
    script.includes('AZURE_MAX_REPLICAS="${AZURE_MAX_REPLICAS:-3}"') &&
    deployWorkflow.includes('AZURE_WEB_TARGET_PORT: "3000"') &&
    deployWorkflow.includes('AZURE_MIN_REPLICAS: "3"') &&
    script.includes("DISTRIBUTED_NOTIFIER_KIND=redis") &&
    script.includes("GLITCH_SERVER_CACHE_MODE=redis") &&
    script.includes("PLAYER_MESH_MAX_ACTIVE_COMPUTES=1") &&
    script.includes("PLAYER_MESH_WARMUP_MAX_ACTIVE_COMPUTES=0") &&
    deployWorkflow.includes('AZURE_MAX_REPLICAS: "3"') &&
    script.includes("AZURE_ALLOW_SINGLE_REPLICA") &&
    script.includes("single-replica production deploys are disabled"),
  "production deploy preserves the HA replica posture and requires an explicit single-replica downgrade"
);
ok(
  script.includes(
    "--command ./scripts/glitch/run-glitch-local-game-stack.sh"
  ) && script.includes('--args ""'),
  "production updates replace stale Azure startup command overrides with the role-aware stack runner"
);
ok(
  script.includes("GLITCH_STACK_ROLE=web") &&
    script.includes("GLITCH_ENABLE_ANIMA=0") &&
    script.includes("GLITCH_ENABLE_GAIA=0") &&
    script.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN=0") &&
    stackRunner.includes(
      "GLITCH_STACK_ROLE=web requires GLITCH_ENABLE_ANIMA=0 and GLITCH_ENABLE_GAIA=0"
    ),
  "public production replicas cannot co-locate Anima/Gaia or rebuild terrain during startup"
);
ok(
  script.includes(
    'AZURE_SIMULATION_CONTAINER_APP="${AZURE_SIMULATION_CONTAINER_APP:-biomes-simulation-vnet}"'
  ) &&
    script.includes(
      'AZURE_SIMULATION_WORKLOAD_PROFILE="${AZURE_SIMULATION_WORKLOAD_PROFILE:-d4-prod}"'
    ) &&
    script.includes(
      'AZURE_SIMULATION_MEMORY="${AZURE_SIMULATION_MEMORY:-16Gi}"'
    ) &&
    script.includes("GLITCH_STACK_ROLE=simulation") &&
    script.includes("GLITCH_ENABLE_ANIMA=1") &&
    script.includes("GLITCH_ENABLE_GAIA=1") &&
    script.includes("GLITCH_ANIMA_MAX_OLD_SPACE_MB=2048") &&
    script.includes("GLITCH_GAIA_WASM_MEMORY_MB=4096") &&
    script.includes("GLITCH_STACK_HTTP_READY_WAIT_TRIES=900") &&
    script.includes("deploy_simulation_container_app") &&
    script.includes("--ingress internal"),
  "production deploy provisions an internal D4 simulation app with explicit Anima and Gaia memory budgets"
);
ok(
  stackRunner.includes("simulation-health-server.cjs") &&
    stackRunner.includes(
      'start_bg logic 127.0.0.1 3500 3504 3501 "$APP_ROOT/dist/logic.js"'
    ) &&
    stackRunner.includes("GLITCH_SIMULATION_ROLE_READY anima=1 gaia=1") &&
    simulationHealth.includes("ready ? 200 : 503") &&
    simulationHealth.includes('name: "anima"') &&
    simulationHealth.includes('name: "gaia"') &&
    script.includes("wait_for_simulation_role_ready"),
  "simulation deployment waits for a health endpoint and log marker that require both native workers"
);
ok(
  script.includes("ensure_azure_ingress_target_port") &&
    script.includes("az containerapp ingress update") &&
    script.includes('--target-port "$AZURE_WEB_TARGET_PORT"') &&
    script.includes("properties.configuration.ingress.targetPort"),
  "production deploy reasserts Azure ingress on the public web port"
);
ok(
  script.includes("validate_production_revision_before_traffic") &&
    script.includes("azure_revision_fqdn") &&
    script.includes("validate_game_html_url") &&
    script.includes("returned metrics instead of game HTML") &&
    pushAndDeploy.indexOf("promote_azure_revision_when_ready") <
      pushAndDeploy.indexOf("validate_production_bucket_assets"),
  "production deploy smoke-tests the concrete revision before post-shift validation"
);
ok(
  script.includes("capture_azure_traffic_weights") &&
    script.includes("restore_azure_traffic_weights") &&
    script.includes("AZURE_TRAFFIC_RESTORE_ARMED=1") &&
    script.includes("AZURE_TRAFFIC_RESTORE_ARMED=0") &&
    script.includes("deactivate_stale_azure_revisions"),
  "production deploy can restore previous traffic if validation fails after shifting"
);
ok(
  !waitForAzureRevisionReady.includes("latestReadyRevisionName") &&
    waitForAzureRevisionReady.includes("az containerapp replica list") &&
    waitForAzureRevisionReady.includes("properties.containers[0].ready") &&
    waitForAzureRevisionReady.includes("properties.containers[0].started") &&
    waitForAzureRevisionReady.includes("properties.template.scale.minReplicas"),
  "production deploy requires the configured minimum replicas to be started and ready instead of trusting Azure's stale revision label"
);
ok(
  restoreAzureTrafficWeights.includes("az containerapp revision deactivate") &&
    restoreAzureTrafficWeights.includes("az containerapp revision activate") &&
    restoreAzureTrafficWeights.includes("wait_for_azure_revision_ready"),
  "automatic rollback frees failed-revision capacity, reactivates prior revisions, and waits for readiness"
);
ok(
  pushAndDeploy.indexOf(
    'AZURE_PREVIOUS_TRAFFIC_WEIGHTS="$(capture_azure_traffic_weights)"'
  ) < pushAndDeploy.indexOf('az containerapp update "${update_args[@]}"') &&
    pushAndDeploy.indexOf("AZURE_TRAFFIC_RESTORE_ARMED=1") <
      pushAndDeploy.indexOf('az containerapp update "${update_args[@]}"'),
  "automatic rollback is armed before Azure can replace the serving revision"
);
ok(
  script.includes("az containerapp ingress traffic set") &&
    script.includes('--revision-weight "$revision=100"') &&
    script.includes("az containerapp revision deactivate") &&
    script.includes("properties.active==\\`true\\`"),
  "production deploy pins one ready Azure revision and deactivates stale active revisions after validation"
);
ok(
  script.includes("GLITCH_MUTABLE_HOTFIX_REDIS_KEY") &&
    script.includes("archive_production_mutable_hotfix_manifest()") &&
    script.includes(
      'archive_production_mutable_hotfix_manifest "Azure Container App update"'
    ) &&
    pushAndDeploy.indexOf(
      'archive_production_mutable_hotfix_manifest "Azure Container App update"'
    ) < pushAndDeploy.indexOf("az containerapp update"),
  "production deploy archives and clears stale mutable hotfix manifests before creating a new revision"
);
ok(
  script.includes("GLITCH_CODEX_HOTPATCH_JS") &&
    script.includes("GLITCH_MUTABLE_HOTFIX_MANIFEST_BASE64") &&
    script.includes("GLITCH_MUTABLE_HOTFIX_MANIFEST_URL") &&
    script.includes("GLITCH_PLAYER_MESH_FALLBACK_ON_BUILD_ERROR") &&
    script.includes("--remove-env-vars"),
  "production deploy strips stale startup hotpatch environment before Azure updates"
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
  script.includes("should_directly_push_buildx_image") &&
    script.includes("--push") &&
    script.includes("--load -t") &&
    script.includes('RUN_LOCAL_SMOKE" != "1"'),
  "Docker build pushes directly when local smoke does not need a loaded image"
);
ok(
  script.includes("DOCKER_BUILD_CACHE_FROM") &&
    script.includes("DOCKER_BUILD_CACHE_TO") &&
    script.includes("prepare_docker_build_disk_budget") &&
    script.includes("DOCKER_BUILD_RETRY_WITHOUT_CACHE_ON_ENOSPC") &&
    script.includes("no space left on device|ENOSPC") &&
    script.includes("retrying once without external layer cache") &&
    script.includes("disable_docker_build_layer_cache"),
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
  deployWorkflow.includes("Free runner disk before checkout and build") &&
    deployWorkflow.includes("Guard Docker layer cache disk budget") &&
    deployWorkflow.includes("Prune Docker after image push") &&
    deployWorkflow.includes("MAX_DOCKER_LAYER_CACHE_MB") &&
    deployWorkflow.includes("MIN_DOCKER_BUILD_FREE_MB") &&
    deployWorkflow.includes("MIN_DOCKER_CACHE_EXPORT_FREE_MB") &&
    deployWorkflow.includes(
      "DOCKER_BUILD_CACHE_TO: type=local,dest=/tmp/.buildx-cache-new,mode=min,ignore-error=true"
    ) &&
    deployWorkflow.includes("${{ runner.os }}-buildx-min-") &&
    !deployWorkflow.includes("${{ runner.os }}-buildx-${{") &&
    deployWorkflow.includes("cache_size_mb") &&
    deployWorkflow.includes("above ${MAX_DOCKER_LAYER_CACHE_MB}MB") &&
    deployWorkflow.includes("DOCKER_BUILD_CACHE_TO="),
  "production workflow keeps GitHub runner disk usage bounded during Docker deploys"
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
  script.includes('docker push "$IMAGE"') &&
    script.includes('IMAGE_WAS_PUSHED" != "1"') &&
    script.includes("Production image was already pushed by Docker Buildx"),
  "production upload reuses a local image only when Buildx did not already push it"
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
  script.includes("load_production_redis_aof_health") &&
    script.includes("load_production_redis_snapshot_state") &&
    script.includes("prod_redis_vm_run_script"),
  "deploy batches Azure VM Redis checks to avoid many slow run-command calls"
);
ok(
  mainFlow.indexOf("check_production_image_push_preflight") !== -1 &&
    mainFlow.indexOf("build_image") !== -1 &&
    mainFlow.indexOf("check_production_image_push_preflight") <
      mainFlow.indexOf("build_image"),
  "direct Buildx push performs production preflight before build-and-push"
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
  script.includes(
    'HARTHMERE_WORLD_SYNC_RUNNER_MODE="${HARTHMERE_WORLD_SYNC_RUNNER_MODE:-auto}"'
  ) &&
    script.includes("az containerapp job create") &&
    script.includes("run_azure_world_sync_job") &&
    script.includes("HARTHMERE_PRODUCTION_RECONCILIATION_READY tag=$TAG"),
  "local production deploy runs private-Redis reconciliation in a temporary Azure VNet job"
);
ok(
  script.includes(
    'HARTHMERE_WORLD_SYNC_JOB_CPU="${HARTHMERE_WORLD_SYNC_JOB_CPU:-4.0}"'
  ) &&
    script.includes(
      'HARTHMERE_WORLD_SYNC_JOB_MEMORY="${HARTHMERE_WORLD_SYNC_JOB_MEMORY:-16Gi}"'
    ) &&
    script.includes("--workload-profile-name") &&
    script.includes("delete_azure_world_sync_job"),
  "production reconciliation job has a dedicated D4-sized memory budget and cleanup"
);
ok(
  harthmereProductionReconciliation.includes(
    [
      "audit_extension_terrain",
      "materialize_business_outposts",
      "run_node \"Harthmere ECS and shared-state reconciliation\" \\",
      "  scripts/harthmere/reconcile-production-world-sync.cjs",
      "materialize_connector_route",
    ].join("\n")
  ) &&
    harthmereProductionReconciliation.includes(
      "probe-production-terrain-grounding.cjs"
    ) &&
    harthmereProductionReconciliation.includes(
      "reconcile-production-live-creature-grounding.cjs"
    ),
  "in-VNet reconciliation audits terrain, applies map/ECS migration, writes the connector last, and verifies grounding"
);
ok(
  dockerfile.includes("ts-node@10.9.1") &&
    dockerfile.includes("tsconfig-paths@3.12.0") &&
    dockerfile.includes("typescript@5.9.3") &&
    dockerfile.includes("--prefix /opt/harthmere-maintenance") &&
    harthmereProductionReconciliation.includes(
      'NODE_PATH="/opt/harthmere-maintenance/node_modules'
    ) &&
    dockerfile.includes("run-harthmere-production-reconciliation.sh"),
  "production image packages the narrow TypeScript runtime needed by the VNet reconciliation job"
);
ok(
  script.includes("reconcile_production_world_sync"),
  "production deploy has a named broad world sync reconciliation phase"
);
ok(
  script.includes("seed_production_harthmere_extension_terrain") &&
    script.includes(
      "Skipping additive Harthmere terrain maintenance during an explicit app-only rollout."
    ) &&
    script.includes("az containerapp revision copy") &&
    script.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN=1") &&
    script.includes("BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED=1") &&
    script.includes("--min-replicas 1") &&
    script.includes("--max-replicas 1"),
  "production deploy seeds additive terrain in one isolated maintenance replica"
);
ok(
  pushAndDeploy.indexOf(
    'seed_production_harthmere_extension_terrain "$latest_revision"'
  ) <
    pushAndDeploy.indexOf(
      'promote_azure_revision_when_ready "$latest_revision"'
    ),
  "production deploy completes terrain seeding before promoting web traffic"
);
ok(
  script.includes("audit-production-extension-terrain.cjs") &&
    script.includes("wait_for_production_harthmere_extension_terrain_audit") &&
    script.includes("HARTHMERE_TERRAIN_AUDIT_POLLS"),
  "production deploy blocks promotion on missing foundation or flat-surface shards"
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
  harthmereWorldSync.includes("harthmereSnapshotCombatNpcSeedIds") &&
    harthmereWorldSync.includes("SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS") &&
    harthmereWorldSync.includes(
      "no muck monster seed resolves into a safe zone"
    ),
  "production world sync upserts snapshot combat NPCs and rejects Grove-safe-zone Muckers"
);
ok(
  harthmereTerrainAudit.includes("harthmereExtensionFoundationShardSpecs") &&
    harthmereTerrainAudit.includes("emptyFoundationCount") &&
    harthmereTerrainAudit.includes("surfaceHoleShardCount") &&
    harthmereTerrainAudit.includes("retiredTerrainCount"),
  "production terrain audit verifies foundation content, flat support, and retired cleanup"
);
ok(
  script.includes("run_production_live_creature_grounding_reconcile") &&
    script.includes("reconcile-production-live-creature-grounding.cjs") &&
    harthmereCreatureGrounding.includes("loadCreatureRows") &&
    harthmereCreatureGrounding.includes("bodyCanStandAt") &&
    harthmereCreatureGrounding.includes("verifyReadback") &&
    harthmereCreatureGrounding.includes("respawn_anchor_not_grounded"),
  "production deploy repairs real persisted creature bodies, footprints, and respawn anchors"
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
    'force_production_redis_bgsave "post-deploy world sync and grounding reconciliation"'
  ),
  "production deploy persists reconciled and grounded authored content with a forced RDB save"
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
