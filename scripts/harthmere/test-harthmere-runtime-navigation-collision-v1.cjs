#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const placementSuitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const GROUND_Y = 53.05;
const PLAYER_RADIUS = 0.18;
const MOUNT_RADIUS = 0.42;
const SERVICE_RADIUS = 1.65;

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

const assetsSrc = read(assetsPath);
const registrySrc = read(registryPath);
const playerSrc = read(playerPath);

let failures = 0;

function pass(label) {
  console.log(`OK ${label}`);
}

function fail(label, detail) {
  failures += 1;
  console.log(`FAIL ${label}`);
  const lines = Array.isArray(detail) ? detail : detail ? [detail] : [];
  for (const line of lines.slice(0, 30)) {
    console.log(`  - ${line}`);
  }
  if (lines.length > 30) {
    console.log(`  - ... ${lines.length - 30} more`);
  }
}

function check(label, condition, detail) {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail);
  }
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

    calls.push({
      callee,
      args: splitTopLevelArgs(clean.slice(open + 1, close)),
      start: index,
    });

    index = close + 1;
  }

  return calls;
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

function parsePlacements() {
  const placements = [];

  for (const call of [...parseLiteralCalls(assetsSrc, "P"), ...parseLiteralCalls(assetsSrc, "A")]) {
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
      source: call.callee,
      kind: call.callee === "A" ? "actor" : "prop",
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
    const baseName = parseStringLiteral(call.args[2]);
    const x = safeNumber(call.args[3]);
    const z = safeNumber(call.args[4]);
    const count = safeNumber(call.args[5]);
    const dx = safeNumber(call.args[6]);
    const dz = safeNumber(call.args[7]);
    const rot = safeNumber(call.args[8]) ?? 0;
    const scale = safeNumber(call.args[9]) ?? 1;

    if (
      !asset ||
      !district ||
      !baseName ||
      x === undefined ||
      z === undefined ||
      count === undefined ||
      dx === undefined ||
      dz === undefined
    ) {
      continue;
    }

    for (let index = 0; index < count; index += 1) {
      placements.push({
        source: "row",
        kind: "prop",
        asset,
        x: x + dx * index,
        y: GROUND_Y,
        z: z + dz * index,
        rot,
        scale,
        name: `${baseName} ${index + 1}`,
        district,
      });
    }
  }

  return placements;
}

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function baseObstacleDims(placement) {
  const scale = placement.scale ?? 1;
  const asset = placement.asset;
  const label = lower(`${placement.asset} ${placement.name}`);

  if (
    asset.startsWith("food_") ||
    /scroll|book|mug|plate|coin|dagger|pickaxe|sword|apple|bread|cheese|fishbone|fish_/.test(label)
  ) {
    return undefined;
  }

  if (asset.startsWith("arch_wall_corner")) return { halfX: 1.6 * scale, halfZ: 1.6 * scale };
  if (asset.startsWith("arch_wall_")) return { halfX: 3.7 * scale, halfZ: 0.62 * scale };
  if (asset === "obj_tower_complex") return { halfX: 5.8 * scale, halfZ: 5.8 * scale };
  if (asset.startsWith("obj_wall_")) return { halfX: 5.2 * scale, halfZ: 0.9 * scale };
  if (asset === "obj_church_iso") return { halfX: 8.5 * scale, halfZ: 10.0 * scale };
  if (asset === "arch_windmill" || asset === "arch_watermill") return { halfX: 5.2 * scale, halfZ: 5.2 * scale };
  if (/fountain|old well/.test(label)) return { halfX: 4.2 * scale, halfZ: 4.2 * scale };
  if (asset.startsWith("stall")) return { halfX: 2.8 * scale, halfZ: 2.0 * scale };
  if (["cart", "cart_high", "trolley"].includes(asset) || /cart|wagon/.test(label)) return { halfX: 2.8 * scale, halfZ: 1.5 * scale };
  if (["fence", "fence_gate", "fence_broken"].includes(asset)) return { halfX: 2.8 * scale, halfZ: 0.42 * scale };
  if (["hedge", "hedge_large"].includes(asset)) return { halfX: 2.6 * scale, halfZ: 0.55 * scale };
  if (/counter|table|bench|bed|cabinet|bookcase|shelf|workbench|anvil|dummy|cage|chest|crate|barrel|keg|bucket|sack|stool|chair/.test(label)) {
    return { halfX: 1.35 * scale, halfZ: 1.0 * scale };
  }

  return undefined;
}

