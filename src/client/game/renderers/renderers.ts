import type { ClientContext } from "@/client/game/context";
import { AudioRenderer } from "@/client/game/renderers/audio";
import { makeBeamRenderer } from "@/client/game/renderers/beam";
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
import { makeHarthmereJobsBoardMarkerRenderer } from "@/client/game/renderers/local_dev/harthmere_jobs_board_marker";
import { makeHarthmereQuestObjectMarkersRenderer } from "@/client/game/renderers/local_dev/harthmere_quest_object_markers";
import { makeHarthmereGatheringNodeMarkersRenderer } from "@/client/game/renderers/local_dev/harthmere_gathering_node_markers";
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
    makeHarthmereRuntimeAssetsRenderer(),
    makeHarthmereBusinessOutpostBuildingsRenderer(),
    makeHarthmereBusinessBoardMarkerRenderer(),
    // HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER: bulletproof procedural
    // kiosks for the two Harthmere jobs boards. Runs alongside the OBJ-based
    // assets above; if the snapshot policy filters the OBJ kiosk out, this
    // dedicated renderer still draws a big visible board the player can find.
    makeHarthmereJobsBoardMarkerRenderer(),
    // HARTHMERE_QUEST_OBJECT_MARKERS: small procedural stand-ins for
    // quest-linked Grove props so map objectives do not point at invisible
    // filtered/asset-dependent objects.
    makeHarthmereQuestObjectMarkersRenderer(resources),
    // HARTHMERE_GATHERING_NODE_MARKERS: visible, terrain-grounded resource
    // nodes at every gathering position so harvest targets exist in the world
    // (with an F-prompt) instead of only inside the HUD menu.
    makeHarthmereGatheringNodeMarkersRenderer(resources),
    new BoundaryRenderer(resources),
    makeBeamRenderer(mapManager, resources),
    new AudioRenderer(resources, audioManager),
    makeMuckRenderer(resources),
    new RobotProtectionPreviewRenderer(resources),
    new ProtectionRenderer(table, resources),
  ];

  return renderers;
}
