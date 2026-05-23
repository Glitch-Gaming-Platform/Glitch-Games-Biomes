#!/usr/bin/env node
// SNAPSHOT_GROVE_PRODUCTION_DIALOGUE_V107:
// Verifies that on-screen onboarding text reads as natural NPC/world copy and
// does not leak dev/debug strings into the HUD, map panels, or NPC dialogue.
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    failures += 1;
    console.error(`FAIL ${msg}`);
  }
}
function failIf(cond, msg) { ok(!cond, msg); }

const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const quests = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");

// 1. The HUD systems panel no longer renders the dev "Rule refs:" line or the
//    dev-facing "What matters" bullets.
failIf(
  /Rule refs:\s*MMO_RULES/.test(hud),
  "HUD Biomes Systems panel does not show dev 'Rule refs: MMO_RULES ...' string",
);
failIf(
  hud.includes("The active tab stays visually highlighted."),
  "HUD does not render 'The active tab stays visually highlighted' dev bullet",
);
failIf(
  hud.includes("Key-driven entries now show why that panel opened."),
  "HUD does not render 'Key-driven entries now show why that panel opened' dev bullet",
);
failIf(
  hud.includes("Section copy is grouped so important info is easier to scan."),
  "HUD does not render 'Section copy is grouped ...' dev bullet",
);
ok(
  /SYSTEM_TAB_HIGHLIGHTS_V107/.test(hud),
  "HUD defines SYSTEM_TAB_HIGHLIGHTS_V107 production highlight copy per tab",
);
ok(
  /At a glance/.test(hud),
  "HUD uses an in-world 'At a glance' label in place of the dev 'What matters' label",
);

// 2. The Grove and Harthmere quest map panels no longer leak 'Rule refs:'
//    or design-bible references.
failIf(
  /Rule refs:\s*Grove Lore Bible/.test(quests),
  "Grove map panel no longer prints 'Rule refs: Grove Lore Bible ...'",
);
failIf(
  /Rule refs:\s*Town Design Bible/.test(quests),
  "Harthmere map panel no longer prints 'Rule refs: Town Design Bible ...'",
);
failIf(
  /Snapshot Map Guide Rule 3/.test(quests),
  "Harthmere map panel no longer references the internal 'Snapshot Map Guide Rule 3'",
);

// 3. NPC dialogue copy is naturalized: no "I will not mark it done from
//    chatter" meta line, no run-together sentence joins.
failIf(
  /I will not mark it done from chatter/.test(runtime),
  "NPC dialogue does not include the 'I will not mark it done from chatter' meta line",
);
failIf(
  />Your next move:\s*\$/.test(runtime),
  "NPC dialogue uses an in-world lead-in ('Next on the list') instead of 'Your next move:'",
);
ok(
  /Next on the list:/.test(runtime),
  "NPC dialogue uses 'Next on the list:' as the in-world objective lead-in",
);
ok(
  /Come find me back here at the fountain when/.test(runtime),
  "NPC dialogue closes with an in-world line tying back to the fountain",
);
// SNAPSHOT_GROVE_DIALOGUE_SPACING_V109:
// Paragraphs MUST be joined with {break} so unslugNpcDescription can split
// them; otherwise sentences run together as "go.Say" / "day.Next" / "words.I"
// like in the pre-v109 screenshots.
ok(
  /\.join\("\{break\}"\)/.test(runtime),
  "Grove NPC quest dialog paragraphs are joined with {break} (fixes run-on sentence bug)",
);
ok(
  !/<\/text><text>/.test(
    runtime
      .replace(/\/\/.*$/gm, "") // strip line comments
      .replace(/`<text>\$\{[^}]+\}<\/text>` \+ questCopy/, "OK"),
  ),
  "No raw </text><text> back-to-back joins in the runtime (paragraphs use {break} instead)",
);

// 4. HUD copy for the highlighted-panel hint and out-of-range button is
//    naturalized.
failIf(
  /Watch the blinking HUD item:/.test(runtime),
  "HUD callout no longer reads 'Watch the blinking HUD item: ...' (dev-speak)",
);
ok(
  /panel is\` : \`panels are\`/.test(runtime) ||
    /panel is|panels are/.test(runtime),
  "HUD highlight callout uses natural 'panel is' / 'panels are' phrasing",
);
failIf(
  /"Move closer to practice"/.test(runtime),
  "Out-of-range practice button no longer reads literal 'Move closer to practice'",
);
ok(
  /Walk to .* first/.test(runtime),
  "Out-of-range practice button names the marker the player needs to walk to",
);

// 5. Generic meta tags ("Current task:", "HUD lesson:", "Source:", "Compatibility
//    bridge", "snapshot task bridge", "dead bark") must not appear in any
//    onboarding-visible component.
const forbiddenMetaPhrases = [
  /Current task:/,
  /HUD lesson:/,
  /\bSource:\s/,
  /Compatibility bridge/,
  /snapshot task bridge/,
  /dead bark/,
  /TODO:/,
  /FIXME:/,
];
for (const re of forbiddenMetaPhrases) {
  failIf(
    re.test(runtime),
    `Grove runtime onboarding copy is free of meta phrase: ${re.source}`,
  );
}

// 6. Runtime version bump documents the polish pass.
ok(
  runtime.includes("snapshot-grove-bible-onboarding-polish-v107") ||
    runtime.includes("snapshot-grove-bible-graduation-chain-v108") ||
    runtime.includes("snapshot-grove-bible-tutor-highlights-v109") ||
    (runtime.includes("snapshot-grove-mission-critical-v110") || runtime.includes("snapshot-grove-mission-critical-v111")),
  "Grove runtime version constant records the v107 production-dialogue polish (or v108 successor)",
);

// 7. Pre-accept and completed-state dialogue stay in character.
ok(
  /Take this on if you have a quiet minute\./.test(runtime),
  "Pre-accept NPC line reads as a calm offer, not a system prompt",
);
ok(
  /stamps the lesson in your journal\./.test(runtime),
  "Completed-quest NPC line reads as a natural in-world wrap, not a status code",
);

if (failures) {
  console.error(`v107 Grove production dialogue check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v107 Grove production dialogue check passed");
