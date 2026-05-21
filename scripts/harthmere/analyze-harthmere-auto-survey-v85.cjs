#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/harthmere/analyze-harthmere-auto-survey-v85.cjs <harthmere-auto-survey-v84.json>");
  process.exit(1);
}
const survey = JSON.parse(fs.readFileSync(file, "utf8"));
const samples = Array.isArray(survey.rawSamples) ? survey.rawSamples : [];
if (!samples.length) {
  console.error("No rawSamples found in survey file.");
  process.exit(1);
}

const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const pct = (values, p) => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))))];
};
const avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const round = (value, places = 2) => {
  const m = 10 ** places;
  return Math.round(num(value) * m) / m;
};

const byArea = new Map();
for (const sample of samples) {
  const area = sample.area ?? "unknown";
  const list = byArea.get(area) ?? [];
  list.push(sample);
  byArea.set(area, list);
}

const summarize = (label, list) => {
  const fps = list.map((s) => num(s.performance?.fps));
  const avgFrame = list.map((s) => num(s.performance?.avgFrameMs));
  const maxFrame = list.map((s) => num(s.performance?.maxFrameMs));
  const missingTerrain = list.map((s) => num(s.terrainStreaming?.missingTerrainShards));
  const missingMeshes = list.map((s) => num(s.terrainStreaming?.missingCombinedMeshShards));
  const collision = list.map((s) => num(s.collision?.density));
  const offGround = list.map((s) => num(s.npcs?.offGroundCount));
  const heap = list.map((s) => num(s.performance?.heapUsedMb));
  return {
    area: label,
    samples: list.length,
    fpsAvg: round(avg(fps)),
    fpsP10: round(pct(fps, 10)),
    avgFrameMsP50: round(pct(avgFrame, 50)),
    maxFrameMsP95: round(pct(maxFrame, 95)),
    missingTerrainP50: round(pct(missingTerrain, 50)),
    missingMeshP50: round(pct(missingMeshes, 50)),
    collisionDensityP95: round(pct(collision, 95), 3),
    offGroundNpcP95: round(pct(offGround, 95)),
    heapMbP95: round(pct(heap, 95)),
  };
};

const summaries = [summarize("all", samples), ...[...byArea.entries()].map(([area, list]) => summarize(area, list))];
console.table(summaries);

const worstFrames = [...samples]
  .sort((a, b) => num(b.performance?.maxFrameMs) - num(a.performance?.maxFrameMs))
  .slice(0, 10)
  .map((s) => ({
    elapsedMs: s.elapsedMs,
    area: s.area,
    position: (s.position ?? []).join(","),
    fps: s.performance?.fps,
    avgFrameMs: s.performance?.avgFrameMs,
    maxFrameMs: s.performance?.maxFrameMs,
    missingTerrain: s.terrainStreaming?.missingTerrainShards,
    missingMesh: s.terrainStreaming?.missingCombinedMeshShards,
    collisionDensity: s.collision?.density,
    offGroundNpcs: s.npcs?.offGroundCount,
    heapMb: s.performance?.heapUsedMb,
  }));
console.log("\nWorst frame samples:");
console.table(worstFrames);

const npcIssues = new Map();
for (const sample of samples) {
  for (const npc of sample.npcs?.worst ?? []) {
    if (!npc.issue) continue;
    const prior = npcIssues.get(String(npc.id));
    if (!prior || Math.abs(num(npc.footDelta)) > Math.abs(num(prior.footDelta))) {
      npcIssues.set(String(npc.id), npc);
    }
  }
}
console.log("\nWorst NPC ground issues:");
console.table([...npcIssues.values()]
  .sort((a, b) => Math.abs(num(b.footDelta)) - Math.abs(num(a.footDelta)))
  .slice(0, 20)
  .map((n) => ({
    id: n.id,
    label: n.label,
    area: n.area,
    position: (n.position ?? []).join(","),
    expectedFeetY: n.expectedFeetY,
    footDelta: n.footDelta,
    issue: n.issue,
  })));

const highOnlyMissing = samples.flatMap((s) => s.terrainStreaming?.missingShardCenters ?? [])
  .filter((center) => Array.isArray(center) && center[1] >= 112).length;
const allMissingCenters = samples.flatMap((s) => s.terrainStreaming?.missingShardCenters ?? []).length;
if (allMissingCenters) {
  console.log(`\nMissing terrain shard note: ${highOnlyMissing}/${allMissingCenters} reported missing centers are high vertical slices (y>=112). Treat those as survey noise unless the player is actually at that height.`);
}
