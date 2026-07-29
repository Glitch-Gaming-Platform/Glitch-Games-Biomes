#!/usr/bin/env node
// check-harthmere-quest-bible-grounded.cjs
//
// Smoke check for patch 02 + 03. Walks the quest catalog in plain text
// and asserts the high-leverage facts that the deeper TS test
// (harthmere_quest_bible_grounded.test.ts) checks structurally.
// Designed to be runnable from a stock node binary without yarn install,
// so the existing biomes-test-output harness can include it.

const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let failures = 0;
function ok(condition, message) {
  if (condition) { console.log(`OK ${message}`); }
  else { failures += 1; console.error(`FAIL ${message}`); }
}
function countMatches(text, re) { return [...text.matchAll(re)].length; }

const catalogFile = read('src/shared/harthmere/bible/bible_quest_catalog.ts');

// Extract the JSON catalog literal.
// Audit fix (2026-07-13): the catalog now contains template-literal escape
// sequences (\\\" etc.), so parsing the RAW file text as JSON fails. Evaluate
// the backtick literal in an empty VM context — exactly what the TS runtime
// does — and JSON.parse the resulting string.
const m = catalogFile.match(/HARTHMERE_QUEST_CATALOG_JSON\s*=\s*(`\[[\s\S]*?\]`);/);
ok(!!m, 'quest catalog JSON literal is locatable');
let catalog = [];
try {
  const jsonText = require('vm').runInNewContext(m[1], {});
  catalog = JSON.parse(jsonText);
} catch (err) {
  failures += 1;
  console.error('FAIL quest catalog JSON parses:', err.message);
}

ok(catalog.length === 85, `quest catalog has 85 entries (got ${catalog.length})`);

// 1. No placeholder dialogue.
const PLACEHOLDER_PATTERNS = [
  /frames\s+"[^"]+"\s+with a clear reason/i,
  /\bactive text for "/i,
  /\bready-to-complete text for "/i,
  /\bcompletion text for "/i,
  /\bfailure text for "/i,
  /no out-of-world scaffolding language/i,
];
let placeholderCount = 0;
for (const quest of catalog) {
  const d = quest.dialogue || {};
  for (const field of ['offer', 'active', 'ready', 'complete', 'fail']) {
    const text = d[field] || '';
    for (const pat of PLACEHOLDER_PATTERNS) {
      if (pat.test(text)) { placeholderCount += 1; break; }
    }
  }
}
ok(placeholderCount === 0, `no placeholder/meta-text in quest dialogue (found ${placeholderCount})`);

// 2. Every dialogue field is non-empty and at least 40 chars.
let shortCount = 0;
for (const quest of catalog) {
  for (const field of ['offer', 'active', 'ready', 'complete', 'fail']) {
    const text = (quest.dialogue || {})[field] || '';
    if (text.length < 40) { shortCount += 1; }
  }
}
ok(shortCount === 0, `every dialogue field is at least 40 chars (${shortCount} too short)`);

// 3. Sanity: a few specific bible-voice lifts must be present where authored.
ok(catalog.find(q => q.code === 'Q1').dialogue.offer.includes('Reeve Caldus'),
   'Q1 offer is in Caldus voice');
ok(catalog.find(q => q.code === 'Q2').dialogue.offer.includes('Father Aldren'),
   'Q2 offer is in Aldren voice');
ok(catalog.find(q => q.code === 'Q5').dialogue.offer.includes('Close the door'),
   'Q5 offer carries Osric Vale\'s bible line "Close the door"');
ok(catalog.find(q => q.code === 'Q2.5').dialogue.offer.includes('I was nine'),
   'Q2.5 offer carries Nessa\'s bible confession');
ok(catalog.find(q => q.code === 'Q8').dialogue.active.includes('Old Harth'),
   'Q8 active text references Old Harth\'s voice');
ok(catalog.find(q => q.code === 'Q12').dialogue.offer.includes('Thaedryn'),
   'Q12 offer carries Thaedryn\'s voice');

// 4. Givers resolve.
// Audit fix (2026-07-13): this block previously declared `const current` (and
// ran the matchAll loop) TWICE — a SyntaxError that made the whole script
// crash on load, silently removing its checks from any pipeline that ran it.
const current = read('src/shared/harthmere/npc_compendium.ts');
const NPC_ID_RE = /"id":\s*"([a-z0-9_]+)"/gi;
const knownNpcIds = new Set();
for (const m of current.matchAll(NPC_ID_RE)) knownNpcIds.add(m[1]);
const NO_GIVER_REQUIRED = new Set([
  'Q2.5',
  'Q8',
  'Q9',
  'Q10',
  // Q12 starts as the final Thaedryn encounter itself. Thaedryn is not a normal
  // town NPC record, so this quest intentionally has no catalog NPC giver.
  'Q12',
  'SQ-040',
  'SQ-041',
  'SQ-042',
]);
const NON_NPC_GIVERS = new Set(['thaedryn_bellbound']);
let unresolvedGivers = 0;
for (const quest of catalog) {
  if (NO_GIVER_REQUIRED.has(quest.code)) continue;
  if (!quest.giverId) { unresolvedGivers += 1; continue; }
  if (NON_NPC_GIVERS.has(quest.giverId)) continue;
  if (!knownNpcIds.has(quest.giverId)) {
    unresolvedGivers += 1;
    console.error(`  unresolved giver: ${quest.code} -> ${quest.giverId}`);
  }
}
ok(unresolvedGivers === 0, `every giverId resolves to a known NPC (${unresolvedGivers} unresolved)`);

