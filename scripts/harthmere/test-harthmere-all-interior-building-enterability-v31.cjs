#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const GROUND_Y = 53.05;
const PLAYER_RADIUS = 0.44;
const SAMPLE_STEP = 0.32;
const EPS = 1e-6;

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
  return fs.readFileSync(file, "utf8");
}

const assetsSrc = read(assetsPath);
const registrySrc = read(registryPath);
const playerSrc = read(playerPath);
const suiteSrc = fs.existsSync(suitePath) ? read(suitePath) : "";

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
    return;
  }
  failures += 1;
  console.log(`FAIL ${label}`);
  if (detail) {
    const lines = Array.isArray(detail) ? detail : [detail];
    for (const line of lines.slice(0, 35)) console.log(`  - ${line}`);
    if (lines.length > 35) console.log(`  - ... ${lines.length - 35} more`);
  }
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
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
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
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if ("({[".includes(ch)) depth += 1;
    if (")}]".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() || text.trim().endsWith(",")) args.push(current.trim());
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
    calls.push({ callee, args: splitTopLevelArgs(clean.slice(open + 1, close)), start: index });
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

function getObjectProperty(objectText, key) {
  const pattern = new RegExp(`(?:^|[,\\n\\r])\\s*${escapeRegExp(key)}\\s*:\\s*([^,\\n\\r}]+)`, "m");
  const match = objectText.match(pattern);
  return match ? match[1].trim() : undefined;
}

function getObjectPropertyBlock(objectText, key) {
  const pattern = new RegExp(`(?:^|[,\\n\\r])\\s*${escapeRegExp(key)}\\s*:\\s*`, "m");
  const match = pattern.exec(objectText);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  const first = objectText[start];
  if (first === "{") {
    const close = findBalanced(objectText, start, "{", "}");
    return close >= 0 ? objectText.slice(start, close + 1) : undefined;
  }
  const comma = objectText.indexOf(",", start);
  return objectText.slice(start, comma >= 0 ? comma : objectText.length).trim();
}

function localPoint(x, z, rot, dx, dz) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: x + dx * c - dz * s, z: z + dx * s + dz * c };
}

function parseThemeConstants() {
  const themes = {};
  const clean = stripComments(assetsSrc);
  const re = /const\s+([A-Z_]+_THEME)\s*:\s*BuildingTheme\s*=\s*{/g;
  let match;
  while ((match = re.exec(clean))) {
    const name = match[1];
    const brace = clean.indexOf("{", match.index);
    const close = findBalanced(clean, brace, "{", "}");
    if (close < 0) continue;
    const body = clean.slice(brace + 1, close);
    const theme = {};
    for (const key of ["wall", "window", "door", "roof", "stair", "corner", "chimney", "banner"]) {
      const value = parseStringLiteral(getObjectProperty(body, key));
      if (value !== undefined) theme[key] = value;
    }
    themes[name] = theme;
    re.lastIndex = close + 1;
  }
  return themes;
}

const THEME_CONSTANTS = parseThemeConstants();

function resolveTheme(raw) {
  const text = String(raw ?? "").trim();
  let theme = {};
  const spread = text.match(/\.\.\.([A-Z_]+_THEME)/);
  const direct = text.match(/^([A-Z_]+_THEME)$/);
  if (spread && THEME_CONSTANTS[spread[1]]) theme = { ...THEME_CONSTANTS[spread[1]] };
  else if (direct && THEME_CONSTANTS[direct[1]]) theme = { ...THEME_CONSTANTS[direct[1]] };
  else theme = { ...(THEME_CONSTANTS.STONE_THEME ?? {}) };

  for (const key of ["wall", "window", "door", "roof", "stair", "corner", "chimney", "banner"]) {
    const m = text.match(new RegExp(`${key}\\s*:\\s*("[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*')`));
    const value = m ? parseStringLiteral(m[1]) : undefined;
    if (value !== undefined) theme[key] = value;
  }
  return theme;
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
    const wallY = safeNumber(getObjectProperty(objectText, "wallY")) ?? 0;
    const roofY = safeNumber(getObjectProperty(objectText, "roofY")) ?? 2.85;
    const roofScale = safeNumber(getObjectProperty(objectText, "roofScale")) ?? scale * 1.18;
    const theme = resolveTheme(getObjectPropertyBlock(objectText, "theme"));
    if (name && district && x !== undefined && z !== undefined && w !== undefined && d !== undefined) {
      const hw = w / 2;
      const hd = d / 2;
      shells.push({ name, district, x, z, w, d, hw, hd, rot, scale, wallY, roofY, roofScale, theme });
    }
    index = close + 1;
  }
  return shells;
}

