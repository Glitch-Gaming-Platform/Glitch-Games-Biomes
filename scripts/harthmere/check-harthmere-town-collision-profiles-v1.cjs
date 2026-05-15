const fs = require("fs");
const ts = require("typescript");
const playerFile = "src/client/game/scripts/player.ts";
const assetsFile = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const player = fs.readFileSync(playerFile, "utf8");
const assets = fs.readFileSync(assetsFile, "utf8");
const checks = [
  ["collision profiles marker exists", player.includes("harthmere-town-collision-profiles-v1")],
  ["player radius is smaller/tunable", player.includes("__harthmereHorizontalPlayerTownCollisionRadius")],
  ["vertical range check exists", player.includes("getHarthmereLocalDevHorizontalPlayerVerticalRange")],
  ["jumpable low-object handling exists", player.includes("shape.jumpable && verticalRange.movingUp")],
  ["player resolver still preserves Y", player.includes("return [resolved[0], desiredPosition[1], resolved[2]]")],
  ["renderer exports collision profile obstacle fields", assets.includes("HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V1")],
  ["renderer exports playerHalfX/playerHalfZ", assets.includes("playerHalfX: obstacle.playerHalfX") && assets.includes("playerHalfZ: obstacle.playerHalfZ")],
  ["renderer exports minY/maxY", assets.includes("minY: obstacle.minY") && assets.includes("maxY: obstacle.maxY")],
  ["renderer exports player/NPC collision attributes", assets.includes("collisionProfile: obstacle.collisionProfile") && assets.includes("playerCanWalkThrough: obstacle.playerCanWalkThrough") && assets.includes("npcCanWalkThrough: obstacle.npcCanWalkThrough")],
  ["player collision skips pass-through profiles", player.includes("obstacle.playerCanWalkThrough === true")],
  ["fountain is low jumpable shape", assets.includes("asset === \"fountain_round\"") && assets.includes("jumpable = true")],
];
let ok = true;
for (const [label, passed] of checks) {
  console.log(`${passed ? "OK" : "FAIL"} ${label}`);
  if (!passed) ok = false;
}
for (const file of [playerFile, assetsFile]) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics.length) {
    ok = false;
    for (const d of sf.parseDiagnostics) {
      const p = sf.getLineAndCharacterOfPosition(d.start || 0);
      console.error(`${file}:${p.line + 1}:${p.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\\n")}`);
    }
  } else {
    console.log(`OK TypeScript parser accepts ${file}`);
  }
}
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
