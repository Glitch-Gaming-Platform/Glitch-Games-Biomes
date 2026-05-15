const fs = require("fs");
const ts = require("typescript");
const playerFile = "src/client/game/scripts/player.ts";
const assetsFile = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const player = fs.readFileSync(playerFile, "utf8");
const assets = fs.readFileSync(assetsFile, "utf8");

function check(label, ok) {
  if (ok) {
    console.log(`OK ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    failed = true;
  }
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

let failed = false;
check("assets parser clean", parseOk(assetsFile));
check("player parser clean", parseOk(playerFile));
check("v2 asset profile marker exists", assets.includes("HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V2"));
check("visual-only profile exists", assets.includes('collisionProfile = "visual_only"') && assets.includes("playerCanWalkThrough = true") && assets.includes("npcCanWalkThrough = true"));
check("windows/signs/tiny props are not player blockers", assets.includes('name.includes("window")') && assets.includes('name.includes("sign")') && assets.includes('name.includes("coin")'));
check("fountain/well profile is smaller and jumpable", assets.includes('asset === "fountain_round"') && assets.includes('halfX * 0.52') && assets.includes('collisionProfile = "low_jumpable_landmark"'));
check("bench collision is low and soft", assets.includes('name.includes("bench")') && assets.includes('collisionProfile = "low_jumpable_seating"'));
check("v2 player collision version exists", player.includes('"harthmere-town-collision-profiles-v2"'));
check("player default radius reduced", player.includes("DEFAULT_RADIUS = 0.11") && player.includes("MIN_RADIUS = 0.04"));
check("profile-specific effective radius exists", player.includes("radiusScale") && player.includes("effectiveRadius"));
check("jumpable low object clearance exists", player.includes("harthmereLocalDevHorizontalJumpClearsShape") && player.includes("clearByStep") && player.includes("clearWhileRising"));
check("stats include limits/effective radius for mapping", player.includes("effectiveRadius: hit.effectiveRadius") && player.includes("limitX: hit.limitX"));

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
