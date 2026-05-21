#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const file = path.join(root, 'src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx');
const src = fs.readFileSync(file, 'utf8');

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

ok(src.includes('HARTHMERE_AUTO_SURVEY_VERSION_V84'), 'auto survey version is declared');
ok(src.includes('__harthmereAutoSurveyV84'), 'browser global auto survey command is exposed');
ok(src.includes('sampleTerrainColumnV84'), 'terrain column scanner is installed');
ok(src.includes('collectNpcGroundSamplesV84'), 'NPC ground scanner is installed');
ok(src.includes('terrainStreamingStatusV84'), 'terrain/mesh streaming scanner is installed');
ok(src.includes('collisionDensityV84'), 'collision density scanner is installed');
ok(src.includes('window.__harthmereAutoSurveyV84.start(); walk around; stop(); download()'), 'HUD help text references the automatic survey');

if (process.exitCode) {
  console.error('\nHarthmere auto survey v84 checks failed.');
  process.exit(process.exitCode);
}
console.log('\nHarthmere auto survey v84 checks passed.');
