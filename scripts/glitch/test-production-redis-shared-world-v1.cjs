#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const stack = fs.readFileSync(
  path.join(root, "scripts/glitch/run-glitch-local-game-stack-v92.sh"),
  "utf8"
);
const dockerfile = fs.readFileSync(path.join(root, "Dockerfile.biomes"), "utf8");
const playerMeshRoute = fs.readFileSync(
  path.join(root, "src/pages/api/assets/player_mesh.glb.ts"),
  "utf8"
);
const config = fs.readFileSync(
  path.join(root, "src/server/shared/config.ts"),
  "utf8"
);
const shim = fs.readFileSync(path.join(root, "src/server/shim/main.ts"), "utf8");
const firebase = fs.readFileSync(
  path.join(root, "src/client/game/firebase.ts"),
  "utf8"
);
const serviceWorker = fs.readFileSync(
  path.join(root, "src/client/service_worker.ts"),
  "utf8"
);

let failed = false;
function ok(condition, message) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK ${message}`);
  }
}

ok(
  dockerfile.includes("GLITCH_REDIS_MODE=external") &&
    dockerfile.includes("GLITCH_POPULATE_SNAPSHOT_REDIS=0") &&
    dockerfile.includes("GLITCH_REQUIRE_SNAPSHOT_REDIS=1"),
  "production image requires shared external Redis and does not auto-import snapshots"
);

ok(
  !dockerfile.includes("voxeloo-wheel") &&
    !dockerfile.includes("bazelisk") &&
    !dockerfile.includes("python -m pip wheel --no-cache-dir --no-deps") &&
    !dockerfile.includes("pygltflib") &&
    !dockerfile.includes("python3-pip") &&
    !dockerfile.includes("python3-venv"),
  "production image does not add unused mesh-builder tooling"
);

ok(
  playerMeshRoute.includes("shouldUseStaticPlayerMeshFallback") &&
    playerMeshRoute.includes("Using packaged player body mesh fallback for Glitch runtime") &&
    playerMeshRoute.includes('process.env.GLITCH_RUNTIME === "1"'),
  "production player mesh uses packaged fallback without starting unavailable local generation"
);

ok(
  stack.includes("snapshot_redis_lock_key") &&
    stack.includes('redis_cli_runtime set "$lock_key" "$lock_value" NX EX') &&
    stack.includes("GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1") &&
    stack.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1"),
  "snapshot Redis bootstrap is locked and explicit for production"
);

ok(
  stack.includes("refusing to populate external production Redis from normal app startup") &&
    stack.includes("refusing to flush external production Redis"),
  "normal app startup cannot flush or populate production Redis"
);

ok(
  stack.includes('BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="${BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN:-0}"') &&
    stack.includes('BIOMES_START_IN_HARTHMERE="${BIOMES_START_IN_HARTHMERE:-0}"') &&
    stack.includes('BIOMES_FORCE_LOCAL_DEV_TOWN="${BIOMES_FORCE_LOCAL_DEV_TOWN:-0}"'),
  "runtime defaults to the shared snapshot Grove without seeding Harthmere"
);

ok(
  config.includes("[496, 70, -126]") &&
    config.includes("Snapshot/Grove starter fountain"),
  "default player start positions are the live Grove fountain"
);

ok(
  shim.includes("GLITCH_SNAPSHOT_NPC_GROUNDING_REPAIR_VERSION_V145") &&
    shim.includes("repairKnownSnapshotNpcGroundingV145(worldApi)") &&
    shim.includes("Repaired known snapshot NPC grounding from production perf report"),
  "known floating/buried NPCs are repaired server-side"
);

ok(
  firebase.includes("firebaseDisabledForRuntime") &&
    serviceWorker.includes("Firebase push disabled for Glitch/no-GCP runtime."),
  "Firebase push is disabled in Glitch/no-GCP runtime"
);

if (failed) {
  process.exit(1);
}
console.log("OK production Redis/shared-world guardrail v1");
