#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const sharedPath = path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts");
const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const shared = fs.readFileSync(sharedPath, "utf8");
const renderer = fs.existsSync(rendererPath) ? fs.readFileSync(rendererPath, "utf8") : "";
function finish(name) { if (!ok) process.exit(1); console.log(`RESULT: PASS ${name}`); }

check("same attack variants cannot alter combat mechanics", () => {
  for (const key of ["sameAttackVariantsKeepDamage", "sameAttackVariantsKeepRange", "sameAttackVariantsKeepCooldown", "sameAttackVariantsKeepHitbox", "sameAttackVariantsKeepResourceCost"]) {
    assert(shared.includes(key), `missing ${key}`);
  }
  for (const oldKey of ["damageChangedByVisual: false", "rangeChangedByVisual: false", "cooldownChangedByVisual: false", "hitboxChangedByVisual: false", "resourceCostChangedByVisual: false"]) {
    assert(shared.includes(oldKey), `profile invariant missing ${oldKey}`);
  }
});
check("variations must differ beyond color", () => {
  assert(shared.includes("variationsMustChangeAtLeastThreeVisualDimensions"), "missing multi-dimension rule");
  for (const dim of ["bodyMotion", "weaponPath", "trailShape", "silhouette", "particleStyle"]) {
    assert(shared.includes(dim), `missing visual dimension ${dim}`);
  }
  assert(/noColorOnlyVariation:\s*true/.test(shared), "missing noColorOnlyVariation flag");
});
finish("combat animation mechanics-invariant v3");