function makePlacement(asset, x, y, z, rot, scale, name, district, source = "P", shellName) {
  return { asset, x, y, z, rot: rot ?? 0, scale: scale ?? 1, name: name ?? asset, district, source, shellName };
}

function parseAuthoredPlacements() {
  const placements = [];
  for (const call of [...parseLiteralCalls(assetsSrc, "P"), ...parseLiteralCalls(assetsSrc, "A")]) {
    const asset = parseStringLiteral(call.args[0]);
    const x = safeNumber(call.args[1]);
    const z = safeNumber(call.args[2]);
    if (!asset || x === undefined || z === undefined) continue;
    const rot = safeNumber(call.args[3]) ?? 0;
    const scale = safeNumber(call.args[4]) ?? 1;
    const name = parseStringLiteral(call.args[5]) ?? asset;
    const districtOrYString = parseStringLiteral(call.args[6]);
    const districtOrYNumber = safeNumber(call.args[6]);
    const district = districtOrYString;
    const y = call.callee === "A"
      ? GROUND_Y
      : districtOrYNumber !== undefined && !districtOrYString
        ? districtOrYNumber
        : safeNumber(call.args[7]) ?? GROUND_Y;
    placements.push(makePlacement(asset, x, y, z, rot, scale, name, district, call.callee));
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
    if (!asset || !district || !name || x === undefined || z === undefined || !Number.isInteger(count) || count <= 0 || dx === undefined || dz === undefined) continue;
    for (let i = 0; i < count; i += 1) {
      placements.push(makePlacement(asset, x + dx * i, GROUND_Y, z + dz * i, rot, scale, `${name} ${i + 1}`, district, "row"));
    }
  }
  return placements;
}

function BP(asset, shell, dx, dz, rotAdd, scale, label, yOffset = 0) {
  const p = localPoint(shell.x, shell.z, shell.rot, dx, dz);
  return makePlacement(asset, p.x, GROUND_Y + yOffset, p.z, shell.rot + rotAdd, scale, `${shell.name} ${label}`, shell.district, "createBuildingShell", shell.name);
}

