#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const path = require("path");
const fs = require("fs");
const { connectToRedisWithLua } = require(
  path.join(process.cwd(), "src/server/shared/redis/connection")
);
const { RedisWorld } = require(
  path.join(process.cwd(), "src/server/shared/world/redis")
);
const { loadVoxeloo } = require(
  path.join(process.cwd(), "src/server/shared/voxeloo")
);
const { safeGetTerrainId } = require(
  path.join(process.cwd(), "src/shared/asset_defs/terrain")
);
const { blockPos } = require(path.join(process.cwd(), "src/shared/game/shard"));
const { loadBlockWrapper, saveBlockWrapper } = require(
  path.join(process.cwd(), "src/shared/wasm/biomes")
);
const { HARTHMERE_BUILDINGS } = require(
  path.join(process.cwd(), "src/shared/harthmere/harthmere_town_buildings")
);
const {
  harthmereBuildingRoofBlockAt,
  harthmereBuildingRoofMaterial,
  harthmereBuildingRoofRise,
} = require(
  path.join(process.cwd(), "src/shared/harthmere/harthmere_building_style")
);
const { harthmereTownSurfaceMaterialAt } = require(
  path.join(process.cwd(), "src/shared/harthmere/harthmere_town_surface")
);
const { HARTHMERE_TOWN_STREETS_VERSION, harthmereTownStreetRects } = require(
  path.join(process.cwd(), "src/shared/harthmere/harthmere_town_streets")
);
const {
  HARTHMERE_TOWN_BUILDINGS_VERSION,
  harthmereShellRebuildRects,
} = require(
  path.join(process.cwd(), "src/shared/harthmere/harthmere_town_buildings")
);
const {
  HARTHMERE_WEST_SEAM_RIDGE_BOUNDS,
  HARTHMERE_WEST_SEAM_RIDGE_MAX_RISE,
  HARTHMERE_WEST_SEAM_RIDGE_VERSION,
} = require(
  path.join(process.cwd(), "src/shared/harthmere/harthmere_west_seam_ridge")
);
const { HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS } = require(
  path.join(
    process.cwd(),
    "src/shared/harthmere/harthmere_npc_population_policy"
  )
);
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_EXTENSION_GROUND_Y,
  harthmereExtensionTerrainEntityIdForShard,
} = require(path.join(process.cwd(), "src/shared/harthmere/world_extension"));

const APPLY = process.env.APPLY === "1";
const APPLY_SHARD_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.APPLY_SHARD_BATCH_SIZE || "4", 10)
);
const HARTHMERE_TOWN_PRODUCTION_REPAIR_VERSION =
  "harthmere-town-production-repair-v2";

const MATERIAL_NAME = {
  grass: "grass",
  dirt: "dirt",
  gravel: "gravel",
  cobblestone: "cobblestone",
  cobblestoneBrick: "cobblestone_brick",
  stoneBrick: "stone_brick",
  stonePolished: "stone_polished",
  stoneShingles: "stone_shingles",
  thatch: "thatch",
};

const ROOF_BUILDING_NAMES = new Set([
  "brass_scale_bank",
  "black_anvil_smithy",
  "copper_kettle_inn",
  "mail_post_house",
]);

function materialId(material) {
  const name = MATERIAL_NAME[material];
  const id = safeGetTerrainId(name);
  if (id === undefined) {
    throw new Error(`Missing terrain material ${material} (${name})`);
  }
  return Number(id);
}

