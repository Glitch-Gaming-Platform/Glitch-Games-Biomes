#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const file = path.join(
  repo,
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);
const src = fs.readFileSync(file, "utf8");
const errors = [];
const oks = [];

function ok(cond, msg) {
  if (cond) oks.push(msg);
  else errors.push(msg);
}

ok(
  src.includes("private async loadHarthmerePlayerSwordGltf"),
  "weapon GLTF loader exists"
);
ok(
  src.includes('debugHarthmereRenderer("renderer.player_weapon.gltf_loaded"'),
  "GLTF loaded debug tail restored"
);
ok(
  src.includes(
    'this.playHarthmerePlayerSwordAnimationForCurrentState("gltf_loaded");'
  ),
  "current-state sword animation call restored"
);
ok(
  src.includes('debugHarthmereRenderer("renderer.player_weapon.gltf_failed"'),
  "GLTF failed catch restored"
);

const resolverIdx = src.indexOf("  private resolveHarthmereSwordObject3D");
const beforeResolver =
  resolverIdx >= 0
    ? src.slice(Math.max(0, resolverIdx - 1800), resolverIdx)
    : "";
ok(resolverIdx >= 0, "Object3D resolver follows the loader");
ok(
  /catch \(error\) \{[\s\S]*?renderer\.player_weapon\.gltf_failed[\s\S]*?finally \{[\s\S]*?\}\s*\}\s*$/.test(
    beforeResolver
  ),
  "loadHarthmerePlayerSwordGltf closes before resolver method"
);
ok(
  !/this\.\s*\n\s*private resolveHarthmereSwordObject3D/.test(src),
  "no dangling this before resolver method"
);
ok(
  !/addEventListener\("finished"[\s\S]{0,260}\n\s{10,}\}\s*\n\s{10,}\}\);/.test(
    src
  ),
  "finished listener indentation is not corrupt"
);

for (const msg of oks) console.log(`OK ${msg}`);
if (errors.length) {
  for (const msg of errors) console.error(`FAIL ${msg}`);
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
