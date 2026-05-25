#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const requiredMarkers = [
  ["src/server/bikkie/main.ts", "Skipping Google asset mirror for Glitch/no-cloud runtime."],
  ["src/server/bikkie/main.ts", "Skipping BikkieAssetUpdater for Glitch/no-cloud runtime."],
  ["src/server/bikkie/main.ts", "Skipping production biscuit bake for Glitch/no-cloud runtime."],
  ["src/server/shared/bootstrap/sync.ts", "Skipping SyncBootstrap prod/gcloud load for Glitch/no-cloud runtime."],
  ["src/client/game/firebase.ts", "firebaseDisabledForRuntime"],
  ["src/client/service_worker.ts", "Firebase push disabled for Glitch/no-GCP runtime."],
  ["src/client/game/context_managers/push_manager.ts", "Skipping Firebase push registration for Glitch/no-GCP runtime."],
];

let failed = false;

for (const [rel, marker] of requiredMarkers) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${rel}`);
    failed = true;
    continue;
  }
  const s = fs.readFileSync(p, "utf8");
  if (!s.includes(marker)) {
    console.error(`MISSING MARKER ${rel}: ${marker}`);
    failed = true;
  }
}

const bikkie = fs.readFileSync(path.join(root, "src/server/bikkie/main.ts"), "utf8");
if (/process\.env\.NODE_ENV === "production"\s*\|\|\s*process\.env\.MIRROR_ASSETS/.test(bikkie) && !bikkie.includes("isGlitchNoCloudRuntime()")) {
  console.error("registerMirror can still run in Glitch runtime");
  failed = true;
}

const syncBootstrap = fs.readFileSync(path.join(root, "src/server/shared/bootstrap/sync.ts"), "utf8");
if (!syncBootstrap.includes("return [[], []];")) {
  console.error("SyncBootstrap no-cloud skip must return the tuple shape shim expects");
  failed = true;
}

if (failed) process.exit(1);
console.log("OK no Google/Firebase/BigQuery runtime blockers for Glitch no-cloud mode v1");