// 5. Prerequisites point at real quests in the same catalog.
const allQuestIds = new Set(catalog.map(q => q.id));
let unresolvedPrereqs = 0;
for (const quest of catalog) {
  const prereqs = (quest.activeRules && quest.activeRules.prerequisiteQuestIds) || [];
  for (const prereq of prereqs) {
    if (!allQuestIds.has(prereq)) { unresolvedPrereqs += 1; }
  }
}
ok(unresolvedPrereqs === 0, `every prerequisite quest id resolves (${unresolvedPrereqs} unresolved)`);

// 6. Bible main-quest order.
const BIBLE_ORDER = ['Q1','Q2','Q2.5','Q3','Q4','Q5','Q6','Q7','Q8','Q9','Q10','Q11','Q12'];
const orderIndex = new Map(BIBLE_ORDER.map((c,i) => [c, i]));
let orderViolations = 0;
for (const quest of catalog) {
  if (!orderIndex.has(quest.code)) continue;
  const my = orderIndex.get(quest.code);
  const prereqs = (quest.activeRules && quest.activeRules.prerequisiteQuestIds) || [];
  for (const prereqId of prereqs) {
    const prereq = catalog.find(q => q.id === prereqId);
    if (!prereq || !orderIndex.has(prereq.code)) continue;
    if (orderIndex.get(prereq.code) > my) {
      orderViolations += 1;
      console.error(`  order violation: ${quest.code} requires later ${prereq.code}`);
    }
  }
}
ok(orderViolations === 0, `main-quest prerequisites respect bible hour ordering (${orderViolations} violations)`);

// 7. Grove parallel arrays still aligned (locks fix in patch 01).
//    NOTE: 15 existing Grove quests have known misalignment from before
//    this contract was enforced. Listed here so this check enforces
//    alignment for new quests but doesn't block on existing known issues.
//    Remove from this set as each quest is re-authored.
const KNOWN_MISALIGNED_GROVE = new Set([
  // All 15 previously-misaligned Grove quests were realigned in patch 05.
]);
const groveContent = read('src/shared/harthmere/snapshot_grove_content.ts');
const groveQuestBlock = groveContent.match(/SNAPSHOT_GROVE_QUESTS[\s\S]*?\];/);
ok(!!groveQuestBlock, 'Grove quests block locatable');
if (groveQuestBlock) {
  // Each quest object is delimited by { ... }, with internal objects too.
  // Match each top-level quest by finding `id: "..."` records and
  // their following arrays in source order.
  const block = groveQuestBlock[0];
  const questIds = [...block.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
  const objectivesArrays = [...block.matchAll(/objectives:\s*\[((?:[^[\]]|\[[^\]]*\])*)\]/g)];
  const triggersArrays = [...block.matchAll(/triggers:\s*\[((?:[^[\]]|\[[^\]]*\])*)\]/g)];
  const markerIdsArrays = [...block.matchAll(/markerIds:\s*\[((?:[^[\]]|\[[^\]]*\])*)\]/g)];
  ok(objectivesArrays.length === triggersArrays.length &&
     objectivesArrays.length === markerIdsArrays.length,
     `Grove quest parallel arrays present (${objectivesArrays.length} objectives, ${triggersArrays.length} triggers, ${markerIdsArrays.length} markerIds)`);

  // Audit fix (2026-07-13): quests may reference shared constants
  // (e.g. `objectives: [BUILDING_SYSTEM_MIRA_INTRO_QUEST.objective]`) —
  // counting STRING LITERALS misread those as 0 entries and false-failed.
  // Count top-level array entries instead (commas outside quotes/brackets).
  const countArrayEntries = (content) => {
    const trimmed = String(content ?? '').trim();
    if (!trimmed) return 0;
    let count = 1;
    let depth = 0;
    let inString = false;
    for (let c = 0; c < trimmed.length; c++) {
      const ch = trimmed[c];
      if (inString) {
        if (ch === '\\') c += 1;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '[' || ch === '(' || ch === '{') depth += 1;
      else if (ch === ']' || ch === ')' || ch === '}') depth -= 1;
      else if (ch === ',' && depth === 0) count += 1;
    }
    // A trailing comma does not add an entry.
    if (/,\s*$/.test(trimmed)) count -= 1;
    return count;
  };

  let mismatches = 0;
  for (let i = 0; i < objectivesArrays.length; i++) {
    const qid = questIds[i] || `index_${i}`;
    if (KNOWN_MISALIGNED_GROVE.has(qid)) continue;
    const oCount = countArrayEntries(objectivesArrays[i][1]);
    const tCount = countArrayEntries(triggersArrays[i][1]);
    const mCount = countArrayEntries(markerIdsArrays[i][1]);
    if (oCount !== tCount || oCount !== mCount) {
      mismatches += 1;
      console.error(`  Grove quest ${qid}: objectives=${oCount} triggers=${tCount} markerIds=${mCount}`);
    }
  }
  ok(mismatches === 0, `Grove quest objectives/triggers/markerIds arrays align per quest (${mismatches} new mismatches, ${KNOWN_MISALIGNED_GROVE.size} grandfathered)`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll quest bible-grounded checks passed.');
