#!/usr/bin/env node
/*
 * Static source dump for the current player-like NPC renderer policy. This is not a
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
  version: "snapshot-overlay-npc-visuals",
  npcPlayerAvatarPathPresent: npcs.includes("makeSnapshotPlayerLikeAppearanceMesh(deps, id)"),
  overlayCompatPresent: overlays.includes("SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION"),
  npcRendererModeEnv: "Player-like NPCs use the same generated player/Grove avatar mesh path as players.",
  makeNpcMeshBranch: findAround(npcs, "makeSnapshotPlayerLikeAppearanceMesh(deps, id)"),
  overlayCompatBranch: findAround(overlays, "getOverlayEntitySizeCompat(entity)"),
};

const outDir = path.join(root, "harthmere-debug-dumps");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `snapshot-playerlike-npc-render.${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(out);