function playerObstacleForPlacement(placement) {
  if (placement.kind === "actor") return undefined;

  const dims = baseObstacleDims(placement);
  if (!dims) return undefined;

  const asset = placement.asset;
  const name = lower(placement.name ?? asset);
  const district = lower(placement.district ?? "");
  let halfX = dims.halfX;
  let halfZ = dims.halfZ;
  let height = 2.2 * (placement.scale ?? 1);
  let jumpable = false;
  let profile = "solid_prop";
  let hardness = "hard";
  let passThrough = false;

  const isNorthGateExitDoor = district.includes("north gate") && name.includes("ironbound door");
  const isWalkableGateOrStair =
    isNorthGateExitDoor ||
    name.includes("wall stair") ||
    name.includes("stair to watch") ||
    name.includes("stair access") ||
    name.includes("steps") ||
    name.includes("walkway") ||
    name.includes("passage") ||
    name.includes("opening") ||
    name.includes("archway") ||
    name.includes("gate passage") ||
    name.includes("road exit") ||
    name.includes("town exit") ||
    name.includes("north road") ||
    name.includes("south road") ||
    name.includes("east road") ||
    name.includes("west road") ||
    name.includes("trail") ||
    name.includes("path marker") ||
    name.includes("breadcrumb") ||
    name.includes("wayfinding") ||
    name.includes("approach marker");

  const isVisualOnly =
    isWalkableGateOrStair ||
    name.includes("window") ||
    name.includes("flag") ||
    name.includes("banner") ||
    name.includes("sign") ||
    name.includes("lamp") ||
    name.includes("lantern") ||
    name.includes("torch") ||
    name.includes("candle") ||
    name.includes("note") ||
    name.includes("book") ||
    name.includes("scroll") ||
    name.includes("coin") ||
    name.includes("apple") ||
    name.includes("bread") ||
    name.includes("cheese") ||
    name.includes("fishbone") ||
    name.includes("mug") ||
    name.includes("plate") ||
    name.includes("cloth bolt") ||
    name.includes("recipe") ||
    name.includes("marker detail") ||
    name.includes("rim detail") ||
    name.includes("roof window") ||
    name.includes("rope marker") ||
    name.includes("painted line");

  if (isVisualOnly) {
    halfX = Math.max(0.02, halfX * 0.12);
    halfZ = Math.max(0.02, halfZ * 0.12);
    height = Math.max(0.14, 0.25 * (placement.scale ?? 1));
    jumpable = true;
    profile = isWalkableGateOrStair ? "pass_through_navigation" : "visual_only";
    hardness = "none";
    passThrough = true;
  } else if (asset === "obj_tower_complex" || name.includes("tower")) {
    halfX = Math.max(0.85, halfX * 0.46);
    halfZ = Math.max(0.85, halfZ * 0.46);
    height = Math.max(7.2, Math.max(dims.halfX, dims.halfZ) * 1.25);
    profile = "building_or_wall";
    hardness = "wall";
  } else if (asset === "fountain_round" || name.includes("fountain") || name.includes("old well")) {
    halfX = Math.max(0.34, halfX * 0.34);
    halfZ = Math.max(0.34, halfZ * 0.34);
    height = name.includes("center stone") ? Math.max(0.36, 0.48 * (placement.scale ?? 1)) : Math.max(0.62, 0.72 * (placement.scale ?? 1));
    jumpable = true;
    profile = "low_jumpable_landmark";
    hardness = "soft";
  } else if (["fence", "fence_gate", "fence_broken", "hedge", "hedge_large"].includes(asset) || name.includes("hedge") || name.includes("rail")) {
    halfX = Math.max(0.045, halfX * 0.5);
    halfZ = Math.max(0.045, halfZ * 0.5);
    height = Math.max(0.42, 0.62 * (placement.scale ?? 1));
    jumpable = true;
    profile = "low_jumpable_barrier";
    hardness = "soft";
  } else if (asset.startsWith("stall")) {
    halfX = Math.max(0.18, halfX * 0.54);
    halfZ = Math.max(0.18, halfZ * 0.54);
    height = Math.max(1.05, 1.4 * (placement.scale ?? 1));
    profile = "service_stall";
    hardness = "hard";
  } else if (["cart", "cart_high", "trolley"].includes(asset) || name.includes("cart") || name.includes("wagon")) {
    halfX = Math.max(0.22, halfX * 0.5);
    halfZ = Math.max(0.16, halfZ * 0.5);
    height = Math.max(0.58, 0.78 * (placement.scale ?? 1));
    jumpable = true;
    profile = "low_jumpable_cart";
    hardness = "soft";
  } else if (name.includes("bench") || name.includes("stool") || name.includes("chair")) {
    halfX = Math.max(0.08, halfX * 0.28);
    halfZ = Math.max(0.08, halfZ * 0.28);
    height = Math.max(0.26, 0.36 * (placement.scale ?? 1));
    jumpable = true;
    profile = "low_jumpable_seating";
    hardness = "soft";
  } else if (name.includes("crate") || name.includes("barrel") || name.includes("chest") || name.includes("bucket") || name.includes("sack")) {
    halfX = Math.max(0.1, halfX * 0.44);
    halfZ = Math.max(0.1, halfZ * 0.44);
    height = Math.max(0.36, 0.58 * (placement.scale ?? 1));
    jumpable = true;
    profile = "low_clutter";
    hardness = "soft";
  } else if (name.includes("table") || name.includes("counter") || name.includes("desk") || name.includes("shelf") || name.includes("workbench")) {
    halfX = Math.max(0.14, halfX * 0.54);
    halfZ = Math.max(0.12, halfZ * 0.54);
    height = Math.max(0.72, 0.92 * (placement.scale ?? 1));
    profile = "service_furniture";
    hardness = "hard";
  } else if (
    asset.startsWith("arch_wall_") ||
    asset.startsWith("obj_wall_") ||
    asset === "obj_church_iso" ||
    asset === "arch_windmill" ||
    asset === "arch_watermill" ||
    name.includes("wall") ||
    name.includes("corner") ||
    name.includes("building") ||
    name.includes("hall") ||
    name.includes("office") ||
    name.includes("smithy") ||
    name.includes("chapel") ||
    name.includes("cottage") ||
    name.includes("barracks")
  ) {
    if (isWalkableGateOrStair) {
      halfX = Math.max(0.04, halfX * 0.18);
      halfZ = Math.max(0.04, halfZ * 0.18);
      height = Math.max(0.35, 0.55 * (placement.scale ?? 1));
      jumpable = true;
      profile = "pass_through_navigation";
      hardness = "none";
      passThrough = true;
    } else {
      halfX = Math.max(0.1, halfX * 0.92);
      halfZ = Math.max(0.1, halfZ * 0.92);
      height = Math.max(5.4, Math.max(dims.halfX, dims.halfZ) * 1.12);
      profile = "building_or_wall";
      hardness = "wall";
    }
  } else {
    halfX = Math.max(0.1, halfX * 0.5);
    halfZ = Math.max(0.1, halfZ * 0.5);
    height = Math.max(0.55, Math.min(5.3, Math.max(dims.halfX, dims.halfZ) * 0.82));
    jumpable = height <= 0.95;
    profile = jumpable ? "low_clutter" : "solid_prop";
    hardness = jumpable ? "soft" : "hard";
  }

  return {
    ...placement,
    halfX,
    halfZ,
    height,
    jumpable,
    profile,
    hardness,
    passThrough,
  };
}

