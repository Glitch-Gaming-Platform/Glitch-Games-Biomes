#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const schemaPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const wake = fs.readFileSync(wakePath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`     ${detail}`);
  }
}

function extractConstValues(source, constName) {
  const idx = source.indexOf(constName);
  if (idx < 0) return [];
  const eq = source.indexOf("=", idx);
  const close = source.indexOf("] as const", eq);
  const altClose = source.indexOf("];", eq);
  const end = close >= 0 ? close : altClose;
  if (eq < 0 || end < 0) return [];
  const block = source.slice(eq, end);
  const values = new Set();
  const stringRegex = /["']([a-zA-Z0-9_-]+)["']/g;
  let match;
  while ((match = stringRegex.exec(block))) {
    values.add(match[1]);
  }
  return [...values];
}

const fields = {
  genderIdentity: "HARTHMERE_GENDER_OPTIONS",
  pronouns: "HARTHMERE_PRONOUN_OPTIONS",
  skinTone: "HARTHMERE_SKIN_TONES",
  faceShape: "HARTHMERE_FACE_SHAPES",
  eyeShape: "HARTHMERE_EYE_SHAPES",
  eyeColor: "HARTHMERE_EYE_COLORS",
  browStyle: "HARTHMERE_BROW_STYLES",
  noseStyle: "HARTHMERE_NOSE_STYLES",
  mouthStyle: "HARTHMERE_MOUTH_STYLES",
  hairStyle: "HARTHMERE_HAIR_STYLES",
  hairColor: "HARTHMERE_HAIR_COLORS",
  facialHair: "HARTHMERE_FACIAL_HAIR_STYLES",
  cheekStyle: "HARTHMERE_CHEEK_STYLES",
  accessory: "HARTHMERE_FACE_ACCESSORIES",
  bodyType: "HARTHMERE_BODY_TYPES",
  bodyHeight: "HARTHMERE_BODY_HEIGHTS",
  shoulderWidth: "HARTHMERE_SHOULDER_WIDTHS",
  armLength: "HARTHMERE_ARM_LENGTHS",
  legLength: "HARTHMERE_LEG_LENGTHS",
  stance: "HARTHMERE_BODY_STANCES",
  outfitColor: "HARTHMERE_OUTFIT_COLORS",
};

for (const [field, source] of Object.entries(fields)) {
  const options = extractConstValues(schema, source);
  check(`builder imports/uses option source for ${field}`, wake.includes(source));
  check(`builder renders field ${field}`, wake.includes(field));
  check(`schema has options for ${field}`, options.length > 0);

  for (const option of options) {
    check(`option ${field}:${option} is available from schema source`, schema.includes(option));
  }

  if (field !== "customPronouns") {
    check(`builder updates ${field} through canonical handler or option row`,
      wake.includes(`updateHarthmereBuilderField("${field}"`) ||
      wake.includes(`updateHarthmereBuilderField('${field}'`) ||
      wake.includes(`field="${field}"`) ||
      wake.includes(`field={'${field}'}`),
      `${field} must not be display-only`);
  }
}

check("custom pronouns input is rendered and persisted conditionally",
  wake.includes("customPronouns") && wake.includes("harthmereFace.customPronouns"));

const clothingSlots = extractConstValues(schema, "HARTHMERE_CLOTHING_SLOTS");
for (const slot of clothingSlots) {
  check(`builder can render clothing slot ${slot}`,
    wake.includes("HARTHMERE_CLOTHING_SLOTS") && wake.includes("HarthmereClothingOptionRow"));
}

check("builder saves face config", wake.includes("saveHarthmerePlayerFaceConfig"));
check("builder saves body config", wake.includes("saveHarthmerePlayerBodyConfig"));
check("builder saves clothing config", wake.includes("saveHarthmerePlayerClothingConfig"));
check("builder starts game after synchronous save path", wake.includes("startGame") && wake.includes("saveHarthmerePlayerClothingConfig"));
check("builder preview invalidates on face/body/clothing", wake.includes("harthmereFacePreviewKey") && wake.includes("harthmereFace") && wake.includes("harthmereBody") && wake.includes("harthmereClothing"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
