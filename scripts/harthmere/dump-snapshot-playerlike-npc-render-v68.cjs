#!/usr/bin/env node
/*
 * Static source dump for the v68 player-like NPC renderer policy. This is not a
 * live Redis dump; it confirms which client renderer branch will be used.
 */
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const overlaysPath = path.join(root, "src/client/game/scripts/overlays.ts");
const npcs = fs.readFileSync(npcsPath, "utf8");
const overlays = fs.readFileSync(overlaysPath, "utf8");

function findAround(text, needle, radius = 700) {
  const i = text.indexOf(needle);
  if (i < 0) return null;
  return text.slice(Math.max(0, i - radius), Math.min(text.length, i + needle.length + radius));
}

const report = {
  version: "snapshot-overlay-npc-visuals-v68",
  npcFallbackVersionPresent: npcs.includes("SNAPSHOT_PLAYERLIKE_NPC_VISIBLE_FALLBACK_VERSION_V68"),
  overlayCompatPresent: overlays.includes("SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION_V68"),
  npcRendererModeEnv: "BIOMES_SNAPSHOT_NPC_RENDERER or NEXT_PUBLIC_BIOMES_SNAPSHOT_NPC_RENDERER; use legacy to compare old blank player-like renderer",
  makeNpcMeshBranch: findAround(npcs, "shouldForceVisibleSnapshotPlayerLikeNpcFallbackV68"),
  overlayCompatBranch: findAround(overlays, "getOverlayEntitySizeCompatV68(entity)"),
};

const outDir = path.join(root, "harthmere-debug-dumps");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `snapshot-playerlike-npc-render-v68.${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(out);
