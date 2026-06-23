const fs = require("fs");
const path = require("path");

function readQuestModule(root) {
  const questPath = path.join(root, "src/shared/harthmere/quest_compendium.ts");
  const src = fs.readFileSync(questPath, "utf8");

  // Import the generated TypeScript module instead of scraping template literals.
  // Some quest dialogue includes escaped quotes, and regex extraction parses a
  // different string than the TypeScript runtime ships to the game.
  require("ts-node/register/transpile-only");
  require("tsconfig-paths/register");
  const questModule = require(questPath);
  if (!Array.isArray(questModule.HARTHMERE_QUEST_CATALOG)) {
    throw new Error("Could not load quest catalog export");
  }
  if (!questModule.HARTHMERE_QUEST_COVERAGE_POLICY) {
    throw new Error("Could not load quest policy export");
  }
  return {
    src,
    quests: questModule.HARTHMERE_QUEST_CATALOG,
    policy: questModule.HARTHMERE_QUEST_COVERAGE_POLICY,
  };
}

function readNpcIds(root) {
  const files = [
    path.join(root, "src/shared/harthmere/npc_compendium.ts"),
    path.join(root, "src/shared/harthmere/npc_compendium.ts"),
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
