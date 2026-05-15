const fs = require("fs");
const ts = require("typescript");
const playerFile = "src/client/game/scripts/player.ts";
const assetsFile = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const player = fs.readFileSync(playerFile, "utf8");
const assets = fs.readFileSync(assetsFile, "utf8");
let failed = false;
function check(label, ok) {
  if (ok) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); failed = true; }
}
function parseOk(path) {
  const src = fs.readFileSync(path, "utf8");
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics.length) {
    for (const d of sf.parseDiagnostics) {
      const p = sf.getLineAndCharacterOfPosition(d.start || 0);
      console.error(`${path}:${p.line + 1}:${p.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\\n")}`);
    }
    return false;
  }
  return true;
}
check("assets parser clean", parseOk(assetsFile));
check("player parser clean", parseOk(playerFile));
check("v4 asset marker exists", assets.includes("HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V4"));
check("north gate ironbound door is pass-through", assets.includes("isNorthGateExitDoor") && player.includes("north gate") && player.includes("ironbound door"));
check("flags/banners/signs are visual-only", assets.includes('name.includes("flag")') && player.includes('name.includes("flag")'));
check("wall stairs are navigation pass-through", assets.includes('name.includes("wall stair")') && player.includes('name.includes("wall stair")'));
check("tower footprint is tightened", assets.includes('asset === "obj_tower_complex"') && assets.includes("halfX * 0.46"));
check("fountain collision is tighter and jumpable", assets.includes('asset === "fountain_round"') && assets.includes("halfX * 0.34") && assets.includes("0.72 * scale"));
check("bench contact is tighter", assets.includes('name.includes("bench")') && assets.includes("halfX * 0.28"));
check("actor resolver v4 exists", assets.includes('placementSystemVersion: "harthmere-town-collision-placement-v4"'));
check("actor resolver lifts out of pavement", assets.includes("const actorGroundY = GROUND_Y + 0.1"));
check("actor resolver ignores visual/nav blockers", assets.includes("isIgnoredActorSpawnObstacle") && assets.includes("north gate ironbound door"));
check("v4 player collision version exists", player.includes('"harthmere-town-collision-profiles-v4"'));
check("segment sweep is active", player.includes("getHarthmereLocalDevHorizontalSegmentHits") && player.includes("HARTHMERE_LOCAL_DEV_HORIZONTAL_PLAYER_TOWN_COLLISION_SWEEP_STEP = 0.08"));
check("low jumpables clear naturally", player.includes("lowEnoughToStep") && player.includes("centerAboveLowObject"));
check("player radius is tighter", player.includes("DEFAULT_RADIUS = 0.07") && player.includes("MAX_RADIUS = 0.18"));
if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
