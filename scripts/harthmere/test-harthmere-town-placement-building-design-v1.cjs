#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const playerPath = path.join(root, "src/client/game/scripts/player.ts");

const GROUND_Y = 53.05;
const PLAYER_RADIUS = 0.42;
const NPC_RADIUS = 0.58;
const EPS = 1e-6;

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

const assetsSrc = read(assetsPath);
const registrySrc = read(registryPath);
const playerSrc = fs.existsSync(playerPath) ? read(playerPath) : "";

let failures = 0;
const failureDetails = [];

function fail(label, detail) {
  failures += 1;
  console.log(`FAIL ${label}`);
  if (detail) {
    const lines = Array.isArray(detail) ? detail : [detail];
    for (const line of lines.slice(0, 30)) {
      console.log(`  - ${line}`);
    }
    if (Array.isArray(detail) && detail.length > 30) {
      console.log(`  - ... ${detail.length - 30} more`);
    }
    failureDetails.push({ label, detail });
  }
}

function pass(label) {
  console.log(`OK ${label}`);
}

function check(label, condition, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findBalanced(src, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openIndex; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) depth -= 1;
    if (depth === 0) return i;
  }
  return -1;
}

function splitTopLevelArgs(text) {
  const args = [];
  let depth = 0;
  let quote = null;
  let escaped = false;
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if ("([{".includes(ch)) depth += 1;
    if (")]}".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() || text.trim().endsWith(",")) {
    args.push(current.trim());
  }
  return args;
}

function parseStringLiteral(raw) {
  const value = String(raw ?? "").trim();
  const m = value.match(/^(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')$/s);
  if (!m) return undefined;
  return (m[1] ?? m[2] ?? "")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, "\n");
}

function safeNumber(raw) {
  const value = String(raw ?? "").trim();
  if (!value || value === "undefined") return undefined;
  if (/[^0-9+\-*/().\sA-Za-z_]/.test(value)) return undefined;
  const normalized = value
    .replace(/GROUND_Y/g, String(GROUND_Y))
    .replace(/Math\.PI/g, String(Math.PI));
  if (/[^0-9+\-*/().\s]/.test(normalized)) return undefined;
  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    return Number.isFinite(result) ? result : undefined;
  } catch (_err) {
    return undefined;
  }
}

function parseLiteralCalls(src, callee) {
  const calls = [];
  const clean = stripComments(src);
  const needle = `${callee}(`;
  let index = 0;
  while ((index = clean.indexOf(needle, index)) !== -1) {
    const prev = clean[index - 1];
    if (prev && /[A-Za-z0-9_$]/.test(prev)) {
      index += needle.length;
      continue;
    }
    const open = index + callee.length;
    const close = findBalanced(clean, open, "(", ")");
    if (close === -1) break;
    const args = splitTopLevelArgs(clean.slice(open + 1, close));
    calls.push({ callee, args, start: index });
    index = close + 1;
  }
  return calls;
}

