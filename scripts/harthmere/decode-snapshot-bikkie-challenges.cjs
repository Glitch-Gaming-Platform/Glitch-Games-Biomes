#!/usr/bin/env node
/* SNAPSHOT_BIKKIE_BISCUIT_DECODE_VERSION
 * SNAPSHOT_BIKKIE_BISCUIT_DECODE
 * Searches installed snapshot/static/bikkie assets for non-NUX challenge biscuits.
 * The goal is to prove whether there are richer hidden task records beyond the
 * readable state_machines.ts NUX chain current already extracted.
 */
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'tmp/snapshot-bikkie-challenge-decode.json');

const TERMS = [
  /challenge/i,
  /quest/i,
  /mission/i,
  /objective/i,
  /task/i,
  /trigger/i,
  /pairedStep/i,
  /Road Ahead/i,
  /Busted/i,
  /Muck Buster/i,
  /muckwad/i,
  /Jackie/i,
  /Billy/i,
];
const STRONG_TERMS = [/challenge/i, /quest/i, /mission/i, /objective/i, /pairedStep/i, /state_machine/i];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'bazel-bin', 'bazel-out', 'bazel-testlogs', '.next', '__MACOSX']);
const MAX_BYTES = 5 * 1024 * 1024;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, acc);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.cjs', '.json', '.txt', '.md', '.yaml', '.yml'].includes(ext)) {
        acc.push(p);
      }
    }
  }
  return acc;
}

const searchRoots = [
  path.join(root, 'public/buckets/biomes-bikkie'),
  path.join(root, 'public/buckets/biomes-static'),
  path.join(root, 'public/assets/biomes-static'),
  path.join(root, 'src/shared/triggers'),
  path.join(root, 'src/shared'),
  path.join(root, 'tmp'),
].filter((p, i, a) => a.indexOf(p) === i && fs.existsSync(p));

const candidates = [];
for (const base of searchRoots) {
  for (const file of walk(base)) {
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.size > MAX_BYTES) continue;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!TERMS.some((term) => term.test(text))) continue;
    const lines = text.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (TERMS.some((term) => term.test(line))) {
        hits.push({ line: i + 1, text: line.trim().slice(0, 500) });
      }
      if (hits.length >= 20) break;
    }
    const strongHitCount = hits.filter((hit) => STRONG_TERMS.some((term) => term.test(hit.text))).length;
    candidates.push({
      file: path.relative(root, file),
      size: stat.size,
      strongHitCount,
      hitCount: hits.length,
      hits,
    });
  }
}

const knownNuxIds = [
  '166072605041642',
  '3623277001113501',
  '5660250530071909',
  '4273096364377975',
  '7786806792035454',
  '8903834562824062',
  '4478447552347541',
  '6113676978673631',
  '1950264665487951',
];

const nonNuxCandidates = candidates.filter((candidate) => {
  const joined = candidate.hits.map((hit) => hit.text).join('\n');
  const hasKnownNuxId = knownNuxIds.some((id) => joined.includes(id));
  const sourceMachine = /state_machines\.ts/.test(candidate.file);
  const generatedBridge = /snapshot_(complete|grove|production|port|runtime)|LocalDevSnapshot/i.test(candidate.file);
  return candidate.strongHitCount > 0 && !sourceMachine && !generatedBridge && !hasKnownNuxId;
});

const result = {
  version: 'snapshot-bikkie-biscuit-decode',
  root,
  searchedRoots: searchRoots.map((p) => path.relative(root, p)),
  knownNuxPairedStepIds: knownNuxIds,
  totalCandidates: candidates.length,
  nonNuxCandidates: nonNuxCandidates.length,
  conclusion: nonNuxCandidates.length
    ? 'possible_non_nux_bikkie_or_source_challenge_records_found_review_candidates'
    : 'no_richer_non_nux_challenge_biscuits_found_beyond_readable_nux_state_machine',
  candidates: candidates.sort((a, b) => b.strongHitCount - a.strongHitCount || b.hitCount - a.hitCount).slice(0, 250),
  nonNuxChallengeCandidates: nonNuxCandidates.slice(0, 100),
  nonNuxReview: nonNuxCandidates.slice(0, 100),
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`WROTE ${out}`);
console.log(`Candidates: ${result.totalCandidates}`);
console.log(`Non-NUX review candidates: ${result.nonNuxCandidates}`);
console.log(result.conclusion);
