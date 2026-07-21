// HARTHMERE_DESIGN_RULES
// Source: Harthmere Medieval MMO Town Design Bible, Harthmere Wilds Outside Town Narrative Setting,
// and Harthmere Bellbound Dragon lore guide. This file is intentionally data-only so future
// developers and AI patchers can import or statically inspect the rules without touching render code.

import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_EXTENSION_ROAD,
} from "@/shared/harthmere/world_extension";

export const HARTHMERE_DESIGN_RULES_VERSION = "harthmere-design-rules";

export const HARTHMERE_SNAPSHOT_CONNECTION = {
  defaultOffset: {
    x: HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
    z: HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  },
  shardAligned: true,
  authoredRoad: {
    from: [192, -209] as const,
    to: [392, -209] as const,
  },
  shiftedDefaultRoad: {
    from: HARTHMERE_EXTENSION_ROAD.worldStart,
    to: HARTHMERE_EXTENSION_ROAD.worldWestGate,
  },
  destination: "Harthmere west gate / west trade road",
  designIntent: "adjacent connected settlement, not hidden debug island",
} as const;

export const HARTHMERE_MAP_EXPERIENCE_RULES = [
  {
    id: "connected-not-hidden",
    rule: "Harthmere must be reachable from a visible edge road on the implemented snapshot map.",
    implementation:
      "Default offset is +1600 x; the generated road begins at the old/new boundary [1792,-209] and follows authored [192,-209] to the west gate [392,-209] / world [1992,-209].",
  },
  {
    id: "safe-to-danger-rings",
    rule: "Players should feel town safety fade into working roads, farms, wetlands, ruins, and deeper danger rings.",
    implementation:
      "The connector road has patrol, lamps, banners, shrine, road shoulder, and an off-road bandit scout.",
  },
  {
    id: "landmarks-before-clutter",
    rule: "Each district/service must be readable through landmark, silhouette, color, and sound cue before adding props.",
    implementation:
      "Registry keeps district themes; connector road adds signposts and red-black watch banners instead of loose clutter.",
  },
  {
    id: "bellbound-lore-cues",
    rule: "Bells, wells, bridges, cracks, water, and bronze details should carry the Bellbound Dragon mystery.",
    implementation:
      "The west approach includes a bronze road nail and traveler candle shrine as small lore breadcrumbs.",
  },
  {
    id: "economy-road-loop",
    rule: "Roads are economic arteries: unsafe roads should imply higher prices, missing supplies, and guard/merchant quests.",
    implementation:
      "Wilds registry exposes snapshot_edge_road, road_patrol, and edge_bandit_scout anchors for later quest/event wiring.",
  },
] as const;
