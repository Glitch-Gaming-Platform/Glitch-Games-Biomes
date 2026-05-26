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

ok(script.includes("redis:7-alpine"), "local smoke starts a local Redis container");
ok(script.includes("GLITCH_POPULATE_SNAPSHOT_REDIS=1"), "local smoke explicitly bootstraps only the local Redis snapshot");
ok(script.includes("GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1"), "local smoke uses the explicit bootstrap role");
ok(script.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1"), "local smoke allows flush only for the local Redis container");
ok(script.includes("GLITCH_IDLE_SESSION_MS"), "local smoke sets the short idle-session window expected by the auth smoke test");
ok(script.includes("wait_for_http"), "script waits for the local production image before testing");
ok(script.includes("node scripts/glitch/test-glitch-container.cjs"), "script runs the Glitch container smoke test locally");
ok(script.includes("node scripts/glitch/assert-glitch-build-artifacts-current.cjs ."), "script rejects stale build artifacts before Docker packaging");
ok(script.includes("check-harthmere-mission-critical-suite-v112.cjs"), "script runs the Grove mission-critical suite");
ok(script.includes("test-glitch-prod-bucket-asset-proxy-v146.cjs"), "script runs the production asset proxy check");
ok(script.includes("test-glitch-player-mesh-runtime-v144.cjs"), "script runs the production player mesh check");
ok(script.includes("test-production-redis-shared-world-v1.cjs"), "script runs the shared production Redis guardrail");
ok(script.includes("test-harthmere-third-party-combat-ai-production-hardening-v1.cjs"), "script runs hostile combat AI hardening");
ok(script.includes("NEXT_PUBLIC_GLITCH_SYNC_BASE_URL=\"$PROD_ORIGIN\""), "Next build bakes the production web origin");
ok(script.includes("--platform \"$DOCKER_PLATFORM\""), "Docker build is production-platform aware");
ok(script.includes("--load"), "Docker build loads the tested image locally before push");
ok(!/^\s*az acr build\b/m.test(script), "script avoids expensive remote ACR source uploads");
ok(script.includes("docker push \"$IMAGE\""), "production upload reuses the already-smoked local image");
ok(script.includes("PUSH_PRODUCTION=0"), "production push is opt-in");
ok(script.includes("--push"), "script exposes an explicit push flag");
ok(script.includes("GLITCH_POPULATE_SNAPSHOT_REDIS=0"), "production app startup does not repopulate shared Redis");
ok(script.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0"), "production app startup cannot flush shared Redis");
ok(script.includes("REDIS_HOST=\"$PROD_REDIS_HOST\""), "production update uses the shared Redis host");
ok(script.includes("10.0.0.12"), "production Redis default is the private shared-world Redis VM");
ok(script.includes("BIOMES_PLAYER_START_POSITION=484.24980838010384,53,-207.51197432867897"), "production update keeps the requested Grove start coordinate");

if (failed) {
  process.exit(1);
}
console.log("OK production deploy local Redis smoke script v1");
