#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere solid collision runtime parity tests v1", root);
const town = loadTown(root);

report.check(
  "production registry has uploaded-solid player collision version marker",
  town.registrySrc.includes("HARTHMERE_SOLID_UPLOADED_ASSET_COLLISION_VERSION_V1"),
  "Expected town_registry.ts marker from the solid uploaded asset collision fix"
);

report.check(
  "runtime obstacle export includes blocksPlayer-only blockers, not only blocksNpc blockers",
  town.assetsSrc.includes("(standardizedCollision.blocksNpc || standardizedCollision.blocksPlayer)"),
  "Expected harthmere_assets.ts export condition to include blocksPlayer"
);

report.check(
  "runtime code carries a named uploaded-solid collision regression marker",
  town.assetsSrc.includes("HARTHMERE_SOLID_UPLOADED_ASSET_PLAYER_COLLISION_V1"),
  "Expected a durable marker so future refactors do not silently remove the fix"
);

const mustBlockFamilies = [
  "table", "counter", "desk", "bench", "bed", "cabinet", "bookcase", "shelf",
  "workbench", "anvil", "dummy", "cage", "chest", "crate", "barrel", "keg",
  "fence", "hedge", "gate", "rock", "boulder", "tree", "pillar", "coffin",
  "minecart", "cart", "wagon", "tower", "house", "warehouse", "dock", "bridge"
];

const missingFamilies = mustBlockFamilies.filter((word) => {
  const re = new RegExp(`${word}[\\s\\S]{0,180}blocksPlayer:\\s*true|blocksPlayer:\\s*true[\\s\\S]{0,180}${word}`, "i");
  return !re.test(town.registrySrc);
});

report.check(
  "solid uploaded asset family rules explicitly set blocksPlayer true",
  missingFamilies.length === 0,
  missingFamilies.map((word) => `Missing blocksPlayer true coverage near family: ${word}`)
);

report.check(
  "player script still uses horizontal segment collision rather than endpoint-only collision",
  /segment/i.test(town.playerSrc) && /sweep/i.test(town.playerSrc) && /radius/i.test(town.playerSrc),
  "Expected player movement code to retain segment sweep collision terms"
);

report.finish();
