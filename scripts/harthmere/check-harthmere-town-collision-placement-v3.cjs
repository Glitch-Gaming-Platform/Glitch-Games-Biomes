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
check("v3 asset marker exists", assets.includes("HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V3"));
check("navigation pass-through profile exists", assets.includes("pass_through_navigation") && assets.includes("town exit") && assets.includes("front door"));
check("fountain collision tighter and jumpable", assets.includes('asset === "fountain_round"') && assets.includes("halfX * 0.42") && assets.includes('collisionProfile = "low_jumpable_landmark"'));
check("benches are low soft seating", assets.includes('name.includes("bench")') && assets.includes('collisionProfile = "low_jumpable_seating"'));
check("actor spawn resolver samples body footprint", assets.includes("actorRadius") && assets.includes("body_inside_collision") && assets.includes("placement_spawn_unresolved"));
check("actor resolver snaps to GROUND_Y", assets.includes("Math.abs(startY - GROUND_Y) > 0.03") && assets.includes("[x, GROUND_Y, z]"));
check("v3 player collision version exists", player.includes('"harthmere-town-collision-profiles-v3"'));
check("segment sweep exists", player.includes("getHarthmereLocalDevHorizontalSegmentHits") && player.includes("HARTHMERE_LOCAL_DEV_HORIZONTAL_PLAYER_TOWN_COLLISION_SWEEP_STEP"));
check("pass-through obstacles ignored by player", player.includes("harthmereLocalDevHorizontalObstacleIsNavigationPassThrough"));
check("low jumpable objects clear more naturally", player.includes("lowObjectWalkover") && player.includes("clearWhileRising"));
check("stats include sweep debug", player.includes("segmentSamples") && player.includes("blockedAtSample"));

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
