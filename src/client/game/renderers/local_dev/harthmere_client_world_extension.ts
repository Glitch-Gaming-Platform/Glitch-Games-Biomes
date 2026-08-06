import { shouldEnableHarthmereAdditiveWorldExtension } from "@/shared/harthmere/world_extension";

export interface HarthmereClientWorldExtensionEnvironment {
  [key: string]: string | undefined;
  NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET?: string;
  NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN?: string;
  NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN?: string;
  NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN?: string;
  NEXT_PUBLIC_BIOMES_RENDER_HARTHMERE_RUNTIME?: string;
  NEXT_PUBLIC_BIOMES_HARTHMERE_RENDER_GLBS?: string;
  NEXT_PUBLIC_BIOMES_HARTHMERE_SNAPSHOT_BUILT_MODE?: string;
  NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE?: string;
  NEXT_PUBLIC_GLITCH_RUNTIME?: string;
  NEXT_PUBLIC_GLITCH_LOCAL_ASSETS?: string;
}

function clientWorldExtensionEnvironment(): HarthmereClientWorldExtensionEnvironment {
  return {
    NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET:
      process.env.NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET,
    NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN:
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN,
    NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN:
      process.env.NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN,
    NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN:
      process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN,
    NEXT_PUBLIC_BIOMES_RENDER_HARTHMERE_RUNTIME:
      process.env.NEXT_PUBLIC_BIOMES_RENDER_HARTHMERE_RUNTIME,
    NEXT_PUBLIC_BIOMES_HARTHMERE_RENDER_GLBS:
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_RENDER_GLBS,
    NEXT_PUBLIC_BIOMES_HARTHMERE_SNAPSHOT_BUILT_MODE:
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_SNAPSHOT_BUILT_MODE,
    NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE:
      process.env.NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE,
    NEXT_PUBLIC_GLITCH_RUNTIME: process.env.NEXT_PUBLIC_GLITCH_RUNTIME,
    NEXT_PUBLIC_GLITCH_LOCAL_ASSETS:
      process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS,
  };
}

/**
 * Client-safe extra-town topology gate.
 *
 * Next.js only substitutes browser environment variables when it can see a
 * direct `process.env.NEXT_PUBLIC_*` member access. Passing the complete
 * `process.env` object into the shared resolver leaves the browser polyfill
 * empty and silently re-enables the +1600 offset. Keep each public flag
 * explicit here so the selected topology is frozen into the client chunk at
 * build time.
 */
export function shouldEnableHarthmereClientWorldExtension(
  env: HarthmereClientWorldExtensionEnvironment =
    clientWorldExtensionEnvironment()
) {
  return shouldEnableHarthmereAdditiveWorldExtension(env);
}

function explicitlyRequestsRuntimeTown(
  env: HarthmereClientWorldExtensionEnvironment
) {
  return (
    env.NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN === "1" ||
    env.NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1" ||
    env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN === "1" ||
    env.NEXT_PUBLIC_BIOMES_RENDER_HARTHMERE_RUNTIME === "1" ||
    env.NEXT_PUBLIC_GLITCH_RUNTIME === "1" ||
    env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1"
  );
}

/** Keep authored runtime scenery visible when the local stack selects it. */
export function shouldRenderHarthmereClientRuntimeTown(
  env: HarthmereClientWorldExtensionEnvironment =
    clientWorldExtensionEnvironment()
) {
  if (env.NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE !== "1") {
    return true;
  }
  return (
    shouldEnableHarthmereClientWorldExtension(env) ||
    explicitlyRequestsRuntimeTown(env)
  );
}

/**
 * Snapshot-built mode removes GLB/OBJ map scenery because server voxels own it.
 * An explicitly requested unshifted/standalone town is the exception: those
 * authored runtime placements are the actual Bellward/Underways scenery and
 * must not disappear merely because the +1600 extension offset is disabled.
 */
export function shouldUseHarthmereClientSnapshotBuiltRuntimePolicy(
  env: HarthmereClientWorldExtensionEnvironment =
    clientWorldExtensionEnvironment()
) {
  if (
    env.NEXT_PUBLIC_BIOMES_HARTHMERE_SNAPSHOT_BUILT_MODE === "0" ||
    env.NEXT_PUBLIC_BIOMES_HARTHMERE_RENDER_GLBS === "1"
  ) {
    return false;
  }
  const extensionEnabled = shouldEnableHarthmereClientWorldExtension(env);
  return (
    env.NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE === "1" ||
    extensionEnabled ||
    explicitlyRequestsRuntimeTown(env)
  );
}

/**
 * Snapshot terrain replaces ordinary town/Wilds map props, but the unshifted
 * Bellward/Underways rooms are still authored runtime scenery. Preserve only
 * that district instead of disabling the snapshot filter for the whole map.
 */
export function shouldPreserveHarthmereUnderwaysRuntimeScenery(
  district: string | undefined
) {
  return district === "Old Well / Underways";
}
