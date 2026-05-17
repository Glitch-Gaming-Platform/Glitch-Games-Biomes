#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const dialoguePath = path.join(root, "src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx");
const questsPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereQuests.tsx");

let failed = 0;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

const dialogue = fs.readFileSync(dialoguePath, "utf8");
const quests = fs.readFileSync(questsPath, "utf8");

const forbiddenDialogue = [
  "They keep the conversation practical",
  "leave room for you to ask more",
  "How do conversations work here?",
  "Dialogue choices are labeled",
  "optional lore",
  "mission journal",
  "local-dev dialogue memory",
  "NPCs will treat repeat conversations like first-time local-dev conversations",
  "Current lead:",
  "deeper lore optional",
];

for (const phrase of forbiddenDialogue) {
  check(`dialogue does not contain meta phrase: ${phrase}`, !dialogue.includes(phrase));
}

check("fallback relation tone uses role-aware neutral line", dialogue.includes("neutralRoleTone(offset)"));
check("generic fallback mentions Harthmere in-world business", dialogue.includes("what brought you to Harthmere"));
check("merchant neutral line is about counter and goods", dialogue.includes("goods closest to the counter"));
check("guard neutral line is about watch/business", dialogue.includes("steady watch on the street"));
check("board action is in-world notices", dialogue.includes('name: "How do I read the notices?"'));
check("old short-version action was replaced", !dialogue.includes('name: "Give me the short version."'));
check("new local-need action exists", dialogue.includes('name: "What needs doing here?"'));
check("quest compactor accepts new local-need action", quests.includes('action.name === "What needs doing here?"'));
check("quest compactor accepts new board notice action", quests.includes('action.name === "How do I read the notices?"'));
check("quest follow-up no longer points to mission journal", !quests.includes("mission journal"));
check("market board first line is in-world", dialogue.includes("Fresh ink marks urgent work first"));
check("role lines avoid explaining conversation design", !/ROLE_LINES[\s\S]*conversation starts/.test(dialogue));
check("role lines avoid optional lore wording", !/ROLE_LINES[\s\S]*optional lore/.test(dialogue));

console.log(`\nRESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
