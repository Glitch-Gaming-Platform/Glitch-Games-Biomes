#!/usr/bin/env node
// BIOMES_HARTHMERE_SURVEY_ANALYZER
// Reads a harthmere-auto-survey JSON capture and summarizes the locations
// that should drive grounding/performance fixes.
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/harthmere/analyze-harthmere-auto-survey.cjs <harthmere-auto-survey.json>');
  process.exit(1);
}
const survey = JSON.parse(fs.readFileSync(file, 'utf8'));
const samples = Array.isArray(survey.rawSamples) ? survey.rawSamples : [];
if (!samples.length) {
  console.error('No rawSamples found in survey:', file);
  process.exit(1);
}

const round = (n) => Number.isFinite(n) ? Math.round(n * 100) / 100 : n;
const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const max = (xs) => xs.length ? Math.max(...xs) : 0;
const min = (xs) => xs.length ? Math.min(...xs) : 0;
const keyForPos = (pos) => pos ? `${Math.round(pos[0] / 16) * 16},${Math.round(pos[2] / 16) * 16}` : 'unknown';

const byArea = new Map();
const byHotspot = new Map();
const npcIssues = new Map();
for (const sample of samples) {
  const area = sample.area || 'unknown';
  const bucket = byArea.get(area) || [];
  bucket.push(sample);
  byArea.set(area, bucket);

  const hotspot = keyForPos(sample.position);
  const hotspotBucket = byHotspot.get(hotspot) || [];
  hotspotBucket.push(sample);
  byHotspot.set(hotspot, hotspotBucket);

  for (const npc of sample.npcs?.worst || []) {
    const prior = npcIssues.get(npc.id) || { ...npc, seen: 0, worstAbsDelta: 0 };
    prior.seen += 1;
    prior.worstAbsDelta = Math.max(prior.worstAbsDelta, Math.abs(Number(npc.footDelta || 0)));
    if (Math.abs(Number(npc.footDelta || 0)) > Math.abs(Number(prior.footDelta || 0))) {
      Object.assign(prior, npc, { seen: prior.seen, worstAbsDelta: prior.worstAbsDelta });
    }
    npcIssues.set(npc.id, prior);
  }
}

console.log('BIOMES_HARTHMERE_SURVEY_ANALYZER');
console.log(`samples=${samples.length} version=${survey.version || 'unknown'} file=${path.basename(file)}`);
console.log('');
console.log('Areas:');
for (const [area, xs] of [...byArea.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const fps = xs.map((s) => s.performance?.fps ?? 0);
  const frame = xs.map((s) => s.performance?.avgFrameMs ?? 0);
  const maxFrame = xs.map((s) => s.performance?.maxFrameMs ?? 0);
  const density = xs.map((s) => s.collision?.density ?? 0);
  const offGround = xs.map((s) => s.npcs?.offGroundCount ?? 0);
  const meshMissing = xs.map((s) => s.terrainStreaming?.missingCombinedMeshShards ?? 0);
  const terrainMissing = xs.map((s) => s.terrainStreaming?.missingTerrainShards ?? 0);
  console.log(`- ${area}: count=${xs.length} fps avg/min=${round(avg(fps))}/${round(min(fps))} avgFrame=${round(avg(frame))} maxFrame=${round(max(maxFrame))} density avg/max=${round(avg(density))}/${round(max(density))} offGround avg/max=${round(avg(offGround))}/${round(max(offGround))} combinedMeshMissing avg/max=${round(avg(meshMissing))}/${round(max(meshMissing))} terrainMissing avg/max=${round(avg(terrainMissing))}/${round(max(terrainMissing))}`);
}

console.log('');
console.log('Worst hotspots:');
for (const [hotspot, xs] of [...byHotspot.entries()].sort((a, b) => avg(a[1].map((s) => s.performance?.fps ?? 0)) - avg(b[1].map((s) => s.performance?.fps ?? 0))).slice(0, 8)) {
  const fps = xs.map((s) => s.performance?.fps ?? 0);
  const density = xs.map((s) => s.collision?.density ?? 0);
  const offGround = xs.map((s) => s.npcs?.offGroundCount ?? 0);
  const example = xs[0]?.position || [];
  console.log(`- ${hotspot}: samples=${xs.length} example=[${example.map(round).join(', ')}] fpsAvg=${round(avg(fps))} fpsMin=${round(min(fps))} densityAvg=${round(avg(density))} offGroundAvg=${round(avg(offGround))}`);
}

console.log('');
console.log('Worst repeated NPC grounding issues:');
for (const issue of [...npcIssues.values()].sort((a, b) => b.worstAbsDelta - a.worstAbsDelta || b.seen - a.seen).slice(0, 20)) {
  console.log(`- ${issue.label || issue.id} id=${issue.id} pos=[${(issue.position || []).map(round).join(', ')}] issue=${issue.issue} footDelta=${round(issue.footDelta)} expectedFeetY=${round(issue.expectedFeetY)} seen=${issue.seen}`);
}