function blocksWalking(obstacle, options = {}) {
  if (!obstacle || obstacle.passThrough || obstacle.hardness === "none") return false;
  if (obstacle.jumpable && options.allowStepOver !== false) return false;
  if (options.hardOnly && !(obstacle.hardness === "hard" || obstacle.hardness === "wall")) return false;
  return true;
}

function pointInRotatedAabb(x, z, obstacle, radius = PLAYER_RADIUS) {
  const cos = Math.cos(obstacle.rot ?? 0);
  const sin = Math.sin(obstacle.rot ?? 0);
  const dx = x - obstacle.x;
  const dz = z - obstacle.z;
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;

  return (
    Math.abs(localX) <= obstacle.halfX + radius &&
    Math.abs(localZ) <= obstacle.halfZ + radius
  );
}

function hitAt(x, z, obstacles, radius, options = {}) {
  return obstacles.find((obstacle) =>
    blocksWalking(obstacle, options) && pointInRotatedAabb(x, z, obstacle, radius)
  );
}

function segmentHits(a, b, obstacles, radius, options = {}) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / 0.45));
  const hits = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = a[0] + dx * t;
    const z = a[1] + dz * t;
    const hit = hitAt(x, z, obstacles, radius, options);
    if (hit && !hits.includes(hit)) hits.push(hit);
  }

  return hits;
}

