#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const file = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const text = fs.readFileSync(file, "utf8");

let failed = false;
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else {
    failed = true;
    console.error(`FAIL ${msg}`);
  }
}

ok(text.includes("private resolveHarthmereSwordObject3D(value: unknown)"), "renderer has Object3D resolver guard");
ok(text.includes("private sanitizeHarthmereSwordTextures(value: unknown)"), "sanitize accepts unknown");
ok(text.includes("const object = this.resolveHarthmereSwordObject3D(value)"), "sanitize resolves Object3D before traverse");
ok(text.includes("private normalizeHarthmerePlayerSwordGltfScale(value: unknown)"), "scale normalizer accepts unknown");
ok(!/private\s+sanitizeHarthmereSwordTextures\([^)]*THREE\.Object3D/.test(text), "sanitize signature is not Object3D-only");
ok(!/private\s+normalizeHarthmerePlayerSwordGltfScale\([^)]*THREE\.Object3D/.test(text), "normalizer signature is not Object3D-only");
ok(!/this\.sanitizeHarthmereSwordTextures\(\s*gltf\s*\)/.test(text), "no sanitize(gltf wrapper) call remains");
ok(!/this\.normalizeHarthmerePlayerSwordGltfScale\(\s*gltf\s*\)/.test(text), "no normalize(gltf wrapper) call remains");
ok(text.includes("this.sanitizeHarthmereSwordTextures(gltf.scene)"), "loader explicitly sanitizes GLTF scene");
ok(
  text.includes("this.normalizeHarthmerePlayerSwordGltfScale(gltf.scene)") ||
    text.includes("this.normalizeHarthmerePlayerSwordGltfScale(loaded.scene ?? loaded)") ||
    text.includes("this.normalizeHarthmerePlayerSwordGltfScale(swordGltf.scene ?? swordGltf)"),
  "loader normalizes scene when possible"
);
ok(text.includes("Pass the GLTF scene into sword helpers when possible"), "future-dev loader scene comment exists");

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