function loadCanonicalTerrainBuilder() {
  process.env.BIOMES_TERRAIN_SEED_MODE = "preserve-overlays";
  process.env.BIOMES_MIGRATE_HARTHMERE_AUTHORED_WATER = "0";
  const bundlePath = path.join(process.cwd(), "dist/shim.js");
  const startMarker = 'void (0, main_1.runServer)("shim",';
  const source = fs.readFileSync(bundlePath, "utf8");
  if (!source.includes(startMarker)) {
    throw new Error(`Unable to locate shim startup marker in ${bundlePath}`);
  }
  // BUNDLE FRESHNESS GATE.
  //
  // This writer reads its target set from the WORKTREE (building table, street
  // network) and its replacement geometry from the PACKAGED BUNDLE. If the two
  // disagree, the repair does the worst possible thing: it rebuilds every
  // targeted shard from stale geometry and thereby REVERTS the shells and
  // streets the deploy was meant to ship, while still reporting success and
  // printing the worktree's version numbers.
  //
  // Nothing else in the deploy catches this. The persisted-world audit checks
  // the town surface and four roofs; it does not verify a single shell position
  // or street voxel. So the check belongs here, before anything is written.
  for (const [label, version] of [
    ["building table", HARTHMERE_TOWN_BUILDINGS_VERSION],
    ["street network", HARTHMERE_TOWN_STREETS_VERSION],
    ["west seam ridge", HARTHMERE_WEST_SEAM_RIDGE_VERSION],
  ]) {
    if (!source.includes(version)) {
      throw new Error(
        `Stale ${bundlePath}: it does not contain the worktree's ${label} ` +
          `version "${version}". Rebuild the image from this worktree before ` +
          `running the town repair — reconstructing shards from an older ` +
          `bundle would overwrite the current shells and streets with the ` +
          `geometry they replaced.`
      );
    }
  }
  const instrumented = source.replace(
    startMarker,
    'globalThis.__harthmereTownTerrainBuilder = { localDevTerrainShardSpecs, makeLocalDevTerrainShard }; false && (0, main_1.runServer)("shim",'
  );
  // The production bundle owns the canonical terrain generator. Instrumenting
  // it in memory avoids duplicating that very large topology implementation,
  // while the false guard prevents the shim server from starting.
  const executeBundle = new Function(
    "require",
    "module",
    "exports",
    "__filename",
    "__dirname",
    instrumented
  );
  executeBundle(
    require,
    module,
    module.exports,
    bundlePath,
    path.dirname(bundlePath)
  );
  const builder = globalThis.__harthmereTownTerrainBuilder;
  delete globalThis.__harthmereTownTerrainBuilder;
  if (
    !builder?.localDevTerrainShardSpecs ||
    !builder?.makeLocalDevTerrainShard
  ) {
    throw new Error("Canonical Harthmere terrain builder was not exposed");
  }
  return builder;
}

function buffersEqual(a, b) {
  return Buffer.from(a ?? []).equals(Buffer.from(b ?? []));
}

function storyHeight(building) {
  return building.profile === "slum" ? 4 : 5;
}

function floorCount(building) {
  return Math.max(1, building.floors ?? (building.upper ? 2 : 1));
}

function inBuildingFootprint(x, z) {
  return HARTHMERE_BUILDINGS.some(
    (building) =>
      x >= building.x0 &&
      x <= building.x1 &&
      z >= building.z0 &&
      z <= building.z1
  );
}

function terrainEntityIdForPosition(position) {
  const id = harthmereExtensionTerrainEntityIdForShard(
    Math.floor(position[0] / 32),
    Math.floor(position[1] / 32),
    Math.floor(position[2] / 32)
  );
  if (id === undefined) {
    throw new Error(`No stable Harthmere terrain id for ${position.join(",")}`);
  }
  return id;
}

function addEdit(editsByEntity, position, value, reason) {
  const id = terrainEntityIdForPosition(position);
  const edits = editsByEntity.get(id) ?? [];
  edits.push({ position, value, reason });
  editsByEntity.set(id, edits);
}

function addCanonicalShardTarget(editsByEntity, position) {
  const id = terrainEntityIdForPosition(position);
  if (!editsByEntity.has(id)) {
    editsByEntity.set(id, []);
  }
}

function inclusiveShardSamples(min, max) {
  const values = new Set([min, max]);
  let value = Math.floor(min / 32) * 32 + 31;
  while (value < max) {
    values.add(Math.max(min, value));
    values.add(Math.min(max, value + 1));
    value += 32;
  }
  return [...values];
}

