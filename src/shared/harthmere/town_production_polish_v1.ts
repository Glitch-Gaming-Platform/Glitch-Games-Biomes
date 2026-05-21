export const HARTHMERE_PRODUCTION_POLISH_VERSION_V1 = "harthmere-production-building-polish-and-optimization-v87" as const;

export const HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1 = {
  // v87 survey response: the Wilds capture still showed 3-6 FPS,
  // 0.63 collision density, and 45+ off-ground animated actors on average.
  // Keep the default profile more conservative; developers can still set
  // biomes.localDev.harthmere.performanceProfile="full" for screenshots.
  prototypeLoadConcurrency: 1,
  maxExteriorAccentPlacementsPerBuilding: 2,
  districtLodDistanceMeters: 72,
  nearLodDistanceMeters: 38,
  interiorLodDistanceMeters: 20,
  tinyLodDistanceMeters: 10,
  eventLodDistanceMeters: 46,
  maxAlwaysVisibleLandmarkFamilies: 5,
} as const;

export const HARTHMERE_VOXEL_DESIGN_RULES_V1 = [
  "battered-foundation",
  "corner-buttress-silhouette",
  "restrained-belt-course-not-wall-noise",
  "layered-depth-door-window-pillar",
  "icon-first-service-signage",
  "district-palette-accent",
  "asymmetrical-roofline",
  "door-clearance-preserved",
] as const;

export const HARTHMERE_PRODUCTION_POLISH_DISTRICT_PALETTE_V1 = {
  stoneFortification: ["#6E7278", "#8B8F94", "#B7B9B6"],
  timberWork: ["#4B3427", "#6B4B36", "#8B6646"],
  warmMarket: ["#C08A37", "#93403A", "#6C8272"],
  faithCalm: ["#DEE3E5", "#778593", "#E7C772"],
  povertySoot: ["#5D5149", "#85756A", "#A5907C"],
  waterNight: ["#3A5365", "#27404D", "#AABBC5"],
} as const;

export type HarthmereProductionPolishRuleV1 =
  (typeof HARTHMERE_VOXEL_DESIGN_RULES_V1)[number];


export const HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RULES_V2 = [
  "70-30-rest-detail-ratio",
  "clean-readable-silhouette",
  "no-pointless-blocks",
  "functional-protrusions-only",
  "structural-support-under-weight",
  "layered-depth-door-window-pillar",
  "service-landmark-accents-only",
  "delete-random-wall-clutter",
] as const;

export const HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_VERSION_V2 = "harthmere-production-voxel-self-edit-v2" as const;


export const HARTHMERE_FLOATING_BLOCK_INTEGRITY_VERSION_V3 = "harthmere-floating-block-integrity-v3" as const;

export const HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES_V3 = [
  "no-airborne-singletons",
  "architecture-blocks-need-horizontal-neighbor-or-below-support",
  "lod-structural-shells-hide-as-one-group",
  "doors-windows-roofs-never-survive-without-their-wall-shell",
  "debug-report-unsupported-floating-blocks",
] as const;

export const HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_VERSION_V3 = "harthmere-runtime-performance-profile-v87" as const;

export const HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3 = {
  // Default local-dev profile. Set localStorage biomes.localDev.harthmere.performanceProfile="full"
  // to restore the full visual wilds for screenshots or final walkthroughs.
  //
  // v87 is tighter again after the Wilds survey showed sustained 3-6 FPS,
  // 0.63 nearby solid density, 64 missing combined meshes, and 25 off-ground
  // NPCs around [897,53,-46]. Keep gameplay-critical landmarks, but thin
  // repeated actors/props hard by default.
  defaultProfile: "optimized",
  coreRadiusMeters: 190,
  farRadiusMeters: 285,
  maxRuntimePlacementsOptimized: 640,
  maxAnimatedLifeOptimized: 48,
  maxTinyPropsOptimized: 48,
  maxWildsActorsOptimized: 16,
  maxWildsRuntimePlacementsOptimized: 68,
  maxUnsupportedFloatingBlocksVisible: 0,
  optimizedTerrainShardBudget: 396,
} as const;
