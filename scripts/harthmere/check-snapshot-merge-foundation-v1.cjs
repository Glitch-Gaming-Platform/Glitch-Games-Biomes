#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const repo = process.cwd();
let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    failed = true;
  }
}
function read(rel) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}
function fnBody(src, name) {
  const marker = `function ${name}()`;
  const start = src.indexOf(marker);
  if (start < 0) return "";
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const dataSnapshot = read("scripts/b/data_snapshot.py");
ok(dataSnapshot.includes("data-snapshot-2026-05-16/biomes_data_snapshot.tar.gz"), "data_snapshot.py points at the 2026-05-16 GitHub snapshot release");
ok(dataSnapshot.includes("BIOMES_DATA_SNAPSHOT_URL"), "data_snapshot.py allows BIOMES_DATA_SNAPSHOT_URL override");
ok(dataSnapshot.includes("BIOMES_DATA_SNAPSHOT_SHA256"), "data_snapshot.py allows BIOMES_DATA_SNAPSHOT_SHA256 override");
ok(dataSnapshot.includes("ac211539b14b29d2a07a405f6b763583722666319d2aa9bf9ca056aad4180033"), "data_snapshot.py pins expected release SHA-256");
ok(dataSnapshot.includes("def sha256_file(path: str):"), "data_snapshot.py has SHA-256 file verifier");
ok(dataSnapshot.includes('"--fail"') && dataSnapshot.includes('"--location"') && dataSnapshot.includes('"--show-error"'), "download uses curl fail/redirect/error flags");
ok(dataSnapshot.includes("Downloaded data snapshot failed SHA-256 verification"), "download fails on snapshot SHA mismatch");
ok(dataSnapshot.includes("SKIP_MISSING_ASSET_CHECK"), "local emergency SKIP_MISSING_ASSET_CHECK escape hatch is preserved");

const assetVersionsPath = path.join(repo, "src/galois/js/interface/gen/asset_versions.json");
const assetVersionsRaw = fs.readFileSync(assetVersionsPath);
const assetVersionsHash = crypto.createHash("sha256").update(assetVersionsRaw).digest("hex");
ok(assetVersionsHash === "4224d0c1cb5de36e70231a790dc5fc10d5f81b6f01dce010abc670715a1dc74d", "asset_versions.json matches the 2026-05-16 snapshot source");
const assetVersions = JSON.parse(assetVersionsRaw.toString("utf8"));
ok(assetVersions && assetVersions.paths && Object.keys(assetVersions.paths).length === 2769, "snapshot asset_versions.json has 2769 static asset paths");

const staticHostPath = path.join(repo, "src/galois/js/interface/gen/static_asset_host.json");
if (fs.existsSync(staticHostPath)) {
  const staticHost = read("src/galois/js/interface/gen/static_asset_host.json");
  ok(staticHost.includes("/buckets/biomes-static/"), "local static asset host remains /buckets/biomes-static/");
}

const players = read("src/server/logic/utils/players.ts");
const playerSpawnBody = fnBody(players, "shouldUseLocalDevStarterTownSpawn");
ok(playerSpawnBody.includes('BIOMES_START_IN_HARTHMERE === "1"'), "player spawn uses explicit BIOMES_START_IN_HARTHMERE flag");
ok(!playerSpawnBody.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN"), "player spawn no longer follows generic BIOMES_CREATE_LOCAL_DEV_TERRAIN default");
ok(players.includes("LOCAL_DEV_STARTER_TOWN_START_POSITIONS"), "Harthmere start positions are preserved for explicit opt-in");

const shim = read("src/server/shim/main.ts");
const shouldSeedBody = fnBody(shim, "shouldSeedLocalDevTerrain");
ok(shouldSeedBody.includes('BIOMES_FORCE_LOCAL_DEV_TOWN === "1"'), "shim local-dev seed requires explicit BIOMES_FORCE_LOCAL_DEV_TOWN");
ok(shouldSeedBody.includes('BIOMES_CREATE_LOCAL_DEV_TERRAIN !== "0"'), "shim still honors BIOMES_CREATE_LOCAL_DEV_TERRAIN=0 safety switch");
const extraTownOffsetPatchInstalled = shim.includes("HARTHMERE_EXTRA_TOWN_OFFSET_V1");
if (extraTownOffsetPatchInstalled) {
  ok(shouldSeedBody.includes('BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1"'), "foundation seed guard now allows explicit extra-town after coordinate offset patch");
} else {
  ok(!shouldSeedBody.includes("BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN"), "foundation patch does not enable extra-town seed before coordinate offset patch");
}

const observer = read("src/server/sync/subscription/game_observer.ts");
const eagerBody = fnBody(observer, "shouldEagerBootstrapLocalDevWorld");
ok(eagerBody.includes('BIOMES_FORCE_LOCAL_DEV_TOWN === "1"'), "observer eager bootstrap is limited to explicit forced local-dev world");
ok(eagerBody.includes('SKIP_PROD_LOAD === "true"'), "observer eager bootstrap stays scoped to local snapshot-recovery boot");

const playerAnimations = read("src/client/game/util/player_animations.ts");
ok(playerAnimations.includes("HARTHMERE_BODY_WEAPON_ALIGNED_CLIPS_VERSION_V8"), "Glitch/Harthmere animation work remains present");
ok(playerAnimations.includes('walk: { fileAnimationName: "Walking" }'), "snapshot walking clip remains the base locomotion clip");
ok(playerAnimations.includes('idle: { fileAnimationName: "Idle" }'), "snapshot idle clip remains the base idle clip");
ok(playerAnimations.includes('run: { fileAnimationName: "Running" }'), "snapshot running clip remains the base run clip");

if (failed) {
  console.error("snapshot merge foundation v1 check failed");
  process.exit(1);
}
console.log("snapshot merge foundation v1 check passed");
