#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const renderer = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

const text = fs.readFileSync(renderer, "utf8");

ok(!/this\.debugHarthmereRenderer\?\.\(/.test(text), "renderer no longer calls missing this.debugHarthmereRenderer");
ok(text.includes("debugHarthmereSwordRendererEvent"), "renderer has safe sword debug helper");
ok(text.includes('startHarthmerePlayerSwordManualSwing("basic")'), "basic slash still starts manual swing");
ok(text.includes('startHarthmerePlayerSwordManualSwing("heavy")'), "heavy slash still starts manual swing");
ok(text.includes("private normalizeHarthmerePlayerSwordGltfScale(value: unknown)"), "normalizer still accepts unknown");
ok(text.includes("const object = this.resolveHarthmereSwordObject3D(value);"), "normalizer/sanitizer still resolves Object3D");
ok(!/private normalizeHarthmerePlayerSwordGltfScale\(value: unknown\)[\s\S]*?\bmodel\b[\s\S]*?\n  private /.test(text), "normalizer has no stale model identifier");
ok(!/private loadHarthmerePlayerSwordGltf[\s\S]*?\bclipName\b[\s\S]*?\n  private /.test(text), "loader has no stray clipName identifier");

if (!process.exitCode) {
  console.log("\nRESULT: PASS");
}
