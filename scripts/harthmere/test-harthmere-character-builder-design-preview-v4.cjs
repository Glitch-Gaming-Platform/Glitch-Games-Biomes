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
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

check("preview uses deterministic SVG full-body renderer", wake.includes('data-harthmere-builder-preview-svg="v4"'));
check("preview exposes a release-readable version marker", wake.includes('v24-svg-full-body-readable'));
check("preview renders core full-body parts", ["head", "torso", "left-leg", "right-leg", "left-foot", "right-foot"].every((part) => wake.includes(`data-harthmere-builder-preview-part="${part}"`)));
check("preview does not render overlapping Full body visible badge text", !wake.includes('Full body visible'));
check("preview does not render drag-ready badge text", !wake.includes('Drag-ready preview'));
check("mini face/body preview pair was removed from hero column", !wake.includes('<HarthmereVoxelFacePreview face={harthmereFace} />'));
check("preview helper uses one non-overlapping line", wake.includes('data-harthmere-builder-preview-helper="true"'));

check("choice cards use release design class", wake.includes('harthmere-builder-choice-card'));
check("option rows use flex-wrap chip row class", wake.includes('harthmere-builder-chip-row flex flex-wrap items-center gap-3'));
check("option buttons use shared chip class", wake.includes('harthmere-builder-chip rounded-full'));
check("selected face/body chip uses dark text on yellow", wake.includes('bg-amber-300 text-[#25143f]'));
check("selected clothing chip uses dark text on green", wake.includes('bg-emerald-300 text-[#25143f]'));
check("chips prevent label wrapping", css.includes('white-space: nowrap'));
check("chips use exact 12px flex gap", css.includes('gap: 12px'));
check("chips use standardized 8px 16px padding", css.includes('padding: 8px 16px'));
check("chips use larger readable font size", css.includes('font-size: 0.875rem'));
check("unselected chips have visible translucent background", css.includes('background: rgba(255, 255, 255, 0.1)'));
check("selected chip CSS uses dark purple text", css.includes('color: #25143f'));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
