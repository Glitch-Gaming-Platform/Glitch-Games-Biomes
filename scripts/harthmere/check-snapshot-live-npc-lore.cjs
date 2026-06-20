#!/usr/bin/env node
/* eslint-disable no-console */
// SNAPSHOT_LIVE_NPC_LORE_CHECK
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`MISSING ${rel}`);
    process.exitCode = 1;
    return "";
  }
  return fs.readFileSync(file, "utf8");
}
function ok(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  }
}

const shared = read("src/shared/harthmere/snapshot_live_npc_bible.ts");
const runtime = read("src/client/components/challenges/LocalDevSnapshotLiveNpcLoreRuntime.tsx");
const dialog = read("src/client/components/challenges/TalkToNPCDefaultDialog.tsx");
const doc = read("docs/harthmere/snapshot_grove_live_npc_bible.md");

ok(shared.includes("SNAPSHOT_LIVE_NPC_BIBLE_VERSION"), "shared live NPC bible registry exists");
ok(shared.includes("SNAPSHOT_LIVE_NPC_BIBLE_NO_NEW_NPCS = true"), "registry explicitly does not spawn new NPCs");
ok(shared.includes("SNAPSHOT_LIVE_NPC_BIBLE_EXCLUDES_HARTHMERE = true"), "registry explicitly excludes Harthmere");
ok(runtime.includes("SNAPSHOT_LIVE_NPC_LORE_RUNTIME_VERSION"), "client live NPC lore runtime exists");
ok(dialog.includes("useSnapshotLiveNpcLoreDialog"), "default NPC dialog imports live snapshot lore hook");
ok(dialog.includes("snapshotLiveNpcLoreDialog"), "default NPC dialog evaluates live snapshot lore dialog");
ok(dialog.indexOf("snapshotGroveNpcDialog") < dialog.indexOf("snapshotLiveNpcLoreDialog"), "Grove bible NPCs keep priority before live supplemental NPC lore");
ok(dialog.indexOf("snapshotLiveNpcLoreDialog") < dialog.indexOf("localDevHarthmereDialog"), "live supplemental lore runs before Harthmere fallback but excludes Harthmere names");
ok(doc.includes("This document does **not** add new NPCs"), "bible document states no new NPC creation");
ok(doc.includes("It does **not** apply to Harthmere NPCs"), "bible document states Harthmere exclusion");

const expectedNames = [
  "Allix",
  "Helsa",
  "Drona",
  "Coretta",
  "Patsy",
  "Gizela",
  "Grover",
  "Alva",
  "Davi",
  "Runna",
  "Richard",
  "Emily",
];
for (const name of expectedNames) {
  ok(shared.includes(`displayName: "${name}"`), `live snapshot NPC lore includes ${name}`);
  ok(doc.includes(`### ${name}`), `bible document includes ${name}`);
}

const harthmereNames = [
  "Sergeant Bram Holt",
  "Father Aldren",
  "Market Board",
];
for (const name of harthmereNames) {
  const bodyWithoutExcludedList = shared.replace(/SNAPSHOT_LIVE_NPC_EXCLUDED_HARTHMERE_NAMES[\s\S]*?\] as const;/, "");
  ok(!bodyWithoutExcludedList.includes(`displayName: "${name}"`), `Harthmere NPC ${name} is not added as live snapshot lore`);
}

ok(runtime.includes("Ask about their story"), "dialog exposes story background action");
ok(runtime.includes("Ask what they do here"), "dialog exposes current role/action");
ok(runtime.includes("Ask what matters to them"), "dialog exposes motivation action");
ok(runtime.includes("__snapshotLiveNpcBible"), "debug helper exposes live NPC bible audit");

if (process.exitCode) {
  console.error("current live snapshot NPC lore check failed");
  process.exit(process.exitCode);
}
console.log("current live snapshot NPC lore check passed");
