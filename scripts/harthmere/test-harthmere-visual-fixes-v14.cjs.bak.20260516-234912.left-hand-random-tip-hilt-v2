#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const target = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const suite = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
let failures = 0;
function check(label, cond, extra) {
  if (cond) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
    if (extra) console.log(`  - ${extra}`);
  }
}
console.log("== Harthmere visual fixes v14 ==");
console.log(`Root: ${root}`);
console.log();
check("renderer file exists", fs.existsSync(target));
const text = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
check(
  "procedural animals use forward axis tuned for visible forward walking",
  /if \(isProceduralAnimalKey\(asset\)\) \{\s*return "plusZ";\s*\}/.test(text) && /return isProceduralTownspersonKey\(asset\) \? "minusZ" : "plusZ";/.test(text)
);
check(
  "animal gait helper exists",
  /HARTHMERE_PROCEDURAL_ANIMAL_GAIT_VERSION_V14/.test(text) && /function applyAnimalLegSwingV14\(/.test(text)
);
check(
  "animal gait covers multiple legged species edge cases",
  /dog-leg-left-front/.test(text) && /pig-leg-left-front/.test(text) && /sheep-leg-left-front/.test(text) && /horse-leg-left-front/.test(text) && /snake-front/.test(text)
);
check(
  "procedural walker accepts asset and routes animals through gait helper",
  /function animateProceduralWalker\([\s\S]*asset\?: string/.test(text) && /if \(asset && isProceduralAnimalKey\(asset\)\)/.test(text)
);
check(
  "walker update passes asset into animateProceduralWalker",
  /animateProceduralWalker\(instance\.object, this\.elapsed, instance\.asset\)/.test(text)
);
check(
  "weapons resolve to right-hand anchors and shield to left-hand",
  /activeWeaponProfile === "shield"\s*\? \["lefthand"/.test(text) && /: \["righthand"/.test(text) && /activeWeaponProfile === "shield" \? "harthmere-anchor-left-hand" : "harthmere-anchor-right-hand"/.test(text)
);
check(
  "weapon orientation includes outward blade offsets",
  /weaponGripPitchOffsetV14/.test(text) && /weaponGripYawOffsetV14/.test(text) && /bladeForwardMode: "outward"/.test(text)
);
check(
  "large body clothing helper exists",
  /HARTHMERE_LARGE_BODY_CLOTHING_VISIBILITY_VERSION_V14/.test(text) && /function ensureHarthmereLargeBodyClothingVisibilityV14\(/.test(text)
);
check(
  "large body clothing helper widens and pushes clothing outward",
  /child\.position\.z -= 0\.055;/.test(text) && /child\.scale\.x \*= 1\.05;/.test(text)
);
check(
  "large body clothing helper is called during procedural townsperson creation",
  /ensureHarthmereLargeBodyClothingVisibilityV14\(root, appearance, body\);/.test(text)
);
check(
  "full suite includes v14 visual fixes test",
  fs.existsSync(suite) && /test-harthmere-visual-fixes-v14\.cjs/.test(fs.readFileSync(suite, "utf8"))
);
console.log();
console.log(failures ? `RESULT: FAIL (${failures})` : "RESULT: PASS");
process.exit(failures ? 1 : 0);
