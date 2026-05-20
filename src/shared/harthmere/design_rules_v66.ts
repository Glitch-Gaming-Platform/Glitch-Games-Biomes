
// HARTHMERE_DESIGN_RULES_V66
// Source: Harthmere Medieval MMO Town Design Bible, Harthmere Wilds Outside Town Narrative Setting,
// and Harthmere Bellbound Dragon lore guide. This file is intentionally data-only so future
// developers and AI patchers can import or statically inspect the rules without touching render code.

export const HARTHMERE_DESIGN_RULES_VERSION_V66 = "harthmere-design-rules-v66";

export const HARTHMERE_SNAPSHOT_CONNECTION_V66 = {
  defaultOffset: { x: 512, z: 0 },
  shardAligned: true,
  authoredRoad: {
    from: [128, -209] as const,
    to: [392, -209] as const,
  },
  shiftedDefaultRoad: {
    from: [640, -209] as const,
    to: [904, -209] as const,
  },
  destination: "Harthmere west gate / west trade road",
  designIntent: "adjacent connected settlement, not hidden debug island",
} as const;

export const HARTHMERE_MAP_EXPERIENCE_RULES_V66 = [
  {
    id: "connected-not-hidden",
    rule: "Harthmere must be reachable from a visible edge road on the implemented snapshot map.",
    implementation: "Default offset is +512 x; authored road [128,-209] to [392,-209] renders as [640,-209] to [904,-209].",
  },
  {
    id: "safe-to-danger-rings",
    rule: "Players should feel town safety fade into working roads, farms, wetlands, ruins, and deeper danger rings.",
    implementation: "The connector road has patrol, lamps, banners, shrine, road shoulder, and an off-road bandit scout.",
  },
  {
    id: "landmarks-before-clutter",
    rule: "Each district/service must be readable through landmark, silhouette, color, and sound cue before adding props.",
    implementation: "Registry keeps district themes; connector road adds signposts and red-black watch banners instead of loose clutter.",
  },
  {
    id: "bellbound-lore-cues",
    rule: "Bells, wells, bridges, cracks, water, and bronze details should carry the Bellbound Dragon mystery.",
    implementation: "The west approach includes a bronze road nail and traveler candle shrine as small lore breadcrumbs.",
  },
  {
    id: "economy-road-loop",
    rule: "Roads are economic arteries: unsafe roads should imply higher prices, missing supplies, and guard/merchant quests.",
    implementation: "Wilds registry exposes snapshot_edge_road, road_patrol, and edge_bandit_scout anchors for later quest/event wiring.",
  },
] as const;
