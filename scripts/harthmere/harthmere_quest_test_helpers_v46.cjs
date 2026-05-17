const fs = require("fs");
const path = require("path");

function readQuestModule(root) {
  const questPath = path.join(root, "src/shared/harthmere/quest_compendium_v46.ts");
  const src = fs.readFileSync(questPath, "utf8");
  const catalogMatch = src.match(/HARTHMERE_QUEST_CATALOG_V46_JSON = `([\s\S]*?)`;/);
  const policyMatch = src.match(/HARTHMERE_QUEST_COVERAGE_POLICY_V46_JSON = `([\s\S]*?)`;/);
  if (!catalogMatch) throw new Error("Could not find quest catalog JSON export");
  if (!policyMatch) throw new Error("Could not find quest policy JSON export");
  return { src, quests: JSON.parse(catalogMatch[1]), policy: JSON.parse(policyMatch[1]) };
}

function readNpcIds(root) {
  const files = [
    path.join(root, "src/shared/harthmere/npc_compendium_v44.ts"),
    path.join(root, "src/shared/harthmere/npc_compendium_v45.ts"),
  ];
  const ids = new Set();
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/"id"\s*:\s*"([^"]+)"/g)) ids.add(match[1]);
    for (const match of text.matchAll(/id:\s*"([^"]+)"/g)) ids.add(match[1]);
  }
  return ids;
}

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

module.exports = { readQuestModule, readNpcIds, check };
