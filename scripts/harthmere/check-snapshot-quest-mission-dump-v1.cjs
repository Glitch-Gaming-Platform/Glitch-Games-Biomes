#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
function ok(cond, msg) { if (!cond) { console.error('FAIL', msg); process.exit(1); } console.log('OK', msg); }
const dump = path.join(repo, 'scripts/harthmere/dump-snapshot-quest-mission-state-v1.cjs');
ok(fs.existsSync(dump), 'snapshot quest/mission dump script exists');
const src = fs.readFileSync(dump, 'utf8');
ok(src.includes('snapshot_backup.json'), 'dump scans installed snapshot_backup.json');
ok(src.includes('quest_giver'), 'dump scans quest_giver markers');
ok(src.includes('objective'), 'dump scans objective markers');
ok(src.includes('Missing Bell'), 'dump scans Harthmere Missing Bell markers');
ok(src.includes('nextPatchRecommendation'), 'dump writes next patch recommendations');
console.log('snapshot quest/mission dump v1 check passed');
