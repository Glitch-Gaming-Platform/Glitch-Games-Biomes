#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const wake = fs.readFileSync(path.join(root, "src/client/components/WakeUpScreen.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/client/styles/edit_character.css"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}
check("builder keeps release layout marker for existing suite", wake.includes('data-harthmere-builder-layout="v21-release-polish-clothing"'));
check("builder keeps legacy v22 UI marker while v24 preview is active", wake.includes('data-harthmere-builder-ui-version="v22-full-body-readable-chips"') && wake.includes('v24-svg-full-body-readable'));
check("preview uses deterministic full-body release component", wake.includes("const HarthmereReleaseHeroPreview") && wake.includes("data-harthmere-builder-full-body-preview"));
check("main preview no longer relies on cropped CharacterPreview canvas", wake.includes("<HarthmereReleaseHeroPreview") && !wake.includes('previewSlot={makePreviewSlot("appearencePreview")}' ));
check("full body preview is explicitly marked with non-overlapping SVG data", wake.includes('data-harthmere-builder-preview-svg="v4"') && !wake.includes("Full body visible"));
check("choice cards remove duplicate selected-value pill", !wake.includes("max-w-[10rem] truncate rounded-full border border-amber-200/15"));
check("face/body option chips expose explicit selected state", wake.includes("data-harthmere-choice-chip") && wake.includes("data-harthmere-choice-chip-selected"));
check("selected face/body chip uses solid high-contrast accent", wake.includes("bg-amber-300 text-[#25143f]") || wake.includes("bg-amber-300 text-slate-950"));
check("unselected face/body chip remains visibly clickable", wake.includes("bg-white/[0.075] text-white/90"));
check("clothing chips expose explicit selected state", wake.includes("data-harthmere-clothing-chip") && wake.includes("data-harthmere-clothing-chip-selected"));
check("selected clothing chip uses solid high-contrast accent", wake.includes("bg-emerald-300 text-[#25143f]") || wake.includes("bg-emerald-300 text-slate-950"));
check("CTA copy is action oriented", wake.includes("Enter Harthmere") && !wake.includes("That&apos;s right"));
check("CSS hardens selected/unselected visual states", css.includes("Harthmere character builder v22 release readability patch") && css.includes('[data-harthmere-choice-chip-selected="true"]') && css.includes('[data-harthmere-clothing-chip-selected="true"]'));
check("CSS prevents faded controls", css.includes("opacity: 1") && css.includes("filter: none"));
if (!ok) process.exit(1);
console.log("RESULT: PASS");
