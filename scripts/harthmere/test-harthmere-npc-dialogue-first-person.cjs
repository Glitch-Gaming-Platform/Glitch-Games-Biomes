const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const checks = [
  {
    rel: "src/shared/harthmere/npc_dialog_fallback.ts",
    patterns: [
      /\$\{name\}\s+(?:keeps|is|knows|listens|works|has|points)\b/,
      /They take the offer seriously/,
      /name:\s*"Offer a hand"/,
    ],
  },
  {
    rel: "src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx",
    patterns: [
      /return\s+"They\b/,
      /return\s+"The guard\b/,
      /lines\.push\(\s*`They\b/,
      /\$\{name\}\s+(?:points|says|gives|softens|decides|never)\b/,
    ],
  },
  {
    rel: "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
    patterns: [
      /\b(?:Maren|Merl|Brann|Luma|Edrin|Tilda|Garrick|Bram|Mara|Osric|Elowen|Aldren|Nessa|Tovin|Hal|Maelle|Ysabet|Ora|Pip|Bela|Kip|Luth|Anwen|Ren)\s+(?:checks|sorts|points|keeps|watches|smells|measures|knows|names|weighs|answers|talks|offers|speaks|carries|heard|says|will|is|does|takes|notes|records|stamps|quotes|buys|closes|treats|reacts|turns|pulls|secures|explains|shows|gives|asks|admits|unlocks|lists|gets|mixes|blesses|decides|denies|declares|lowers|rests|lets|cares|makes|can|accepts)\b/,
    ],
  },
  {
    rel: "src/client/components/challenges/LocalDevHarthmereNpcBehaviorSystem.ts",
    patterns: [
      /dialogueLine:\s*`\$\{profile\.name\}/,
      /routeStop\([^\n]+`\$\{profile\.name\}/,
    ],
  },
  ...[
    "src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereClassSkillSystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx",
  ].map((rel) => ({
    rel,
    patterns: [
      /followUpText:\s*`?\$\{[^}]+\.name\}/,
      /followUpText:\s*`?\$\{name\}/,
      /followUpText:\s*\n\s*"(?:The|They|Merl|Maren|Bram|Garrick|Aldren|Nessa|Tovin|The trainer|The clerk|The smith|The fence|The dockhand)\b/,
    ],
  })),
  {
    rel: "src/pages/api/npcs/generated_chat.ts",
    required: [
      /Speak as \$\{npcName\} in first person/,
      /using "I" statements/,
    ],
  },
];

let failed = false;
for (const check of checks) {
  const source = read(check.rel);
  for (const pattern of check.patterns ?? []) {
    if (pattern.test(source)) {
      console.error(`FAIL ${check.rel}: found third-person dialogue pattern ${pattern}`);
      failed = true;
    }
  }
  for (const pattern of check.required ?? []) {
    if (!pattern.test(source)) {
      console.error(`FAIL ${check.rel}: missing first-person guardrail ${pattern}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("RESULT: PASS harthmere NPC dialogue first-person guardrails current");
