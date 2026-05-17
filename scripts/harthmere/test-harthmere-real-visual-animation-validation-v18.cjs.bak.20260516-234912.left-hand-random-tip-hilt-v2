#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let failures = 0;
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function check(label, cond, detail) {
  if (cond) console.log(`OK ${label}`);
  else { failures += 1; console.log(`FAIL ${label}`); if (detail) console.log(`  - ${detail}`); }
}
function componentCount(type) { return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type] || 1; }
function readAccessorFloats(gltfPath, data, accessorIndex) {
  const accessor = data.accessors[accessorIndex];
  const view = data.bufferViews[accessor.bufferView];
  const buffer = data.buffers[view.buffer || 0];
  let bin;
  if (buffer.uri && buffer.uri.startsWith("data:")) {
    bin = Buffer.from(buffer.uri.split(",", 2)[1], "base64");
  } else {
    bin = fs.readFileSync(path.join(path.dirname(gltfPath), buffer.uri || `${path.basename(gltfPath, ".gltf")}.bin`));
  }
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const comps = componentCount(accessor.type);
  const count = accessor.count * comps;
  const vals = [];
  for (let i = 0; i < count; i += 1) vals.push(bin.readFloatLE(start + i * 4));
  return vals;
}
function hashFloats(vals) {
  return vals.map((v) => Math.round(v * 1000)).join(",");
}
console.log("== Harthmere real visual animation validation tests v18 ==");
console.log(`Root: ${root}`);
console.log();
const renderer = exists("src/client/game/renderers/local_dev/harthmere_assets.ts") ? read("src/client/game/renderers/local_dev/harthmere_assets.ts") : "";
const player = exists("src/client/game/util/player_animations.ts") ? read("src/client/game/util/player_animations.ts") : "";
const suite = exists("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs") ? read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs") : "";
check("renderer computes visual right side from facing vector instead of trusting anchor names", /harthmereVisualRightVectorV18/.test(renderer) && /dot\(harthmereVisualRightVectorV18\)/.test(renderer));
check("renderer chooses main-hand anchor by positive visual-right side score", /mainHandExpected:\s*"right"/.test(renderer) && /mainHandSideScore/.test(renderer));
check("renderer rejects opposite-hand sword placement with distance budget", /mainHandDistanceMeters/.test(renderer) && /mainHandDistanceBudgetMeters:\s*0\.14/.test(renderer));
check("renderer exposes actual right and left hand distances for live tests", /rightHandDistanceMeters/.test(renderer) && /leftHandDistanceMeters/.test(renderer));
check("player animation runtime references real v18 variation selection", /harthmere-real-attack-variation-clips-v18/.test(player) || /getHarthmereAttackVariationForActionV17/.test(player));

const variantDir = path.join(root, "public/assets/harthmere/gltf/characters/player_body_variants");
check("body variant directory exists", fs.existsSync(variantDir));
let checkedFiles = 0;
let variationClipCount = 0;
let uniquenessFailures = 0;
let channelFailures = 0;
if (fs.existsSync(variantDir)) {
  const files = fs.readdirSync(variantDir).filter((f) => f.endsWith(".gltf")).slice(0, 8);
  for (const file of files) {
    const gltfPath = path.join(variantDir, file);
    const data = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const nodes = data.nodes || [];
    const anims = data.animations || [];
    const names = [
      "HarthmereBodyWeaponBasic_Variation1_24",
      "HarthmereBodyWeaponBasic_Variation2_24",
      "HarthmereBodyWeaponBasic_Variation3_24",
      "HarthmereBodyWeaponBasic_Variation4_24",
      "HarthmereBodyWeaponHeavy_Variation1_24",
      "HarthmereBodyWeaponHeavy_Variation2_24",
      "HarthmereBodyWeaponHeavy_Variation3_24",
      "HarthmereBodyWeaponHeavy_Variation4_24",
    ];
    const hashes = [];
    for (const name of names) {
      const anim = anims.find((a) => a.name === name);
      if (!anim) { channelFailures += 1; continue; }
      variationClipCount += 1;
      if (!anim.extras || anim.extras.harthmereRealVariationVersion !== "harthmere-real-attack-variation-clips-v18" || anim.channels.length < 5) {
        channelFailures += 1;
      }
      const targetNodeNames = anim.channels.map((ch) => nodes[ch.target.node]?.name || "").join(" ").toLowerCase();
      if (!/(right|r_|\.r|townsperson-right).*(arm|hand)|townsperson-right-arm/.test(targetNodeNames) || !/(spine|chest|torso|body|hip|pelvis|root)/.test(targetNodeNames)) {
        channelFailures += 1;
      }
      const rotChannel = anim.channels.find((ch) => ch.target.path === "rotation");
      if (rotChannel) {
        const vals = readAccessorFloats(gltfPath, data, anim.samplers[rotChannel.sampler].output);
        const hasMotion = vals.some((v, i) => (i % 4 !== 3) && Math.abs(v) > 0.03);
        if (!hasMotion) channelFailures += 1;
        hashes.push(hashFloats(vals.slice(0, 64)));
      }
    }
    const unique = new Set(hashes).size;
    if (unique < Math.min(4, hashes.length)) uniquenessFailures += 1;
    checkedFiles += 1;
  }
}
check("generated GLTF clips have real channels, not metadata-only placeholders", variationClipCount > 0 && channelFailures === 0, `clips=${variationClipCount} channelFailures=${channelFailures}`);
check("attack variation clips differ in real quaternion data", checkedFiles > 0 && uniquenessFailures === 0, `checkedFiles=${checkedFiles} uniquenessFailures=${uniquenessFailures}`);
check("full suite includes v18 real visual validation test", /test-harthmere-real-visual-animation-validation-v18\.cjs/.test(suite));
console.log();
console.log(failures ? `RESULT: FAIL (${failures})` : "RESULT: PASS");
process.exit(failures ? 1 : 0);