function pathHits(points, obstacles, radius, options = {}) {
  const hits = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    for (const hit of segmentHits(points[index], points[index + 1], obstacles, radius, options)) {
      hits.push(`${hit.name} (${hit.asset}) near segment ${index + 1}`);
    }
  }

  return [...new Set(hits)];
}

function isClear(x, z, obstacles, radius, options = {}) {
  return !hitAt(x, z, obstacles, radius, options);
}

const placements = parsePlacements();
const obstacles = placements.map(playerObstacleForPlacement).filter(Boolean);
const walkingObstacles = obstacles.filter((obstacle) => blocksWalking(obstacle, { allowStepOver: true }));
const actors = placements.filter((placement) => placement.kind === "actor");

console.log("== Harthmere runtime navigation, collision, and service reachability tests v1 ==");
console.log(`Root: ${root}`);
console.log(`Parsed placements: ${placements.length}, player obstacles: ${obstacles.length}, walking blockers: ${walkingObstacles.length}, actors: ${actors.length}`);
console.log("");

check("assets/player/registry files exist", fs.existsSync(assetsPath) && fs.existsSync(playerPath) && fs.existsSync(registryPath));
check("runtime collision export still exposes v4 obstacle profiles", assetsSrc.includes("HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V4") && assetsSrc.includes("harthmerePlayerCollisionObstacleShapeForPlacement"));
check("player uses horizontal segment sweep instead of endpoint-only collision", playerSrc.includes("getHarthmereLocalDevHorizontalSegmentHits") && playerSrc.includes("HARTHMERE_LOCAL_DEV_HORIZONTAL_PLAYER_TOWN_COLLISION_SWEEP_STEP = 0.08"));
check("player collision radius is tight enough for MMO town clutter", playerSrc.includes("DEFAULT_RADIUS = 0.07") && playerSrc.includes("MAX_RADIUS = 0.18"));
check("low/jumpable object clearance logic remains active", playerSrc.includes("lowEnoughToStep") && playerSrc.includes("centerAboveLowObject") && playerSrc.includes("risingOntoObject"));
check("collision escape fallback exists for bad overlaps instead of trapping player forever", playerSrc.includes("harthmereLocalDevHorizontalEscapeScore") && playerSrc.includes("lastClear"));
check("north gate doors and stair/wayfinding markers remain pass-through navigation", assetsSrc.includes("isNorthGateExitDoor") && playerSrc.includes("pass_through_navigation"));
check("visual-only signs, lamps, banners, notes, food, and scrolls do not become walking blockers", assetsSrc.includes('collisionProfile = isWalkableGateOrStair ? "pass_through_navigation" : "visual_only"'));
check("hard blockers still exist for walls, towers, buildings, stalls, and service furniture", walkingObstacles.some((obstacle) => obstacle.profile === "building_or_wall") && walkingObstacles.some((obstacle) => obstacle.profile === "service_stall") && walkingObstacles.some((obstacle) => obstacle.profile === "service_furniture"));

