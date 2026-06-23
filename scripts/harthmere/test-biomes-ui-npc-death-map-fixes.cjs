#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}
function includes(source, needle, message) {
  assert(source.includes(needle), message);
}

const mapTab = read('src/client/components/biomes_ui/tabs/MapQuestsTab.tsx');
const liveAdapters = read('src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts');
const inventoryTab = read('src/client/components/biomes_ui/tabs/InventoryTab.tsx');
const npcs = read('src/client/game/resources/npcs.ts');
const npcSeed = read('src/server/harthmere/snapshot_grove_npc_ecs_seed.ts');
const npcRouting = read('src/shared/harthmere/snapshot_grove_npc_mesh_routing.ts');
const deathSystem = read('src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx');
const combat = read('src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const hud = read('src/client/components/challenges/HarthmereUnifiedHUD.tsx');
const liveDebug = read('src/shared/harthmere/snapshot_live_debug.ts');

// 1. Map must be live-data only, with no hard-coded placeholder markers/steps.
assert(!/PLACEHOLDER_MARKERS|PLACEHOLDER_STEPS|Jackie", x: 0\.42|Old Grove Road Post", x: 0\.52/.test(mapTab), 'MapQuestsTab has no dummy placeholder markers or steps');
includes(mapTab, 'getPlayerMarker?: () => MapMarker | undefined', 'MapQuestsTab accepts a live current-player marker');
includes(mapTab, 'Zoom map in', 'MapQuestsTab exposes zoom-in control');
includes(mapTab, 'Zoom map out', 'MapQuestsTab exposes zoom-out control');
includes(mapTab, 'Center Player', 'MapQuestsTab can center the live map on the player');
includes(liveAdapters, 'SNAPSHOT_GROVE_LANDMARKS', 'Live map adapter reads Grove landmark data');
includes(liveAdapters, 'worldToLiveMap', 'Live map adapter projects real world positions into map coordinates');
includes(liveAdapters, 'getPlayerMarker', 'Live map adapter publishes current player marker');
includes(liveAdapters, 'service_${npc.id}', 'Live map adapter adds real service/store/bank markers from NPC roles');
assert(!/x:\s*0\.[0-9]+,\s*y:\s*0\.[0-9]+,\s*kind:\s*"objective"/.test(liveAdapters), 'Live map adapter no longer fabricates fixed dummy marker coordinates');

// 2. Inventory and bank labels must not leak raw bucket/asset paths, and InventoryTab must mirror the bottom hotbar.
includes(liveAdapters, 'function looksLikeRawAssetPath', 'Inventory adapter detects raw bucket/asset paths');
includes(liveAdapters, '/\\/buckets\\//i', 'Inventory adapter treats /buckets paths as raw asset IDs');
includes(liveAdapters, 'getHotbar: () => ({', 'Inventory adapter exposes live ECS hotbar contents to InventoryTab');
includes(inventoryTab, 'Hotbar / quick slots', 'InventoryTab renders a synced hotbar section');
includes(inventoryTab, 'Mirrors the bottom HUD hotbar', 'InventoryTab documents bottom-hotbar parity');
assert(!inventoryTab.includes('Math.max(0, backpack.items.findIndex'), 'Inventory split/unequip does not overwrite slot 0 when backpack is full');

// 3. Legacy Biomes Systems right-side panel must be retired so the replacement BiomesUI owns those tabs.
includes(hud, 'HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED', 'Legacy Biomes Systems panel is unified as retired');
const retiredIndex = hud.indexOf('HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED');
const returnNullIndex = hud.indexOf('return null;', retiredIndex);
const legacyTitleIndex = hud.indexOf('Biomes Systems', retiredIndex);
assert(returnNullIndex > retiredIndex && (legacyTitleIndex < 0 || returnNullIndex < legacyTitleIndex), 'Legacy Biomes Systems component returns null before rendering the old title');

// 4. Grove NPCs must use the original snapshot/player avatar family, not the
// blocky Harthmere voxel body.
includes(npcs, 'makeSnapshotGroveNpcAssetMesh(deps, id)', 'Renderer tries archived Grove NPC assets before avatar fallback');
includes(npcs, 'makeSnapshotPlayerLikeAppearanceMesh(deps, id)', 'No-asset Grove NPCs use player/Grove avatar mesh generation');
includes(npcSeed, 'delete (base as { appearance_component?: unknown }).appearance_component', 'No-asset Grove NPC seeds drop uniform default appearance');
includes(npcSeed, 'delete (base as { wearing?: unknown }).wearing', 'No-asset Grove NPC seeds drop uniform default wearables');
includes(npcRouting, 'sil: "npcs/sil"', 'Sil routes to the original snapshot NPC asset');
includes(npcRouting, 'doc: "npcs/doc"', 'Doc routes to the original snapshot NPC asset');

// 5. Moving NPCs must animate from render-motion velocity, not remain idle while their render position changes.
includes(npcs, 'HARTHMERE_VOXEL_NPC_RENDER_MOTION_ANIMATION', 'Voxel NPC render-motion animation bridge is versioned');
includes(npcs, 'getHarthmereVoxelNpcRenderMotionAnimationVelocity', 'Voxel NPC render-only wander/chase produces synthetic animation velocity');
const velocityBridgeIndex = npcs.indexOf('harthmereRenderMotionAnimationVelocity');
const velocityUseIndex = npcs.indexOf('motionOverrides?.velocity ??\n      harthmereRenderMotionAnimationVelocity', velocityBridgeIndex);
assert(velocityUseIndex > velocityBridgeIndex, 'NPC animation velocity uses render-motion bridge before rigid-body fallback');
assert(!npcs.includes('SNAPSHOT_GROVE_GENERATED_VOXEL_NPC_VERSION'), 'No-asset Grove NPCs should not use generated voxel renderer');
assert(!npcs.includes('shouldUseSnapshotGroveGeneratedVoxelNpc(id, label)'), 'No-asset Grove NPCs should fall through to player-like mesh generation');
includes(npcs, 'makeSnapshotPlayerLikeAppearanceMesh(deps, id)', 'No-asset Grove NPCs use player/Grove avatar mesh generation');

// 6. Death screen must appear for combat/zero-HP deaths, not only fall deaths.
includes(deathSystem, 'HARTHMERE_DEATH_RESPAWN_ALWAYS_ON_OVERLAY', 'Always-on death/respawn overlay is versioned');
includes(deathSystem, 'data-harthmere-death-respawn-screen="true"', 'Death/respawn overlay exposes a testable screen marker');
includes(deathSystem, 'combat.player.hp <= 0', 'Death/respawn overlay triggers on zero HP');
includes(deathSystem, 'Respawn at The Grove', 'Death/respawn overlay exposes Grove respawn CTA');
includes(combat, 'the_grove: {', 'Combat respawn rules support The Grove respawn point');
includes(combat, 'availableRespawns: ["the_grove", "temple_green", "north_gate", "player_house"]', 'Death records include The Grove in available respawns');

// 7. Floating hostile muckers/hexers are grounded through the same live visual grounding path.
includes(liveDebug, 'SNAPSHOT_HOSTILE_MUCKER_GROUNDING_VERSION', 'Mucker/Hexer grounding pass is versioned');
includes(liveDebug, 'snapshotLabelIsMuckerOrHexer', 'Mucker/Hexer labels are detected for grounding');
includes(liveDebug, 'SNAPSHOT_HARTHMERE_LIVE_BOUNDS', 'Mucker grounding is constrained to live Harthmere/Grove bounds');

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('All BiomesUI/NPC/death/map current installer regression checks passed.');