function expandShellPlacements(shell) {
  const t = shell.theme;
  const hw = shell.hw;
  const hd = shell.hd;
  const scale = shell.scale;
  const roofScale = shell.roofScale;
  const wallY = shell.wallY;
  const roofY = shell.roofY;
  const placements = [
    BP(t.door, shell, 0, hd, 0, scale, "front door", wallY),
    BP(t.window, shell, -hw * 0.48, hd, 0, scale, "front left window", wallY),
    BP(t.window, shell, hw * 0.48, hd, 0, scale, "front right window", wallY),
    BP(t.window, shell, -hw * 0.45, -hd, Math.PI, scale, "back left window", wallY),
    BP(t.wall, shell, 0, -hd, Math.PI, scale, "back wall", wallY),
    BP(t.window, shell, hw * 0.45, -hd, Math.PI, scale, "back right window", wallY),
    BP(t.wall, shell, -hw, -hd * 0.45, Math.PI / 2, scale, "left rear wall", wallY),
    BP(t.window, shell, -hw, 0, Math.PI / 2, scale, "left window", wallY),
    BP(t.wall, shell, -hw, hd * 0.45, Math.PI / 2, scale, "left front wall", wallY),
    BP(t.wall, shell, hw, -hd * 0.45, -Math.PI / 2, scale, "right rear wall", wallY),
    BP(t.window, shell, hw, 0, -Math.PI / 2, scale, "right window", wallY),
    BP(t.wall, shell, hw, hd * 0.45, -Math.PI / 2, scale, "right front wall", wallY),
  ];
  if (t.corner) {
    placements.push(
      BP(t.corner, shell, -hw, -hd, Math.PI, scale, "north-west corner", wallY),
      BP(t.corner, shell, hw, -hd, -Math.PI / 2, scale, "north-east corner", wallY),
      BP(t.corner, shell, -hw, hd, Math.PI / 2, scale, "south-west corner", wallY),
      BP(t.corner, shell, hw, hd, 0, scale, "south-east corner", wallY),
    );
  }
  if (shell.w >= 22) {
    placements.push(
      BP(t.roof, shell, -shell.w * 0.25, 0, 0, roofScale, "left roof volume", roofY),
      BP(t.roof, shell, 0, 0, 0, roofScale, "center roof volume", roofY),
      BP(t.roof, shell, shell.w * 0.25, 0, 0, roofScale, "right roof volume", roofY),
    );
  } else {
    placements.push(BP(t.roof, shell, 0, 0, 0, roofScale, "roof volume", roofY));
  }
  if (t.chimney) placements.push(BP(t.chimney, shell, hw * 0.38, -hd * 0.34, 0, scale * 0.78, "chimney", roofY + 1.25));
  if (t.stair) placements.push(BP(t.stair, shell, 0, hd + 2.2, 0, scale * 0.75, "entry step", 0));
  if (t.banner) {
    placements.push(
      BP(t.banner, shell, -hw * 0.72, hd + 0.3, 0, 0.72, "district banner", 1.2),
      BP(t.banner, shell, hw * 0.72, hd + 0.3, 0, 0.72, "district banner", 1.2),
    );
  }
  return placements.filter((p) => p.asset);
}

function isNavigationOpening(p) {
  const name = String(p.name ?? p.asset).toLowerCase();
  const asset = String(p.asset ?? "");
  return name.includes("front door") ||
    name.includes("entry step") ||
    name.includes("entry stair") ||
    name.includes("doorway clear") ||
    name.includes("public entrance") ||
    name.includes("shop entrance") ||
    name.includes("building entrance") ||
    name.includes("gate passage") ||
    name.includes("road exit") ||
    name.includes("town exit") ||
    name.includes("archway") ||
    name.includes("opening") ||
    (/^arch_stairs_/i.test(asset) && /entry|front|stair|steps/.test(name)) ||
    (/^arch_wall_.*door/i.test(asset) && /front door|public entrance|shop entrance|building entrance/.test(name)) ||
    (/^obj_wall_entrance_door/i.test(asset) && /ironbound door|gate passage|road exit|town exit/.test(name));
}

function isVisualOnly(p) {
  const name = String(p.name ?? p.asset).toLowerCase();
  const asset = String(p.asset ?? "");
  if (isNavigationOpening(p)) return true;
  if (/^obj_flag_large_/i.test(asset)) return false;
  if (/^arch_wall_.*window/i.test(asset) || /^obj_church_window_/i.test(asset)) return false;
  return name.includes("flag") ||
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
}

function isTinyAsset(asset) {
  return /food_|coin|key|mug|cup|plate|spoon|knife|apple|carrot|bread|cheese|cake|bottle|vial|scroll|book|candle|chalice|fish|mushroom|note|cloth/i.test(asset);
}

