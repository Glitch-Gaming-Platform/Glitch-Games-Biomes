#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const route = read("src/shared/harthmere/harthmere_connector_route.ts");
const groveContent = read("src/shared/harthmere/snapshot_grove_content.ts");
const worldMapLandmarks = read("src/pages/api/world_map/landmarks.ts");
const materializer = read(
  "scripts/harthmere/materialize-harthmere-connector-route.cjs"
);
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke.sh");

function check(message, condition) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

check(
  "route has Grove, connector, and west-gate anchors",
  route.includes("[560, -182]") &&
    route.includes("[640, -209]") &&
    route.includes("[896, -209]")
);
check(
  "route planner enforces a one-block player grade",
  route.includes("if (rise > 1) continue")
);
check(
  "route planner provides a terrain-matched west-gate stair",
  route.includes("westGateStairEdits") &&
    route.includes("landingColumn.surfaceY - startColumn.surfaceY")
);
check(
  "road beginning and end have dedicated visible world-map markers",
  groveContent.includes('id: "harthmere_road_grove_trailhead"') &&
    groveContent.includes('id: "harthmere_road_west_gate"') &&
    groveContent.includes('label: "Harthmere Road — Grove Trailhead"') &&
    groveContent.includes('label: "Harthmere Road — West Gate"')
);
check(
  "connector endpoint pins are appended outside the optional mission gate",
  worldMapLandmarks.includes(
    "appendHarthmereConnectorWorldMapLandmarks(scanned)"
  ) &&
    worldMapLandmarks.indexOf(
      "appendHarthmereConnectorWorldMapLandmarks(scanned)"
    ) > worldMapLandmarks.indexOf("async ({ context: { askApi } })")
);
check(
  "materializer protects placeables, groups, and occupied voxels",
  materializer.includes('"placeable_component"') &&
    materializer.includes('"group_component"') &&
    materializer.includes('"grouped_entities"') &&
    materializer.includes(":occupied_voxel")
);
check(
  "materializer validates every destructive edit before writing",
  materializer.includes("validateEdits(edits") &&
    materializer.indexOf("validateEdits(edits") <
      materializer.indexOf("await applyEdits(")
);
check(
  "materializer supports a read-only packaged-snapshot audit",
  materializer.includes("SNAPSHOT_PATH=snapshot_backup.json") &&
    materializer.includes("APPLY=1 is not supported with SNAPSHOT_PATH")
);
check(
  "production reconciliation applies the connector route",
  deploy.includes("materialize_production_harthmere_connector_route") &&
    deploy.includes("materialize-harthmere-connector-route.cjs")
);
check(
  "production route reconciliation has an explicit emergency skip",
  deploy.includes("HARTHMERE_SKIP_CONNECTOR_ROUTE_MATERIALIZATION")
);

console.log("PASS harthmere connector route materialization contract");
