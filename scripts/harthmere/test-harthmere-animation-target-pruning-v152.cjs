#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
let failed = 0;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed = 1;
    console.error(`FAIL ${message}`);
  }
}

console.log("== Harthmere animation target pruning v152 ==");

const animationSystem = read("src/client/game/util/animation_system.ts");
const playerMesh = read("src/client/game/resources/player_mesh.ts");
const playerMeshRoute = read("src/pages/api/assets/player_mesh.glb.ts");

ok(
  animationSystem.includes("HARTHMERE_STATIC_FALLBACK_ANIMATION_TARGET_PRUNING_V152"),
  "animation system declares the v152 static-fallback target pruning guard"
);
ok(
  /function\s+collectAnimationTargetNodeNames[\s\S]*?root\.traverse/.test(animationSystem),
  "animation system builds the set of node names available on the current mesh"
);
ok(
  /function\s+animationTrackTargetNodeName[\s\S]*?trackName\.indexOf\(\"\.\"\)/.test(animationSystem) &&
    animationSystem.includes("bones\\[([^\\]]+)\\]"),
  "animation system extracts node names from simple and bones[...] track targets"
);
ok(
  /function\s+animationTrackCanBindToMesh[\s\S]*?targetNodeNames\.has\(targetNodeName\)/.test(animationSystem),
  "animation system can reject tracks that target missing bones or nodes"
);
ok(
  /const\s+targetNodeNames\s*=\s*collectAnimationTargetNodeNames\(meshScene\)/.test(animationSystem),
  "new animation state collects target node names from the mesh being animated"
);
ok(
  /anim\.tracks\s*=\s*anim\.tracks\.filter\(\(t\)\s*=>\s*animationTrackCanBindToMesh\(t,\s*targetNodeNames\)\s*\)/.test(animationSystem),
  "animation clips are pruned to tracks that can bind before clipAction is created"
);
ok(
  /if\s*\(anim\.tracks\.length\s*===\s*0\)\s*{\s*return undefined;\s*}/.test(animationSystem),
  "fully incompatible clips are skipped instead of creating noisy Three.js actions"
);
ok(
  playerMesh.includes("loadPlayerAnimatedMesh(mesh, animationTimings)"),
  "player mesh still uses the shared animation system, so pruning covers runtime players"
);
ok(
  playerMeshRoute.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    playerMeshRoute.includes("Using packaged player body mesh fallback for Glitch runtime"),
  "test covers the exact static fallback route used by production Glitch"
);

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
