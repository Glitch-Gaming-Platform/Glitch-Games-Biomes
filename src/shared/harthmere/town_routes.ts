// HARTHMERE_TOWN_ROUTE_GRAPH_V1
// Static route graph contract. Runtime route following can consume these anchors later;
// tests use this file to ensure town NPC movement is not hand-waved.
export const HARTHMERE_TOWN_ROUTE_GRAPH_VERSION_V1 = "harthmere-town-route-graph-v1";

export const HARTHMERE_TOWN_ROUTE_DISTRICTS_V1 = [
  "north_gate",
  "market_square",
  "player_services",
  "temple_green",
  "river_docks",
  "craftsman_row",
  "copper_kettle",
  "old_well_underways",
  "noble_rise",
  "guard_yard",
  "mudden_ward",
] as const;

export const HARTHMERE_TOWN_ROLE_ROUTES_V1 = {
  guardPatrolRoute: "guard patrol route loop covers north_gate guard_yard noble_rise market_square",
  marketRoute: "market route loop covers market_square player_services copper_kettle",
  clergyRoute: "clergy route loop covers temple_green old_well_underways",
  courierRoute: "courier route loop covers north_gate market_square player_services river_docks",
  muddenRoute: "mudden route loop covers mudden_ward old_well_underways market_square",
} as const;

export const HARTHMERE_TOWN_ROUTE_SAFETY_V1 = {
  fallback: "fallback safeAnchor unstuck nearest valid anchor if an invalid route is found",
  validation: "validate route graph by collision blocker obstacle sweep navmesh avoid checks before enabling patrol loops",
} as const;


// HARTHMERE_TOWN_ROUTE_GRAPH_V48
// Concrete patrol/service route anchors used by the local-dev renderer to keep
// NPCs dispersed instead of stacked in one crowd blob.
export const HARTHMERE_TOWN_ROUTE_GRAPH_VERSION_V48 = "harthmere-town-route-graph-npc-dispersal-v48";
export const HARTHMERE_TOWN_ROUTE_GRAPH_NAVIGATION_VERSION_V150 = "harthmere-town-route-graph-road-safe-v150";

export const HARTHMERE_TOWN_ROUTE_ANCHORS_V48 = {
  // V150 road-safe patrol/service loops. Runtime tests sweep these against
  // hard blockers before deploy so NPCs do not cut through buildings/walls.
  north_gate: [[486, -282], [486, -252], [486, -222], [486, -207], [486, -222], [486, -252]],
  guard_yard: [[486, -207], [490, -225], [500, -242], [500, -255], [509, -255], [500, -255], [500, -242], [490, -225]],
  market_square: [[430, -207], [462, -207], [494, -207], [526, -207], [494, -207], [462, -207]],
  player_services: [[486, -207], [520, -207], [548, -207], [556, -214], [548, -207], [520, -207]],
  craftsman_row: [[486, -207], [500, -220], [512, -232], [524, -236], [512, -232], [500, -220]],
  copper_kettle: [[486, -207], [520, -207], [538, -207], [552, -207], [538, -207], [520, -207]],
  temple_green: [[486, -207], [486, -190], [491, -155], [486, -190]],
  noble_rise: [[486, -207], [526, -218], [552, -246], [526, -218]],
  river_docks: [[536, -196], [568, -196], [600, -196], [568, -196]],
  mudden_ward: [[412, -166], [419, -170], [430, -172], [442, -174], [430, -172], [419, -170]],
  residential: [[486, -282], [486, -252], [486, -222], [486, -207]],
} as const;

export const HARTHMERE_TOWN_NPC_DENSITY_LIMITS_V48 = {
  maxActorsWithin12m: 7,
  maxActorsWithin20m: 16,
  maxActorsWithin30m: 20,
  routeMovementRequired: true,
} as const;


// HARTHMERE_CONNECTED_MAP_ROUTE_ANCHORS_V66
// Authored anchors are shifted by the runtime/server extra-town offset. With the
// default +512 x offset this becomes a real road from snapshot edge x=640 to
// Harthmere west gate x=904.
export const HARTHMERE_CONNECTED_MAP_ROUTE_ANCHORS_V66 = {
  version: "harthmere-connected-map-route-anchors-v66",
  authoredSnapshotEdgeRoad: [[128, -209], [192, -209], [280, -209], [392, -209]],
  shiftedDefaultSnapshotEdgeRoad: [[640, -209], [704, -209], [792, -209], [904, -209]],
  safetyGradient: ["snapshot_edge_sign", "lamp_and_banner_lane", "traveler_shrine", "offroad_bandit_scout", "west_gate_lamp"],
} as const;
