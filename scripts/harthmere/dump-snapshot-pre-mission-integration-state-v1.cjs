const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const outDir = path.join(repo, 'harthmere-debug-dumps');
fs.mkdirSync(outDir, { recursive: true });
const files = [
  'src/client/game/resources/npcs.ts',
  'src/client/game/renderers/local_dev/harthmere_assets.ts',
  'src/server/shim/main.ts',
  'src/server/logic/utils/players.ts',
  'src/shared/npc/bikkie.ts',
  'src/shared/game/collision.ts',
  'src/shared/game/buffs.ts',
  'src/client/game/resources/placeables/helpers.ts',
];
const checks = [];
for (const rel of files) {
  const full = path.join(repo, rel);
  const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  checks.push({
    file: rel,
    exists: !!text,
    markers: {
      foundation: text.includes('BIOMES_START_IN_HARTHMERE'),
      runtimeBridge: text.includes('SNAPSHOT_RUNTIME_BRIDGE') || text.includes('GLITCH_BISCUIT_MODE'),
      extraTownOffset: text.includes('HARTHMERE_EXTRA_TOWN_OFFSET') || text.includes('harthmere-extra-town'),
      runtimeGate: text.includes('HARTHMERE_RUNTIME_GATE') || text.includes('snapshot merge runtime'),
      npcCosmeticsFallback: text.includes('SNAPSHOT_NPC_COSMETICS_FALLBACK_VERSION_V1'),
      npcTypeCompat: text.includes('LEGACY_SNAPSHOT_NPC') || text.includes('maybeIdToNpcType'),
      collisionCompat: text.includes('missing-AABB') || text.includes('SNAPSHOT_COLLISION'),
      buffCompat: text.includes('SNAPSHOT_BUFF_TYPE_COMPAT') || text.includes('maybeBuffType'),
      placeableFallback: text.includes('snapshot-placeable-galois-fallback') || text.includes('missingPlaceableGltf'),
    }
  });
}
let snapshotMissionTerms = null;
const snapshot = path.join(repo, 'snapshot_backup.json');
if (fs.existsSync(snapshot)) {
  const cp = require('child_process');
  const terms = ['quest_giver', 'QuestGiver', 'quest', 'mission', 'objective', 'trigger', 'dialog', 'challenge', 'task', 'talk_to', 'completeQuestStep'];
  snapshotMissionTerms = Object.fromEntries(terms.map((term) => {
    try {
      const result = cp.spawnSync('grep', ['-ao', term, snapshot], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
      const count = result.stdout ? result.stdout.trim().split('\n').filter(Boolean).length : 0;
      return [term, count];
    } catch (error) {
      return [term, `error:${error.message}`];
    }
  }));
}
const report = {
  version: 'snapshot-pre-mission-integration-state-v1',
  generatedAt: new Date().toISOString(),
  snapshotExists: fs.existsSync(snapshot),
  snapshotSizeBytes: fs.existsSync(snapshot) ? fs.statSync(snapshot).size : 0,
  snapshotMissionTerms,
  checks,
  recommendations: [
    'If NPCs are still beige/naked, verify SNAPSHOT_NPC_COSMETICS_FALLBACK_V1 logs appear for player-like NPCs without appearance/wearing.',
    'If snapshotMissionTerms has no quest/mission/objective/trigger counts, the upstream snapshot is world-state-only and mission migration should focus on Glitch/Harthmere quests rather than importing nonexistent snapshot missions.',
    'If snapshotMissionTerms shows meaningful mission data, run the next quest/mission reconciliation patch against those exact fields instead of guessing.'
  ]
};
const out = path.join(outDir, `snapshot-pre-mission-integration-state-v1.${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`WROTE ${out}`);
console.log(JSON.stringify({ snapshotExists: report.snapshotExists, snapshotSizeBytes: report.snapshotSizeBytes, snapshotMissionTerms: report.snapshotMissionTerms, checkedFiles: checks.length }, null, 2));
