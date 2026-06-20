export const HARTHMERE_PRODUCTION_POLISH_VERSION = "harthmere-production-building-polish-and-optimization" as const;

// HARTHMERE_PERF_AND_PLACEMENT — streaming pre-warm ring.
//
// Players reported "walking into whitespace" while landmarks loaded behind
// the camera. The cause is that the renderer streams shards lazily on first
// look, and the first ~3 seconds after spawn or fast-travel have no warm
// cache. The pre-warm ring queues a fixed list of shards centered on the
// active town spawn so the player's initial field of view is already
// resident when the camera engages.
//
// Values were chosen so the warm ring covers roughly 96m at default LOD
// (matching districtLodDistanceMeters) without exceeding the same shard
// budget the current profile already proved out. The ring is opt-in via the
// renderer at startup and idempotent — re-calling it is a no-op once the
// shards are resident.
export const HARTHMERE_PERF_AND_PLACEMENT_PREWARM_VERSION =
  "harthmere-streaming-prewarm";

export const HARTHMERE_PERF_AND_PLACEMENT_PREWARM = {
  // Ring radius in world meters around the active spawn position.
  ringRadiusMeters: 96,
  // Stride between pre-warm probe points. 16 = one probe per shard at
  // SHARD_DIM=32 with 50% overlap, which empirically eliminates the
  // whitespace-on-spawn pop without overshooting the renderer's resource
  // limiter.
  probeStrideMeters: 16,
  // Soft cap on probes per pre-warm call. The fixed ring above produces
  // ~120 probes at the default radius; anything beyond is excessive.
  maxProbesPerPrewarm: 144,
  // The pre-warm runs once at spawn and again only if the player teleports
  // more than this many meters from the last pre-warm origin.
  teleportPrewarmThresholdMeters: 64,
} as const;

export const HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS = {
  // current survey response: the Wilds capture still showed 3-6 FPS,
  // 0.63 collision density, and 45+ off-ground animated actors on average.
  // Keep the default profile more conservative; developers can still set
  // biomes.localDev.harthmere.performanceProfile="full" for screenshots.
  prototypeLoadConcurrency: 2,
  maxExteriorAccentPlacementsPerBuilding: 2,
  districtLodDistanceMeters: 96,
  nearLodDistanceMeters: 48,
  interiorLodDistanceMeters: 20,
  tinyLodDistanceMeters: 10,
  eventLodDistanceMeters: 60,
  maxAlwaysVisibleLandmarkFamilies: 5,
} as const;

export const HARTHMERE_VOXEL_DESIGN_RULES = [
  "battered-foundation",
  "corner-buttress-silhouette",
  "restrained-belt-course-not-wall-noise",
  "layered-depth-door-window-pillar",
  "icon-first-service-signage",
  "district-palette-accent",
  "asymmetrical-roofline",
  "door-clearance-preserved",
] as const;

export const HARTHMERE_PRODUCTION_POLISH_DISTRICT_PALETTE = {
  stoneFortification: ["#6E7278", "#8B8F94", "#B7B9B6"],
  timberWork: ["#4B3427", "#6B4B36", "#8B6646"],
  warmMarket: ["#C08A37", "#93403A", "#6C8272"],
  faithCalm: ["#DEE3E5", "#778593", "#E7C772"],
  povertySoot: ["#5D5149", "#85756A", "#A5907C"],
  waterNight: ["#3A5365", "#27404D", "#AABBC5"],
} as const;

export type HarthmereProductionPolishRule =
  (typeof HARTHMERE_VOXEL_DESIGN_RULES)[number];


export const HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RULES = [
  "70-30-rest-detail-ratio",
  "clean-readable-silhouette",
  "no-pointless-blocks",
  "functional-protrusions-only",
  "structural-support-under-weight",
  "layered-depth-door-window-pillar",
  "service-landmark-accents-only",
  "delete-random-wall-clutter",
] as const;

export const HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_VERSION = "harthmere-production-voxel-self-edit" as const;


export const HARTHMERE_FLOATING_BLOCK_INTEGRITY_VERSION = "harthmere-floating-block-integrity" as const;

export const HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES = [
  "no-airborne-singletons",
  "architecture-blocks-need-horizontal-neighbor-or-below-support",
  "lod-structural-shells-hide-as-one-group",
  "doors-windows-roofs-never-survive-without-their-wall-shell",
  "debug-report-unsupported-floating-blocks",
] as const;

export const HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_VERSION = "harthmere-runtime-performance-profile" as const;

export const HARTHMERE_RUNTIME_PERFORMANCE_PROFILE = {
  // Default local-dev profile. Set localStorage biomes.localDev.harthmere.performanceProfile="full"
  // to restore the full visual wilds for screenshots or final walkthroughs.
  //
  // current is tighter again after the Wilds survey showed sustained 3-6 FPS,
  // 0.63 nearby solid density, 64 missing combined meshes, and 25 off-ground
  // NPCs around [897,53,-46]. Keep gameplay-critical landmarks, but thin
  // repeated actors/props hard by default.
  defaultProfile: "optimized",
  coreRadiusMeters: 190,
  farRadiusMeters: 285,
  maxRuntimePlacementsOptimized: 560,
  maxAnimatedLifeOptimized: 72,
  maxTinyPropsOptimized: 36,
  maxWildsActorsOptimized: 16,
  maxWildsRuntimePlacementsOptimized: 54,
  maxUnsupportedFloatingBlocksVisible: 0,
  optimizedTerrainShardBudget: 396,
} as const;