const routes = [
  { name: "North Gate to Market Square main arrival route", radius: PLAYER_RADIUS, points: [[486, -282], [486, -252], [486, -222], [486, -207]] },
  { name: "Market Square to Player Services route", radius: PLAYER_RADIUS, points: [[486, -207], [520, -207], [548, -207], [556, -214]] },
  { name: "Market Square to Copper Kettle Inn route", radius: PLAYER_RADIUS, points: [[486, -207], [520, -207], [538, -207], [552, -206]] },
  { name: "Market Square to Temple Green exterior service approach route", radius: PLAYER_RADIUS, points: [[486, -207], [486, -190], [491, -155]] },
  { name: "Market Square to River Docks road approach route", radius: PLAYER_RADIUS, points: [[486, -207], [520, -203], [536, -196], [570, -196], [590, -196]] },
  { name: "Market Square to Guard Yard service approach route", radius: PLAYER_RADIUS, points: [[486, -207], [490, -225], [500, -242], [500, -255], [509, -255]] },
  { name: "Market Square to Noble Rise route", radius: PLAYER_RADIUS, points: [[486, -207], [526, -218], [552, -246], [562, -246]] },
  { name: "Market Square to Mudden Ward route", radius: PLAYER_RADIUS, points: [[486, -207], [450, -196], [424, -176], [412, -166]] },
  { name: "Mudden Ward to Old Well/Underways route", radius: PLAYER_RADIUS, points: [[412, -166], [419, -170], [430, -172], [442, -174]] },
];

for (const route of routes) {
  const hits = pathHits(route.points, walkingObstacles, route.radius, { allowStepOver: true });
  check(`${route.name} is walkable by player sweep`, hits.length === 0, hits);
}

const mountRoutes = [
  { name: "North Gate mounted/crowd lane", points: [[486, -282], [486, -252], [486, -222], [486, -207]] },
  { name: "Market mounted/crowd lane", points: [[430, -207], [462, -207], [494, -207], [526, -207]] },
  { name: "Dock service cart lane", points: [[536, -196], [568, -196], [600, -196]] },
];

for (const route of mountRoutes) {
  const hits = pathHits(route.points, walkingObstacles, MOUNT_RADIUS, { allowStepOver: true, hardOnly: true });
  check(`${route.name} keeps mounted/service traffic clearance`, hits.length === 0, hits);
}

const interactionTargets = [
  /Elowen.*innkeeper/i,
  /Banker Merl Voss/i,
  /Auction Clerk Pell/i,
  /Storage Steward/i,
  /Guild Registrar/i,
  /Cosmetic Wardrobe Attendant/i,
  /Master Osric Vale/i,
  /Sister Maelle/i,
  /Ysabet Fenlow/i,
  /Tovin.*Dockmaster|dockmaster Tovin/i,
  /Ferry Master/i,
  /Sergeant Bram/i,
  /bounty clerk/i,
  /Nessa.*Underways/i,
  /Father Aldren/i,
];

const missingTargets = [];
const blockedTargets = [];

for (const target of interactionTargets) {
  const matches = actors.filter((actor) => target.test(actor.name ?? ""));
  if (!matches.length) {
    missingTargets.push(String(target));
    continue;
  }

  for (const actor of matches) {
    const candidates = [
      [actor.x + SERVICE_RADIUS, actor.z],
      [actor.x - SERVICE_RADIUS, actor.z],
      [actor.x, actor.z + SERVICE_RADIUS],
      [actor.x, actor.z - SERVICE_RADIUS],
      [actor.x + 1.15, actor.z + 1.15],
      [actor.x - 1.15, actor.z - 1.15],
      [actor.x + 1.15, actor.z - 1.15],
      [actor.x - 1.15, actor.z + 1.15],
    ];

    const clear = candidates.some(([x, z]) => isClear(x, z, walkingObstacles, PLAYER_RADIUS, { allowStepOver: true }));
    if (!clear) {
      blockedTargets.push(`${actor.name} at ${actor.x.toFixed(1)},${actor.z.toFixed(1)} has no clear interaction approach`);
    }
  }
}