function collisionShape(p) {
  if (!p || p.source === "A") return undefined;
  const asset = String(p.asset ?? "");
  const name = String(p.name ?? asset).toLowerCase();
  const label = `${asset} ${name}`.toLowerCase();
  const scale = p.scale ?? 1;

  if (isNavigationOpening(p) || isVisualOnly(p) || isTinyAsset(asset)) return undefined;
  if (p.y > GROUND_Y + 1.45 && !/table|counter|desk|shelf|workbench|rack|bridge|platform|stair|wall|window|door|corner|tower|church|mill/.test(label)) return undefined;
  if (/roof|chimney/.test(label) && p.y > GROUND_Y + 1.45) return undefined;
  if (asset.startsWith("townsperson_") || asset.startsWith("animal_")) return undefined;

  if (/^obj_flag_large_/i.test(asset)) return { halfX: Math.max(0.68, 0.68 * scale), halfZ: Math.max(0.22, 0.22 * scale), hard: true, profile: "solid_landmark_fixture" };
  if (asset.startsWith("arch_wall_corner")) return { halfX: Math.max(0.1, 1.6 * scale * 0.92), halfZ: Math.max(0.1, 1.6 * scale * 0.92), hard: true, profile: "building_corner" };
  if (asset.startsWith("arch_wall_")) return { halfX: Math.max(0.1, 3.7 * scale * 0.92), halfZ: Math.max(0.1, 0.62 * scale * 0.92), hard: true, profile: "building_wall" };
  if (asset.startsWith("obj_wall_")) return { halfX: Math.max(0.1, 5.2 * scale * 0.92), halfZ: Math.max(0.1, 0.9 * scale * 0.92), hard: true, profile: "fortification_wall" };
  if (asset === "obj_tower_complex") return { halfX: Math.max(0.85, 5.8 * scale * 0.46), halfZ: Math.max(0.85, 5.8 * scale * 0.46), hard: true, profile: "watch_tower" };
  if (asset === "obj_church_iso") return { halfX: Math.max(0.1, 8.5 * scale * 0.92), halfZ: Math.max(0.1, 10.0 * scale * 0.92), hard: true, profile: "chapel" };
  if (asset === "arch_windmill" || asset === "arch_watermill") return { halfX: Math.max(0.1, 5.2 * scale * 0.92), halfZ: Math.max(0.1, 5.2 * scale * 0.92), hard: true, profile: "mill" };
  if (/fountain|old well/.test(label)) return { halfX: Math.max(0.34, 4.2 * scale * 0.34), halfZ: Math.max(0.34, 4.2 * scale * 0.34), hard: false, profile: "low_jumpable_landmark" };
  if (asset.startsWith("stall")) return { halfX: Math.max(0.18, 2.8 * scale * 0.54), halfZ: Math.max(0.18, 2.0 * scale * 0.54), hard: true, profile: "service_stall" };
  if (/table|counter|desk|shelf|workbench|anvil|dummy|cage|rack/.test(label)) return { halfX: Math.max(0.14, 1.35 * scale * 0.54), halfZ: Math.max(0.12, 1.0 * scale * 0.54), hard: true, profile: "service_furniture" };
  if (/bench|stool|chair|crate|barrel|chest|bucket|sack|bag|cart|wagon|fence|hedge|rail/.test(label)) return { halfX: Math.max(0.08, 1.35 * scale * 0.44), halfZ: Math.max(0.08, 1.0 * scale * 0.44), hard: false, profile: "jumpable_clutter" };
  if (/wall|tower|church|chapel|warehouse|hall|office|smithy|cottage|barracks|building|house/.test(label)) return { halfX: Math.max(0.1, 1.8 * scale * 0.92), halfZ: Math.max(0.1, 1.2 * scale * 0.92), hard: true, profile: "building_like" };
  return undefined;
}

function pointInsideRotated(p, point, extra = PLAYER_RADIUS) {
  const shape = collisionShape(p);
  if (!shape || !shape.hard) return false;
  const rot = -(p.rot ?? 0);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const dx = point.x - p.x;
  const dz = point.z - p.z;
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  return Math.abs(localX) <= shape.halfX + extra && Math.abs(localZ) <= shape.halfZ + extra;
}

