#!/usr/bin/env node
/* eslint-disable no-console */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const authored = [];

// Flatten every authored source into one corpus so duplication across systems
// is caught, not merely repetition within each individual module.
function add(source, actorId, lines) {
  for (const [index, raw] of lines.entries()) {
    const line = String(raw ?? "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!line) throw new Error(`${source}:${actorId}:${index} is empty`);
    authored.push({ source, actorId, index, line });
  }
}

function parseCompendiumArray(text, name) {
  const match = text.match(
    new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]) as const;`)
  );
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}

const compendiumText = fs.readFileSync(
  path.join(root, "src/shared/harthmere/npc_compendium.ts"),
  "utf8"
);
for (const npc of [
  ...parseCompendiumArray(compendiumText, "HARTHMERE_NAMED_NPCS"),
  ...parseCompendiumArray(compendiumText, "HARTHMERE_REMAINING_NPCS"),
]) {
  add("compendium", npc.id, Object.values(npc.dialogue));
}

const {
  SNAPSHOT_GROVE_NPCS,
} = require("../../src/shared/harthmere/snapshot_grove_content.ts");
for (const npc of SNAPSHOT_GROVE_NPCS) {
  add("grove_protected", npc.id, [npc.line, ...npc.extraLines]);
}

const {
  SNAPSHOT_GROVE_AMBIENT_DIALOGUE,
} = require("../../src/shared/harthmere/snapshot_grove_ambient_dialogue.ts");
for (const [npcId, lines] of Object.entries(SNAPSHOT_GROVE_AMBIENT_DIALOGUE)) {
  add("grove_ambient", npcId, lines);
}

const {
  SNAPSHOT_LIVE_NPC_LORE,
} = require("../../src/shared/harthmere/snapshot_live_npc_bible.ts");
for (const npc of SNAPSHOT_LIVE_NPC_LORE) {
  add("snapshot_live", npc.id, [npc.line, ...npc.extraLines]);
}

const {
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_owner_npc_seed.ts");
for (const npc of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS) {
  add("business_owner", npc.ownerNpcId, [
    npc.line,
    ...npc.ambientLines,
    ...npc.extraLines,
  ]);
}

const {
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_customer_npc_seed.ts");
for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
  add("business_customer", npc.customerNpcId, [npc.line, ...npc.extraLines]);
}

const {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
} = require("../../src/shared/harthmere/live_entity_production_seed.ts");
for (const robot of HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS) {
  add("robot_sentinel", robot.seedId, robot.dialog.split("{break}"));
}

// starterTownNpcs() is intentionally local to the shim, so read its authored
// starterNpc(... npcDialog(...)) calls through the TypeScript AST instead of
// exporting runtime-only setup data into shared code.
const shimPath = path.join(root, "src/server/shim/main.ts");
const shimText = fs.readFileSync(shimPath, "utf8");
const sourceFile = ts.createSourceFile(
  shimPath,
  shimText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
let starterTownFunction;
function findStarterTown(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "starterTownNpcs") {
    starterTownFunction = node;
  }
  ts.forEachChild(node, findStarterTown);
}
findStarterTown(sourceFile);
if (!starterTownFunction) throw new Error("Could not find starterTownNpcs");

function collectStarterTown(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "starterNpc"
  ) {
    const displayName = node.arguments[1]?.text;
    const dialog = node.arguments[4];
    if (
      displayName &&
      ts.isCallExpression(dialog) &&
      ts.isIdentifier(dialog.expression) &&
      dialog.expression.text === "npcDialog"
    ) {
      add(
        "starter_town",
        displayName,
        dialog.arguments.map((argument) => argument.text).filter(Boolean)
      );
    }
  }
  ts.forEachChild(node, collectStarterTown);
}
collectStarterTown(starterTownFunction);

const seen = new Map();
for (const entry of authored) {
  // Keep this list narrow: ordinary in-world uses of words such as "test"
  // should not be confused with actual implementation/debug language.
  if (
    /\b(local-dev|placeholder|debug|renderer|spawn height|smoke test|test chain|gameplay|production mesh|missing asset)\b/i.test(
      entry.line
    )
  ) {
    throw new Error(
      `${entry.source}:${entry.actorId}:${entry.index} contains implementation language`
    );
  }
  const normalized = entry.line.toLocaleLowerCase().replace(/\s+/g, " ");
  const prior = seen.get(normalized);
  if (prior) {
    throw new Error(
      `${entry.source}:${entry.actorId}:${entry.index} duplicates ${prior.source}:${prior.actorId}:${prior.index}`
    );
  }
  seen.set(normalized, entry);
}

console.log(
  `RESULT: PASS ${authored.length} authored Harthmere/Grove dialogue lines are globally unique and in-world`
);
