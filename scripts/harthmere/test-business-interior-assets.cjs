#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const manifestPath = path.join(
  repoRoot,
  "public/assets/harthmere/manifest/business-interiors.json"
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const EXPECTED_ORIGINS = {
  ashline_containment_works: [660, 66, -55],
  north_anchor_repair_shed: [752, 62, 27],
  glassyard_biome_studio: [1171, 45, 128],
  redoubt_contract_yard: [1438, 46, 66],
  eastgate_portal_office: [1564, 65, -147],
  southplot_rare_foods: [1711, 49, -598],
  cinderlane_tool_forge: [1616, 42, -791],
  moonstall_ward_shop: [1715, 26, -916],
  westtrail_guide_table: [1529, 51, -705],
  keylot_property_office: [1217, 53, -799],
  brightcart_general_house: [974, 52, -944],
  ridgecooler_larder: [762, 36, -678],
  greenlamp_walk_in_clinic: [642, 64, -193],
  returnstone_pad_office: [30, 40, -40],
  clearbarrel_cleanup_yard: [423, 44, -357],
  hingehall_repair_shop: [415, 45, -328],
  redpot_service_kitchen: [411, 43, -393],
  stampspur_courier_office: [737, 46, -562],
  lanternrest_road_inn: [592, 47, -495],
};

const EXPANDED = new Set([
  "north_anchor_repair_shed",
  "greenlamp_walk_in_clinic",
  "hingehall_repair_shop",
  "redpot_service_kitchen",
  "stampspur_courier_office",
]);

function publicFile(url) {
  assert.ok(url.startsWith("/assets/"), `not a public URL: ${url}`);
  return path.join(repoRoot, "public", url.slice(1));
}

