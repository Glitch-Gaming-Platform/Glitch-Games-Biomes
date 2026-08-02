export type TerrainSeedMigrationMode =
  | "additive"
  | "preserve-overlays"
  | "destructive";

const TERRAIN_SEED_MIGRATION_MODES = new Set<TerrainSeedMigrationMode>([
  "additive",
  "preserve-overlays",
  "destructive",
]);

type TerrainSeedMigrationEnvironment = {
  BIOMES_TERRAIN_SEED_MODE?: string;
  BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED?: string;
  BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED?: string;
};

export function terrainSeedMigrationMode(
  env: TerrainSeedMigrationEnvironment =
    process.env as TerrainSeedMigrationEnvironment
): TerrainSeedMigrationMode {
  const requested = env.BIOMES_TERRAIN_SEED_MODE;
  const legacyForceReseed = env.BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED === "1";
  const mode = (requested ??
    (legacyForceReseed
      ? "destructive"
      : "additive")) as TerrainSeedMigrationMode;

  if (!TERRAIN_SEED_MIGRATION_MODES.has(mode)) {
    throw new Error(
      `Unknown BIOMES_TERRAIN_SEED_MODE=${requested}; expected additive, preserve-overlays, or destructive.`
    );
  }
  if (
    mode === "destructive" &&
    env.BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED !== "1"
  ) {
    throw new Error(
      "Destructive terrain reseeding requires BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED=1. Ordinary deployments must use additive or preserve-overlays mode."
    );
  }
  return mode;
}

export function terrainSeedModeRewritesExistingShards(
  mode: TerrainSeedMigrationMode
) {
  return mode !== "additive";
}

/**
 * Existing terrain shards contain durable player/world overlays in components
 * that are independent of the authored seed: shard_diff, shapes, placer,
 * occupancy, farming, growth, moisture, water, muck, and restoration state.
 *
 * A normal authored migration must therefore send a partial ECS update that
 * changes only the seed identity. Omitting the mutable components preserves
 * both their current values and concurrent writes made while maintenance runs.
 * The destructive branch exists only for explicitly acknowledged recovery.
 */
export function terrainSeedEntityForWrite<
  TAuthored extends object,
  TMutableDefaults extends object
>(input: {
  kind: "create" | "update";
  mode: TerrainSeedMigrationMode;
  authored: TAuthored;
  mutableDefaults: TMutableDefaults;
}): TAuthored | (TAuthored & TMutableDefaults) {
  if (input.kind === "create" || input.mode === "destructive") {
    return { ...input.authored, ...input.mutableDefaults };
  }
  return input.authored;
}
