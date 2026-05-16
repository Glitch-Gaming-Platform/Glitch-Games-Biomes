#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const facesPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");

const faces = fs.readFileSync(facesPath, "utf8");
const npcs = fs.readFileSync(npcsPath, "utf8");

let ok = true;

function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check(
  "exported NPC appearance config wrapper exists",
  /export\s+function\s+makeHarthmereNpcAppearanceConfig\s*\(/.test(faces)
);

check(
  "base NPC appearance config is preserved",
  faces.includes("makeHarthmereNpcAppearanceConfigBaseV21d")
);

check(
  "NPC appearance config wrapper calls v20 complete clothing guarantee",
  faces.includes("harthmereEnsureProductMinecraftClothingSetV20")
);

check(
  "NPC appearance config wrapper feeds existing/generated clothing through guarantee",
  faces.includes("appearance.clothing ?? input.clothing")
);

check(
  "NPC animation execution check records selectedState",
  npcs.includes("harthmereNpcAnimationExecutionCheck") &&
    npcs.includes("selectedState")
);

check(
  "NPC animation execution keeps selected compatibility field",
  npcs.includes("selected:")
);

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
