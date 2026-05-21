#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.log(`OK ${message}`);
}

const survey = read('src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx');

ok(survey.includes('harthmere-auto-survey-terrain-npc-performance-mission-v90'), 'auto survey reports mission v90');
ok(survey.includes('biomes-harthmere-mission-audit-v90'), 'mission audit version marker exists');
ok(survey.includes('readHarthmereQuestState'), 'mission audit reads live quest state');
ok(survey.includes('QUESTS') && survey.includes('QUEST_TARGETS'), 'mission audit uses quest definitions and targets');
ok(survey.includes('getHarthmereQuestTargetWorldPosV71'), 'mission audit resolves transformed target positions');
ok(survey.includes('collectMissionTargetCandidatesV90'), 'mission audit checks nearby loaded target people/items');
ok(survey.includes('documentTextV90'), 'mission audit checks visible UI text');
ok(survey.includes('titleVisible') && survey.includes('objectiveVisible') && survey.includes('actionVisible'), 'mission audit checks title, objective, and action text visibility');
ok(survey.includes('missionTraceRef') && survey.includes('appendMissionTraceEventsV90'), 'mission audit records mission state transitions');
ok(survey.includes('missionProblems'), 'auto survey report summarizes mission problems');
ok(survey.includes('downloadMissionAudit'), 'global helper can download mission audit');
ok(survey.includes('active mission audit issues'), 'auto survey warnings include mission issues');

console.log('\nBiomes/Harthmere v90 mission audit checks passed.');
