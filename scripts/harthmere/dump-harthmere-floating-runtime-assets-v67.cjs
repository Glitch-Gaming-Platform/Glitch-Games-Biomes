#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const repo = path.resolve(__dirname, "..", "..");
const src = fs.readFileSync(path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const outDir = path.join(repo, "harthmere-debug-dumps");
fs.mkdirSync(outDir, { recursive: true });
const glbDefinitions = [...src.matchAll(/gltf\("([^"]+)",\s*"([^"]*\.glb)"/g)].map((m) => ({ key: m[1], path: m[2] }));
const structuralKeys = glbDefinitions.filter((entry) => /building|fantasy_town|environment\/(trees|roads|shrubbery|fences|rocks|mines)|props\/market\/fountain|watermill|windmill|wall|roof|stairs|bridge/i.test(entry.path));
const report = {
  version: "harthmere-floating-runtime-assets-v67",
  glbDefinitions: glbDefinitions.length,
  structuralOrMapGlbDefinitions: structuralKeys.length,
  note: "Definitions are intentionally left in the file. v67 removes their placements in snapshot-built runtime mode; it does not delete assets.",
  structuralKeys,
};
const out = path.join(outDir, `harthmere-floating-runtime-assets-v67.${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(out);