check("all required service/quest NPC actors exist for interaction reachability tests", missingTargets.length === 0, missingTargets);
check("service and quest NPCs have at least one clear interaction approach point", blockedTargets.length === 0, blockedTargets);

const safeOpenAnchors = [
  { name: "Market Square social/combat-safe plaza", center: [486, -207], radius: 4.5 },
  { name: "Player Services customer queue pocket", center: [556, -211], radius: 2.0 },
  { name: "Copper Kettle entry pocket", center: [552, -207], radius: 2.0 },
  { name: "Temple Green exterior healer/sign approach pocket", center: [491, -155], radius: 2.0 },
  { name: "Guard Yard training safety pocket", center: [512, -254], radius: 2.0 },
  { name: "River Docks loading pocket", center: [590, -196], radius: 2.0 },
];

const pocketIssues = [];

for (const pocket of safeOpenAnchors) {
  const [cx, cz] = pocket.center;
  const samples = [
    [cx, cz],
    [cx + pocket.radius, cz],
    [cx - pocket.radius, cz],
    [cx, cz + pocket.radius],
    [cx, cz - pocket.radius],
  ];
  const blocked = samples
    .map(([x, z]) => hitAt(x, z, walkingObstacles, PLAYER_RADIUS, { allowStepOver: true }))
    .filter(Boolean);

  if (blocked.length > 1) {
    pocketIssues.push(`${pocket.name} blocked by ${[...new Set(blocked.map((hit) => `${hit.name} (${hit.asset})`))].join(", ")}`);
  }
}

check("safe districts keep at least one open pocket near services/plazas", pocketIssues.length === 0, pocketIssues);

const waterNpcIssues = actors
  .filter((actor) =>
    /river docks/i.test(actor.district ?? "") &&
    !/^animal_/.test(actor.asset) &&
    /water|river|ferry|skiff|dock|fish|gull|duck|frog|flood|rescue|rope|bridge|corpse|smuggler/i.test(actor.name ?? "") === false &&
    (actor.z > -169 || actor.x > 611)
  )
  .map((actor) => `${actor.name} appears outside dock-safe land lane at ${actor.x},${actor.z}`);

check("dock actors stay on dock/road side unless explicitly water-working", waterNpcIssues.length === 0, waterNpcIssues);

const dangerSignals = [
  /PvP opt-in warning/i,
  /Mudden Ward warning/i,
  /Hidden tunnel access/i,
  /Crypt disturbance/i,
  /bandit|ambush|danger|warning/i,
];
const dangerMissing = dangerSignals
  .filter((pattern) => !placements.some((placement) => pattern.test(placement.name ?? "")))
  .map(String);

check("danger/medium-risk areas have visible warning or breadcrumb placements", dangerMissing.length === 0, dangerMissing);

const searchableTownText = `${assetsSrc}\n${registrySrc}`;
const hiddenHooks = [
  /Hidden tunnel access/i,
  /Old Well/i,
  /underways/i,
  /smuggler/i,
  /cellar/i,
  /crypt/i,
  /stolen[_ -]mail/i,
  /secret/i,
];

const missingHiddenHooks = hiddenHooks
  .filter((pattern) => !pattern.test(searchableTownText))
  .map(String);

check("exploration hooks remain authored for alleys, underways, cellars, criminal services, and mysteries", missingHiddenHooks.length === 0, missingHiddenHooks);
check("full placement suite includes this runtime navigation checker", fs.existsSync(placementSuitePath) && read(placementSuitePath).includes("test-harthmere-runtime-navigation-collision-v1.cjs"));

console.log("");
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}

console.log("RESULT: PASS");
