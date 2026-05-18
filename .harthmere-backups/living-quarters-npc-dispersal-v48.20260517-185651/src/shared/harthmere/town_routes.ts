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