function parsePlacementCalls() {
  const placements = [];
  const directCalls = [
    ...parseLiteralCalls(assetsSrc, "P"),
    ...parseLiteralCalls(assetsSrc, "A"),
  ];

  for (const call of directCalls) {
    const asset = parseStringLiteral(call.args[0]);
    const x = safeNumber(call.args[1]);
    const z = safeNumber(call.args[2]);
    if (!asset || x === undefined || z === undefined) continue;
    const rot = safeNumber(call.args[3]) ?? 0;
    const scale = safeNumber(call.args[4]);
    const name = parseStringLiteral(call.args[5]) ?? asset;
    const districtOrYString = parseStringLiteral(call.args[6]);
    const districtOrYNumber = safeNumber(call.args[6]);
    const district = districtOrYString;
    const y = call.callee === "A"
      ? GROUND_Y
      : districtOrYNumber !== undefined && !districtOrYString
        ? districtOrYNumber
        : safeNumber(call.args[7]) ?? GROUND_Y;
    placements.push({
      kind: call.callee === "A" ? "actor" : "prop",
      source: call.callee,
      asset,
      x,
      y,
      z,
      rot,
      scale,
      name,
      district,
    });
  }

  for (const call of parseLiteralCalls(assetsSrc, "row")) {
    const asset = parseStringLiteral(call.args[0]);
    const district = parseStringLiteral(call.args[1]);
    const name = parseStringLiteral(call.args[2]);
    const x = safeNumber(call.args[3]);
    const z = safeNumber(call.args[4]);
    const count = safeNumber(call.args[5]);
    const dx = safeNumber(call.args[6]);
    const dz = safeNumber(call.args[7]);
    const rot = safeNumber(call.args[8]) ?? 0;
    const scale = safeNumber(call.args[9]) ?? 1;
    if (!asset || !district || !name || x === undefined || z === undefined || !Number.isInteger(count) || count <= 0 || dx === undefined || dz === undefined) {
      continue;
    }
    for (let i = 0; i < count; i += 1) {
      placements.push({
        kind: "prop",
        source: "row",
        asset,
        x: x + dx * i,
        y: GROUND_Y,
        z: z + dz * i,
        rot,
        scale,
        name: `${name} ${i + 1}`,
        district,
      });
    }
  }

  return placements;
}

function getObjectProperty(objectText, key) {
  const pattern = new RegExp(`(?:^|[,\\n\\r])\\s*${escapeRegExp(key)}\\s*:\\s*([^,\\n\\r}]+)`, "m");
  const match = objectText.match(pattern);
  return match ? match[1].trim() : undefined;
}

function localPoint(x, z, rot, dx, dz) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x + dx * c - dz * s, z + dx * s + dz * c];
}

function parseBuildingShells() {
  const shells = [];
  const clean = stripComments(assetsSrc);
  const needle = "createBuildingShell({";
  let index = 0;
  while ((index = clean.indexOf(needle, index)) !== -1) {
    const brace = clean.indexOf("{", index);
    const close = findBalanced(clean, brace, "{", "}");
    if (close === -1) break;
    const objectText = clean.slice(brace + 1, close);
    const name = parseStringLiteral(getObjectProperty(objectText, "name"));
    const district = parseStringLiteral(getObjectProperty(objectText, "district"));
    const x = safeNumber(getObjectProperty(objectText, "x"));
    const z = safeNumber(getObjectProperty(objectText, "z"));
    const w = safeNumber(getObjectProperty(objectText, "w"));
    const d = safeNumber(getObjectProperty(objectText, "d"));
    const rot = safeNumber(getObjectProperty(objectText, "rot")) ?? 0;
    const scale = safeNumber(getObjectProperty(objectText, "scale")) ?? 0.95;
    const roofY = safeNumber(getObjectProperty(objectText, "roofY")) ?? 2.85;
    if (name && district && x !== undefined && z !== undefined && w !== undefined && d !== undefined) {
      const [doorX, doorZ] = localPoint(x, z, rot, 0, d / 2);
      const [approachX, approachZ] = localPoint(x, z, rot, 0, d / 2 + 2.2);
      shells.push({ name, district, x, z, w, d, rot, scale, roofY, doorX, doorZ, approachX, approachZ });
    }
    index = close + 1;
  }
  return shells;
}

function normalizeDistrictLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isTownPlacement(p) {
  return !String(p.district ?? "").toLowerCase().includes("harthmere wilds");
}

function isLifePlacement(p) {
  return p.kind === "actor" || p.asset.startsWith("townsperson_") || p.asset.startsWith("animal_");
}

function isTinyAsset(asset) {
  return /food_|coin|key|mug|cup|plate|spoon|knife|apple|carrot|bread|cheese|cake|bottle|vial|scroll|book|candle|chalice|fish|mushroom|note|cloth/i.test(asset);
}

function isWallOrBuildingAsset(asset, name = "") {
  const label = `${asset} ${name}`.toLowerCase();
  return /arch_wall|obj_wall|tower|church|windmill|watermill|warehouse|roof volume|building|barracks|hall|smithy|chapel|office|cottage/.test(label);
}

