#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const wake = fs.readFileSync(
  path.join(root, "src/client/components/WakeUpScreen.tsx"),
  "utf8"
);

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

console.log("== Harthmere native ECS character builder ==");
console.log(`Root: ${root}\n`);

check(
  "builder advertises only renderer-supported voxel features",
  wake.includes('data-harthmere-builder-layout="supported-voxel-features"') &&
    /Only the options the voxel renderer actually consumes are\s+shown\./.test(wake)
);
check(
  "native head shape control is rendered",
  wake.includes("<HarthmereVoxelHeadShapeRow") &&
    wake.includes("setPreviewAppearance")
);
check(
  "native skin, eye, and hair palettes are rendered",
  [
    'palette="color_palettes/skin_colors"',
    'palette="color_palettes/eye_colors"',
    'palette="color_palettes/hair_colors"',
  ].every((value) => wake.includes(value))
);
check(
  "native hair selection is rendered",
  wake.includes("<HarthmereVoxelHairStyleRow") && wake.includes("setPreviewHair")
);
check(
  "appearance changes publish through native ECS events",
  wake.includes("new AppearanceChangeEvent") &&
    wake.includes("new HairTransplantEvent") &&
    wake.includes("new PlayerInitEvent")
);
check(
  "live preview uses native appearance and wearable overrides",
  wake.includes("appearanceOverride={previewAppearance}") &&
    wake.includes("wearableOverrides={wearableOverrides}")
);
check(
  "legacy local clothing picker is not rendered",
  !wake.includes('data-harthmere-builder-clothing-panel="release-clothing-picker"') &&
    !wake.includes('data-harthmere-builder-clothing-presets="true"') &&
    !wake.includes('data-harthmere-builder-clothing-slots="true"')
);
check(
  "legacy synthetic face/body option rows are not rendered",
  !/field="(?:genderIdentity|pronouns|skinTone|bodyType|outfitColor)"/.test(wake)
);
check(
  "builder completes through the normal player start path",
  wake.includes("const startGame") && wake.includes("onComplete();")
);

console.log(`\nRESULT: ${failures === 0 ? "PASS" : "FAIL"}`);
process.exit(failures === 0 ? 0 : 1);
