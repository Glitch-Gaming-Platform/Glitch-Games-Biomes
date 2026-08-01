#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(
  path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
  "utf8"
);
const polish = fs.readFileSync(
  path.join(root, "src/shared/harthmere/town_production_polish.ts"),
  "utf8"
);
const npcs = fs.readFileSync(
  path.join(root, "src/client/game/resources/npcs.ts"),
  "utf8"
);
const npcRenderer = fs.readFileSync(
  path.join(root, "src/client/game/renderers/npcs.ts"),
  "utf8"
);
const rendererController = fs.readFileSync(
  path.join(root, "src/client/game/renderers/renderer_controller.ts"),
  "utf8"
);
const reactResources = fs.readFileSync(
  path.join(root, "src/client/resources/react.ts"),
  "utf8"
);
const gatheringNodeRenderer = fs.readFileSync(
  path.join(
    root,
    "src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts"
  ),
  "utf8"
);
const questObjectRenderer = fs.readFileSync(
  path.join(
    root,
    "src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts"
  ),
  "utf8"
);
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}
ok(
  polish.includes("harthmere-production-building-polish-and-optimization"),
  "production polish version is current"
);
ok(
  polish.includes("harthmere-runtime-performance-profile"),
  "runtime performance profile is current"
);
ok(
  polish.includes("prototypeLoadConcurrency: 2"),
  "prototype loading is capped lower for local-dev"
);
ok(
  polish.includes("maxAnimatedLifeOptimized: 24"),
  "animated life budget is tightened"
);
ok(
  assets.includes("HARTHMERE_SURVEY_PERFORMANCE_RESPONSE_VERSION"),
  "renderer exposes current survey response version"
);
ok(
  assets.includes("Core placement is no longer") ||
    assets.includes("core radius bypass"),
  "core placements no longer bypass animated/tiny/wilds budgets"
);
ok(
  assets.includes("keepWithinTotalBudget"),
  "core static placements share the optimized total cap"
);
ok(
  assets.includes("NEAR_ANIM_DIST_SQ") && assets.includes("MID_ANIM_DIST_SQ"),
  "far animation throttling is installed"
);
ok(
  assets.includes("this.harthmerePlacementLodUpdateIn = 0.5"),
  "LOD refresh is throttled to twice per second"
);
ok(
  assets.includes("this.harthmereCombatSnapshotUpdateIn = 0.1"),
  "combat actor snapshots are throttled to 10 Hz"
);
ok(
  assets.includes("this.harthmereLastNpcCollisionStatsAt >= 1_000") ||
    assets.includes("now - this.harthmereLastNpcCollisionStatsAt >= 1_000"),
  "collision diagnostic sorting is throttled to once per second"
);
ok(
  npcs.includes(
    "this.nextHarthmereAnimationAuditAtMs = animationAuditNowMs + 500"
  ),
  "native NPC animation diagnostics are throttled to 2 Hz"
);
ok(
  npcs.includes("audit[String(entity.id)] = entry") &&
    !npcs.includes("...(win.__harthmereVoxelNpcAnimationAudit ?? {})"),
  "native NPC animation audit updates no longer clone the full map per actor per frame"
);
ok(
  npcs.includes("this.mixedMesh.basePassMaterials") &&
    npcs.includes("this.mixedMesh.skinnedMeshes"),
  "native NPC render ticks reuse cached material and skinned-mesh lists"
);
ok(
  npcRenderer.includes("puppetOverrideById?.get(entity.id) ?? null") &&
    npcRenderer.includes(
      "const sunDirection = skyParams.sunDirection.toArray()"
    ),
  "native NPCs share frame-level puppet and sun-direction projections"
);
ok(
  rendererController.includes("this.reactResources.flush()") &&
    reactResources.includes("version !== observed.lastEmittedVersion"),
  "React resource listeners wake only when their observed version changes"
);
ok(
  assets.includes("scenes.three.add(this.root)") &&
    !assets.includes("addToScenes(scenes, this.root)"),
  "the full Harthmere runtime hierarchy bypasses per-frame scene rescans"
);
ok(
  gatheringNodeRenderer.includes("this.groundRefreshSeconds = 0.25") &&
    gatheringNodeRenderer.includes("maxDistanceSq") &&
    gatheringNodeRenderer.includes("mesh.frustumCulled = true"),
  "gathering nodes throttle terrain probes and cull out-of-range geometry/lights"
);
ok(
  questObjectRenderer.includes("this.debugRefreshSeconds = 0.5"),
  "quest marker debug snapshots are throttled to 2 Hz"
);
if (process.exitCode) process.exit(process.exitCode);
console.log("\nHarthmere current performance response checks passed.");