function isVisualOnlyAsset(asset, name = "") {
  const label = `${asset} ${name}`.toLowerCase();
  return /road|path|trail|window|flag|banner|sign|torch|lamp|lantern|candle|chimney|roof window|stair|bell|cloth|scroll|book|mug|plate|spoon|knife|food|coin|key|bottle|vial|rope|bucket|bag/.test(label);
}

function collisionShape(p) {
  const scale = p.scale ?? 1;
  const asset = p.asset;
  const label = `${p.asset} ${p.name ?? ""}`.toLowerCase();

  if (isTinyAsset(asset) || isVisualOnlyAsset(asset, p.name) && !/stair|fence|cart|stall|table|counter|shelf|bench|chair|stool|crate|barrel|chest|rack|dummy|cage|wall|tower|church|fountain/.test(label)) {
    return undefined;
  }
  if (asset.startsWith("townsperson_") || asset.startsWith("animal_")) {
    return undefined;
  }
  if (asset === "obj_tower_complex") return { halfX: 5.8 * scale, halfZ: 5.8 * scale, padding: 0.9, hard: true, profile: "watch_tower" };
  if (asset.startsWith("obj_wall_")) {
    if (/entrance_door|stairs|stair|gate|exit/i.test(label)) return undefined;
    return { halfX: 5.2 * scale, halfZ: 0.9 * scale, padding: 0.85, hard: true, profile: "fortification_wall" };
  }
  if (asset.startsWith("arch_wall_corner")) return { halfX: 1.6 * scale, halfZ: 1.6 * scale, padding: 0.72, hard: true, profile: "building_corner" };
  if (asset.startsWith("arch_wall_")) {
    if (/door|window|stair/i.test(label)) return undefined;
    return { halfX: 3.7 * scale, halfZ: 0.62 * scale, padding: 0.8, hard: true, profile: "building_wall" };
  }
  if (asset === "obj_church_iso") return { halfX: 8.5 * scale, halfZ: 10.0 * scale, padding: 1.0, hard: true, profile: "chapel" };
  if (asset === "arch_windmill" || asset === "arch_watermill") return { halfX: 5.2 * scale, halfZ: 5.2 * scale, padding: 0.85, hard: true, profile: "mill" };
  if (/fountain|old well/.test(label)) return { halfX: 4.2 * scale, halfZ: 4.2 * scale, padding: 0.95, hard: true, profile: "landmark" };
  if (asset.startsWith("stall")) return { halfX: 2.8 * scale, halfZ: 2.0 * scale, padding: 0.7, hard: true, profile: "stall" };
  if (asset === "cart" || asset === "cart_high" || asset === "trolley" || /cart|wagon/.test(label)) return { halfX: 2.8 * scale, halfZ: 1.5 * scale, padding: 0.72, hard: false, profile: "cart" };
  if (asset === "fence" || asset === "fence_gate" || asset === "fence_broken" || /hedge|rail|fence/.test(label)) return { halfX: 2.8 * scale, halfZ: 0.42 * scale, padding: 0.55, hard: false, profile: "low_barrier" };
  if (/bench|stool|chair/.test(label)) return { halfX: 1.35 * scale, halfZ: 1.0 * scale, padding: 0.42, hard: false, profile: "seating" };
  if (/crate|barrel|chest|bucket|sack|bag/.test(label)) return { halfX: 1.35 * scale, halfZ: 1.0 * scale, padding: 0.42, hard: false, profile: "low_clutter" };
  if (/table|counter|desk|shelf|workbench|anvil|dummy|cage|rack/.test(label)) return { halfX: 1.35 * scale, halfZ: 1.0 * scale, padding: 0.42, hard: true, profile: "service_furniture" };
  if (isWallOrBuildingAsset(asset, p.name)) return { halfX: 1.8 * scale, halfZ: 1.2 * scale, padding: 0.5, hard: true, profile: "building_like" };
  return undefined;
}

