#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const relative = path.join(
  "public/assets/harthmere/glb/animations/player_animations.glb"
);
const bytes = fs.readFileSync(path.join(root, relative));
const jsonLength = bytes.readUInt32LE(12);
const glb = JSON.parse(
  bytes.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/, "")
);
const clips = new Map(
  (glb.animations || []).map((animation) => [animation.name, animation])
);

let ok = true;
function check(condition, message) {
  console.log(`${condition ? "OK" : "FAIL"} ${message}`);
  ok &&= condition;
}

for (let index = 1; index <= 4; index += 1) {
  const basic = clips.get(`HarthmereBodyWeaponBasic_Variation${index}_24`);
  const heavy = clips.get(`HarthmereBodyWeaponHeavy_Variation${index}_24`);
  check(
    basic?.extras?.impactSeconds === 6 / 24,
    `basic variation ${index} contacts on frame 6`
  );
  check(
    heavy?.extras?.impactSeconds === 10 / 24,
    `heavy variation ${index} contacts on frame 10`
  );
  check(
    heavy?.extras?.phases?.find((phase) => phase.name === "impact")?.start ===
      10 / 24,
    `heavy variation ${index} impact phase starts on the gameplay damage clock`
  );
  check(
    heavy?.extras?.phases?.at(-1)?.end === 26 / 24,
    `heavy variation ${index} recovery reaches frame 26`
  );
}

const combat = fs.readFileSync(
  path.join(root, "src/shared/harthmere/deliberate_combat.ts"),
  "utf8"
);
check(
  /basic:\s*\{[\s\S]*?impactMs:\s*250/.test(combat),
  "gameplay basic impact is the exact frame-6 clock"
);
check(
  /heavy:\s*\{[\s\S]*?impactMs:\s*417/.test(combat),
  "gameplay heavy impact rounds frame 10 to 417 ms"
);
check(
  /heavy:\s*\{[\s\S]*?recoveryMs:\s*666/.test(combat),
  "gameplay heavy recovery keeps the full frame-26 commitment"
);
check(
  /return HARTHMERE_PLAYER_ATTACK_TIMINGS\[timingClass\]\.impactMs \/ 1000/.test(
    combat
  ),
  "combo links use the same gameplay contact clock as damage"
);

console.log(ok ? `RESULT: PASS ${relative}` : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
