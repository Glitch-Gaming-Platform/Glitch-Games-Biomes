const fs = require("fs");
const path = require("path");

function read(root, rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function checkFactory() {
  let ok = true;
  return {
    check(label, condition) {
      if (condition) console.log(`OK ${label}`);
      else {
        ok = false;
        console.log(`FAIL ${label}`);
      }
    },
    finish() {
      console.log("");
      if (!ok) {
        console.log("RESULT: FAIL");
        process.exit(1);
      }
      console.log("RESULT: PASS");
    },
  };
}

function ruleSource(root) {
  return read(root, "src/client/components/challenges/LocalDevHarthmereDialogueRuleSystem.tsx");
}

function dialogueFacingSources(root) {
  const rels = [
    "src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
    "src/client/components/challenges/LocalDevHarthmereNpcSystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereNpcBehaviorSystem.ts",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
    "src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx",
    "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx",
  ];
  return rels.map((rel) => ({ rel, text: read(root, rel) })).filter((entry) => entry.text);
}

module.exports = { read, checkFactory, ruleSource, dialogueFacingSources };
