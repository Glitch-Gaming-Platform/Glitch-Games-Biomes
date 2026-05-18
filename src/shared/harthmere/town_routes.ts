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

export const HARTHMERE_TOWN_ROUTE_ANCHORS_V48 = {
  north_gate: [[476, -286], [486, -270], [502, -286], [514, -260], [468, -258]],
  guard_yard: [[506, -256], [522, -260], [530, -276], [508, -282], [492, -266]],
  market_square: [[456, -214], [474, -206], [492, -198], [512, -214], [498, -230], [466, -232], [438, -206], [538, -194]],
  player_services: [[548, -216], [562, -224], [566, -202], [540, -198], [526, -210], [558, -236]],
  craftsman_row: [[512, -232], [528, -238], [540, -226], [504, -220], [496, -236], [524, -248]],
  copper_kettle: [[540, -188], [552, -196], [562, -184], [534, -204], [548, -210]],
  temple_green: [[466, -146], [482, -142], [496, -150], [488, -164], [458, -160]],
  noble_rise: [[554, -260], [570, -270], [584, -250], [548, -242], [566, -232]],
  river_docks: [[584, -176], [604, -166], [620, -190], [592, -210], [566, -188], [612, -228]],
  mudden_ward: [[392, -154], [410, -146], [428, -158], [444, -138], [404, -126], [462, -122]],
  residential: [[342, -314], [368, -314], [394, -314], [424, -314], [454, -314], [342, -358], [372, -358], [402, -358], [432, -358], [462, -358]],
} as const;

export const HARTHMERE_TOWN_NPC_DENSITY_LIMITS_V48 = {
  maxActorsWithin12m: 7,
  maxActorsWithin20m: 16,
  maxActorsWithin30m: 20,
  routeMovementRequired: true,
} as const;
