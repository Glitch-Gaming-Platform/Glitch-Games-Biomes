#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const repo = path.resolve(__dirname, '..', '..');
const outDir = path.join(repo, 'harthmere-debug-dumps');
fs.mkdirSync(outDir, { recursive: true });
const snapshotPath = path.join(repo, 'snapshot_backup.json');
const sourceFiles = [
  'src/server/shim/main.ts',
  'src/client/game/renderers/local_dev/harthmere_assets.ts',
  'src/shared/harthmere/main_quest_spaces_v47.ts',
  'src/shared/harthmere/town_registry.ts',
].map((rel) => path.join(repo, rel)).filter(fs.existsSync);
const terms = ['quest_giver', 'QuestGiver', 'quest', 'mission', 'objective', 'trigger', 'dialog', 'Market Board', 'Missing Bell', 'Harthmere', 'Hawthorn'];
function scanText(text, file, limit = 300) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (terms.some((term) => line.includes(term))) {
      hits.push({ file, line: i + 1, text: line.slice(0, 320) });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}
async function scanSnapshotBackup(limit = 500) {
  const result = { exists: fs.existsSync(snapshotPath), sizeBytes: 0, termCounts: {}, samples: [] };
  if (!result.exists) return result;
  result.sizeBytes = fs.statSync(snapshotPath).size;
  for (const t of terms) result.termCounts[t] = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(snapshotPath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    for (const term of terms) {
      if (line.includes(term)) {
        result.termCounts[term]++;
        if (result.samples.length < limit) result.samples.push({ line: lineNo, term, text: line.slice(0, 600) });
      }
    }
  }
  return result;
}
(async () => {
  const sourceHits = [];
  for (const file of sourceFiles) sourceHits.push(...scanText(fs.readFileSync(file, 'utf8'), path.relative(repo, file)));
  const snapshot = await scanSnapshotBackup();
  const report = { version: 'snapshot-quest-mission-dump-v1', generatedAt: new Date().toISOString(), purpose: 'Baseline before merging snapshot missions/quests into Glitch/Harthmere systems.', snapshotBackup: snapshot, sourceHits, nextPatchRecommendation: ['Reconcile quest_giver NPC ids after Harthmere extra-town offset.', 'Extract snapshot quest/objective entities from snapshot_backup.json once exact component names are confirmed.', 'Map Harthmere Market Board/Missing Bell chain separately from upstream snapshot quests.', 'Only then patch mission/quest UI and server objective flow.'] };
  const out = path.join(outDir, `snapshot-quest-mission-state-v1.${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`WROTE ${out}`);
  console.log(JSON.stringify({ sourceHits: sourceHits.length, snapshotExists: snapshot.exists, snapshotSizeBytes: snapshot.sizeBytes, snapshotTermCounts: snapshot.termCounts, sampleCount: snapshot.samples.length }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
