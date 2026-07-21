#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const compendiumPath = path.join(
  root,
  "src",
  "shared",
  "harthmere",
  "npc_compendium.ts"
);
const text = fs.readFileSync(compendiumPath, "utf8");

function parseArray(name) {
  const match = text.match(
    new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]) as const;`)
  );
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}

const npcs = [
  ...parseArray("HARTHMERE_NAMED_NPCS"),
  ...parseArray("HARTHMERE_REMAINING_NPCS"),
];
const fields = ["greeting", "service", "rumor", "questOffer", "farewell"];
const seen = new Map();

for (const npc of npcs) {
  const local = new Set();
  for (const field of fields) {
    const line = npc.dialogue?.[field];
    if (typeof line !== "string" || line.length < 45) {
      throw new Error(`${npc.id}.${field} is missing or too short`);
    }
    if (
      /\b(testing|placeholder|debug|todo|local-dev|spawn|renderer)\b/i.test(
        line
      )
    ) {
      throw new Error(`${npc.id}.${field} contains implementation language`);
    }
    const normalized = line.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (local.has(normalized)) {
      throw new Error(
        `${npc.id}.${field} repeats another line for the same NPC`
      );
    }
    local.add(normalized);
    const prior = seen.get(normalized);
    if (prior) throw new Error(`${npc.id}.${field} duplicates ${prior}`);
    seen.set(normalized, `${npc.id}.${field}`);
  }
}

const expected = npcs.length * fields.length;
if (seen.size !== expected) {
  throw new Error(`Expected ${expected} unique lines, found ${seen.size}`);
}

console.log(
  `RESULT: PASS ${seen.size} unique dialogue lines across ${npcs.length} Harthmere compendium NPCs`
);
