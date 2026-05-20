#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const files = [
  "src/server/shim/main.ts",
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
  "src/server/logic/utils/players.ts",
  "scripts/b/data_snapshot.py",
];
const outDir = path.join(process.cwd(), "harthmere-debug-dumps");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(outDir, `harthmere-npc-placement-state-v1.${stamp}.txt`);
let report = [];
report.push("# Harthmere/NPC placement state dump v1");
report.push(`created=${new Date().toISOString()}`);
report.push(`cwd=${process.cwd()}`);
for (const file of files) {
  report.push(`\n## ${file}`);
  if (!fs.existsSync(file)) {
    report.push("MISSING");
    continue;
  }
  const s = fs.readFileSync(file, "utf8");
  const markers = [
    "SNAPSHOT_RUNTIME_BRIDGE_V1",
    "SNAPSHOT_RUNTIME_BRIDGE_REPAIR_V2",
    "HARTHMERE_EXTRA_TOWN_OFFSET_V3",
    "SNAPSHOT_NPC_ATTACK_FILTER_COMPAT_V1",
    "SNAPSHOT_COLLISION_MISSING_AABB_COMPAT_V1",
    "BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN",
    "BIOMES_FORCE_LOCAL_DEV_TOWN",
    "BIOMES_FORCE_SNAPSHOT_REDIS_RESET",
    "withHarthmereExtraTownPositionV1",
    "harthmereExtraTownWorldXV1",
    "harthmereExtraTownAuthoredXV1",
  ];
  for (const marker of markers) {
    if (s.includes(marker)) report.push(`MARKER ${marker}`);
  }
  const lines = s.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/Hawthorn|hawthorn|Harthmere|harthmere|position:\s*\[[45]\d\d|pos:\s*\[[45]\d\d|\[486,\s*5\d,\s*-209\]/.test(line)) {
      report.push(`${String(i + 1).padStart(6)}: ${line.slice(0, 240)}`);
    }
  });
}
fs.writeFileSync(out, report.join("\n") + "\n");
console.log(out);
