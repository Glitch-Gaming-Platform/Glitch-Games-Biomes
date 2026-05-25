#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_PLAYER_GLB_URL_PARITY_V137
//
// Validates that the in-game player loads from the same /api/assets/player_mesh.glb
// path the rich Grove "player-like" NPCs use, instead of the V122 static body
// variant URLs that were never shipped.
//
// V122 background:
//   src/client/game/resources/player_mesh.ts routed the Glitch production player
//   through a checked-in static path:
//     /assets/harthmere/gltf/characters/player_body_variants/harthmere_player_*.gltf
//   Those .gltf files do not exist in public/ — only the manifest JSON does —
//   so the player rendered as a featureless block.
//
// V137 fix:
//   Route the player through ecsWearablesToUrl(...) like
//   makeSnapshotPlayerLikeAppearanceMesh already does for the rich Grove NPCs.
//   The Glitch snapshot deploy sets GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1,
//   which makes the web server's assetServerMode default to "lazy" — meaning
//   /api/assets/player_mesh.glb computes the mesh locally instead of proxying.
//
// Usage: node scripts/harthmere/test-harthmere-player-glb-url-parity-v1.cjs <repo-root>

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const PLAYER_MESH_PATH = path.join(
  root,
  "src/client/game/resources/player_mesh.ts",
);
const WEB_CONFIG_PATH = path.join(root, "src/server/web/config.ts");
const DATA_SNAPSHOT_PATH = path.join(root, "scripts/b/data_snapshot.py");
const NPCS_PATH = path.join(root, "src/client/game/resources/npcs.ts");
const PLAYER_MESH_ROUTE_PATH = path.join(
  root,
  "src/pages/api/assets/player_mesh.glb.ts",
);

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL  required file missing: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf8");
}

const playerMesh = read(PLAYER_MESH_PATH);
const webConfig = read(WEB_CONFIG_PATH);
const dataSnapshot = read(DATA_SNAPSHOT_PATH);
const npcs = read(NPCS_PATH);
const playerMeshRoute = read(PLAYER_MESH_ROUTE_PATH);

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK    ${label}`);
  } else {
    ok = false;
    console.error(`FAIL  ${label}`);
    if (detail) {
      console.error(`      ${detail}`);
    }
  }
}

// -----------------------------------------------------------------------------
// 1. playerMeshUrlForId returns ecsWearablesToUrl, not the static variant URL.
// -----------------------------------------------------------------------------

const playerMeshUrlFnIdx = playerMesh.indexOf("function playerMeshUrlForId");
check(
  "player_mesh.ts defines playerMeshUrlForId",
  playerMeshUrlFnIdx > 0,
);

const playerMeshUrlFnEnd = playerMesh.indexOf("\n}\n", playerMeshUrlFnIdx);
const playerMeshUrlFnBody = playerMesh.slice(
  playerMeshUrlFnIdx,
  playerMeshUrlFnEnd,
);

check(
  "playerMeshUrlForId no longer branches on shouldUseHarthmereStaticPlayerMeshVariant",
  !/shouldUseHarthmereStaticPlayerMeshVariant\s*\(/.test(playerMeshUrlFnBody),
  "V122 sent the player to harthmerePlayerBodyVariantUrl(id) when this " +
    "predicate returned true; V137 always goes through ecsWearablesToUrl.",
);

check(
  "playerMeshUrlForId no longer returns harthmerePlayerBodyVariantUrl",
  !/return\s+harthmerePlayerBodyVariantUrl\s*\(/.test(playerMeshUrlFnBody),
);

check(
  "playerMeshUrlForId returns ecsWearablesToUrl(wearables, appearance)",
  /return\s+ecsWearablesToUrl\s*\(\s*wearables\s*,\s*appearance\s*\)/.test(
    playerMeshUrlFnBody,
  ),
);

// -----------------------------------------------------------------------------
// 2. ecsWearablesToUrl points at /api/assets/player_mesh.glb (same endpoint
//    the snapshot rich NPCs use through makeSnapshotPlayerLikeAppearanceMesh).
// -----------------------------------------------------------------------------

check(
  "ecsWearablesToUrl returns the /api/assets/player_mesh.glb URL",
  /export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/.test(
    playerMesh,
  ),
);

check(
  "makeSnapshotPlayerLikeAppearanceMesh exists and shares the same code path",
  /export async function makeSnapshotPlayerLikeAppearanceMesh/.test(playerMesh) &&
    /fetchPlayerMeshGLTF\s*\([\s\S]{0,600}undefined/.test(playerMesh),
  "Snapshot player-like NPCs intentionally pass id=undefined so " +
    "playerMeshUrlForId falls through to ecsWearablesToUrl. With V137, the " +
    "real player takes the same path automatically.",
);

check(
  "ECS NPC factory (npcs.ts) uses makeSnapshotPlayerLikeAppearanceMesh for player-like NPCs",
  /makeSnapshotPlayerLikeAppearanceMesh\(/.test(npcs),
);

check(
  "player_mesh API route keeps local mesh generation for non-Glitch callers",
  playerMeshRoute.includes('"wearables/animated_player_mesh"') &&
    playerMeshRoute.includes("assetExportsServer.build") &&
    playerMeshRoute.includes("parsePlayerMeshUrl"),
  "The route still supports the normal lazy/local asset-server path outside " +
    "Glitch production.",
);

check(
  "player_mesh API route redirects Glitch production before starting unavailable local generation",
  playerMeshRoute.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    playerMeshRoute.includes('process.env.GLITCH_RUNTIME === "1"') &&
    playerMeshRoute.indexOf("if (shouldUseStaticPlayerMeshFallback())") <
      playerMeshRoute.indexOf("const playerMeshParse = parsePlayerMeshUrl"),
  "Glitch production should use the packaged player body asset directly so " +
    "the missing Python voxeloo module cannot crash or spam the web process.",
);

// -----------------------------------------------------------------------------
// 3. Glitch snapshot deploy enables the lazy local asset server so
//    /api/assets/player_mesh.glb computes meshes instead of proxying to
//    biomes.gg. This is the precondition that makes V137 work in production.
// -----------------------------------------------------------------------------

check(
  "data_snapshot.py sets GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1",
  /_snapshot_setdefault_env\(\s*"GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER"\s*,\s*"1"\s*\)/.test(
    dataSnapshot,
  ),
  "Without this, assetServerMode defaults to 'proxy' in Glitch runtime and " +
    "/api/assets/player_mesh.glb forwards to https://www.biomes.gg.",
);

check(
  "web/config.ts maps GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1 to assetServerMode='lazy'",
  webConfig.includes("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER") &&
    /defaultValue:\s*useLocalAssetRuntime\(\)\s*\?\s*"lazy"/.test(
      webConfig,
    ),
);

// -----------------------------------------------------------------------------
// 4. The legacy V122 comment is marked superseded so future readers know
//    /api/assets/player_mesh.glb is now the canonical path.
// -----------------------------------------------------------------------------

check(
  "V122 comment is annotated as SUPERSEDED by V137",
  /GLITCH_STATIC_PLAYER_MESH_VARIANT_V122[^\n]*SUPERSEDED/.test(playerMesh),
);

check(
  "V137 marker is present in playerMeshUrlForId",
  /HARTHMERE_PLAYER_GLB_URL_PARITY_V137/.test(playerMesh),
);

// -----------------------------------------------------------------------------

if (!ok) {
  console.error("");
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("");
console.log("RESULT: PASS");
