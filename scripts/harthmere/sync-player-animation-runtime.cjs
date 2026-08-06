#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = path.join(
  root,
  "src/galois/data/exports/wearables/animations.glb"
);
const destination = path.join(
  root,
  "public/assets/harthmere/glb/animations/player_animations.glb"
);

function parseGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  return {
    bytes,
    json: JSON.parse(
      bytes
        .subarray(20, 20 + jsonLength)
        .toString("utf8")
        .replace(/\u0000+$/g, "")
    ),
  };
}

const parsed = parseGlb(source);
const clips = new Map(
  (parsed.json.animations ?? []).map((animation) => [animation.name, animation])
);
for (const family of ["Basic", "Heavy"]) {
  for (let step = 1; step <= 4; step += 1) {
    const name = `HarthmereBodyWeapon${family}_Variation${step}_24`;
    const clip = clips.get(name);
    assert.ok(clip, `${name} is missing from the materialized animation set`);
    assert.equal(clip.extras?.comboStep, step, `${name} combo step`);
    assert.equal(
      clip.extras?.harthmereAnimationPolishVersion,
      "harthmere-player-combo-animation-polish-v4-trajectories",
      `${name} polish version`
    );
  }
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, parsed.bytes);
console.log(
  `Synced ${parsed.json.animations?.length ?? 0} player animations to ${path.relative(
    root,
    destination
  )}.`
);
