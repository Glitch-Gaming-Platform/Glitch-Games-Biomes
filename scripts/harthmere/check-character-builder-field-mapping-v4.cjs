#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const face = fs.readFileSync(path.join(root, "src/shared/harthmere/voxel_faces.ts"), "utf8");
const wake = fs.readFileSync(path.join(root, "src/client/components/WakeUpScreen.tsx"), "utf8");

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

const fields = [
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

ok(face.includes("HARTHMERE_APPEARANCE_BUILDER_FACE_FIELDS"), "shared face builder field list exists");
ok(face.includes("HARTHMERE_APPEARANCE_BUILDER_BODY_FIELDS"), "shared body builder field list exists");
ok(face.includes("canonicalizeHarthmereAppearanceBuilderField"), "canonical field alias resolver exists");
ok(face.includes('cheeks: "cheekStyle"'), "legacy cheeks alias maps to cheekStyle");
ok(face.includes('height: "bodyHeight"'), "legacy height alias maps to bodyHeight");
ok(face.includes("applyHarthmereAppearanceBuilderSelection(input"), "field selection applier exists");
ok(face.includes("applyHarthmereAppearanceBuilderSelectionToAppearance"), "appearance-level selection applier exists for player and NPCs");
ok(face.includes("auditHarthmereAppearanceBuilderFieldMappings"), "shared field mapping audit helper exists");
ok(!face.includes("return true;\n  return true;"), "duplicate return true cleanup applied");
ok(face.includes("makeHarthmereNpcAppearanceConfig({ id: 1, name: \"Audit NPC\" })"), "audit validates NPC appearance mapping too");

ok(wake.includes("applyHarthmereAppearanceBuilderSelection"), "wake screen imports central field applier");
ok(wake.includes("type HarthmereAppearanceBuilderField"), "wake screen uses typed canonical builder fields");
ok(wake.includes("field: HarthmereAppearanceBuilderField"), "option row requires canonical field prop");
ok(!wake.includes("const auditField = label.toLowerCase()"), "option row no longer derives field from visible label");
ok(wake.includes('new CustomEvent("biomes:harthmere-builder-selection-applied"'), "lightweight builder selection audit event emitted");
ok(wake.includes('data-harthmere-builder-field="customPronouns"'), "custom pronouns input is auditable");

for (const field of fields) {
  ok(face.includes(`"${field}"`), `shared mapping includes ${field}`);
  ok(wake.includes(`field="${field}"`) || field === "customPronouns", `wake screen row uses canonical field ${field}`);
}

const rowCount = (wake.match(/<HarthmereFaceOptionRow/g) || []).length;
const fieldPropCount = (wake.match(/field="(?:genderIdentity|pronouns|skinTone|faceShape|eyeShape|eyeColor|browStyle|noseStyle|mouthStyle|hairStyle|hairColor|facialHair|cheekStyle|accessory|bodyType|bodyHeight|shoulderWidth|armLength|legLength|stance|outfitColor)"/g) || []).length;
ok(rowCount === 21, `expected 21 option rows, found ${rowCount}`);
ok(fieldPropCount === 21, `all option rows have canonical field props, found ${fieldPropCount}`);

console.log(failed ? "\nRESULT: FAIL" : "\nRESULT: PASS");
process.exit(failed ? 1 : 0);
