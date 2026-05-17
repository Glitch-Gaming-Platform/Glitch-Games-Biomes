#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const wake = fs.readFileSync(path.join(root, "src/client/components/WakeUpScreen.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/client/styles/edit_character.css"), "utf8");
const runtime = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const cval = fs.existsSync(path.join(root, "src/client/components/CvalHUD.tsx"))
  ? fs.readFileSync(path.join(root, "src/client/components/CvalHUD.tsx"), "utf8")
  : "";
const building = fs.existsSync(path.join(root, "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx"))
  ? fs.readFileSync(path.join(root, "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx"), "utf8")
  : "";
const guild = fs.existsSync(path.join(root, "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx"))
  ? fs.readFileSync(path.join(root, "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx"), "utf8")
  : "";

let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); }
}

check("builder uses actual CharacterPreview", wake.includes("<CharacterPreview"));
check("actual preview is in a small dedicated frame", wake.includes('data-harthmere-builder-real-avatar-preview="true"') && css.includes("harthmere-builder-real-avatar-frame"));
check("actual preview camera is zoomed out", /new Spherical\(\s*7\.75/.test(wake) && wake.includes("cameraFOV={30}"));
check("actual preview keeps wearable overrides", wake.includes("wearableOverrides={wearableOverrides}"));
check("option area remains scrollable", wake.includes('data-harthmere-builder-options-scroll="true"') && css.includes("overflow-y: auto !important"));
check("compact chip rows remain enforced", css.includes("flex-wrap: wrap !important") && css.includes("padding: 5px 10px !important"));
check("CvalHUD unsupported react-json-view props are removed", !/indentWidth|displayDataTypes|displayObjectSize|quotesOnKeys|iconStyle|name=/.test(cval));
check("building/guild do not require missing HarthmereInventoryState import", !building.includes('): HarthmereInventoryState["recent"][number]') && !guild.includes('): HarthmereInventoryState["recent"][number]'));
check("NPC clothing uses material recolor, not only spatial shell", runtime.includes("setHarthmereRuntimeNpcMeshColorV28") && runtime.includes("townsperson-body"));
check("NPC clothing recolor is called from procedural townsperson path", runtime.includes("addHarthmereRuntimeNpcClothingMaterialRecolorV28(root, appearance, body, palette, torsoY, shoulderY);"));
check("scholar comparison is string-safe", !runtime.includes('role === "scholar"'));

if (!ok) { console.error("RESULT: FAIL"); process.exit(1); }
console.log("RESULT: PASS");
