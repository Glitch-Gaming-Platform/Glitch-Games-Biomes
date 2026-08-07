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
const assetVersionsPath = path.join(
  root,
  "src/galois/js/interface/gen/asset_versions.json"
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
for (const name of [
  "HarthmereBodyBowAim_Aligned_30",
  "HarthmereBodyBowRelease_Aligned_30",
  "HarthmereBodyGunAim_Aligned_30",
  "HarthmereBodyGunFire_Aligned_30",
]) {
  const clip = clips.get(name);
  assert.ok(clip, `${name} is missing from the materialized animation set`);
  assert.equal(clip.extras?.targetRequired, true, `${name} target gate`);
  assert.equal(
    clip.extras?.upperBodyAdditive,
    true,
    `${name} upper-body layering`
  );
}
assert.equal(
  clips.get("HarthmereBodyBowRelease_Aligned_30")?.extras?.impactSeconds,
  0.28,
  "bow release timing"
);
assert.equal(
  clips.get("HarthmereBodyGunFire_Aligned_30")?.extras?.impactSeconds,
  0.52,
  "gun fire timing"
);

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, parsed.bytes);
const contentHash = require("node:crypto")
  .createHash("md5")
  .update(parsed.bytes)
  .digest("hex");
const contentRelativePath = `asset_data/wearables/animations.${contentHash}.glb`;
const contentDestination = path.join(
  root,
  "public/buckets/biomes-static",
  contentRelativePath
);
fs.mkdirSync(path.dirname(contentDestination), { recursive: true });
fs.writeFileSync(contentDestination, parsed.bytes);

const assetVersions = JSON.parse(fs.readFileSync(assetVersionsPath, "utf8"));
assetVersions.paths["wearables/animations"] = contentRelativePath;
fs.writeFileSync(
  assetVersionsPath,
  `${JSON.stringify(assetVersions, null, 2)}\n`
);
console.log(
  `Synced ${parsed.json.animations?.length ?? 0} player animations to ${path.relative(
    root,
    destination
  )} and indexed ${contentRelativePath}.`
);
