#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const housingPath = path.join(root, "src/shared/harthmere/resident_housing_v38.ts");
const routesPath = path.join(root, "src/shared/harthmere/town_routes.ts");
const schedulesPath = path.join(root, "src/shared/harthmere/town_schedules.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const assets = fs.readFileSync(assetsPath, "utf8");
const housing = fs.readFileSync(housingPath, "utf8");
const routes = fs.readFileSync(routesPath, "utf8");
const schedules = fs.readFileSync(schedulesPath, "utf8");
const suite = fs.readFileSync(suitePath, "utf8");

let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

function count(re, text) {
  const m = text.match(re);
  return m ? m.length : 0;
}

console.log("== Harthmere living quarters + NPC dispersal v48 test ==");

check("housing v48 version marker exists", housing.includes("HARTHMERE_RESIDENT_HOUSING_LIVING_QUARTERS_REBUILD_VERSION_V48"));
check("renderer v48 living-quarter rebuild marker exists", assets.includes("HARTHMERE_LIVING_QUARTERS_REBUILD_RENDERER_VERSION_V48"));
check("resident story frame delegates to v48 block shell", /return createHarthmereLivingQuarterBlockShellV48\(building\);/.test(assets));
check("living quarters use resource/chippable stone block assets", /HARTHMERE_LIVING_QUARTERS_STRUCTURAL_BLOCKS_V48 = \["mine_stone_01", "mine_stone_02", "arch_wall_stone"\]/.test(assets));
check("living-quarter structural labels include solid voxel wall blocks", /solid voxel wall block/.test(assets));
check("living-quarter floors ceilings roofs are explicit block slabs", /walkable stone floor slab/.test(assets) && /clear roof or ceiling slab/.test(assets));
check("living-quarter stairs are accessible block stairs", /accessible interior block stair floor/.test(assets) && /max-rise/.test(assets));

const residentialRows = [...housing.matchAll(/id: "res_v38_home_\d+"[^\n]+floors: (\d+)[^\n]+roomsPerFloor: (\d+)/g)];
const slumRows = [...housing.matchAll(/id: "slum_v38_stack_\d+"[^\n]+floors: (\d+)[^\n]+roomsPerFloor: (\d+)/g)];
check("all ten residential living quarters still exist", residentialRows.length === 10);
check("all residential living quarters are exactly two stories", residentialRows.every((m) => Number(m[1]) === 2));
check("residential capacity is enough for town non-wild residents", residentialRows.reduce((sum, m) => sum + Number(m[1]) * Number(m[2]), 0) >= 122);
check("all four Mudden Ward slum stacks exist", slumRows.length === 4);
check("Mudden Ward stacks are four or five stories", slumRows.every((m) => Number(m[1]) >= 4 && Number(m[1]) <= 5));
check("slum capacity is far above named Mudden need", slumRows.reduce((sum, m) => sum + Number(m[1]) * Number(m[2]), 0) >= 80);
check("existing home ids are preserved for assignments", /res_v38_home_01/.test(housing) && /res_v38_home_10/.test(housing) && /slum_v38_stack_01/.test(housing) && /slum_v38_stack_04/.test(housing));
check("home assignment summary still maps actors to home ids", /assignHarthmereResidentHomeV38/.test(housing) && /homeId: `\$\{room\.building\.id\}_f\$\{room\.floor\}_r\$\{room\.room\}`/.test(housing));

check("route graph v48 exists", routes.includes("HARTHMERE_TOWN_ROUTE_GRAPH_VERSION_V48"));
check("route schedule v48 exists", schedules.includes("HARTHMERE_TOWN_NPC_ROUTE_SCHEDULE_VERSION_V48"));
check("renderer has npc route distribution marker", assets.includes("HARTHMERE_NPC_ROUTE_DISTRIBUTION_VERSION_V48"));
check("town actors get route wander, not static piling", /makeHarthmereTownActorRouteWanderV48/.test(assets) && /routeLabel: routeKey/.test(assets));
check("A() passes source x/z into wander normalizer", /normalizeHarthmereActorWander\(asset, name, district, x, z, wander\)/.test(assets));
check("renderer repositions initial actor placements to route anchors", /applyHarthmereNpcRouteDistributionV48/.test(assets) && /placementWithHarthmereRuntimeAt\(placement, \[x, placement\.at\[1\], z\]\)/.test(assets));
check("loadAll uses v48 cleaned/distributed runtime placements", /prepareHarthmereRuntimePlacementsV3\(RUNTIME_PLACEMENTS_V48\)/.test(assets));
check("debug window exposes npc distribution report", /__harthmereNpcDistributionReportV48/.test(assets));
check("draw loop follows route interpolation", /harthmereRoutePositionV48\(instance\.wander\.route, progress\)/.test(assets));

const anchorBlock = assets.match(/const HARTHMERE_NPC_ROUTE_ANCHORS_V48 = \{([\s\S]*?)\n\} as const satisfies/);
check("renderer route anchor block is parseable", Boolean(anchorBlock));
const anchors = {};
if (anchorBlock) {
  const re = /([a-z_]+): \[([^\n]+)\]/g;
  let m;
  while ((m = re.exec(anchorBlock[1]))) {
    const nums = [...m[2].matchAll(/\[([\-\d.]+),\s*([\-\d.]+)\]/g)].map((p) => [Number(p[1]), Number(p[2])]);
    anchors[m[1]] = nums;
  }
}
check("all important districts have multiple route anchors", ["market_square", "player_services", "craftsman_row", "mudden_ward", "residential", "river_docks", "temple_green"].every((key) => (anchors[key] || []).length >= 5));

function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function keyFor(asset, name, district) {
  const rawDistrict = `${district || ""}`.toLowerCase();
  const label = `${asset} ${name || ""} ${district || ""}`.toLowerCase();
  if (/wilds|forest|briarfen|gravewood|bandit ridge|greenmere|watchtower ridge|charcoal|orchard lane|gate fields|mill road|old hunter/.test(label)) return null;
  if (/mudden/.test(rawDistrict)) return "mudden_ward";
  if (/residential|farm/.test(rawDistrict)) return "residential";
  if (/north gate/.test(rawDistrict)) return "north_gate";
  if (/guard yard/.test(rawDistrict)) return "guard_yard";
  if (/player services/.test(rawDistrict)) return "player_services";
  if (/craftsman|apothecary|magic shop/.test(rawDistrict)) return "craftsman_row";
  if (/copper kettle/.test(rawDistrict)) return "copper_kettle";
  if (/temple|chapel/.test(rawDistrict)) return "temple_green";
  if (/noble/.test(rawDistrict)) return "noble_rise";
  if (/river docks|dock/.test(rawDistrict)) return "river_docks";
  if (/market/.test(rawDistrict)) return "market_square";
  if (/mudden|slum|rat-catcher|washer/.test(label)) return "mudden_ward";
  if (/residential|cottage|house|farmer|farmhand|chicken|pig|cow|sheep/.test(label)) return "residential";
  if (/north gate|stable|gate dog|gate patrol/.test(label)) return "north_gate";
  if (/player services|bank|auction|storage|courier anwen|mail|guild|wardrobe/.test(label)) return "player_services";
  if (/craftsman|black anvil|smith|forge|carpentry|tailor|leather|ore delivery/.test(label)) return "craftsman_row";
  if (/copper kettle|inn|tavern|gambler|bard|patron/.test(label)) return "copper_kettle";
  if (/temple|chapel|clergy|father|sister|pilgrim|apothecary|ysabet|healer/.test(label)) return "temple_green";
  if (/noble|reeve|edrik|tax|legal|clerk/.test(label)) return "noble_rise";
  if (/river docks|dock|ferry|fish|smuggl|warehouse|tovin/.test(label)) return "river_docks";
  if (/guard|sergeant|bounty|duel|sparring|drill|prisoner|quartermaster/.test(label)) return "guard_yard";
  if (/market|mara|vendor|produce|crier|performer|customer|pigeon|livestock|pickpocket/.test(label)) return "market_square";
  return "market_square";
}
function actorCalls(text) {
  const calls = [];
  const re = /A\("([^"]+)",\s*([\-\d.]+),\s*([\-\d.]+),[\s\S]*?"([^"]*)",\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    calls.push({ asset: m[1], x: Number(m[2]), z: Number(m[3]), name: m[4], district: m[5] });
  }
  return calls;
}
const actors = actorCalls(assets).filter((a) => /^(townsperson|animal|monster)_/.test(a.asset));
const sequenceByRoute = new Map();
const routed = actors.map((a) => {
  const key = keyFor(a.asset, a.name, a.district);
  if (!key || !anchors[key] || anchors[key].length === 0) return null;
  const sequence = sequenceByRoute.get(key) || 0;
  sequenceByRoute.set(key, sequence + 1);
  const routeAnchors = anchors[key];
  const spreadRing = Math.floor(sequence / Math.max(1, routeAnchors.length));
  const spreadDistance = spreadRing * 5.5;
  const spreadAngle = sequence * 2.399963229728653;
  const base = routeAnchors[sequence % routeAnchors.length];
  const x = base[0] + Math.cos(spreadAngle) * spreadDistance + 1.2;
  const z = base[1] + Math.sin(spreadAngle) * spreadDistance - 1.2;
  return { ...a, x, z, key };
}).filter(Boolean);
check("static test found routed town actors", routed.length >= 60);
function maxWithin(radius) {
  let max = 0;
  let worst = null;
  for (const a of routed) {
    const near = routed.filter((b) => ((a.x - b.x) ** 2 + (a.z - b.z) ** 2) <= radius * radius);
    if (near.length > max) { max = near.length; worst = a; }
  }
  return { max, worst };
}
const d12 = maxWithin(12);
const d20 = maxWithin(20);
check(`no NPC pile exceeds 12m local density cap (max ${d12.max})`, d12.max <= 7);
check(`no NPC pile exceeds 20m local density cap (max ${d20.max})`, d20.max <= 16);
const routeKeys = new Set(routed.map((a) => a.key));
check("NPCs are dispersed across at least eight town route groups", routeKeys.size >= 8);
check("full placement suite includes v48 test", suite.includes("test-harthmere-living-quarters-npc-dispersal-v48.cjs"));

if (!ok) process.exit(1);
console.log("RESULT PASS");
