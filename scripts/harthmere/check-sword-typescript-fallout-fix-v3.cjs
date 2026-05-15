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

ok(!/declare const debugHarthmereRenderer/.test(text), "no duplicate ambient debugHarthmereRenderer declaration");
ok(/function debugHarthmereRenderer/.test(text), "keeps real debugHarthmereRenderer function");
ok(text.includes("private normalizeHarthmerePlayerSwordGltfScale(value: unknown)"), "normalizer accepts unknown");
ok(text.includes("const object = this.resolveHarthmereSwordObject3D(value);"), "normalizer resolves Object3D");
ok(text.includes("new THREE.Box3().setFromObject(object)"), "normalizer measures resolved object");
ok(text.includes("object.scale.multiplyScalar"), "normalizer scales resolved object");
ok(!/private normalizeHarthmerePlayerSwordGltfScale\(value: unknown\)[\s\S]*?\bmodel\b[\s\S]*?\n  private /.test(text), "normalizer has no stale model identifier");
ok(!/\bclipName\b/.test(text), "renderer has no stale clipName identifier");
ok(text.includes('if (name === "BasicSlash_24")'), "basic slash checks method parameter");
ok(text.includes('name === "HeavySlash_24"'), "heavy slash checks method parameter");
ok(text.includes('startHarthmerePlayerSwordManualSwing("basic")'), "basic slash still starts manual swing");
ok(text.includes('startHarthmerePlayerSwordManualSwing("heavy")'), "heavy slash still starts manual swing");
ok(text.includes("payload?: Record<string, unknown>"), "sword debug helper uses Record payload");
ok(text.includes("debugHarthmereRenderer(event, payload ?? {})"), "sword debug helper calls real logger safely");

if (!process.exitCode) {
  console.log("\nRESULT: PASS");
}
