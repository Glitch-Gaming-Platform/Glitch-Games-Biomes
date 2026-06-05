#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const {
  loadTown,
  makeReporter,
} = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere NPC grounded swept route navigation v150", root);
const town = loadTown(root);
const assetsSrc = town.assetsSrc;
const routePath = path.join(root, "src/shared/harthmere/town_routes.ts");
const deployPath = path.join(root, "scripts/glitch/deploy-production-local-redis-smoke-v1.sh");
const routesSrc = fs.readFileSync(routePath, "utf8");
const deploySrc = fs.readFileSync(deployPath, "utf8");

function extractRouteAnchors(src, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s+as\\s+const`);
  const match = src.match(re);
  if (!match) return undefined;
  return Function(`"use strict"; return ({${match[1]}});`)();
}

const rendererAnchors = extractRouteAnchors(assetsSrc, "HARTHMERE_NPC_ROUTE_ANCHORS_V48");
const sharedAnchors = extractRouteAnchors(routesSrc, "HARTHMERE_TOWN_ROUTE_ANCHORS_V48");

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function isIgnoredNavigationFixture(placement) {
  const label = lower(`${placement.asset} ${placement.name ?? ""} ${placement.district ?? ""}`);
  return (
    /window|flag|banner|sign|lamp|lantern|torch|candle|note|book|scroll|coin|apple|bread|cheese|mug|plate|cloth bolt|recipe|marker detail|rim detail|roof window|rope marker|painted line/.test(label) ||
    /wall stair|stair to watch|stair access|steps|walkway|passage|opening|archway|gate passage|road exit|town exit|north road|south road|east road|west road|trail|path marker|breadcrumb|wayfinding|approach marker/.test(label)
  );
}

function hardObstacleForPlacement(placement) {
  if (placement.kind === "A") return undefined;
  if (isIgnoredNavigationFixture(placement)) return undefined;
  const softRouteFixture = /clear of|leaning|loose|supply crate|broken laundry cart|shield|coal|rack|workbench|crate|barrel|chest|bucket|sack/i.test(`${placement.asset} ${placement.name ?? ""}`);
  if (softRouteFixture) return undefined;
  const asset = placement.asset;
  const label = lower(`${placement.asset} ${placement.name ?? ""}`);
  const scale = placement.scale ?? 1;
  let halfX;
  let halfZ;

  if (asset.startsWith("food_") || /scroll|book|mug|plate|coin|dagger|pickaxe|sword|apple|bread|cheese|fishbone|fish_/.test(label)) return undefined;
  if (asset.startsWith("arch_wall_corner")) { halfX = 1.6 * scale; halfZ = 1.6 * scale; }
  else if (asset.startsWith("arch_wall_")) { halfX = 3.7 * scale; halfZ = 0.62 * scale; }
  else if (asset === "obj_tower_complex") { halfX = 2.7 * scale; halfZ = 2.7 * scale; }
  else if (asset.startsWith("obj_wall_")) { halfX = 4.8 * scale; halfZ = 0.84 * scale; }
  else if (asset === "obj_church_iso") { halfX = 7.8 * scale; halfZ = 9.2 * scale; }
  else if (asset === "arch_windmill" || asset === "arch_watermill") { halfX = 4.8 * scale; halfZ = 4.8 * scale; }
  else if (asset.startsWith("stall")) { halfX = 1.5 * scale; halfZ = 1.08 * scale; }
  else if (/counter|table|desk|shelf|anvil|cabinet|bookcase|pew|bed|cage/.test(label)) { halfX = 0.74 * scale; halfZ = 0.54 * scale; }
  else if (/wall|tower|building|hall|office|smithy|chapel|cottage|barracks|warehouse|shop/.test(label)) { halfX = 2.2 * scale; halfZ = 2.0 * scale; }
  else return undefined;

  return {
    name: placement.name ?? placement.asset,
    asset,
    x: placement.x,
    z: placement.z,
    rot: placement.rot ?? 0,
    halfX: Math.max(0.08, halfX),
    halfZ: Math.max(0.08, halfZ),
  };
}

function pointInRotatedAabb(x, z, obstacle, radius) {
  const c = Math.cos(obstacle.rot);
  const s = Math.sin(obstacle.rot);
  const dx = x - obstacle.x;
  const dz = z - obstacle.z;
  const localX = dx * c + dz * s;
  const localZ = -dx * s + dz * c;
  return Math.abs(localX) <= obstacle.halfX + radius && Math.abs(localZ) <= obstacle.halfZ + radius;
}

function segmentHits(a, b, obstacles, radius) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.42));
  const hits = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = a[0] + dx * t;
    const z = a[1] + dz * t;
    for (const obstacle of obstacles) {
      if (pointInRotatedAabb(x, z, obstacle, radius)) {
        hits.push(`${obstacle.name} (${obstacle.asset})`);
        break;
      }
    }
  }
  return [...new Set(hits)];
}

const hardObstacles = town.placements.map(hardObstacleForPlacement).filter(Boolean);
const routeIssues = [];
const NPC_RADIUS = 0.58;
if (rendererAnchors) {
  for (const [routeName, points] of Object.entries(rendererAnchors)) {
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const hits = segmentHits(a, b, hardObstacles, NPC_RADIUS);
      if (hits.length) routeIssues.push(`${routeName} segment ${index + 1}: ${hits.slice(0, 3).join("; ")}`);
    }
  }
}

report.check("renderer declares v150 NPC navigation fix", assetsSrc.includes("HARTHMERE_NPC_NAVIGATION_FIX_VERSION_V150") && assetsSrc.includes("harthmere-npc-grounded-swept-route-navigation-v150"));
report.check("renderer uses swept NPC body collision, not endpoint-only collision", assetsSrc.includes("sweepHarthmereNpcCollisionObstacleV150") && assetsSrc.includes("HARTHMERE_NPC_BODY_SWEEP_STEP_METERS_V150") && assetsSrc.includes("HARTHMERE_NPC_BODY_SAMPLE_OFFSETS_V150"));
report.check("NPC root Y is grounded instead of bobbing/floating the whole actor", assetsSrc.includes("harthmereNpcGroundedYV150") && !/position\.y\s*=\s*\n\s*instance\.base\[1\]\s*\+\s*Math\.sin\(this\.elapsed \* 2\)/.test(assetsSrc));
report.check("repulsion cannot push NPCs into walls after route collision resolves", /findHarthmereNpcBodyCollisionObstacleV150\(resolvedX, resolvedZ\)[\s\S]{0,180}resolvedX = resolved\.position\[0\]/.test(assetsSrc));
report.check("moving NPC LOD follows current object position so walkers do not disappear away from spawn", /const isRuntimeLife = isHarthmereRuntimeLifePlacement\(instance\.placement\);[\s\S]{0,520}const lodX = isRuntimeLife[\s\S]{0,120}instance\.object\.position\.x[\s\S]{0,220}const lodZ = isRuntimeLife[\s\S]{0,120}instance\.object\.position\.z/.test(assetsSrc));
report.check("runtime life actors stay visible at close range instead of prop LOD hiding their bodies", /const isRuntimeLife = isHarthmereRuntimeLifePlacement\(instance\.placement\);[\s\S]{0,620}const show =[\s\S]{0,160}isRuntimeLife \|\| !origin[\s\S]{0,80}\? true/.test(assetsSrc));
report.check("static NPCs without idle clips do not walk in place", assetsSrc.includes("allowMovingFallback = true") && assetsSrc.includes("canUseMovingClipAsDefault") && assetsSrc.includes("Boolean(placement.wander || placement.bob || placement.spin)"));
report.check("renderer route anchors exist", Boolean(rendererAnchors));
report.check("shared and renderer route anchors stay in sync", JSON.stringify(rendererAnchors) === JSON.stringify(sharedAnchors));
report.check("route anchors cover the whole town, not only the fountain", rendererAnchors && ["north_gate", "market_square", "player_services", "craftsman_row", "copper_kettle", "temple_green", "noble_rise", "river_docks", "mudden_ward", "guard_yard"].every((key) => Array.isArray(rendererAnchors[key]) && rendererAnchors[key].length >= 4));
report.check("every NPC patrol segment sweeps clear of hard blockers", routeIssues.length === 0, routeIssues);
report.check("collision lookup remains grid-hashed for performance", assetsSrc.includes("HARTHMERE_OBSTACLE_GRID_CELL_METERS_V50") && assetsSrc.includes("harthmereNpcObstacleGridV50") && hardObstacles.length < 700, `hard obstacle count ${hardObstacles.length}`);
report.check("existing unreachable/route tests are wired into production deploy guardrails", deploySrc.includes("test-harthmere-npc-route-graph-v1.cjs") && deploySrc.includes("test-harthmere-runtime-navigation-collision-v1.cjs") && deploySrc.includes("test-harthmere-npc-navigation-grounded-routes-v150.cjs"));

report.finish();
