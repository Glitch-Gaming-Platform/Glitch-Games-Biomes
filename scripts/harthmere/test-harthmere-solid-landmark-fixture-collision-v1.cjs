#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const {
  makeReporter,
  loadTown,
} = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere solid landmark fixture collision tests v1", root);
const { assetsSrc, registrySrc, playerSrc, placements } = loadTown(root);

function findPlacement(asset, nameFragment, districtFragment) {
  return placements.find((p) =>
    p.kind === "P" &&
    p.asset === asset &&
    String(p.name || "").toLowerCase().includes(String(nameFragment).toLowerCase()) &&
    String(p.district || "").toLowerCase().includes(String(districtFragment).toLowerCase())
  );
}

const requiredFixtures = [
  ["obj_flag_large_red", "Watch banner left", "North Gate"],
  ["obj_flag_large_red", "Watch banner right", "North Gate"],
  ["obj_lamp_ground_large", "Gate brazier lamp", "North Gate"],
  ["obj_lamp_ground_small", "Fountain lamp", "Market Square"],
  ["fountain_round_detail", "Bridge Fountain carved rim detail", "Market Square"],
  ["fountain_center", "Bridge Fountain center stone marker", "Market Square"],
];

const missing = requiredFixtures
  .map(([asset, name, district]) => ({ asset, name, district, placement: findPlacement(asset, name, district) }))
  .filter((entry) => !entry.placement)
  .map((entry) => `${entry.asset} / ${entry.name} / ${entry.district}`);

report.check(
  "specific reported North Gate and Market Square imported fixtures exist",
  missing.length === 0,
  missing
);

report.check(
  "registry has explicit solid landmark fixture collision contract",
  registrySrc.includes("HARTHMERE_SOLID_LANDMARK_FIXTURE_COLLISION_VERSION_V1") &&
    registrySrc.includes("HARTHMERE_SOLID_LANDMARK_FIXTURE_PLAYER_BLOCKER_FAMILIES_V1") &&
    /obj_flag_large[\s\S]{0,160}blocksPlayer:\s*true/.test(registrySrc) &&
    /obj_lamp_ground[\s\S]{0,180}blocksPlayer:\s*true/.test(registrySrc) &&
    /fountain_round_detail[\s\S]{0,220}blocksPlayer:\s*true/.test(registrySrc),
  "Expected obj_flag_large, obj_lamp_ground, and fountain detail fixtures to be explicit player blockers"
);

report.check(
  "runtime obstacle shape does not downgrade solid landmark fixtures to visual_only",
  assetsSrc.includes("HARTHMERE_SOLID_LANDMARK_FIXTURE_COLLISION_VERSION_V1") &&
    assetsSrc.includes("isAuthoredSolidLandmarkFixture") &&
    assetsSrc.includes('collisionProfile = "solid_landmark_fixture"') &&
    assetsSrc.includes("playerCanWalkThrough = false") &&
    assetsSrc.indexOf("isAuthoredSolidLandmarkFixture") < assetsSrc.indexOf("if (isVisualOnly)"),
  "Expected solid landmark fixture handling before visual-only handling"
);

report.check(
  "player movement pass-through filter excludes solid flags, ground lamps, and fountain detail blockers",
  playerSrc.includes("HARTHMERE_SOLID_LANDMARK_FIXTURE_PLAYER_COLLISION_V1") &&
    playerSrc.includes('profile === "solid_landmark_fixture"') &&
    playerSrc.includes('asset.startsWith("obj_flag_large")') &&
    playerSrc.includes('asset.startsWith("obj_lamp_ground")') &&
    playerSrc.includes('asset.startsWith("fountain_round_detail")') &&
    playerSrc.includes('asset.startsWith("fountain_center")'),
  "Expected player pass-through predicate to return false for solid imported fixtures even when names include flag/lamp/detail"
);

const visualOnlyIndex = assetsSrc.indexOf("const isVisualOnly");
const solidIndex = assetsSrc.indexOf("const isAuthoredSolidLandmarkFixture");
report.check(
  "solid landmark fixture detection is authored separately from broad visual-only names",
  solidIndex >= 0 && visualOnlyIndex >= 0 && solidIndex < visualOnlyIndex,
  "Expected solid fixture detection to be declared before visual-only classification"
);

report.finish();
