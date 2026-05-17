#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const wake = fs.readFileSync(path.join(root, "src/client/components/WakeUpScreen.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/client/styles/edit_character.css"), "utf8");
const runtime = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

check("builder uses real CharacterPreview again", wake.includes("<CharacterPreview"));
check("builder preview camera is zoomed out to make hero small", /new Spherical\(\s*7\.5/.test(wake));
check("builder passes wearable overrides to preview", wake.includes("wearableOverrides={wearableOverrides}"));
check("option rows use compact pill group", wake.includes('className="harthmere-builder-pill-group"'));
check("chips use shared selected/unselected classes", wake.includes("harthmere-builder-chip-selected"));
check("CSS forces row flex-wrap layout", css.includes("flex-wrap: wrap !important") && css.includes("justify-content: flex-start !important"));
check("CSS forces compact chip padding", css.includes("padding: 6px 12px !important"));
check("CSS selected chips have dark text", css.includes("color: #241342 !important"));
check("runtime has outside clothing shell function", runtime.includes("addHarthmereRuntimeOutsideClothingShellV26"));
check("runtime clothing shell is deliberately outside body", runtime.includes("const frontZ = -0.42") && runtime.includes("const backZ = 0.42"));
check("procedural townspeople call outside clothing shell", runtime.includes("addHarthmereRuntimeOutsideClothingShellV26(root, appearance.clothing, body, palette);"));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
