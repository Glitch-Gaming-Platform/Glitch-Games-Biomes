import type { ClientContext } from "@/client/game/context";
import { AudioRenderer } from "@/client/game/renderers/audio";
import { makeBeamRenderer } from "@/client/game/renderers/beam";
import {
  ch1ActiveDungeonRunIdForRender,
  ch1ActiveGateIdsForRender,
  makeCh1FractureGateRenderer,
} from "@/client/game/renderers/ch1_fracture_gate";
import { makeCh1DungeonHorizonBoundaryRenderer } from "@/client/game/renderers/ch1_dungeon_horizon_boundary";
import { makeCh1WorldPhaseRenderer } from "@/client/game/renderers/ch1_world_phase";
import { makeHarthmereTownBackBoundaryRenderer } from "@/client/game/renderers/harthmere_town_back_boundary";
import { BlueprintsRenderer } from "@/client/game/renderers/blueprints";
import { BoundaryRenderer } from "@/client/game/renderers/boundary";
import { DebugAabbRenderer } from "@/client/game/renderers/debug_aabb";
import { DebugLocalPlayerRenderer } from "@/client/game/renderers/debug_local_player";
import { makeDropsRenderer } from "@/client/game/renderers/drops";
import { makeForbiddenEditsRenderer } from "@/client/game/renderers/forbidden_edits";
import { GroupsRenderer } from "@/client/game/renderers/groups";
import { makeHarthmereRuntimeAssetsRenderer } from "@/client/game/renderers/local_dev/harthmere_assets";
import { makeHarthmereBusinessBoardMarkerRenderer } from "@/client/game/renderers/local_dev/harthmere_business_board_marker";
import { makeHarthmereBusinessOutpostBuildingsRenderer } from "@/client/game/renderers/local_dev/harthmere_business_outpost_buildings";
import { makeHarthmereBusinessInteriorsRenderer } from "@/client/game/renderers/local_dev/harthmere_business_interiors";
import { makeHarthmereJobsBoardMarkerRenderer } from "@/client/game/renderers/local_dev/harthmere_jobs_board_marker";
import { makeHarthmereQuestObjectMarkersRenderer } from "@/client/game/renderers/local_dev/harthmere_quest_object_markers";
import { makeHarthmereGatheringNodeMarkersRenderer } from "@/client/game/renderers/local_dev/harthmere_gathering_node_markers";
import { makeHarthmereLootDropMarkersRenderer } from "@/client/game/renderers/local_dev/harthmere_loot_drop_markers";
import { makeMuckRenderer } from "@/client/game/renderers/muck";
import { makeNpcsRenderer } from "@/client/game/renderers/npcs";
import { makeParticlesRenderer } from "@/client/game/renderers/particles";
import { makePlaceablesRenderer } from "@/client/game/renderers/placeables";
import { PlayersRenderer } from "@/client/game/renderers/players";
import { makePreviewRenderer } from "@/client/game/renderers/previews";
import { ProtectionRenderer } from "@/client/game/renderers/protection";
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import { RobotProtectionPreviewRenderer } from "@/client/game/renderers/robot_protection_preview";
import { SkyRenderer } from "@/client/game/renderers/sky";
import { TerrainRenderer } from "@/client/game/renderers/terrain";
import {
  harthmereTerrainBlocksSight,
  registerHarthmereGroundingDeps,
} from "@/client/game/util/harthmere_entity_grounding";
import { registerHarthmereServerVoxelSolidSampler } from "@/shared/harthmere/mmo_combat_authority";
import type { RegistryLoader } from "@/shared/registry";

