#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures += 1;
    console.log(`FAIL ${rel} exists`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}
function ok(label, condition, details = []) {
  if (condition) console.log(`OK ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
    for (const d of details) console.log(`  - ${d}`);
  }
}

console.log("== Harthmere NPC combat AI regression tests v36 ==");
console.log(`Root: ${root}\n`);
const bikkie = read("src/shared/npc/bikkie.ts");
const npcTypes = read("src/shared/npc/npc_types.ts");
const chase = read("src/shared/npc/behavior/chase_attack.ts");
const logic = read("src/shared/npc/logic.ts");
const modifyHealth = read("src/shared/npc/modify_health.ts");
const spawnNpc = read("src/server/spawn/spawn_npc.ts");

ok(
  "default rotate speed uses degrees-per-second, not radians",
  /const DEFAULT_NPC_ROTATE_SPEED = 180;/.test(bikkie) && !/DEFAULT_NPC_ROTATE_SPEED = Math\.PI/.test(bikkie),
  ["rotate_target.ts converts deg/s to radians; Math.PI caused ~3 deg/s turning"]
);
ok(
  "combat defaults use readable melee cone and real disengage hysteresis",
  /attackFovDeg:\s*120/.test(npcTypes) && /disengageDistance:\s*24/.test(npcTypes) && /attackDistance:\s*2\.2/.test(npcTypes),
  ["5 degree FOV and disengage==aggro made NPCs unable to hit and flap at aggro boundary"]
);
ok(
  "chase movement no longer freezes when target is behind NPC",
  /turnSlowdown\s*=\s*Math\.max\(0\.35/.test(chase) && !/const speedMultiplier = Math\.max\(0, Math\.cos\(diffAngleToPlayer\)\)/.test(chase),
  ["old cosine-only multiplier produced forwardSpeed=0 for targets behind the NPC"]
);
ok(
  "only-if-attacked NPCs remember combat long enough to retaliate",
  /const ATTACK_MEMORY_SECONDS = 30;/.test(chase),
  ["3 seconds was too short for defensive NPC combat memory"]
);
ok(
  "attack range approximates target collision capsule instead of origin only",
  /TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS/.test(chase) && /effectiveAttackRadius/.test(chase) && /attackFovDeg \/ 2/.test(chase),
  ["origin-to-origin distance caused large NPCs to miss targets already touching their body"]
);
ok(
  "dead NPCs stop running behavior logic",
  /if \(npc\.hp <= 0\) \{\s*return;\s*\}/s.test(logic),
  ["dead NPCs were still meandering/chasing/receiving movement forces"]
);
ok(
  "corpse linger is longer and death zeroes residual velocity",
  /const NPC_CORPSE_LINGER_SECS = 90;/.test(modifyHealth) && /mutableRigidBody\(\)\.velocity\s*=\s*\[0, 0, 0\]/.test(modifyHealth),
  ["30s hard expiry felt like NPCs vanished; residual velocity made corpses slide"]
);
ok(
  "size variation remains uniform on all axes",
  /return \[overallScale, overallScale, overallScale\];/.test(spawnNpc) && !/xScale|yScale|zScale/.test(spawnNpc),
  ["per-axis scale sampling squashed/stretched NPCs and broke capsule consistency"]
);

console.log("");
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
