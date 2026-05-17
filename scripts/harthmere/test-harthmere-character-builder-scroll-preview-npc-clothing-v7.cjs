#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const wake = fs.readFileSync(path.join(root, "src/client/components/WakeUpScreen.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/client/styles/edit_character.css"), "utf8");
const runtime = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { ok = false; console.error(`FAIL ${label}`); } }
check("options are wrapped in a dedicated scroll container", wake.includes('data-harthmere-builder-options-scroll="true"'));
check("scroll container is vertically scrollable", css.includes(".harthmere-builder-options-scroll") && css.includes("overflow-y: auto !important"));
check("preview uses guaranteed tiny svg avatar", wake.includes('data-harthmere-builder-preview-avatar="tiny-svg"'));
check("preview svg contains visible avatar geometry", wake.includes("Harthmere character preview") && wake.includes('<ellipse cx="80" cy="205"'));
check("chips are compact wrapped rows", css.includes("flex-wrap: wrap !important") && css.includes("padding: 5px 10px !important"));
check("selected chip text remains dark", css.includes("color: #241342 !important"));
check("new runtime clothing function is unconditional and role colored", runtime.includes("addHarthmereRuntimeAlwaysVisibleNpcClothingV27") && runtime.includes("runtime-always-visible-clothing-torso-front-v27"));
check("new runtime clothing is called after human anchors", runtime.includes("addHarthmereRuntimeHumanAnchors(root, body);\n  addHarthmereRuntimeAlwaysVisibleNpcClothingV27"));
check("new runtime clothing is pushed far outside body", runtime.includes("const frontZ = -0.48") && runtime.includes("const backZ = 0.48"));
if (!ok) { console.error("RESULT: FAIL"); process.exit(1); }
console.log("RESULT: PASS");
