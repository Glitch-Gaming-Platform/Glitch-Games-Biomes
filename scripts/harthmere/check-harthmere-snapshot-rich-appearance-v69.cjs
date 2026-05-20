#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function ok(name, condition) {
  if (!condition) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${name}`);
  }
}

const playerMesh = read("src/client/game/resources/player_mesh.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const webMain = read("src/server/web/main.ts");
const webConfig = read("src/server/web/config.ts");
const dataSnapshot = read("scripts/b/data_snapshot.py");

ok("snapshot rich appearance marker exists", playerMesh.includes("SNAPSHOT_RICH_NPC_APPEARANCE_V69"));
ok("snapshot NPC mesh bypasses Harthmere id body URL", playerMesh.includes("makeSnapshotPlayerLikeAppearanceMesh") && playerMesh.includes("undefined\n  );"));
ok("snapshot NPC fallback wearables include top/bottoms/feet", playerMesh.includes("BikkieIds.top") && playerMesh.includes("BikkieIds.bottoms") && playerMesh.includes("BikkieIds.feet"));
ok("NPC renderer imports snapshot player-like mesh helper", npcs.includes("makeSnapshotPlayerLikeAppearanceMesh"));
ok("NPC renderer prefers rich snapshot mesh before fallback", npcs.includes("SNAPSHOT_RICH_NPC_APPEARANCE_V69 makeNpcMesh") && npcs.includes("await makeSnapshotPlayerLikeAppearanceMesh(deps, id)"));
ok("asset server can be enabled for snapshot mode", webMain.includes("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER") && webMain.includes("allowSnapshotAssetServer"));
ok("assetServerMode defaults to lazy when enabled", webConfig.includes("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER") && webConfig.includes('"lazy"'));
ok("data snapshot enables rich NPC appearance", dataSnapshot.includes("BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE") && dataSnapshot.includes("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER"));

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("v69 snapshot rich NPC appearance check passed");
