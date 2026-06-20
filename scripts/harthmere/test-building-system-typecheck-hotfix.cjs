#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failed = 0;
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function ok(cond, msg) { if (cond) console.log(`OK ${msg}`); else { failed++; console.error(`FAIL ${msg}`); } }
console.log("== Building System current typecheck hotfix ==");
const guilds = read("src/client/components/biomes_ui/tabs/GuildsTab.tsx");
ok(guilds.includes("guildBlueprint?.blueprintId"), "GuildsTab uses blueprintId instead of missing id");
ok(guilds.includes("guildBlueprint?.displayName"), "GuildsTab uses displayName instead of missing name");
ok(guilds.includes("guildPlot?.displayName"), "GuildsTab uses plot displayName instead of missing name");
ok(!guilds.includes("guildBlueprint?.id"), "GuildsTab no longer reads missing blueprint id field");
const inventory = read("src/client/components/biomes_ui/tabs/InventoryTab.tsx");
ok(inventory.includes("cell.onClick?.();"), "InventoryTab calls RovingGrid click handler without arguments");
ok(!inventory.includes("cell.onClick?.(event as any)"), "InventoryTab no longer passes event to zero-arg click handler");
const land = read("src/client/components/biomes_ui/tabs/LandTab.tsx");
ok(land.includes("onPreview={previewSelectedBuilding}"), "LandTab wires blueprint preview callback from parent");
ok(land.includes("onOpenDoor={() => runPropertyAction(\"open_door\""), "LandTab wires physical door action into PropertyPanel");
ok(land.includes("onUseStorage={() => runPropertyAction(\"use_storage\""), "LandTab wires physical storage action into PropertyPanel");
ok(land.includes("onStartBusiness={startGeneralBusiness}"), "LandTab wires business start action into PropertyPanel");
ok(land.includes("storageContainers={serverState.storageContainers}"), "LandTab passes storage container records into PropertyPanel");
ok(land.includes("doorLocks={serverState.doorLocks}"), "LandTab passes door lock records into PropertyPanel");
ok(land.includes("businesses={serverState.businesses}"), "LandTab passes business records into PropertyPanel");
ok(!land.includes("GhostPreviewPanel plot={plot}"), "LandTab has no out-of-scope plot variable in PlotsPanel");
ok(land.includes("onPreview: () => void;"), "BlueprintPanel props include preview handler");
const route = read("src/pages/api/harthmere/live_mode.ts");
ok(route.includes("id: voxelShard(...edit.position) as unknown as BiomesId"), "live_mode casts voxel shard id to BiomesId for EditEvent type safety");
const shared = read("src/shared/harthmere/building_system.ts");
ok(shared.includes("recurringDemand: readonly string[]"), "business recurringDemand type accepts readonly catalogue arrays");
ok(shared.includes("connectedBusinesses: readonly BuildingSystemBusinessType[]"), "business connectedBusinesses type accepts readonly catalogue arrays");
const backend = read("src/shared/harthmere/live_mode_backend.ts");
ok(backend.includes("includes(stage as any)"), "backend construction-stage includes avoids completed-stage literal mismatch");
ok(backend.includes("indexOf(stage as any)"), "backend construction-stage indexOf avoids completed-stage literal mismatch");
if (failed) {
  console.error(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
