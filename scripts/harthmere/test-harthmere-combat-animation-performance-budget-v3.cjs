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

check("performance budget covers town-fight scale actors", () => {
  for (const key of ["idleNpcCount: 100", "runningNpcCount: 50", "attackingNpcCount: 25", "casterNpcCount: 10", "bossTelegraphCount: 5"]) {
    assert(shared.includes(key), `missing budget ${key}`);
  }
});
check("transient effects must be bounded and disposable", () => {
  for (const key of ["maxTrailLifetimeMs", "maxImpactEffectLifetimeMs", "oldTrailsMustBeDisposed: true", "oldImpactEffectsMustBeDisposed: true", "noUnboundedTrailArrays: true"]) {
    assert(shared.includes(key), `missing performance cleanup rule ${key}`);
  }
});
finish("combat animation performance-budget v3");