function segmentSamples(a, b, step = SAMPLE_STEP) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(length / step));
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    points.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return points;
}

function pathClear(label, points, blockers, allow = () => false) {
  const offenders = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const samples = segmentSamples(points[i], points[i + 1]);
    for (const sample of samples) {
      for (const blocker of blockers) {
        if (allow(blocker, sample)) continue;
        if (pointInsideRotated(blocker, sample, PLAYER_RADIUS)) {
          const shape = collisionShape(blocker);
          offenders.push(`${label}: blocked by ${blocker.name} (${blocker.asset}, ${shape?.profile ?? "unknown"}) near ${sample.x.toFixed(1)},${sample.z.toFixed(1)} in ${blocker.district ?? "unknown"}`);
          break;
        }
      }
      if (offenders.length) break;
    }
    if (offenders.length) break;
  }
  return offenders;
}

function pointLocalInShell(shell, point) {
  const c = Math.cos(-(shell.rot ?? 0));
  const s = Math.sin(-(shell.rot ?? 0));
  const dx = point.x - shell.x;
  const dz = point.z - shell.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function pointInsideShell(shell, point, margin = 0) {
  const local = pointLocalInShell(shell, point);
  return Math.abs(local.x) <= shell.hw - margin && Math.abs(local.z) <= shell.hd - margin;
}

const buildingShells = parseBuildingShells();
const authoredPlacements = parseAuthoredPlacements();
const expandedShellPlacements = buildingShells.flatMap(expandShellPlacements);
const allPlacements = [...authoredPlacements, ...expandedShellPlacements];
const hardBlockers = allPlacements.filter((p) => collisionShape(p)?.hard);
const actors = authoredPlacements.filter((p) => p.source === "A");

console.log("== Harthmere all interior building enterability tests v31 ==");
console.log(`Root: ${root}`);
console.log(`Parsed building shells: ${buildingShells.length}; blockers: ${hardBlockers.length}; actors: ${actors.length}`);
console.log("");

check("v31 test has enough authored building shells to be meaningful", buildingShells.length >= 14, buildingShells.map((s) => s.name));
check("renderer exposes building navigation opening helper used by the player collision bridge", /function isHarthmereBuildingNavigationOpeningPlacement/.test(assetsSrc) && /front door/.test(assetsSrc) && /entry step/.test(assetsSrc));
check("player runtime collision bridge respects building navigation openings", /isHarthmereLocalDevBuildingNavigationOpening/.test(playerSrc) && /pass_through_navigation/.test(playerSrc));

const shellEntryFailures = [];
const shellExitFailures = [];
const shellInteriorFailures = [];
const shellServiceFailures = [];
const shellDoorMarkersMissing = [];

for (const shell of buildingShells) {
  const outside = localPoint(shell.x, shell.z, shell.rot, 0, shell.hd + 3.8);
  const approach = localPoint(shell.x, shell.z, shell.rot, 0, shell.hd + 1.45);
  const threshold = localPoint(shell.x, shell.z, shell.rot, 0, shell.hd + 0.1);
  const inside = localPoint(shell.x, shell.z, shell.rot, 0, Math.max(-shell.hd + 2.6, shell.hd - 2.65));
  const center = localPoint(shell.x, shell.z, shell.rot, 0, 0);
  const leftInside = localPoint(shell.x, shell.z, shell.rot, -Math.max(1.2, shell.hw * 0.35), Math.max(-shell.hd + 2.8, shell.hd - 3.4));
  const rightInside = localPoint(shell.x, shell.z, shell.rot, Math.max(1.2, shell.hw * 0.35), Math.max(-shell.hd + 2.8, shell.hd - 3.4));
  const ownDoorPlacements = expandedShellPlacements.filter((p) => p.shellName === shell.name && isNavigationOpening(p));
  if (!ownDoorPlacements.some((p) => /front door/.test(String(p.name).toLowerCase()))) {
    shellDoorMarkersMissing.push(`${shell.name} has no generated front door navigation opening`);
  }

  const allowOwnNavigationAndNonGround = (blocker) => {
    if (blocker.shellName === shell.name && isNavigationOpening(blocker)) return true;
    if (blocker.y > GROUND_Y + 1.45 && /roof|chimney|banner|sign|lamp|lantern|torch|window/i.test(`${blocker.asset} ${blocker.name}`)) return true;
    return false;
  };

  const entryOffenders = pathClear(shell.name, [outside, approach, threshold, inside, center], hardBlockers, allowOwnNavigationAndNonGround);
  if (entryOffenders.length) shellEntryFailures.push(...entryOffenders);

  const exitOffenders = pathClear(`${shell.name} exit`, [center, inside, threshold, approach, outside], hardBlockers, allowOwnNavigationAndNonGround);
  if (exitOffenders.length) shellExitFailures.push(...exitOffenders);

  const interiorSweepFailures = [leftInside, center, rightInside]
    .flatMap((target, index) => pathClear(`${shell.name} interior aisle ${index + 1}`, [inside, target], hardBlockers, allowOwnNavigationAndNonGround));
  if (interiorSweepFailures.length) shellInteriorFailures.push(...interiorSweepFailures.slice(0, 3));

  const interiorActors = actors.filter((actor) => actor.district === shell.district && pointInsideShell(shell, actor, 0.8));
  if (interiorActors.length > 0) {
    for (const actor of interiorActors.slice(0, 3)) {
      const actorPoint = { x: actor.x, z: actor.z };
      const serviceFailures = pathClear(`${shell.name} service route to ${actor.name}`, [inside, center, actorPoint], hardBlockers, (blocker) => {
        if (allowOwnNavigationAndNonGround(blocker)) return true;
        if (blocker.name === actor.name) return true;
        return false;
      });
      if (serviceFailures.length) shellServiceFailures.push(...serviceFailures);
    }
  }
}

check("every generated building shell has a front-door navigation opening", shellDoorMarkersMissing.length === 0, shellDoorMarkersMissing);
check("player-sized path from outside approach through front door into every generated interior is clear", shellEntryFailures.length === 0, shellEntryFailures);
check("player-sized exit path from every generated interior back outside is clear", shellExitFailures.length === 0, shellExitFailures);
check("interior aisles inside generated buildings are not immediately blocked by counters, walls, crates, or shell collision", shellInteriorFailures.length === 0, shellInteriorFailures);
check("service NPCs inside generated buildings are reachable from the entry aisle when present", shellServiceFailures.length === 0, shellServiceFailures);

const blackAnvil = buildingShells.find((s) => /Black Anvil Smithy/.test(s.name));
const importantShellNames = [
  "Black Anvil Smithy",
  "Player Services Hall",
  "Copper Kettle Inn",
  "Green Mortar Apothecary",
  "Wyrm and Candle Magic Shop",
  "Reeve Hall",
  "Dock Ledger Warehouse",
  "Guard Barracks",
  "Stable Yard Office",
  "Roadside Family Cottage",
];
const missingImportant = importantShellNames.filter((name) => !buildingShells.some((shell) => shell.name === name));
check("all important interior/service buildings are included in the enterability sweep", missingImportant.length === 0, missingImportant);
check("Black Anvil / weapon shop is explicitly covered by the enterability test", !!blackAnvil, "Black Anvil Smithy shell missing");

check(
  "town placement suite includes the all-interior enterability regression test",
  suiteSrc.includes("test-harthmere-all-interior-building-enterability-v31.cjs"),
);

console.log("");
console.log(`RESULT: ${failures === 0 ? "PASS" : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);

