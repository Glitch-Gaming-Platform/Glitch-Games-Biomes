#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const cssPath = path.join(root, "src/client/styles/edit_character.css");
const wake = fs.readFileSync(wakePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

check("actual face preview component exists", wake.includes("HarthmereActualFacePreview"));
check("actual face preview uses CharacterPreview", /HarthmereActualFacePreview[\s\S]*<CharacterPreview/.test(wake));
check("actual face preview targets head height", wake.includes("controlTarget={new Vector3(0, 1.42, 0)}"));
check("actual face preview uses close face camera", wake.includes("new Spherical(") && wake.includes("2.05"));
check("actual face preview keeps wearable overrides", wake.includes("wearableOverrides={wearableOverrides}"));
check("old mini fake face usage is replaced in the side card", !wake.includes("<HarthmereVoxelFacePreview face={harthmereFace} />"));
check("actual face preview CSS keeps frame small", css.includes("harthmere-actual-face-preview-frame") && css.includes("height: 9.25rem !important"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
