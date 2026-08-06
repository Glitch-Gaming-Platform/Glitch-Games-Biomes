const fs = require("fs");
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL " + msg);
    process.exit(1);
  }
  console.log("OK " + msg);
}
const shim = fs.readFileSync("src/server/shim/main.ts", "utf8");
const players = fs.readFileSync("src/server/logic/utils/players.ts", "utf8");
const renderer = fs.readFileSync(
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
  "utf8"
);
const clientWorldExtension = fs.readFileSync(
  "src/client/game/renderers/local_dev/harthmere_client_world_extension.ts",
  "utf8"
);
const docker = fs.readFileSync("Dockerfile.biomes", "utf8");
const prepare = fs.readFileSync(
  "scripts/glitch/prepare-glitch-image.sh",
  "utf8"
);
const runner = fs.readFileSync(
  "scripts/glitch/run-glitch-local-game-stack.sh",
  "utf8"
);
const deploy = fs.readFileSync(
  "scripts/glitch/deploy-production-local-redis-smoke.sh",
  "utf8"
);
const liveEntitySeed = fs.readFileSync(
  "src/server/harthmere/live_entity_ecs_seed.ts",
  "utf8"
);
const liveEntityProductionSeed = fs.readFileSync(
  "src/shared/harthmere/live_entity_production_seed.ts",
  "utf8"
);
const mapTerrain = fs.readFileSync(
  "src/client/components/biomes_ui/adapters/harthmereMapTerrainRegions.ts",
  "utf8"
);
const worldSync = fs.readFileSync(
  "scripts/harthmere/reconcile-production-world-sync.cjs",
  "utf8"
);
const productionPlacement = fs.readFileSync(
  "src/shared/harthmere/production_terrain_placement_map.ts",
  "utf8"
);
const groundingProbe = fs.readFileSync(
  "scripts/harthmere/probe-production-terrain-grounding.cjs",
  "utf8"
);
ok(
  shim.includes("HARTHMERE_EXTRA_TOWN_OFFSET"),
  "server shim extra-town offset marker is present"
);
ok(
  shim.includes("shouldEnableHarthmereAdditiveWorldExtension(process.env)"),
  "server enables additive town by default with explicit rollback support"
);
ok(
  shim.includes("harthmereExtraTownShardOffsetX()"),
  "terrain shard specs are shifted"
);
ok(
  shim.includes("harthmereAuthoredWorldX(worldX)"),
  "terrain generator maps shifted world X back to authored X"
);
ok(
  shim.includes("harthmereAuthoredWorldZ(worldZ)"),
  "terrain generator maps shifted world Z back to authored Z"
);
ok(
  shim.includes("LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID") &&
    shim.includes("reconcileLocalDevRuntimeContent(service, worldApi)"),
  "already-seeded worlds reconcile persisted Harthmere runtime coordinates"
);
ok(
  shim.indexOf(
    "reconcileLocalDevRuntimeContent(service, worldApi)",
    shim.indexOf(
      '"Skipping local dev starter town seed; fingerprint already current."'
    )
  ) >
    shim.indexOf(
      '"Skipping local dev starter town seed; fingerprint already current."'
    ),
  "terrain fingerprint fast path still runs runtime-content migration"
);
ok(
  shim.includes('terrainMigrationMode === "additive"') &&
    shim.includes("? []") &&
    shim.includes("[...previousAdditiveTerrainIds]"),
  "additive fingerprint checks ignore intentionally preserved legacy terrain ids"
);
ok(
  shim.includes("LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE") &&
    shim.includes("buildAndApplyLocalDevTerrainSeedBatches") &&
    shim.includes("Applied bounded local dev terrain seed batch") &&
    shim.includes("batch = []") &&
    shim.includes(
      "The seed marker is written later, after every shard and authored"
    ),
  "production terrain reseed applies bounded build batches and stamps completion only after all shards"
);
ok(
  shim.includes("HARTHMERE_EXTENSION_FEET_Y") &&
    shim.includes("HARTHMERE_ADDITIVE_RUNTIME_CONTENT_VERSION") &&
    shim.includes("makeLocalDevRuntimeContentFingerprint") &&
    shim.includes("? HARTHMERE_EXTENSION_FEET_Y"),
  "persisted additive-town NPCs migrate to the flat extension feet level"
);
ok(
  shim.includes("position: harthmereWorldPosition(npc.position)") ||
    shim.includes(
      "position: harthmereGroundedNpcWorldPositionWithClaim(npc, claimed)"
    ),
  "NPC positions are shifted"
);
ok(
  players.includes("HARTHMERE_EXTRA_TOWN_PLAYER_START_OFFSET"),
  "player start offset marker is present"
);
ok(
  players.includes("offsetLocalDevStarterTownSpawn"),
  "explicit Harthmere starts use shifted spawn"
);
ok(
  players.includes("return sample(CONFIG.playerStartPositions)!"),
  "snapshot start remains default"
);
ok(
  renderer.includes("HARTHMERE_RUNTIME_EXTRA_TOWN_OFFSET"),
  "client runtime offset marker is present"
);
ok(
  renderer.includes("NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN"),
  "client reads public extra-town flag"
);
ok(
  renderer.includes("shiftHarthmereRuntimePlacementForExtraTown"),
  "client placements shift"
);
ok(
  renderer.includes("shouldEnableHarthmereClientWorldExtension()") &&
    !renderer.includes(
      "shouldEnableHarthmereAdditiveWorldExtension(process.env)"
    ),
  "client offset gate does not pass the empty browser process.env polyfill"
);
ok(
  clientWorldExtension.includes(
    "process.env.NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET"
  ) &&
    clientWorldExtension.includes(
      "process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN"
    ),
  "client offset gate uses direct public env accesses that Next can inline"
);
ok(
  renderer.includes("extra-town-offset"),
  "shifted client placements are tagged"
);
ok(
  liveEntitySeed.includes("position: seed.position") &&
    !liveEntitySeed.includes("resolveHarthmereProductionMarkerPosition"),
  "live entity ECS seeds use their canonical per-coordinate-space positions"
);
ok(
  liveEntityProductionSeed.includes("return recommended;") &&
    liveEntityProductionSeed.includes("harthmereLiveEntityIsTownLivestock") &&
    liveEntityProductionSeed.includes(
      "HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_SEEDS"
    ),
  "original-map creatures preserve terrain-sampled XYZ while Harthmere uses a separate town herd"
);
ok(
  shim.includes("allowMuckwad") &&
    shim.includes("!isHarthmereExtensionWorldPosition") &&
    shim.includes("shard_muck: ShardMuck.create") &&
    shim.includes('copperOre: terrainId("copper_ore"'),
  "additive Harthmere suppresses Muck terrain/atmosphere and includes sparse copper resources"
);
ok(
  worldSync.includes("position: seed.position") &&
    !worldSync.includes("resolveHarthmereProductionMarkerPosition") &&
    worldSync.includes("POST_DEPLOY_POSITION_AUDIT") &&
    !worldSync.includes(
      "check(\n    true,\n    `live entity positions converged"
    ),
  "post-deploy world sync preserves and verifies canonical creature coordinates"
);
ok(
  productionPlacement.includes("ADDITIVE_HARTHMERE_MARKER_PLACEMENT") &&
    productionPlacement.includes("HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X"),
  "shared marker resolver rejects retired west-map coordinates for shifted content"
);
ok(
  mapTerrain.includes("shiftAuthoredTerrainShapeToWorld") &&
    mapTerrain.includes('id: "grove_to_harthmere_connector_road"'),
  "player map shifts town geography and draws the complete connector road"
);
for (const family of [
  "additive_town_npcs",
  "additive_robot_sentinels",
  "additive_town_animals",
  "additive_town_bandits",
  "original_muckers_hexers",
  "original_muck_area_animals",
  "original_road_camp_bandits",
  "original_grove_npcs",
  "original_snapshot_hostiles",
  "original_business_owners",
  "original_business_customers",
  "gathering_nodes",
]) {
  ok(
    groundingProbe.includes(`\"${family}\"`),
    `production grounding gate covers ${family}`
  );
}
ok(
  deploy.includes("HARTHMERE_SKIP_GROUNDING_PROBE") &&
    deploy.includes("APPLY=1") &&
    !deploy.includes("HARTHMERE_RUN_GROUNDING_PROBE:-0"),
  "production deploy repairs and verifies grounding by default"
);
ok(
  docker.includes("ENV BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1"),
  "production image enables the additive town"
);
ok(
  docker.includes("ENV BIOMES_CREATE_LOCAL_DEV_TERRAIN=1"),
  "production image enables automatic terrain creation"
);
ok(
  docker.includes("ENV BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "production image server offset is +1600"
);
ok(
  docker.includes("ENV NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "production image client offset is +1600"
);
ok(
  prepare.includes("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X:-1600"),
  "image preparation defaults the server offset to +1600"
);
ok(
  prepare.includes("NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X"),
  "image preparation mirrors the offset into the client build"
);
ok(
  runner.includes("GLITCH_DEFAULT_CREATE_TERRAIN=1") &&
    runner.includes(
      "BIOMES_CREATE_LOCAL_DEV_TERRAIN:-$GLITCH_DEFAULT_CREATE_TERRAIN"
    ),
  "unified local runner leaves automatic terrain creation enabled while production roles can disable it"
);
ok(
  runner.includes("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X:-1600"),
  "production runner defaults the connected offset to +1600"
);
ok(
  deploy.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN=0") &&
    deploy.includes("materialize_production_harthmere_connector_route"),
  "Azure runtime disables per-replica terrain seeding after guarded Harthmere and connector reconciliation"
);
ok(
  deploy.includes("HARTHMERE_TERRAIN_MAINTENANCE_READY_POLLS:-360") &&
    deploy.includes(
      'local max_polls="${3:-${AZURE_REVISION_READY_POLLS:-90}}"'
    ),
  "isolated terrain maintenance has a dedicated one-hour readiness window"
);
ok(
  deploy.includes("max_suffix_length=$((54 - ${#AZURE_CONTAINER_APP} - 2))") &&
    deploy.includes(
      'suffix="$(printf \'terrain-%s\' "$tag_slug" | cut -c1-"$max_suffix_length")"'
    ),
  "terrain maintenance revision suffix stays within Azure's combined 54-character name limit"
);
ok(
  deploy.includes("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "Azure deployment explicitly uses the +1600 server offset"
);
ok(
  deploy.includes("NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "Azure build/runtime explicitly use the +1600 client offset"
);
ok(
  deploy.includes(
    'NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET="$disable_extra_town_offset"'
  ) &&
    deploy.includes(
      'BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET="$disable_extra_town_offset"'
    ),
  "production build mirrors the selected offset topology into server and client compilation"
);
console.log("harthmere extra-town offset current check passed");
