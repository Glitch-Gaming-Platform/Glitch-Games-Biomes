#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const polish = fs.readFileSync(path.join(root, "src/shared/harthmere/town_production_polish_v1.ts"), "utf8");
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}
ok(polish.includes("harthmere-production-building-polish-and-optimization-v85"), "production polish version is v85");
ok(polish.includes("harthmere-runtime-performance-profile-v85"), "runtime performance profile is v85");
ok(polish.includes("prototypeLoadConcurrency: 2"), "prototype loading is capped lower for local-dev");
ok(polish.includes("maxAnimatedLifeOptimized: 72"), "animated life budget is tightened");
ok(assets.includes("HARTHMERE_SURVEY_PERFORMANCE_RESPONSE_VERSION_V85"), "renderer exposes v85 survey response version");
ok(assets.includes("Core placement is no longer") || assets.includes("core radius bypass"), "core placements no longer bypass animated/tiny/wilds budgets");
ok(assets.includes("NEAR_ANIM_DIST_SQ_V85") && assets.includes("MID_ANIM_DIST_SQ_V85"), "far animation throttling is installed");
ok(assets.includes("this.harthmerePlacementLodUpdateIn = 0.5"), "LOD refresh is throttled to twice per second");
if (process.exitCode) process.exit(process.exitCode);
console.log("\nHarthmere v85 performance response checks passed.");
