const fs = require("fs");
const ts = require("typescript");
const file = "src/client/game/scripts/player.ts";
const src = fs.readFileSync(file, "utf8");
const checks = [
  ["bridge still exists", "HARTHMERE_LOCAL_DEV_PLAYER_TOWN_COLLISION_VERSION"],
  ["disabled-by-default marker exists", "HARTHMERE_LOCAL_DEV_PLAYER_TOWN_COLLISION_DISABLED_BY_DEFAULT_V1"],
  ["raw bridge call is guarded by opt-in flag", "__harthmereEnablePlayerTownCollision"],
  ["disabled stats helper exists", "markHarthmereLocalDevTownCollisionDisabledByDefault"],
];
let ok = true;
for (const [label, needle] of checks) {
  if (!src.includes(needle)) {
    console.error(`FAIL ${label}`);
    ok = false;
  } else {
    console.log(`OK ${label}`);
  }
}
if (src.includes("intersectLocalDevHarthmereTownCollision([v0, v1], fn);\n") && !src.includes("__harthmereEnablePlayerTownCollision")) {
  console.error("FAIL raw collision call appears unguarded");
  ok = false;
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
