#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadTown, normalizeDistrict, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const reporter = makeReporter("Harthmere residential/slums vertical housing v38", root);
const town = loadTown(root);
const manifestPath = path.join(root, "src/shared/harthmere/resident_housing_v38.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const manifest = fs.readFileSync(manifestPath, "utf8");
const suite = fs.existsSync(suitePath) ? fs.readFileSync(suitePath, "utf8") : "";
const assets = town.assetsSrc;

const actors = town.placements.filter((p) => p.kind === "A");
const humanoids = actors.filter((p) => p.asset.startsWith("townsperson_"));
const animals = actors.filter((p) => p.asset.startsWith("animal_"));
const mudden = actors.filter((p) => normalizeDistrict(p.district) === "mudden_ward");
const townNonWild = actors.filter((p) => normalizeDistrict(p.district) !== "wilds");

function countMatches(src, re) {
  return [...src.matchAll(re)].length;
}

function parseBuildings(arrayName) {
  const start = manifest.indexOf(`export const ${arrayName}`);
  if (start < 0) return [];
  const open = manifest.indexOf("[", start);
  const close = manifest.indexOf("] as const", open);
  const block = manifest.slice(open + 1, close);
  return [...block.matchAll(/\{([^{}]+)\}/g)].map((m) => {
    const body = m[1];
    const getString = (key) => body.match(new RegExp(`${key}:\\s*\"([^\"]+)\"`))?.[1];
    const getNumber = (key) => {
      const raw = body.match(new RegExp(`${key}:\\s*([^,]+)`))?.[1]?.trim();
      if (!raw) return undefined;
      if (raw === "Math.PI") return Math.PI;
      if (raw === "-Math.PI / 2") return -Math.PI / 2;
      if (raw === "Math.PI / 2") return Math.PI / 2;
      return Number(raw);
    };
    return {
      id: getString("id"),
      name: getString("name"),
      district: getString("district"),
      style: getString("style"),
      x: getNumber("x"),
      z: getNumber("z"),
      w: getNumber("w"),
      d: getNumber("d"),
      floors: getNumber("floors"),
      roomsPerFloor: getNumber("roomsPerFloor"),
      stairDx: getNumber("stairDx"),
      stairDz: getNumber("stairDz"),
    };
  });
}

const residentialBuildings = parseBuildings("HARTHMERE_RESIDENTIAL_HOUSE_BUILDINGS_V38");
const slumBuildings = parseBuildings("HARTHMERE_SLUM_STACK_BUILDINGS_V38");
const residentialCapacity = residentialBuildings.reduce((sum, b) => sum + b.floors * b.roomsPerFloor, 0);
const slumCapacity = slumBuildings.reduce((sum, b) => sum + b.floors * b.roomsPerFloor, 0);

reporter.check("v38 manifest exists and exports the resident housing version", /HARTHMERE_RESIDENT_HOUSING_VERSION_V38/.test(manifest) && /harthmere-resident-slum-vertical-housing-v38/.test(manifest));
reporter.check("current authored NPC count is recorded", actors.length === 189 && /HARTHMERE_RESIDENT_HOUSING_EXPECTED_NPC_COUNT_V38\s*=\s*189/.test(manifest), `actors=${actors.length}`);
reporter.check("humanoid, animal, Mudden, and town counts are recorded", humanoids.length === 130 && animals.length === 59 && mudden.length === 14 && townNonWild.length === 122, [`humanoids=${humanoids.length}`, `animals=${animals.length}`, `mudden=${mudden.length}`, `townNonWild=${townNonWild.length}`]);
reporter.check("every NPC receives a home assignment through the runtime assignment summary", /createHarthmereResidentHomeAssignmentSummaryV38/.test(assets) && /allHaveHome/.test(manifest) && /assignments\.every/.test(manifest));
reporter.check("renderer exposes the resident housing summary for runtime inspection", /__harthmereResidentHousingV38/.test(assets) && /harthmereResidentHousingSummaryV38/.test(assets));

reporter.check("Residential District has a real expansion of nice houses", residentialBuildings.length >= 10, residentialBuildings.map((b) => b.name));
reporter.check("all residential houses are exactly two stories", residentialBuildings.every((b) => b.floors === 2), residentialBuildings.map((b) => `${b.name}: ${b.floors}`));
reporter.check("residential capacity can house all non-Mudden town humanoids and service NPCs", residentialCapacity >= 100, `capacity=${residentialCapacity}`);
reporter.check("residential rooms are dense enough to make every resident count meaningful", residentialBuildings.every((b) => b.roomsPerFloor >= 6), residentialBuildings.map((b) => `${b.name}: ${b.roomsPerFloor}`));

reporter.check("Mudden Ward has multiple vertical slum stacks", slumBuildings.length >= 3, slumBuildings.map((b) => b.name));
reporter.check("slum stacks are 4-5 stories", slumBuildings.every((b) => b.floors >= 4 && b.floors <= 5), slumBuildings.map((b) => `${b.name}: ${b.floors}`));
reporter.check("slum capacity is larger than current Mudden NPC count", slumCapacity >= mudden.length, `slumCapacity=${slumCapacity}; mudden=${mudden.length}`);

reporter.check("renderer creates v38 residential/slum placements", /function createHarthmereResidentHousingV38Placements/.test(assets) && /\.\.\.createHarthmereResidentHousingV38Placements\(\)/.test(assets));
reporter.check("every vertical building generates story-to-story stairs", (/for \(let floor = 1; floor < building\.floors; floor \+= 1\)/.test(assets) && /stair floor \$\{floor\} to \$\{floor \+ 1\} climbable story access clear landing/.test(assets)) || (/createHarthmereBlockStairRunV40/.test(assets) && /block stair riser/.test(assets) && /npc travel tread/.test(assets)));
reporter.check("each floor gets a landing/accessibility marker", /floor \$\{floor \+ 1\} landing clear accessibility anchor visual only/.test(assets) || /hard landing deck block player and NPC accessible/.test(assets));
reporter.check("rooms generate per-floor resident room decor", /for \(let floor = 1; floor <= building\.floors; floor \+= 1\)/.test(assets) && /resident room \$\{item\.role\}/.test(assets));

const niceRoles = ["bed", "storage", "light", "table", "personal", "wall"].filter((role) => new RegExp(`role: \\\"${role}\\\"`).test(manifest));
reporter.check("room decor includes bed, storage, light, table, personal, and wall decoration roles", niceRoles.length === 6, niceRoles);
reporter.check("nice and slum decor both use existing asset keys", ["bed_twin2", "chest_wood_fp", "candlestick_fp", "nightstand", "book_stack_1", "banner_green", "crate_wooden_fp", "candle_1_fp", "stool_fp", "bag_fp", "banner_brown"].every((key) => town.assets.has(key)));

const spacingIssues = [];
for (const building of [...residentialBuildings, ...slumBuildings]) {
  if (Math.abs(building.stairDx) > building.w / 2 - 1.0 || Math.abs(building.stairDz) > building.d / 2 - 1.0) {
    spacingIssues.push(`${building.name} stair is outside interior footprint`);
  }
  if (building.w < 14 || building.d < 12) {
    spacingIssues.push(`${building.name} footprint too small for player interior paths`);
  }
}
reporter.check("stair anchors are inside each building footprint with player clearance", spacingIssues.length === 0, spacingIssues);

const decorClearanceIssues = [];
for (const match of manifest.matchAll(/\{ role: \"([^\"]+)\", asset: \"([^\"]+)\", dx: ([^,]+), dz: ([^,]+),/g)) {
  const role = match[1];
  const dx = Number(match[3]);
  const dz = Number(match[4]);
  if (Number.isFinite(dx) && Number.isFinite(dz) && Math.hypot(dx, dz) < 0.75) {
    decorClearanceIssues.push(`${role} decor too close to room center: ${dx},${dz}`);
  }
}
reporter.check("room decor leaves the center of each room clear for player movement", decorClearanceIssues.length === 0, decorClearanceIssues);

reporter.check("town registry advertises expanded residential/slum housing services", /two_story_accessible_housing/.test(town.registrySrc) && /slum_stack_housing/.test(town.registrySrc) && /resident_home_assignments/.test(town.registrySrc));
reporter.check("town placement suite includes the v38 housing/accessibility regression test", suite.includes("test-harthmere-residential-slums-housing-v38.cjs"));

reporter.finish();
