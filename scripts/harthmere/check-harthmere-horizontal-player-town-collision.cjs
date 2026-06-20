const fs = require("fs");
const ts = require("typescript");
const file = "src/client/game/scripts/player.ts";
const src = fs.readFileSync(file, "utf8");
const checks = [
  ["horizontal collision version marker exists", "HARTHMERE_LOCAL_DEV_HORIZONTAL_PLAYER_TOWN_COLLISION_VERSION"],
  ["uses renderer obstacle global", "__harthmereNpcCollisionObstacles"],
  ["horizontal resolver exists", "maybeResolveLocalDevHarthmereHorizontalTownPosition"],
  ["resolver is applied after edge clamp", "const townSafePosition = maybeResolveLocalDevHarthmereHorizontalTownPosition"],
  ["resolver does not alter Y", "return [resolved[0], desiredPosition[1], resolved[2]]"],
  ["debug stats global exists", "__harthmereHorizontalPlayerTownCollisionStats"],
  ["vertical bridge is opt-in if present", src.includes("HARTHMERE_LOCAL_DEV_PLAYER_TOWN_COLLISION_VERSION") ? "__harthmereEnablePlayerTownCollision" : "maybeResolveLocalDevHarthmereHorizontalTownPosition"],
];
let ok = true;
for (const [label, needle] of checks) {
  const passed = src.includes(needle);
  console.log(`${passed ? "OK" : "FAIL"} ${label}`);
  if (!passed) ok = false;
}
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (sf.parseDiagnostics.length) {
  ok = false;
  for (const d of sf.parseDiagnostics) {
    const p = sf.getLineAndCharacterOfPosition(d.start || 0);
    console.error(`${file}:${p.line + 1}:${p.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\\n")}`);
  }
} else {
  console.log("OK TypeScript parser accepts player.ts");
}
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
