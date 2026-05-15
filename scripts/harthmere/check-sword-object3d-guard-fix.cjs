#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const file = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const text = fs.readFileSync(file, "utf8");

let failed = false;
function ok(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    failed = true;
    console.error(`FAIL ${msg}`);
  }
}

ok(text.includes("private resolveHarthmereSwordObject3D(value: unknown)"), "renderer has Object3D resolver guard");
ok(text.includes("candidate.scene") && text.includes("return this.resolveHarthmereSwordObject3D(candidate.scene)"), "resolver accepts GLTF wrapper scene");
ok(text.includes("private sanitizeHarthmereSwordTextures(value: unknown)"), "sanitize accepts unknown instead of assuming Object3D");
ok(text.includes("const object = this.resolveHarthmereSwordObject3D(value)"), "sanitize resolves Object3D before traverse");
ok(!/private\s+sanitizeHarthmereSwordTextures\([^)]*THREE\.Object3D/.test(text), "sanitize no longer has unsafe Object3D-only signature");
ok(text.includes("object.traverse((child) =>"), "sanitize still traverses valid Object3D roots");
ok(text.includes("private normalizeHarthmerePlayerSwordGltfScale(value: unknown)"), "scale normalizer accepts unknown safely");
ok(text.includes("this.sanitizeHarthmereSwordTextures(gltf.scene)") || text.includes("this.sanitizeHarthmereSwordTextures(loaded.scene ?? loaded)"), "loader passes scene when possible");
ok(text.includes("A bad sword visual should fall back to the") || text.includes("cannot crash the game"), "future-dev crash guard comment exists");

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