function buildEdits() {
  const editsByEntity = new Map();

  // Shell moves and the derived street network are authored by the canonical
  // shim generator. Target every shard their volumes overlap so ordinary
  // reconciliation migrates existing production shards instead of only new
  // worlds. The actual replacement is composed from the canonical seed below;
  // these entries merely widen the reviewed target set.
  for (const building of HARTHMERE_BUILDINGS) {
    const shellTopRelY = floorCount(building) * storyHeight(building);
    const roofTopRelY = shellTopRelY + harthmereBuildingRoofRise(building);
    for (const x of inclusiveShardSamples(building.x0 - 1, building.x1 + 1)) {
      for (const z of inclusiveShardSamples(building.z0 - 1, building.z1 + 1)) {
        for (const relY of inclusiveShardSamples(0, roofTopRelY)) {
          addCanonicalShardTarget(editsByEntity, [
            x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            HARTHMERE_EXTENSION_GROUND_Y + relY,
            z + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
          ]);
        }
      }
    }
  }
  for (const rect of harthmereTownStreetRects()) {
    for (const x of inclusiveShardSamples(rect.x0, rect.x1)) {
      for (const z of inclusiveShardSamples(rect.z0, rect.z1)) {
        addCanonicalShardTarget(editsByEntity, [
          x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
          HARTHMERE_EXTENSION_GROUND_Y,
          z + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
        ]);
      }
    }
  }

  // Ground the shell pass rewrote outside the town core: the two Wilds
  // structures that had to come east across the old map's edge. Their new
  // footprints sit on shards that already exist, so additive seeding will not
  // touch them and the canonical rebuild has to be asked for explicitly.
  for (const rect of harthmereShellRebuildRects()) {
    for (const x of inclusiveShardSamples(rect.x0, rect.x1)) {
      for (const z of inclusiveShardSamples(rect.z0, rect.z1)) {
        for (const relY of inclusiveShardSamples(0, 40)) {
          addCanonicalShardTarget(editsByEntity, [
            x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            HARTHMERE_EXTENSION_GROUND_Y + relY,
            z + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
          ]);
        }
      }
    }
  }

  // The west seam ridge is the hillside either side of the road where the
  // imported map hands over. Unlike everything above it is authored in WORLD
  // coordinates and sits west of the town, so the offset must not be applied.
  // It is new ground on shards that already exist — the exact case additive
  // seeding cannot detect, since those shards are neither missing nor unsolid.
  for (const x of inclusiveShardSamples(
    HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.minX,
    HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.maxX
  )) {
    for (const z of inclusiveShardSamples(
      HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.minZ,
      HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.maxZ
    )) {
      for (const y of inclusiveShardSamples(
        HARTHMERE_EXTENSION_GROUND_Y,
        HARTHMERE_EXTENSION_GROUND_Y + HARTHMERE_WEST_SEAM_RIDGE_MAX_RISE
      )) {
        addCanonicalShardTarget(editsByEntity, [x, y, z]);
      }
    }
  }

  // This is the exact surface sampled by audit-harthmere-town-repair.cjs.
  // Undefined style cells are intentionally open grass rather than another
  // district-sized stone rectangle.
  for (let authoredX = 500; authoredX <= 570; authoredX += 1) {
    for (let authoredZ = -242; authoredZ <= -180; authoredZ += 1) {
      if (inBuildingFootprint(authoredX, authoredZ)) continue;
      const material =
        harthmereTownSurfaceMaterialAt(authoredX, authoredZ) ?? "grass";
      addEdit(
        editsByEntity,
        [
          authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
          HARTHMERE_EXTENSION_GROUND_Y,
          authoredZ + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
        ],
        materialId(material),
        "town-surface"
      );
    }
  }

  const oldFlatRoofIds = new Set(
    [
      "black_wool",
      "blue_wool",
      "green_wool",
      "red_wool",
      "white_wool",
      "yellow_wool",
    ]
      .map((name) => safeGetTerrainId(name))
      .filter((id) => id !== undefined)
      .map(Number)
  );
  for (const building of HARTHMERE_BUILDINGS) {
    if (!ROOF_BUILDING_NAMES.has(building.name)) continue;
    const shellTopRelY = floorCount(building) * storyHeight(building);
    const roofRise = harthmereBuildingRoofRise(building);
    const roofId = materialId(harthmereBuildingRoofMaterial(building));
    for (let x = building.x0 - 1; x <= building.x1 + 1; x += 1) {
      for (let z = building.z0 - 1; z <= building.z1 + 1; z += 1) {
        for (
          let relY = shellTopRelY + 1;
          relY <= shellTopRelY + roofRise;
          relY += 1
        ) {
          const expected = harthmereBuildingRoofBlockAt(
            building,
            x,
            relY,
            z,
            shellTopRelY
          );
          addEdit(
            editsByEntity,
            [
              x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
              HARTHMERE_EXTENSION_GROUND_Y + relY,
              z + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
            ],
            expected ? roofId : undefined,
            expected ? `${building.name}-roof` : `${building.name}-roof-cleanup`
          );
        }
      }
    }
  }

  return { editsByEntity, oldFlatRoofIds };
}

