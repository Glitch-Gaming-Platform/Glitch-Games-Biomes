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
  "route has Grove, connector, Harthmere Bridge Center descent, and extension-boundary anchors",
  route.includes("[560, -182]") &&
    route.includes("[640, -209]") &&
    route.includes("896, -209") &&
    route.includes("903, -209") &&
    route.includes("HARTHMERE_CONNECTOR_DESCENT_LANDING_Y = 56") &&
    route.includes("1780, -209") &&
    route.includes("1792, -209")
);
check(
  "route planner enforces a one-block player grade",
  route.includes("if (rise > 1) continue")
);
check(
  "route planner provides a protected, graded town approach",
  route.includes("engineeredConnectorSegment") &&
    route.includes("Harthmere extension boundary stair") &&
    route.includes("passage_clearance") &&
    route.includes("approach_fill") &&
    route.includes("approach_cap")
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
  materializer.includes("validateEdits(") &&
    materializer.indexOf("validateEdits(") <
      materializer.indexOf("await applyEdits(")
);
check(
  "materializer verifies a collidable floor and three blocks of headroom after edits",
  materializer.includes("validatePostEditTraversal") &&
    materializer.includes("missing_collidable_floor") &&
    materializer.includes("blocked_headroom")
);
check(
  "materializer makes traversal headroom authoritative over overlapping approach caps",
  materializer.includes("enforceTraversalHeadroom") &&
    materializer.lastIndexOf("enforceTraversalHeadroom(") <
      materializer.indexOf("const editFailures = validateEdits(")
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
  "connector terrain is the final writer after Harthmere world sync",
  deploy.lastIndexOf("materialize_production_harthmere_connector_route") >
    deploy.lastIndexOf(
      "node scripts/harthmere/reconcile-production-world-sync.cjs"
    )
);
check(
  "production route reconciliation has an explicit emergency skip",
  deploy.includes("HARTHMERE_SKIP_CONNECTOR_ROUTE_MATERIALIZATION")
);

console.log("PASS harthmere connector route materialization contract");
