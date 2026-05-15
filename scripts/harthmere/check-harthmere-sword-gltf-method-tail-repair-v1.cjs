#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const file = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");
const errors = [];
const oks = [];

function ok(cond, msg) {
  if (cond) oks.push(msg); else errors.push(msg);
}

ok(src.includes("harthmere-sword-gltf-method-tail-repair-v1"), "repair version marker exists");
ok(src.includes('debugHarthmereRenderer("renderer.player_sword.gltf_loaded"'), "GLTF loaded debug tail restored");
ok(src.includes('this.playHarthmerePlayerSwordAnimationForCurrentState("gltf_loaded");'), "current-state sword animation call restored");
ok(src.includes('debugHarthmereRenderer("renderer.player_sword.gltf_failed"'), "GLTF failed catch restored");

const debugIdx = src.indexOf("  private debugHarthmerePlayerSwordManualSwing");
const beforeDebug = debugIdx >= 0 ? src.slice(Math.max(0, debugIdx - 900), debugIdx) : "";
ok(debugIdx >= 0, "debugHarthmerePlayerSwordManualSwing method exists");
ok(/\}\s*catch \(error\) \{[\s\S]*?renderer\.player_sword\.gltf_failed[\s\S]*?\}\s*\}\s*$/.test(beforeDebug), "loadHarthmerePlayerSwordGltf closes before debug method");
ok(!/this\.\s*\n\s*private debugHarthmerePlayerSwordManualSwing/.test(src), "no dangling this before debug method");
ok(!/addEventListener\("finished"[\s\S]{0,260}\n\s{10,}\}\s*\n\s{10,}\}\);/.test(src), "finished listener indentation is not corrupt");

for (const msg of oks) console.log(`OK ${msg}`);
if (errors.length) {
  for (const msg of errors) console.error(`FAIL ${msg}`);
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
