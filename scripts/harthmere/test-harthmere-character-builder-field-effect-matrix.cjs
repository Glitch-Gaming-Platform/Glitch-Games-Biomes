#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const wake = fs.readFileSync(path.join(root, "src/client/components/WakeUpScreen.tsx"), "utf8");

let ok = true;
function check(label, condition, detail) {
  if (condition) console.log(`OK ${label}`);
  else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`     ${detail}`);
  }
}

const fields = [
  "genderIdentity", "pronouns", "customPronouns", "skinTone", "faceShape",
  "eyeShape", "eyeColor", "browStyle", "noseStyle", "mouthStyle",
  "hairStyle", "hairColor", "facialHair", "cheekStyle", "accessory",
  "bodyType", "bodyHeight", "shoulderWidth", "armLength", "legLength",
  "stance", "outfitColor",
];

const clothingSlots = [
  "head", "face", "torso", "legs", "hands", "feet", "back", "belt", "weapon", "shield",
];

for (const field of fields) {
  check(`builder contains canonical field ${field}`, wake.includes(field));
  if (field !== "customPronouns") {
    check(`builder routes ${field} through canonical selection handler`,
      wake.includes(`updateHarthmereBuilderField("${field}"`) ||
      wake.includes(`updateHarthmereBuilderField('${field}'`) ||
      wake.includes(`field="${field}"`),
      `${field} must not be display-only`);
  }
}

for (const slot of clothingSlots) {
  check(`builder can render clothing slot ${slot}`,
    wake.includes("HARTHMERE_CLOTHING_SLOTS") && wake.includes("HarthmereClothingOptionRow"));
}

check("builder saves face config", wake.includes("saveHarthmerePlayerFaceConfig"));
check("builder saves body config", wake.includes("saveHarthmerePlayerBodyConfig"));
check("builder saves clothing config", wake.includes("saveHarthmerePlayerClothingConfig"));
check("builder preview key depends on face", wake.includes("harthmereFacePreviewKey") && wake.includes("harthmereFace"));
check("builder preview key depends on body", wake.includes("harthmereFacePreviewKey") && wake.includes("harthmereBody"));
check("builder preview key depends on clothing", wake.includes("harthmereFacePreviewKey") && wake.includes("harthmereClothing"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
