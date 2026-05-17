#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`OK ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
    if (detail) console.log(`  - ${detail}`);
  }
}
console.log("== Harthmere attack variation sequencing tests v15 ==");
console.log(`Root: ${root}`);
console.log();
const manifest = read("src/shared/harthmere/attack_variation_manifest_v13.ts");
const player = read("src/client/game/util/player_animations.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const variantDir = path.join(root, "public/assets/harthmere/gltf/characters/player_body_variants");
check("attack variation sequence marker exists", player.includes("HARTHMERE_ATTACK_VARIATION_SEQUENCE_VERSION_V15") || manifest.includes("HARTHMERE_ATTACK_VARIATION_SEQUENCE_VERSION_V15"));
for (const family of [
  ["basic", "HarthmereBodyWeaponBasic"],
  ["heavy", "HarthmereBodyWeaponHeavy"],
  ["magic", "HarthmereBodyMagicCast"],
  ["rangedRelease", "HarthmereBodyRangedRelease"],
  ["shieldBash", "HarthmereBodyShieldBash"],
  ["toolUse", "HarthmereBodyToolUse"],
]) {
  const [familyName, clipPrefix] = family;
  const ids = [1,2,3,4].map((i) => `${clipPrefix}_Variation${i}_24`);
  check(`${familyName} has four concrete variation clip names`, ids.every((id) => manifest.includes(id)), ids.join(", "));
}
check("player animation system registers attack1 variation keys", [1,2,3,4].every((i) => player.includes(`attack1Var${i}:`) && player.includes(`HarthmereBodyWeaponBasic_Variation${i}_24`)));
check("player animation system registers attack2 variation keys", [1,2,3,4].every((i) => player.includes(`attack2Var${i}:`) && player.includes(`HarthmereBodyWeaponHeavy_Variation${i}_24`)));
check("same held attack frame reuses the same variation instead of changing every render frame", /harthmereCachedAttackVariationStartTimeV15 === emoteStartTime/.test(player));
check("new attack advances to the next variation", /harthmereLastAttackVariationIndexV15\s*=\s*\(harthmereLastAttackVariationIndexV15 % 4\) \+ 1/.test(player));
check("body animation plays selected variation key", /singleAnimationWeight\(harthmereVariationEmoteTypeV15, 1\)/.test(player));
check("legacy aligned clips remain as fallback for compatibility", player.includes('"HarthmereBodyWeaponBasic_Aligned_30"') && player.includes('"HarthmereBodyWeaponHeavy_Aligned_30"'));
let inspected = 0;
let missing = [];
if (fs.existsSync(variantDir)) {
  for (const file of fs.readdirSync(variantDir).filter((f) => f.endsWith(".gltf")).slice(0, 6)) {
    inspected += 1;
    const txt = fs.readFileSync(path.join(variantDir, file), "utf8");
    for (const name of [
      "HarthmereBodyWeaponBasic_Variation1_24",
      "HarthmereBodyWeaponBasic_Variation4_24",
      "HarthmereBodyWeaponHeavy_Variation1_24",
      "HarthmereBodyWeaponHeavy_Variation4_24",
    ]) {
      if (!txt.includes(`"name": "${name}"`) && !txt.includes(`"name":"${name}"`)) {
        missing.push(`${file}:${name}`);
      }
    }
  }
}
check("generated GLTF body variants expose concrete attack variation clip names", inspected > 0 && missing.length === 0, missing.slice(0, 8).join("\n"));
check("full suite includes v15 sequencing test", suite.includes("test-harthmere-attack-variation-sequencing-v15.cjs"));
console.log();
console.log(failures ? `RESULT: FAIL (${failures})` : "RESULT: PASS");
process.exit(failures ? 1 : 0);