function parseGlb(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${file} is not GLB`);
  assert.equal(data.readUInt32LE(4), 2, `${file} is not glTF 2`);
  const jsonLength = data.readUInt32LE(12);
  assert.equal(data.toString("ascii", 16, 20), "JSON");
  return {
    bytes: data.length,
    json: JSON.parse(
      data
        .toString("utf8", 20, 20 + jsonLength)
        .replace(/[\u0000\u0020]+$/g, "")
    ),
  };
}

function projectedAabb(box) {
  const angle = ((box.rotationDegrees || 0) * Math.PI) / 180;
  const halfX =
    (Math.abs(Math.cos(angle)) * box.size[0] +
      Math.abs(Math.sin(angle)) * box.size[1]) /
    2;
  const halfY =
    (Math.abs(Math.sin(angle)) * box.size[0] +
      Math.abs(Math.cos(angle)) * box.size[1]) /
    2;
  return {
    xMin: box.center[0] - halfX,
    xMax: box.center[0] + halfX,
    yMin: box.center[1] - halfY,
    yMax: box.center[1] + halfY,
    zMin: box.center[2] - box.size[2] / 2,
    zMax: box.center[2] + box.size[2] / 2,
  };
}

function intersects(a, b) {
  return (
    a.xMin < b.xMax &&
    a.xMax > b.xMin &&
    a.yMin < b.yMax &&
    a.yMax > b.yMin &&
    (b.zMin === undefined || (a.zMin < b.zMax && a.zMax > b.zMin))
  );
}

function pointInside(aabb, point) {
  return (
    point[0] > aabb.xMin &&
    point[0] < aabb.xMax &&
    point[1] > aabb.yMin &&
    point[1] < aabb.yMax &&
    point[2] >= aabb.zMin &&
    point[2] <= aabb.zMax
  );
}

const NAV_STEP_METERS = 0.5;
const NAV_ACTOR_RADIUS_METERS = 0.3;

function distanceToRect(point, rect) {
  const dx =
    point[0] < rect.xMin
      ? rect.xMin - point[0]
      : point[0] > rect.xMax
        ? point[0] - rect.xMax
        : 0;
  const dy =
    point[1] < rect.yMin
      ? rect.yMin - point[1]
      : point[1] > rect.yMax
        ? point[1] - rect.yMax
        : 0;
  return Math.hypot(dx, dy);
}

function routeExists(width, depth, obstacles, start, isGoal) {
  const columns = Math.floor(width / NAV_STEP_METERS);
  const rows = Math.floor(depth / NAV_STEP_METERS);
  const pointFor = (xIndex, yIndex) => [
    (xIndex + 0.5) * NAV_STEP_METERS,
    (yIndex + 0.5) * NAV_STEP_METERS,
  ];
  const blocked = (point) =>
    obstacles.some(
      ({ aabb }) =>
        point[0] > aabb.xMin - NAV_ACTOR_RADIUS_METERS &&
        point[0] < aabb.xMax + NAV_ACTOR_RADIUS_METERS &&
        point[1] > aabb.yMin - NAV_ACTOR_RADIUS_METERS &&
        point[1] < aabb.yMax + NAV_ACTOR_RADIUS_METERS
    );
  const startX = Math.max(
    0,
    Math.min(columns - 1, Math.floor(start[0] / NAV_STEP_METERS))
  );
  const startY = Math.max(
    0,
    Math.min(rows - 1, Math.floor(start[1] / NAV_STEP_METERS))
  );
  const startPoint = pointFor(startX, startY);
  if (blocked(startPoint)) return false;

  const queue = [[startX, startY]];
  const visited = new Set([`${startX}:${startY}`]);
  for (let head = 0; head < queue.length; head += 1) {
    const [xIndex, yIndex] = queue[head];
    const point = pointFor(xIndex, yIndex);
    if (isGoal(point)) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nextX = xIndex + dx;
      const nextY = yIndex + dy;
      if (nextX < 0 || nextX >= columns || nextY < 0 || nextY >= rows) {
        continue;
      }
      const key = `${nextX}:${nextY}`;
      if (visited.has(key)) continue;
      const nextPoint = pointFor(nextX, nextY);
      if (blocked(nextPoint)) continue;
      visited.add(key);
      queue.push([nextX, nextY]);
    }
  }
  return false;
}

function routeToPoint(width, depth, obstacles, start, goal) {
  return routeExists(
    width,
    depth,
    obstacles,
    start,
    (point) => Math.hypot(point[0] - goal[0], point[1] - goal[1]) <= 0.4
  );
}

function routeToFixture(width, depth, obstacles, starts, target) {
  return starts.some((start) =>
    routeExists(width, depth, obstacles, start, (point) => {
      const distance = distanceToRect(point, target.aabb);
      return (
        distance >= NAV_ACTOR_RADIUS_METERS &&
        distance <= NAV_ACTOR_RADIUS_METERS + 0.65
      );
    })
  );
}

assert.equal(manifest.businesses.length, 19, "must generate all 19 businesses");
assert.equal(new Set(manifest.businesses.map((entry) => entry.slug)).size, 19);

let totalGlbBytes = 0;
let maximumGlbBytes = 0;
let maximumDrawCount = 0;
let fixtureCount = 0;
let collisionCount = 0;
let verifiedNavigationRoutes = 0;

for (const business of manifest.businesses) {
  assert.deepEqual(
    business.shellOrigin,
    EXPECTED_ORIGINS[business.slug],
    `${business.slug} origin drifted from the audited world coordinate`
  );
  assert.equal(
    business.expandedFromCurrent,
    EXPANDED.has(business.slug),
    `${business.slug} expansion flag`
  );
  assert.deepEqual(business.assetWorldAnchor, [
    business.shellOrigin[0],
    business.shellOrigin[1] + 1,
    business.shellOrigin[2],
  ]);

  const deskLocal =
    business.footprint.width === 28 ? [14.5, 16.5] : [12.5, 14.5];
  assert.deepEqual(business.deskWorldPivot, [
    business.shellOrigin[0] + deskLocal[0],
    business.shellOrigin[1] + 1,
    business.shellOrigin[2] + deskLocal[1],
  ]);

  fixtureCount += business.fixtures.length;
  collisionCount += business.collisionBoxes.length;
  const aabbs = business.collisionBoxes.map((box) => ({
    label: box.label,
    aabb: projectedAabb(box),
  }));

  for (const { label, aabb } of aabbs) {
    assert.ok(
      aabb.xMin >= 0 && aabb.xMax <= business.footprint.width,
      `${business.slug}/${label} outside X bounds`
    );
    assert.ok(
      aabb.yMin >= 0 && aabb.yMax <= business.footprint.depth,
      `${business.slug}/${label} outside Y bounds`
    );
    for (const [name, point] of Object.entries(business.interactionPoints)) {
      if (name === "entrance") continue;
      assert.equal(
        pointInside(aabb, point),
        false,
        `${business.slug}/${label} blocks ${name}`
      );
    }
  }

  for (let left = 0; left < aabbs.length; left += 1) {
    for (let right = left + 1; right < aabbs.length; right += 1) {
      assert.equal(
        intersects(aabbs[left].aabb, aabbs[right].aabb),
        false,
        `${business.slug}: ${aabbs[left].label} overlaps ${aabbs[right].label}`
      );
    }
  }

  const protectedAisle = {
    ...business.protectedAisle,
    zMin: -0.1,
    zMax: 3.5,
  };
  for (const { label, aabb } of aabbs) {
    assert.equal(
      intersects(aabb, protectedAisle),
      false,
      `${business.slug}/${label} blocks the entrance-to-counter aisle`
    );
  }

  if (business.stairKeepClear) {
    const stair = { ...business.stairKeepClear, zMin: -0.1, zMax: 3.5 };
    for (const { label, aabb } of aabbs) {
      assert.equal(
        intersects(aabb, stair),
        false,
        `${business.slug}/${label} blocks the internal stair`
      );
    }
  }

  const firstFloorObstacles = aabbs.filter((entry) => entry.aabb.zMin < 3.5);
  const upperFloorObstacles = aabbs.filter((entry) => entry.aabb.zMin >= 3.5);
  const doorInside = [business.interactionPoints.entrance[0], 0.25];
  const queueStart = business.interactionPoints.queueStart;
  const customer = business.interactionPoints.customer;
  const staff = business.interactionPoints.staff;
  for (const [label, start, goal] of [
    ["entrance-to-queue", doorInside, queueStart],
    ["queue-to-counter", queueStart, customer],
    ["customer-exit", customer, doorInside],
  ]) {
    assert.equal(
      routeToPoint(
        business.footprint.width,
        business.footprint.depth,
        firstFloorObstacles,
        start,
        goal
      ),
      true,
      `${business.slug} has no ${label} route`
    );
    verifiedNavigationRoutes += 1;
  }

  for (const target of firstFloorObstacles) {
    assert.equal(
      routeToFixture(
        business.footprint.width,
        business.footprint.depth,
        firstFloorObstacles,
        [customer, staff, doorInside],
        target
      ),
      true,
      `${business.slug}/${target.label} has no reachable approach`
    );
    verifiedNavigationRoutes += 1;
  }

  if (business.stairKeepClear) {
    const stairCenter = [
      (business.stairKeepClear.xMin + business.stairKeepClear.xMax) / 2,
      (business.stairKeepClear.yMin + business.stairKeepClear.yMax) / 2,
    ];
    assert.equal(
      routeToPoint(
        business.footprint.width,
        business.footprint.depth,
        firstFloorObstacles,
        staff,
        stairCenter
      ),
      true,
      `${business.slug} staff cannot reach the internal stair`
    );
    verifiedNavigationRoutes += 1;
    for (const target of upperFloorObstacles) {
      assert.equal(
        routeToFixture(
          business.footprint.width,
          business.footprint.depth,
          upperFloorObstacles,
          [stairCenter],
          target
        ),
        true,
        `${business.slug}/${target.label} has no upper-floor stair approach`
      );
      verifiedNavigationRoutes += 1;
    }
  }

  for (const url of [business.assets.lod0, business.assets.lod1]) {
    const file = publicFile(url);
    assert.ok(fs.existsSync(file), `missing ${url}`);
    const { bytes, json } = parseGlb(file);
    totalGlbBytes += bytes;
    maximumGlbBytes = Math.max(maximumGlbBytes, bytes);
    assert.ok(bytes <= 128 * 1024, `${url} exceeds 128 KiB`);
    assert.ok(
      json.extensionsUsed?.includes("EXT_meshopt_compression"),
      `${url} lacks meshopt compression`
    );
    assert.equal(json.textures?.length ?? 0, 0, `${url} has textures`);
    assert.equal(json.images?.length ?? 0, 0, `${url} has images`);
    assert.ok(
      (json.materials?.length ?? 0) <= 9,
      `${url} has too many materials`
    );
    const drawCount = (json.meshes ?? []).reduce(
      (count, mesh) => count + (mesh.primitives?.length ?? 0),
      0
    );
    maximumDrawCount = Math.max(maximumDrawCount, drawCount);
    assert.ok(drawCount <= 9, `${url} has ${drawCount} draw primitives`);
    assert.equal(
      fs.existsSync(file.replace(/\.glb$/, ".raw.glb")),
      false,
      `${url} leaked an uncompressed raw GLB`
    );
  }
}

assert.ok(totalGlbBytes <= 3 * 1024 * 1024, "interior catalogue exceeds 3 MiB");

const previewRoot = path.join(
  repoRoot,
  "output/harthmere-business-interiors/previews"
);
if (fs.existsSync(previewRoot)) {
  for (const business of manifest.businesses) {
    const preview = path.join(previewRoot, `${business.slug}.png`);
    assert.ok(fs.existsSync(preview), `missing preview for ${business.slug}`);
    const data = fs.readFileSync(preview);
    assert.equal(data.readUInt32BE(16), 960, `${business.slug} preview width`);
    assert.equal(data.readUInt32BE(20), 760, `${business.slug} preview height`);
  }
}

console.log(
  JSON.stringify(
    {
      businesses: manifest.businesses.length,
      fixtures: fixtureCount,
      collisionBoxes: collisionCount,
      glbs: manifest.businesses.length * 2,
      totalGlbBytes,
      maximumGlbBytes,
      maximumDrawCount,
      fixtureOverlaps: 0,
      protectedAisleIntrusions: 0,
      stairIntrusions: 0,
      verifiedNavigationRoutes,
    },
    null,
    2
  )
);
