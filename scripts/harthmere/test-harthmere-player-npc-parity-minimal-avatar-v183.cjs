#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const assetsPath = path.join(root, "src/shared/api/assets.ts");
const deployPath = path.join(root, "scripts/glitch/deploy-production-local-redis-smoke-v1.sh");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK    ${message}`);
}

const player = read(playerPath);
const assets = read(assetsPath);
const deploy = fs.existsSync(deployPath) ? read(deployPath) : "";

ok(/HARTHMERE_PLAYER_NPC_PARITY_MINIMAL_AVATAR_VERSION_V183/.test(player),
  "player mesh declares the v183 NPC-parity minimal avatar version");
ok(/function shouldUseHarthmerePlayerNpcParityMinimalAvatarV183\(\)\s*{\s*return true;\s*}/s.test(player),
  "v183 minimal avatar mode is enabled by default");
ok(/harthmerePlayerNpcParityMinimalAvatarVersion/.test(player),
  "player mesh records v183 minimal avatar metadata on the root");
ok(/stripsGeneratedPlayerOverlayShell:\s*true/.test(player),
  "v183 policy strips the generated player overlay shell");
ok(/stripsPlayerOnlySimpleFaceOverlay:\s*true/.test(player),
  "v183 policy strips the player-only simple face overlay");
ok(/stripsPlayerOnlyModularClothingRuntime:\s*true/.test(player),
  "v183 policy strips the player-only modular clothing runtime");
ok(/stripsPlayerOnlyUniqueEnhancements:\s*true/.test(player),
  "v183 policy strips player-only unique trinket enhancements");
ok(/stripsPlayerOnlyScabbardShieldQuiverStaffPolish:\s*true/.test(player),
  "v183 policy strips extra scabbard/shield/quiver/staff polish");
ok(/keepsRuntimeWeaponAttachment:\s*true/.test(player),
  "v183 policy explicitly keeps the weapon attachment system");
ok(/coerceHarthmerePlayerObjectMaterialsToBasePass\(playerAnimatedMesh\.three\);[\s\S]*const itemAttachment = new ItemAttachment/s.test(player),
  "v183 early return keeps base-pass material coercion and ItemAttachment");
ok(/return makeDisposable\([\s\S]*itemAttachment,[\s\S]*itemAttachment\.dispose\(\);[\s\S]*\);/s.test(player),
  "v183 early return disposes the kept item/weapon attachment cleanly");

const versionMatch = assets.match(/ASSET_EXPORTS_SERVER_VERSION\s*=\s*(\d+)/);
ok(versionMatch && Number(versionMatch[1]) >= 57,
  "asset export version is bumped to invalidate cached pre-v183 player GLBs");

ok(!deploy || deploy.includes("test-harthmere-player-npc-parity-minimal-avatar-v183.cjs"),
  "deploy source guardrails include the v183 minimal avatar test");

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