function rotatedContains(p, x, z, extra = 0) {
  const shape = collisionShape(p);
  if (!shape) return false;
  const c = Math.cos(-(p.rot ?? 0));
  const s = Math.sin(-(p.rot ?? 0));
  const dx = x - p.x;
  const dz = z - p.z;
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  return Math.abs(localX) <= shape.halfX + shape.padding + extra && Math.abs(localZ) <= shape.halfZ + shape.padding + extra;
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distancePointToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const len2 = abx * abx + abz * abz;
  const t = len2 <= EPS ? 0 : Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2));
  const x = ax + abx * t;
  const z = az + abz * t;
  return Math.hypot(px - x, pz - z);
}

function lineSamplingClear(label, ax, az, bx, bz, halfWidth, blockers, allow = () => false) {
  const offenders = [];
  for (const p of blockers) {
    if (allow(p)) continue;
    const shape = collisionShape(p);
    if (!shape || !shape.hard) continue;
    const radius = Math.max(shape.halfX, shape.halfZ) + shape.padding;
    const d = distancePointToSegment(p.x, p.z, ax, az, bx, bz);
    if (d < halfWidth + radius) {
      offenders.push(`${p.name} (${p.asset}) in ${p.district ?? "unknown"} distance=${d.toFixed(2)} required>=${(halfWidth + radius).toFixed(2)}`);
    }
  }
  check(label, offenders.length === 0, offenders.slice(0, 20));
}

const placements = parsePlacementCalls();
const buildingShells = parseBuildingShells();
const props = placements.filter((p) => p.kind === "prop");
const actors = placements.filter((p) => isLifePlacement(p));
const townActors = actors.filter(isTownPlacement);
const blockers = props.filter((p) => collisionShape(p));
const hardBlockers = blockers.filter((p) => collisionShape(p)?.hard);

console.log("== Harthmere town placement, building, spacing, and NPC invariant tests v1 ==");
console.log(`Root: ${root}`);
console.log(`Parsed placements: ${placements.length} (${props.length} props, ${actors.length} actors), building shells: ${buildingShells.length}`);
console.log("");

