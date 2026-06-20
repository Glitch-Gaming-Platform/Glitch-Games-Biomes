#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const file = path.join(root, 'src/client/components/challenges/SnapshotLiveDiagnostics.tsx');
const src = fs.readFileSync(file, 'utf8');

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

ok(src.includes('HARTHMERE_AUTO_SURVEY_VERSION'), 'auto survey version is declared');
ok(src.includes('__harthmereAutoSurvey'), 'browser global auto survey command is exposed');
ok(src.includes('sampleTerrainColumn'), 'terrain column scanner is installed');
ok(src.includes('collectNpcGroundSamples'), 'NPC ground scanner is installed');
ok(src.includes('terrainStreamingStatus'), 'terrain/mesh streaming scanner is installed');
ok(src.includes('collisionDensity'), 'collision density scanner is installed');
ok(src.includes('window.__harthmereAutoSurvey.start(); walk around; stop(); download()'), 'HUD help text references the automatic survey');

if (process.exitCode) {
  console.error('\nHarthmere auto survey current checks failed.');
  process.exit(process.exitCode);
}
console.log('\nHarthmere auto survey current checks passed.');