export async function buildRenderers(loader: RegistryLoader<ClientContext>) {
  // Grab all renderer dependencies.
  const {
    userId,
    authManager,
    clientConfig,
    table,
    resources,
    audioManager,
    mapManager,
    resourcesStats,
    permissionsManager,
    voxeloo,
  } = await loader.getAll(
    "userId",
    "authManager",
    "clientConfig",
    "table",
    "resources",
    "audioManager",
    "mapManager",
    "resourcesStats",
    "permissionsManager",
    "voxeloo"
  );

  // HARTHMERE_GLOBAL_GROUNDING_DEPS (audit fix, 2026-07-13): give
  // resource-less renderers (harthmere_assets NPC wander loop) access to the
  // shared terrain probe so moving NPCs re-ground on real terrain instead of
  // staying frozen at their spawn Y (the "NPCs float downhill / bury uphill"
  // bug).
  registerHarthmereGroundingDeps(resources);

  // HARTHMERE_SERVER_LINE_OF_SIGHT (audit fix, 2026-07-13): give the combat
  // authority a real voxel solidity sampler so line-of-sight checks (NPC AI
  // targeting, requiresLineOfSight abilities running in this client context)
  // are blocked by actual terrain instead of the old always-true stub.
  registerHarthmereServerVoxelSolidSampler((x, y, z) =>
    harthmereTerrainBlocksSight(resources, x, y, z)
  );

  // Initialize all renderers.
  const renderers: Renderer[] = [
    new SkyRenderer(resources),
    new TerrainRenderer(resources, resourcesStats, authManager, voxeloo),
    new PlayersRenderer(
      clientConfig,
      authManager,
      table,
      resources,
      audioManager,
      permissionsManager,
      voxeloo
    ),
    new DebugLocalPlayerRenderer(table, resources, permissionsManager),
    new DebugAabbRenderer(table, resources),
    makePreviewRenderer(resources),
    makeForbiddenEditsRenderer(resources),
    makeParticlesRenderer(resources),
    new GroupsRenderer(userId, table, resources),
    new BlueprintsRenderer(table, resources),
    makeDropsRenderer(table, resources, audioManager),
    makeNpcsRenderer(clientConfig, table, resources),
    makePlaceablesRenderer(clientConfig, audioManager, table, resources),
    makeHarthmereRuntimeAssetsRenderer(resources),
    makeHarthmereBusinessInteriorsRenderer(resources),
    makeHarthmereBusinessOutpostBuildingsRenderer(),
    makeHarthmereBusinessBoardMarkerRenderer(),
    // Optimized Blender-authored landmark jobs boards with distance LOD and a
    // cheap load-failure fallback. The renderer shares five material-batched
    // variants across all physical board locations.
    makeHarthmereJobsBoardMarkerRenderer(resources),
    // HARTHMERE_QUEST_OBJECT_MARKERS: small procedural stand-ins for
    // quest-linked Grove props so map objectives do not point at invisible
    // filtered/asset-dependent objects.
    makeHarthmereQuestObjectMarkersRenderer(resources),
    // Blender-authored, terrain-grounded gathering graphics at every authored
    // position; authority and F interaction remain in their existing systems.
    // (with an F-prompt) instead of only inside the HUD menu.
    makeHarthmereGatheringNodeMarkersRenderer(resources),
    // HARTHMERE_LOOT_DROP_MARKERS (audit fix, 2026-07-13): visible, grounded
    // world bodies for live-mode loot drops (thrown items, combat loot) —
    // previously drops were an invisible F-prompt radius plus a UI list row,
    // so thrown items vanished from view and silently expired.
    makeHarthmereLootDropMarkersRenderer(resources),
    // CHAPTER_1_FRACTURE_GATES: the time-portal apertures. Authored data
    // projected by the client — a gate is never an ECS entity, never moves an
    // NPC, and never edits terrain. Entry is a server-validated warp into the
    // unreachable Elsewhen band (src/shared/harthmere/ch1_elsewhen_region.ts).
    makeCh1FractureGateRenderer(resources, audioManager, () =>
      ch1ActiveGateIdsForRender()
    ),
    makeCh1WorldPhaseRenderer(resources),
    // CHAPTER_1_DUNGEON_HORIZON: the wall at the edge of a dungeon. Drawn only
    // while inside a run and only near a face; disposed the moment the player
    // leaves, so the Grove never pays for dungeon geometry.
    makeCh1DungeonHorizonBoundaryRenderer(resources, () =>
      ch1ActiveDungeonRunIdForRender()
    ),
    // HARTHMERE_TOWN_BACK_BOUNDARY: the wall at the BACK (east) of the
    // additive town only. West stays open — that is the connector road from
    // the main world, and walling it would make Harthmere unreachable.
    makeHarthmereTownBackBoundaryRenderer(resources),
    new BoundaryRenderer(resources),
    makeBeamRenderer(mapManager, resources),
    new AudioRenderer(resources, audioManager),
    makeMuckRenderer(resources),
    new RobotProtectionPreviewRenderer(resources),
    new ProtectionRenderer(table, resources),
  ];

  return renderers;
}