// ---------------------------------------------------------------------------
// 1) Core town system wiring and parser checks.
// ---------------------------------------------------------------------------
check("assets file exists", fs.existsSync(assetsPath), assetsPath);
check("town registry exists", fs.existsSync(registryPath), registryPath);
check("placement helpers exist", /const P = \(/.test(assetsSrc) && /const A = \(/.test(assetsSrc) && /function createBuildingShell/.test(assetsSrc));
check("town registry version is wired", assetsSrc.includes("HARTHMERE_TOWN_SYSTEMS_VERSION") && registrySrc.includes("HARTHMERE_TOWN_REGISTRY_VERSION"));
check("runtime collision/audit hooks exist", /harthmereNpcCollisionObstacles/.test(assetsSrc) && /createHarthmereTownAuditExportApi/.test(assetsSrc) && /__harthmereTownAudit/.test(assetsSrc));
check("actor spawn resolver exists", /resolveHarthmereRuntimePlacement/.test(assetsSrc) && /placementSystemVersion: "harthmere-town-collision-placement-v4"/.test(assetsSrc));
check("player segment collision sweep exists", /getHarthmereLocalDevHorizontalSegmentHits/.test(playerSrc) && /HARTHMERE_LOCAL_DEV_HORIZONTAL_PLAYER_TOWN_COLLISION_SWEEP_STEP/.test(playerSrc));

// ---------------------------------------------------------------------------
// 2) District coverage and map/service readability.
// ---------------------------------------------------------------------------
const expectedDistrictLabels = [
  "North Gate",
  "Market Square",
  "Player Services Plaza",
  "Copper Kettle Inn",
  "Craftsman Row / Black Anvil Smithy",
  "Temple Green",
  "Noble Rise",
  "River Docks",
  "Mudden Ward",
  "Guard Yard",
  "Old Well / Underways",
  "Residential District",
  "Harthmere Wilds",
];
const missingDistricts = expectedDistrictLabels.filter((label) => !registrySrc.includes(`label: "${label}"`));
check("registry contains every required town/wilds district", missingDistricts.length === 0, missingDistricts);

const requiredServices = [
  "bank", "mail", "auction", "storage", "guild_registry", "wardrobe",
  "bind_point", "rested_xp", "food_buffs", "rumor_board",
  "repair", "blacksmithing", "carpentry", "tailoring", "leatherworking",
  "resurrection", "blessings", "condition_cleansing",
  "bounty_board", "dueling_ring", "quartermaster",
  "fishing_trainer", "boat_travel", "cargo_contracts",
  "fence_vendor", "cheap_healer", "hidden_tunnel",
];
const missingServices = requiredServices.filter((service) => !registrySrc.includes(`"${service}"`));
check("registry exposes all required map/services for player readability", missingServices.length === 0, missingServices);

const requiredMapIcons = ["gate", "market", "bank", "inn", "crafting", "healer", "town_hall", "ferry", "slums", "guard", "dungeon_hidden", "house", "wilds"];
const missingIcons = requiredMapIcons.filter((icon) => !registrySrc.includes(`mapIcon: "${icon}"`));
check("registry has map icons for services, danger, housing, and exits", missingIcons.length === 0, missingIcons);

// ---------------------------------------------------------------------------
// 3) Asset registration and literal placement sanity.
// ---------------------------------------------------------------------------
const registeredAssets = new Set(Array.from(assetsSrc.matchAll(/\b(?:gltf|fbx|obj)\(\s*"([^"]+)"/g)).map((m) => m[1]));
const usedLiteralAssets = new Set(placements.map((p) => p.asset));
const missingAssets = Array.from(usedLiteralAssets).filter((asset) => !registeredAssets.has(asset)).sort();
check("every literal P/A/row placement uses a registered runtime asset", missingAssets.length === 0, missingAssets);

const invalidNumeric = placements.filter((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) || (p.scale !== undefined && (!Number.isFinite(p.scale) || p.scale <= 0)));
check("all parsed placements have finite coordinates and positive scale", invalidNumeric.length === 0, invalidNumeric.map((p) => `${p.name} ${JSON.stringify(p)}`));

const outOfTownImpossible = placements.filter((p) => isTownPlacement(p) && (p.x < 330 || p.x > 660 || p.z < -345 || p.z > -70));
check("all non-wilds town placements remain inside the authored Harthmere town envelope", outOfTownImpossible.length === 0, outOfTownImpossible.map((p) => `${p.name} (${p.asset}) ${p.district} at ${p.x},${p.z}`));

// ---------------------------------------------------------------------------
// 4) Building shell and entrance tests.
// ---------------------------------------------------------------------------
check("town has a full set of authored building shells", buildingShells.length >= 14, buildingShells.map((s) => s.name));

const undersizedShells = buildingShells.filter((s) => s.w < 13 || s.d < 12 || s.w > 36 || s.d > 32);
check("building shells use believable MMO-scale footprints", undersizedShells.length === 0, undersizedShells.map((s) => `${s.name} w=${s.w} d=${s.d}`));

check("generated building shell function creates a front door for every shell", /BP\(t\.door,[\s\S]*"front door"/.test(assetsSrc));
check("generated building shell function creates entry steps/ramps when the theme supports stairs", /if \(t\.stair\)[\s\S]*"entry step"/.test(assetsSrc));

const doorBlockers = [];
for (const shell of buildingShells) {
  for (const p of hardBlockers) {
    if (p.name.includes(shell.name) && /front door|entry step|window|banner|roof|chimney/.test(p.name.toLowerCase())) {
      continue;
    }
    if (/sign|lamp|lantern|banner|flag|window|stair|step|road|trail|path/i.test(`${p.asset} ${p.name}`)) {
      continue;
    }
    if (rotatedContains(p, shell.approachX, shell.approachZ, 1.5)) {
      doorBlockers.push(`${shell.name} approach blocked by ${p.name} (${p.asset}) at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    }
  }
}
check("building front-door approach zones keep at least 1.5m clear", doorBlockers.length === 0, doorBlockers);

const importantBuildings = [
  /Copper Kettle Inn/,
  /Black Anvil Smithy/,
  /Player Services Hall/,
  /Green Mortar Apothecary/,
  /Wyrm and Candle Magic Shop/,
  /Reeve Hall/,
  /Dock Ledger Warehouse/,
  /Guard Barracks/,
  /Stable Yard Office/,
  /Roadside Family Cottage/,
];
const missingImportantBuildings = importantBuildings.filter((pattern) => !buildingShells.some((s) => pattern.test(s.name))).map(String);
check("important services have physical building shells", missingImportantBuildings.length === 0, missingImportantBuildings);

// ---------------------------------------------------------------------------
// 5) Road hierarchy, spacing, and route clearance tests.
// ---------------------------------------------------------------------------
const rowCalls = parseLiteralCalls(assetsSrc, "row")
  .map((call) => ({
    asset: parseStringLiteral(call.args[0]),
    district: parseStringLiteral(call.args[1]),
    name: parseStringLiteral(call.args[2]),
    x: safeNumber(call.args[3]),
    z: safeNumber(call.args[4]),
    count: safeNumber(call.args[5]),
    dx: safeNumber(call.args[6]),
    dz: safeNumber(call.args[7]),
    scale: safeNumber(call.args[9]) ?? 1,
  }))
  .filter((row) => row.asset);
const roadRows = rowCalls.filter((row) => row.asset === "road");
const badRoadRows = roadRows.filter((row) => Math.hypot(row.dx ?? 0, row.dz ?? 0) < 3 || (row.count ?? 0) < 4);
check("road rows have MMO-friendly tile spacing and route length", badRoadRows.length === 0, badRoadRows.map((r) => `${r.district} ${r.name} count=${r.count} spacing=${Math.hypot(r.dx ?? 0, r.dz ?? 0).toFixed(2)}`));

const requiredRoadDistricts = ["North Gate", "Market Square", "Temple Green", "River Docks"];
const missingRoadDistricts = requiredRoadDistricts.filter((district) => !roadRows.some((row) => row.district === district));
check("main road hierarchy connects gate, market, temple, and docks", missingRoadDistricts.length === 0, missingRoadDistricts);

lineSamplingClear(
  "North Gate arrival road keeps a 10m gate-road corridor clear of hard blockers",
  486, -282, 486, -220, 5.0,
  hardBlockers.filter((p) => p.district === "North Gate"),
  (p) => /north gate ironbound door|wall stair|gate brazier|watch banner|road|tower/i.test(`${p.name} ${p.asset}`),
);
lineSamplingClear(
  "Market east-west road keeps at least a 4m pedestrian lane clear of hard blockers",
  430, -207, 534, -207, 2.0,
  hardBlockers.filter((p) => p.district === "Market Square"),
  (p) => /bridge fountain|road|fountain lamp|market wayfinding sign|quest and notice kiosk/i.test(`${p.name} ${p.asset}`),
);
lineSamplingClear(
  "Dock road keeps service traffic lane clear of hard blockers",
  536, -196, 600, -196, 2.0,
  hardBlockers.filter((p) => p.district === "River Docks"),
  (p) => /road|dock bell|ferry post|watermill/i.test(`${p.name} ${p.asset}`),
);

const explicitBlockers = placements.filter((p) => /blocked doorway|doorway blocker|entrance blocker|blocks training lane|blocks main|blocked main|trap player/i.test(p.name));
check("no placement is explicitly named as a blocker/trap", explicitBlockers.length === 0, explicitBlockers.map((p) => `${p.name} (${p.asset})`));

// ---------------------------------------------------------------------------
// 6) Prop support, scale, and collision rules.
// ---------------------------------------------------------------------------
const elevatedUnsupportedTinyProps = props.filter((p) => {
  if (!isTinyAsset(p.asset)) return false;
  if (!isTownPlacement(p)) return false;
  if (p.y <= GROUND_Y + 0.18) return false;
  return !/supported|mounted|hanging|fixed|hook|attached|roof|wall|ceiling|on |over |above |beside|against|altar|counter|table|shelf|chest|crate|desk|bar|stage|platform|stand|rack|pinned|resting|leaning|tied/i.test(p.name);
});
check("tiny/elevated props declare a believable support surface", elevatedUnsupportedTinyProps.length === 0, elevatedUnsupportedTinyProps.map((p) => `${p.name} (${p.asset}) y=${p.y.toFixed(2)}`));

const floatingLargeProps = props.filter((p) => {
  if (p.y <= GROUND_Y + 0.12) return false;
  if (isTinyAsset(p.asset)) return false;
  if (/roof|chimney|window|banner|flag|sign|mounted|hanging|wall|lantern|lamp|torch|bell|stairs|stair|supported|above|over|silhouette|platform|altar|shelf|counter|table|stage|resting|leaning|displayed|display|tied|climbable|rack/i.test(`${p.asset} ${p.name}`)) return false;
  return p.y > GROUND_Y + 0.35;
});
check("large props above ground are roof/wall/hanging/supported objects, not accidental floaters", floatingLargeProps.length === 0, floatingLargeProps.map((p) => `${p.name} (${p.asset}) ${p.district} y=${p.y.toFixed(2)}`));

check("tiny FBX food scale normalization remains active", /HARTHMERE_TINY_FBX_FOOD_SCALE_CAPS/.test(assetsSrc) && /normalizeHarthmerePropPlacementScale/.test(assetsSrc));
check("tiny props have no collision in shared registry", /kind === "tinyProp"[\s\S]*blocksNpc: false[\s\S]*blocksPlayer: false/.test(registrySrc) || /tiny food\/hand props should not block movement/.test(registrySrc));
check("visual signs, banners, flags, windows, lamps, and stairs are pass-through for player/NPC pathing", /name\.includes\("flag"\)/.test(assetsSrc) && /name\.includes\("banner"\)/.test(assetsSrc) && /name\.includes\("sign"\)/.test(assetsSrc) && /name\.includes\("window"\)/.test(assetsSrc) && /name\.includes\("wall stair"\)/.test(assetsSrc));
check("large object collision profiles are tightened instead of using oversized visual bounds", /asset === "obj_tower_complex"[\s\S]*halfX \* 0\.46/.test(assetsSrc) && /asset === "fountain_round"[\s\S]*halfX \* 0\.34/.test(assetsSrc) && /name\.includes\("bench"\)[\s\S]*halfX \* 0\.28/.test(assetsSrc));

// ---------------------------------------------------------------------------
// 7) NPC/people placement and crowd rules.
// ---------------------------------------------------------------------------
const actorInsideHardBlocker = [];
for (const actor of townActors) {
  for (const blocker of hardBlockers) {
    if (/window|banner|flag|sign|lamp|lantern|torch|stair|road|trail|path/i.test(`${blocker.asset} ${blocker.name}`)) continue;
    if (rotatedContains(blocker, actor.x, actor.z, NPC_RADIUS)) {
      actorInsideHardBlocker.push(`${actor.name} (${actor.asset}) in ${actor.district ?? "unknown"} overlaps ${blocker.name} (${blocker.asset})`);
      break;
    }
  }
}
check("town NPC/animal authored anchors do not start inside hard collision bounds", actorInsideHardBlocker.length === 0, actorInsideHardBlocker);

const tooTightActors = [];
for (let i = 0; i < townActors.length; i += 1) {
  for (let j = i + 1; j < townActors.length; j += 1) {
    const a = townActors[i];
    const b = townActors[j];
    if (a.district !== b.district) continue;
    const d = distance2d(a, b);
    const label = `${a.name} ${b.name}`.toLowerCase();
    if (d < 0.85 && !/duel|sparring|choir|crowd|queue|listening|patron|child|pigeon|chicken|rat|cat|crow/.test(label)) {
      tooTightActors.push(`${a.name} <-> ${b.name} in ${a.district} distance=${d.toFixed(2)}m`);
    }
  }
}
check("NPCs have personal space unless intentionally staged as a crowd/event", tooTightActors.length === 0, tooTightActors.slice(0, 40));

const actorRoleProblems = [];
for (const actor of townActors) {
  const asset = actor.asset.toLowerCase();
  const district = String(actor.district ?? "").toLowerCase();
  const label = `${asset} ${actor.name}`.toLowerCase();
  if (asset.includes("guard") && !/(north gate|guard yard|noble|market|player services|temple|dock|mudden|craftsman)/.test(district)) {
    actorRoleProblems.push(`${actor.name} guard placed in ${actor.district}`);
  }
  if ((asset.includes("market") || /vendor|merchant|clerk|banker|registrar|attendant/.test(label)) && !/(market|player services|copper kettle|craftsman|noble|river docks|mudden|apothecary)/.test(district)) {
    if (!/(traveler|pilgrim|witness|bounty clerk|charity|reputation vendor|old woman)/.test(label)) {
      actorRoleProblems.push(`${actor.name} merchant/service NPC placed in ${actor.district}`);
    }
  }
  if (asset.includes("clergy") && !/(temple|old well|apothecary)/.test(district)) {
    actorRoleProblems.push(`${actor.name} clergy NPC placed in ${actor.district}`);
  }
}
check("NPC roles match believable town districts", actorRoleProblems.length === 0, actorRoleProblems);

const townWanderEnabled = townActors.filter((p) => {
  const pattern = new RegExp(`A\\(\\s*"${escapeRegExp(p.asset)}"[\\s\\S]{0,220}"${escapeRegExp(p.name)}"[\\s\\S]{0,260}radius\\s*:`, "m");
  return pattern.test(assetsSrc) && !String(p.district ?? "").toLowerCase().includes("harthmere wilds");
});
check("authored town NPC wander is disabled until route graphs/navmesh exist", townWanderEnabled.length === 0 || /if \(!isWilds\) \{\s*return undefined;\s*\}/.test(assetsSrc), townWanderEnabled.map((p) => `${p.name} ${p.district}`));

// ---------------------------------------------------------------------------
// 8) Component/district-specific acceptance tests are available for suite use.
// ---------------------------------------------------------------------------
const expectedComponentCheckers = [
  "check-harthmere-market-square-v1.cjs",
  "check-harthmere-player-services-plaza-v1.cjs",
  "check-harthmere-copper-kettle-inn-v1.cjs",
  "check-harthmere-craftsman-row-black-anvil-v1.cjs",
  "check-harthmere-noble-rise-v1.cjs",
  "check-harthmere-river-docks-v1.cjs",
  "check-harthmere-mudden-ward-v1.cjs",
  "check-harthmere-guard-yard-v1.cjs",
  "check-harthmere-old-well-underways-v1.cjs",
  "check-harthmere-temple-green-v1.cjs",
  "check-harthmere-town-collision-placement-v4.cjs",
  "check-harthmere-town-audit-export-v1.cjs",
  "check-harthmere-town-audit-pattern-fixes-v3.cjs",
];
const missingCheckers = expectedComponentCheckers.filter((file) => !fs.existsSync(path.join(root, "scripts/harthmere", file)));
check("district/component checker scripts exist for full suite coverage", missingCheckers.length === 0, missingCheckers);

console.log("");
console.log(`RESULT: ${failures === 0 ? "PASS" : `FAIL (${failures})`}`);
if (failures) {
  console.log("");
  console.log("These are red tests by design: fix placement/building/collision code until the suite turns green.");
}
process.exit(failures === 0 ? 0 : 1);