async function applyTerrain(
  world,
  voxeloo,
  editsByEntity,
  oldFlatRoofIds,
  canonicalTerrain
) {
  const entries = [...editsByEntity.entries()].sort(([a], [b]) => a - b);
  const specsById = new Map(
    canonicalTerrain.localDevTerrainShardSpecs().map((spec) => [spec.id, spec])
  );
  const stats = {
    targetShards: entries.length,
    inspectedEdits: 0,
    authoredOverrideEdits: 0,
    changedShards: 0,
    repairedSeedShards: 0,
    surfaceEdits: 0,
    roofEdits: 0,
    clearedOldRoofBlocks: 0,
  };
  for (let start = 0; start < entries.length; start += APPLY_SHARD_BATCH_SIZE) {
    const batch = entries.slice(start, start + APPLY_SHARD_BATCH_SIZE);
    const editor = world.edit();
    const entities = await editor.get(batch.map(([id]) => id));
    let dirtyBatch = false;
    for (let index = 0; index < batch.length; index += 1) {
      const [id, edits] = batch[index];
      const entity = entities[index];
      if (!entity?.shardSeed?.()) {
        throw new Error(`Missing terrain shard_seed for ${id}`);
      }
      const spec = specsById.get(id);
      if (!spec) {
        throw new Error(`No canonical Harthmere terrain spec for ${id}`);
      }
      const canonicalChange = canonicalTerrain.makeLocalDevTerrainShard(
        voxeloo,
        "update",
        id,
        spec.shardX,
        spec.shardY,
        spec.shardZ,
        1,
        false
      );
      const canonicalSeed = canonicalChange.entity.shard_seed;
      const canonicalBox = canonicalChange.entity.box;
      if (!canonicalSeed || !canonicalBox) {
        throw new Error(`Canonical terrain builder omitted seed/box for ${id}`);
      }
      const seed = new voxeloo.VolumeBlock_U32();
      try {
        // Compose the small town-repair overrides on top of the complete
        // canonical seed first. Only then compare and write the final buffer.
        // This makes retries idempotent and never exposes a half-restored shard.
        loadBlockWrapper(voxeloo, seed, canonicalSeed);
        for (const edit of edits) {
          stats.inspectedEdits += 1;
          const local = blockPos(...edit.position);
          const current = Number(seed.get(...local) ?? 0);
          let next = edit.value;
          if (next === undefined) {
            if (!oldFlatRoofIds.has(current)) continue;
            next = 0;
            stats.clearedOldRoofBlocks += 1;
          }
          if (current === next) continue;
          if (edit.reason === "town-surface") stats.surfaceEdits += 1;
          else stats.roofEdits += 1;
          stats.authoredOverrideEdits += 1;
          seed.set(...local, next);
        }
        const repairedSeed = saveBlockWrapper(voxeloo, seed);
        if (!buffersEqual(entity.shardSeed().buffer, repairedSeed.buffer)) {
          stats.repairedSeedShards += 1;
          stats.changedShards += 1;
          if (APPLY) {
            entity.setBox(canonicalBox);
            entity.setShardSeed({ buffer: repairedSeed.buffer });
            dirtyBatch = true;
          }
        }
      } finally {
        seed.delete();
      }
    }
    if (APPLY && dirtyBatch) {
      await editor.commit();
    }
  }
  return stats;
}

async function retireNpcRows(world) {
  const ids = [...HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS];
  const rows = await world.getWithVersion(ids);
  const existing = rows
    .map(([version, entity], index) => ({ id: ids[index], version, entity }))
    .filter((row) => row.entity !== undefined);
  if (APPLY && existing.length > 0) {
    const result = await world.apply({
      iffs: existing.map(({ id, version }) => [id, version]),
      changes: existing.map(({ id }) => ({ kind: "delete", id })),
    });
    if (result.outcome !== "success") {
      throw new Error(`NPC retirement failed: ${result.outcome}`);
    }
  }
  return {
    audited: ids.length,
    existingBeforeRepair: existing.length,
    deleted: APPLY ? existing.length : 0,
  };
}

async function main() {
  const voxeloo = await loadVoxeloo();
  const canonicalTerrain = loadCanonicalTerrainBuilder();
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  try {
    await world.waitForHealthy();
    const { editsByEntity, oldFlatRoofIds } = buildEdits();
    const terrain = await applyTerrain(
      world,
      voxeloo,
      editsByEntity,
      oldFlatRoofIds,
      canonicalTerrain
    );
    const npcs = await retireNpcRows(world);
    console.log(
      JSON.stringify(
        {
          version: HARTHMERE_TOWN_PRODUCTION_REPAIR_VERSION,
          streetsVersion: HARTHMERE_TOWN_STREETS_VERSION,
          westSeamRidgeVersion: HARTHMERE_WEST_SEAM_RIDGE_VERSION,
          apply: APPLY,
          terrain,
          npcs,
        },
        null,
        2
      )
    );
    console.log(
      `HARTHMERE_TOWN_TARGETED_REPAIR_READY version=${HARTHMERE_TOWN_PRODUCTION_REPAIR_VERSION} apply=${APPLY ? 1 : 0}`
    );
  } finally {
    await world.stop?.();
  }
}

if (process.env.HARTHMERE_TOWN_REPAIR_LOADER_SELF_TEST === "1") {
  const builder = loadCanonicalTerrainBuilder();
  const specs = builder.localDevTerrainShardSpecs();
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error("Canonical terrain builder self-test returned no shards");
  }
  console.log(
    `HARTHMERE_TOWN_REPAIR_LOADER_READY terrainShards=${specs.length}`
  );
} else {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}
