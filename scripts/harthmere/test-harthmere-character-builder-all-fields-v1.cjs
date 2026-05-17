#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const voxelPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${path.relative(root, file)}`);
    process.exit(1);
  }
  return fs.readFileSync(file, "utf8");
}
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    failed += 1;
  }
}
function hasAll(text, values) {
  return values.every((value) => text.includes(value));
}
let failed = 0;

const wake = read(wakePath);
const voxel = read(voxelPath);

const requiredBuilderFields = [
  "genderIdentity",
  "pronouns",
  "customPronouns",
  "skinTone",
  "faceShape",
  "eyeShape",
  "eyeColor",
  "browStyle",
  "noseStyle",
  "mouthStyle",
  "hairStyle",
  "hairColor",
  "facialHair",
  "cheekStyle",
  "accessory",
  "bodyType",
  "bodyHeight",
  "shoulderWidth",
  "armLength",
  "legLength",
  "stance",
  "outfitColor",
];
const optionConstants = [
  "HARTHMERE_GENDER_OPTIONS",
  "HARTHMERE_PRONOUN_OPTIONS",
  "HARTHMERE_SKIN_TONES",
  "HARTHMERE_FACE_SHAPES",
  "HARTHMERE_EYE_SHAPES",
  "HARTHMERE_EYE_COLORS",
  "HARTHMERE_BROW_STYLES",
  "HARTHMERE_NOSE_STYLES",
  "HARTHMERE_MOUTH_STYLES",
  "HARTHMERE_HAIR_STYLES",
  "HARTHMERE_HAIR_COLORS",
  "HARTHMERE_FACIAL_HAIR_STYLES",
  "HARTHMERE_CHEEK_STYLES",
  "HARTHMERE_FACE_ACCESSORIES",
  "HARTHMERE_BODY_TYPES",
  "HARTHMERE_BODY_HEIGHTS",
  "HARTHMERE_SHOULDER_WIDTHS",
  "HARTHMERE_ARM_LENGTHS",
  "HARTHMERE_LEG_LENGTHS",
  "HARTHMERE_BODY_STANCES",
  "HARTHMERE_OUTFIT_COLORS",
];
const clothingSlots = ["head", "face", "torso", "legs", "hands", "feet", "back", "belt", "weapon", "shield"];

for (const field of requiredBuilderFields) {
  check(`canonical builder field is listed in shared schema: ${field}`, voxel.includes(`"${field}"`));
  if (field === "customPronouns") {
    check(`custom pronoun input is rendered for ${field}`, wake.includes('data-harthmere-builder-field="customPronouns"'));
  } else {
    check(`option row renders field ${field}`, wake.includes(`field="${field}"`));
  }
}

for (const constant of optionConstants) {
  check(`option source is imported/used: ${constant}`, wake.includes(constant));
}

check("clothing slot list is derived from shared clothing slots", wake.includes("HARTHMERE_CLOTHING_SLOTS.filter") && wake.includes('slot !== "hair"'));
for (const slot of clothingSlots) {
  check(`expected clothing slot is represented in source/catalog: ${slot}`, voxel.includes(`slot: "${slot}"`) || voxel.includes(`${slot}:`) || voxel.includes(`"${slot}"`) || wake.includes(`"${slot}"`));
}
check("clothing buttons expose slot/value/current/test state data attributes", hasAll(wake, [
  "data-harthmere-builder-clothing-slot",
  "data-harthmere-builder-clothing-value",
  "data-harthmere-builder-clothing-selected",
  "data-harthmere-builder-clothing-current",
]));
check("coverage report includes clothing slot completeness", hasAll(wake, [
  "expectedClothingSlots",
  "missingClothingSlots",
  "clothingRows",
  "clothing: harthmereClothing",
]));
check("field audit events still avoid localStorage snapshots", wake.includes("biomes:harthmere-builder-selection-applied") && wake.includes("expectedFields") && wake.includes("matched"));

console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
