#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const specs = {
  hexer: { attackDuration: 1 },
  mossy_mucker: { attackDuration: 16 / 24 },
  big_mucker: { attackDuration: 1 },
  cobble_mucker: { attackDuration: 16 / 24 },
  stone_mucker: { attackDuration: 16 / 24 },
  tree_mucker: { attackDuration: 16 / 24 },
  cow: { attackDuration: 20 / 24, impactTime: 10 / 24 },
  sheep: { attackDuration: 20 / 24, impactTime: 10 / 24 },
  rabbit: { attackDuration: 14 / 24, impactTime: 7 / 24 },
};

let failed = false;
function check(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

for (const [name, spec] of Object.entries(specs)) {
  const filename = path.join(
    root,
    "src/galois/data/npcs",
    `${name}_animations.gltf`
  );
  const gltf = JSON.parse(fs.readFileSync(filename, "utf8"));
  const byName = new Map(
    (gltf.animations || []).map((animation) => [animation.name, animation])
  );
  for (const clip of ["Attack", "HitReact", "Death"]) {
    const animation = byName.get(clip);
    check(Boolean(animation), `${name} exports ${clip}`);
    if (!animation) continue;
    check(
      animation.channels.length > 0,
      `${name} ${clip} has animated channels`
    );
    const duration = Math.max(
      ...animation.samplers.map(
        (sampler) => gltf.accessors[sampler.input]?.max?.[0] ?? 0
      )
    );
    check(duration > 0, `${name} ${clip} has a non-zero duration`);
    if (clip === "Attack") {
      check(
        Math.abs(duration - spec.attackDuration) <= 0.002,
        `${name} Attack duration matches authored contact timing`
      );
      if (spec.impactTime !== undefined) {
        check(
          Math.abs(
            Number(animation.extras?.impactTimeSecs) - spec.impactTime
          ) <= 0.0001,
          `${name} Attack records its authoritative impact frame`
        );
      }
    }
  }
}

if (failed) process.exit(1);
console.log("Creature melee animation assets OK");
