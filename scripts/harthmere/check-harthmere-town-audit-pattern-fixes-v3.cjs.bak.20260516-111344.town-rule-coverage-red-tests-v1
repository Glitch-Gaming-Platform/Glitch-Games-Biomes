#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const repo = process.argv[2] || process.cwd();
const file = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["pattern fixes version marker exists", /HARTHMERE_TOWN_AUDIT_PATTERN_FIXES_VERSION = "harthmere-town-audit-pattern-fixes-v3"/.test(src)],
  ["tiny FBX food scale caps exist", /HARTHMERE_TINY_FBX_FOOD_SCALE_CAPS/.test(src)],
  ["food apple default is tiny", /food_apple", "fbx\/props\/food\/quaternius_ultimate_food\/Apple\.fbx", 0\.006\)/.test(src)],
  ["food fish default is tiny", /food_fish", "fbx\/props\/food\/quaternius_ultimate_food\/Fish\.fbx", 0\.004\)/.test(src)],
  ["P() normalizes authored prop scale", /const normalizedScale = normalizeHarthmerePropPlacementScale\(asset, scale\);/.test(src)],
  ["P() passes normalized scale to metadata", /scale: normalizedScale,\n\s*\}\);/.test(src)],
  ["P() stores normalized scale on placement", /rot,\n\s*scale: normalizedScale,/.test(src)],
  ["town authored wander is frozen", /Until Harthmere has real\n\s*\/\/ route graphs/.test(src) && /if \(!isWilds\) \{\n\s*return undefined;\n\s*\}/.test(src)],
];

let ok = true;
for (const [name, passed] of checks) {
  console.log(`${passed ? "OK " : "FAIL"} ${name}`);
  ok = ok && passed;
}

const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (sf.parseDiagnostics.length) {
  ok = false;
  for (const d of sf.parseDiagnostics) {
    const p = sf.getLineAndCharacterOfPosition(d.start || 0);
    console.error(`${file}:${p.line + 1}:${p.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\\n")}`);
  }
} else {
  console.log("OK TypeScript parser accepts harthmere_assets.ts");
}

console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
