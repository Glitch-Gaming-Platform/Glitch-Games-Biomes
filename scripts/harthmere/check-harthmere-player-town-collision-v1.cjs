const fs = require("fs");
const ts = require("typescript");
const path = require("path");

const root = process.argv[2] || process.cwd();
const target = path.join(root, "src/client/game/scripts/player.ts");
if (!fs.existsSync(target)) {
  console.error(`Missing ${target}`);
  process.exit(1);
}
const src = fs.readFileSync(target, "utf8");
const checks = [
  ["version marker exists", src.includes("HARTHMERE_LOCAL_DEV_PLAYER_TOWN_COLLISION_VERSION")],
  ["renderer obstacle global is consumed", src.includes("__harthmereNpcCollisionObstacles")],
  ["player physics intersect bridge is installed", src.includes("intersectLocalDevHarthmereTownCollision([v0, v1], fn);")],
  ["local-dev guard prevents production behavior", src.includes("process.env.NODE_ENV === \"production\"")],
  ["debug stats global exists", src.includes("__harthmerePlayerTownCollisionStats")],
];
let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

const sf = ts.createSourceFile(target, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (sf.parseDiagnostics.length) {
  failed = true;
  for (const d of sf.parseDiagnostics) {
    const p = sf.getLineAndCharacterOfPosition(d.start || 0);
    console.error(`${target}:${p.line + 1}:${p.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  }
} else {
  console.log("OK TypeScript parser accepts player.ts");
}

console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
