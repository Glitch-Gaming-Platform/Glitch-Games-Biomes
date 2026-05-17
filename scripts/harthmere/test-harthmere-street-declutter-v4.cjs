#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}
check("street declutter version marker exists", assets.includes("HARTHMERE_STREET_DECLUTTER_VERSION_V4"));
check("road intrusion cleanup exists", assets.includes("shouldRemoveRoadIntrusionPlacementV4"));
check("street clutter cleanup exists", assets.includes("shouldRemoveStreetClutterPlacementV4"));
check("cleanup constant exists", assets.includes("HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4") && assets.includes("RUNTIME_PLACEMENTS_V4"));
check("loadAll uses cleaned placements", assets.includes("RUNTIME_PLACEMENTS_V4.map((placement) => placement.asset)") && assets.includes("for (const authoredPlacement of RUNTIME_PLACEMENTS_V4)"));
check("debug window exposes cleanup report", assets.includes("__harthmerePlacementCleanupReport") && assets.includes("debugWindow.__harthmerePlacementCleanupReport = HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4;"));
if (!ok) process.exit(1);
