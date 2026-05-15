#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
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

ok(wake.includes("HARTHMERE_APPEARANCE_BUILDER_FACE_FIELDS"), "wake imports canonical face field list");
ok(wake.includes("HARTHMERE_APPEARANCE_BUILDER_BODY_FIELDS"), "wake imports canonical body field list");
ok(wake.includes("__harthmereBuilderCoverageReport"), "window coverage report helper is exposed");
ok(wake.includes("biomes:harthmere-builder-state-ready"), "builder state-ready event is emitted");
ok(wake.includes("missingDomFields"), "coverage report checks missing DOM controls");
ok(wake.includes("missingFaceValues"), "coverage report checks missing face values");
ok(wake.includes("missingBodyValues"), "coverage report checks missing body values");
ok(wake.includes('updateHarthmereBuilderField("customPronouns", event.target.value)'), "custom pronouns uses canonical mapping path");
ok(wake.includes("currentValue"), "selection-applied event reports current value");
ok(wake.includes("matched:"), "selection-applied event reports matched status");
ok(wake.includes("expectedFields"), "selection-applied event reports expected field coverage");
ok(!wake.includes("updateHarthmereFace({ customPronouns: event.target.value })"), "custom pronouns no longer bypasses central mapping");

const requiredFields = [
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

for (const field of requiredFields) {
  ok(wake.includes(field), `wake coverage references ${field}`);
}

console.log(failed ? "\nRESULT: FAIL" : "\nRESULT: PASS");
process.exit(failed ? 1 : 0);
