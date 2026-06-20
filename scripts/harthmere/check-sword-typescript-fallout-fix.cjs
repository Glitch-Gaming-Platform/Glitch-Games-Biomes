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

function methodBody(name) {
  const match = new RegExp(`^[ \\t]*private\\s+${name}\\s*\\(`, "m").exec(text);
  if (!match) {
    return "";
  }
  const start = match.index;
  const brace = text.indexOf("{", match.index);
  if (brace < 0) {
    return "";
  }
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return "";
}

const normalizer = methodBody("normalizeHarthmerePlayerSwordGltfScale");
const clipMethod = methodBody("playHarthmerePlayerSwordClip");
const debugMethod = methodBody("debugHarthmereSwordRendererEvent");

ok(!/declare const debugHarthmereRenderer/.test(text), "no duplicate ambient debugHarthmereRenderer declaration");
ok(/function debugHarthmereRenderer/.test(text), "keeps real debugHarthmereRenderer function");
ok(normalizer.includes("value: unknown"), "normalizer accepts unknown");
ok(normalizer.includes("const object = this.resolveHarthmereSwordObject3D(value);"), "normalizer resolves Object3D");
ok(normalizer.includes("new THREE.Box3().setFromObject(object)"), "normalizer measures resolved object");
ok(normalizer.includes("object.scale.multiplyScalar"), "normalizer scales resolved object");
ok(!/\bmodel\b/.test(normalizer), "normalizer has no stale model identifier");
ok(!/\bclipName\b/.test(text), "renderer has no stale clipName identifier");
ok(clipMethod.includes('if (name === "BasicSlash_24")'), "basic slash checks method parameter");
ok(clipMethod.includes('name === "HeavySlash_24"'), "heavy slash checks method parameter");
ok(clipMethod.includes('startHarthmerePlayerSwordManualSwing("basic")'), "basic slash still starts manual swing");
ok(clipMethod.includes('startHarthmerePlayerSwordManualSwing("heavy")'), "heavy slash still starts manual swing");
ok(debugMethod.includes("payload?: Record<string, unknown>"), "sword debug helper uses Record payload");
ok(debugMethod.includes("debugHarthmereRenderer(event, payload ?? {})"), "sword debug helper calls real logger safely");

if (!process.exitCode) {
  console.log("\nRESULT: PASS");
}
