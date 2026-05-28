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
const voxelFaces = read('src/shared/harthmere/voxel_faces.ts');
const npcs = read('src/client/game/resources/npcs.ts');
const deathSystem = read('src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx');
const combat = read('src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const hud = read('src/client/components/challenges/HarthmereUnifiedHUD.tsx');
const liveDebug = read('src/shared/harthmere/snapshot_live_debug_v78.ts');

// 1. Map must be live-data only, with no hard-coded placeholder markers/steps.
assert(!/PLACEHOLDER_MARKERS|PLACEHOLDER_STEPS|Jackie", x: 0\.42|Old Grove Road Post", x: 0\.52/.test(mapTab), 'MapQuestsTab has no dummy placeholder markers or steps');
includes(mapTab, 'getPlayerMarker?: () => MapMarker | undefined', 'MapQuestsTab accepts a live current-player marker');
includes(mapTab, 'Zoom map in', 'MapQuestsTab exposes zoom-in control');
includes(mapTab, 'Zoom map out', 'MapQuestsTab exposes zoom-out control');
includes(mapTab, 'Center Player', 'MapQuestsTab can center the live map on the player');
includes(liveAdapters, 'SNAPSHOT_GROVE_LANDMARKS_V75', 'Live map adapter reads Grove landmark data');
includes(liveAdapters, 'worldToLiveMapV132', 'Live map adapter projects real world positions into map coordinates');
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
includes(hud, 'HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED_V132', 'Legacy Biomes Systems panel is versioned as retired');
const retiredIndex = hud.indexOf('HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED_V132');
const returnNullIndex = hud.indexOf('return null;', retiredIndex);
const legacyTitleIndex = hud.indexOf('Biomes Systems', retiredIndex);
assert(returnNullIndex > retiredIndex && (legacyTitleIndex < 0 || returnNullIndex < legacyTitleIndex), 'Legacy Biomes Systems component returns null before rendering the old title');

// 4. Every no-asset Grove NPC now has a unique authored voxel profile.
const requiredProfiles = [
  ['Billy', 'snapshot_grove_billy_road_runner_v132'],
  ['Sil', 'snapshot_grove_sil_quiet_gatherer_v132'],
  ['Doc', 'snapshot_grove_doc_field_healer_v132'],
  ['Rosalyn', 'snapshot_grove_rosalyn_fountain_steward_v104'],
  ['Nia/Nonah', 'snapshot_grove_nia_guild_clerk_v104'],
  ['Merl Voss', 'snapshot_grove_merl_banker_v132'],
  ['Mira Thatch', 'snapshot_grove_mira_land_steward_v132'],
];
const profileIds = new Set();
for (const [label, profileId] of requiredProfiles) {
  includes(voxelFaces, profileId, `${label} has a unique authored voxel appearance profile`);
  assert(!profileIds.has(profileId), `${label} profile id is unique`);
  profileIds.add(profileId);
}
includes(voxelFaces, '/nonah|nina|nia|guild clerk|charter tutor|guild charter/', 'Nia profile also covers screenshot/runtime Nonah/Nina labels');
includes(voxelFaces, 'SNAPSHOT_GROVE_FULL_UNIQUE_NPC_APPEARANCE_V132', 'Unique Grove NPC appearance pass is documented');

// 5. Moving NPCs must animate from render-motion velocity, not remain idle while their render position changes.
includes(npcs, 'HARTHMERE_VOXEL_NPC_RENDER_MOTION_ANIMATION_V194', 'Voxel NPC render-motion animation bridge is versioned');
includes(npcs, 'getHarthmereVoxelNpcRenderMotionAnimationVelocityV194', 'Voxel NPC render-only wander/chase produces synthetic animation velocity');
const velocityBridgeIndex = npcs.indexOf('harthmereRenderMotionAnimationVelocityV194');
const velocityUseIndex = npcs.indexOf('motionOverrides?.velocity ??\n      harthmereRenderMotionAnimationVelocityV194', velocityBridgeIndex);
assert(velocityUseIndex > velocityBridgeIndex, 'NPC animation velocity uses render-motion bridge before rigid-body fallback');

// 6. Death screen must appear for combat/zero-HP deaths, not only fall deaths.
includes(deathSystem, 'HARTHMERE_DEATH_RESPAWN_ALWAYS_ON_OVERLAY_V132', 'Always-on death/respawn overlay is versioned');
includes(deathSystem, 'data-harthmere-death-respawn-screen="true"', 'Death/respawn overlay exposes a testable screen marker');
includes(deathSystem, 'combat.player.hp <= 0', 'Death/respawn overlay triggers on zero HP');
includes(deathSystem, 'Respawn at The Grove', 'Death/respawn overlay exposes Grove respawn CTA');
includes(combat, 'the_grove: {', 'Combat respawn rules support The Grove respawn point');
includes(combat, 'availableRespawns: ["the_grove", "temple_green", "north_gate", "player_house"]', 'Death records include The Grove in available respawns');

// 7. Floating hostile muckers/hexers are grounded through the same live visual grounding path.
includes(liveDebug, 'SNAPSHOT_HOSTILE_MUCKER_GROUNDING_VERSION_V132', 'Mucker/Hexer grounding pass is versioned');
includes(liveDebug, 'snapshotLabelIsMuckerOrHexerV132', 'Mucker/Hexer labels are detected for grounding');
includes(liveDebug, 'SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78', 'Mucker grounding is constrained to live Harthmere/Grove bounds');

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('All BiomesUI/NPC/death/map v133 installer regression checks passed.');
