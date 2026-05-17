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

check("death/downed/revive/respawn protection visual states exist", () => {
  for (const state of ["downed", "dead", "reviving", "respawnProtection", "captured", "npcDeath", "bossDeath"]) {
    assert(shared.includes(state), `missing visual state ${state}`);
  }
});
check("death visuals stop attacks and AI/phase loops", () => {
  for (const key of ["canAttack: false", "loopsCancelled: true", "stopsAiMovement: true", "stopsAttackLoop: true", "stopsPhaseLoop: true", "clearsTelegraphs: true"]) {
    assert(shared.includes(key), `missing death visual rule ${key}`);
  }
});
finish("combat animation death-respawn visuals v3");
