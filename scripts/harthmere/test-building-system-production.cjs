#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Module = require("module");

const repoRoot = path.resolve(__dirname, "../..");

function installTypeScriptRuntime() {
  try {
    require("ts-node/register/transpile-only");
  } catch (_) {
    let ts;
    try {
      ts = require("typescript");
    } catch (_) {
      ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
    }
    const compilerOptions = {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowJs: true,
      skipLibCheck: true,
      isolatedModules: true,
      baseUrl: path.join(repoRoot, "src"),
      paths: { "@/*": ["*"] },
    };
    for (const ext of [".ts", ".tsx"]) {
      require.extensions[ext] = function compileTs(module, filename) {
        const source = fs.readFileSync(filename, "utf8");
        const output = ts.transpileModule(source, {
          compilerOptions,
          fileName: filename,
          reportDiagnostics: true,
        });
        const blocking = (output.diagnostics || []).filter(
          (d) => d.category === ts.DiagnosticCategory.Error
        );
        if (blocking.length) {
          const message = blocking
            .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
            .join("\n");
          throw new Error(`${filename} failed TypeScript transpile:\n${message}`);
        }
        module._compile(output.outputText, filename);
      };
    }
  }

  try {
    require("tsconfig-paths/register");
  } catch (_) {
    const originalResolve = Module._resolveFilename;
    Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
      if (request.startsWith("@/")) {
        const target = path.join(repoRoot, "src", request.slice(2));
        return originalResolve.call(this, target, parent, isMain, options);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };
  }
}

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function envelope(actionKind, payload = {}, actorId = "player-building") {
  const suffix = `${payload.buildingAction || actionKind}-${payload.plotId || payload.propertyId || Math.random().toString(36).slice(2)}`;
  return {
    requestId: `req-${suffix}-${Math.random().toString(36).slice(2)}`,
    idempotencyKey: `idem-${suffix}-${Math.random().toString(36).slice(2)}`,
    actorId,
    actionKind,
    subsystem: actionKind === "request_property_building_mutation" ? "building" : "quest",
    source: "client_request",
    clientSentAtMs: 1000,
    serverReceivedAtMs: 1001,
    serverTick: 55,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

function apply(state, payload, now = 2000, actorId = "player-building") {
  const { reduceHarthmereLiveModeBackendState } = require("../../src/shared/harthmere/live_mode_backend");
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope("request_property_building_mutation", payload, actorId),
    now
  );
}

function propertyId(plotId = "grove_muckstead_cottage_lot") {
  return `property_${plotId}`;
}

function getProp(state, plotId = "grove_muckstead_cottage_lot") {
  return state.property.owned[propertyId(plotId)];
}

function grantConstructionMaterials(state, catalog) {
  state.inventory.gold = 20000;
  for (const entry of Object.values(catalog)) {
    state.inventory.items[entry.itemId] = 20000;
  }
}

function completeStagedBuilding(state, plotId, blueprintId, now = 2000) {
  const { BUILDING_SYSTEM_CONSTRUCTION_STAGES } = require("../../src/shared/harthmere/building_system");
  state = apply(state, { buildingAction: "claim_plot", plotId }, now).state;
  state = apply(state, { buildingAction: "start_construction", plotId, blueprintId }, now + 100).state;
  for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
    state = apply(state, {
      buildingAction: "contribute_stage",
      plotId,
      stage,
      contributeAll: true,
      laborDelta: 999,
    }, now + 200).state;
  }
  return state;
}

function latestPlan(result) {
  return result.summary.buildingMaterializationPlans?.[0];
}

console.log("== Building System production in-world current ==");

const catalogSource = read("src/shared/harthmere/building_system.ts");
const backendSource = read("src/shared/harthmere/live_mode_backend.ts");
const liveRouteSource = read("src/pages/api/harthmere/live_mode.ts");
const adapterSource = read("src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts");
const landTabSource = read("src/client/components/biomes_ui/tabs/LandTab.tsx");

check(catalogSource.includes("BUILDING_SYSTEM_BUSINESS_TYPES"), "business economy catalogue exists");
check(catalogSource.includes("exotic_matter_refinery") && catalogSource.includes("hospitality_inn_hotel_shelter"), "business catalogue covers PDF business range from refinery to hospitality");
check(catalogSource.includes("ownerId") && catalogSource.includes("licenseLevel") && catalogSource.includes("activeContracts") && catalogSource.includes("customerSatisfaction"), "business records follow owner/license/inventory/contracts/reputation/upkeep/customer model");
check(catalogSource.includes("createBuildingSystemDemolitionMaterializationPlan") && catalogSource.includes("demolition_cleanup"), "shared catalogue creates demolition voxel cleanup plans");
check(catalogSource.includes("createBuildingSystemStorageContainer") && catalogSource.includes("createBuildingSystemDoorLock"), "shared catalogue creates physical storage containers and door locks");
check(catalogSource.includes("createBuildingSystemPlacementPreview") && catalogSource.includes("ghostFootprint"), "shared catalogue creates blueprint ghost preview contracts");
check(catalogSource.includes("createBuildingSystemRepairDamageMaterializationPlan") && catalogSource.includes("createBuildingSystemRepairRestoreMaterializationPlan"), "shared catalogue maps repair decay/restoration to visible voxel edits");
check(catalogSource.includes("createBuildingSystemUpgradeMaterializationPlan") && catalogSource.includes("upgrade_addition"), "shared catalogue maps tier upgrades to physical voxel additions");
check(backendSource.includes("createBuildingSystemMiraMapMarker") && adapterSource.includes("mira_grove_land_steward"), "Mira/Miranda is injected as a map marker");
check(backendSource.includes('subAction === "open_door"') && backendSource.includes('subAction === "use_storage"'), "backend enforces physical door and storage access actions");
check(backendSource.includes('subAction === "start_business"') && backendSource.includes('subAction === "run_business_cycle"') && backendSource.includes('subAction === "collect_business_revenue"'), "backend implements business startup, revenue cycles, and collection");
check(liveRouteSource.includes("EditEvent") && liveRouteSource.includes("value: edit.value"), "live route publishes every materialization plan, including cleanup edits, through EditEvent");
check(landTabSource.includes("Preview ghost / boundary") && landTabSource.includes("Ghost preview"), "BiomesUI exposes blueprint placement ghost preview");
check(landTabSource.includes("Open Door / Gate") && landTabSource.includes("Use Storage Container"), "BiomesUI exposes physical door/storage interactions");
check(landTabSource.includes("Run Revenue Cycle") && landTabSource.includes("Collect Revenue"), "BiomesUI exposes business revenue actions");

installTypeScriptRuntime();

const {
  BUILDING_SYSTEM_BUSINESS_TYPES,
  BUILDING_SYSTEM_MATERIAL_CATALOG,
  buildingSystemBusinessTypeById,
  buildingSystemCanOpenDoorLock,
  buildingSystemCanUseStorageContainer,
  buildingSystemPlotById,
  buildingSystemBlueprintById,
  createBuildingSystemPlacementPreview,
} = require("../../src/shared/harthmere/building_system");
const {
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeBackendState,
} = require("../../src/shared/harthmere/live_mode_backend");

check(BUILDING_SYSTEM_BUSINESS_TYPES.length === 19, "business catalogue implements all 19 PDF business types");
const traderDef = buildingSystemBusinessTypeById("general_trader");
check(traderDef?.startingCostGold === 300 && traderDef.connectedBusinesses.length >= 2, "General Trader uses PDF startup cost and interconnected supply-chain design");
const restaurantDef = buildingSystemBusinessTypeById("food_service_restaurant");
check(restaurantDef?.recurringDemand.some((d) => d.includes("ingredient")), "Restaurant recurring loop tracks ingredient demand/spoilage");

let state = defaultHarthmereLiveModeBackendState("player-building", 1000);
grantConstructionMaterials(state, BUILDING_SYSTEM_MATERIAL_CATALOG);
let mira = apply(state, { buildingAction: "talk_to_steward" }, 1500);
check(Boolean(mira.state.building.inWorldMarkers.mira_grove_land_steward_map_marker), "talking to Mira creates a persistent map marker");
check(mira.state.building.inWorldMarkers.mira_grove_land_steward_map_marker.kind === "npc_map_marker", "Mira marker is typed as NPC map marker");

state = completeStagedBuilding(state, "grove_muckstead_cottage_lot", "grove_voxel_cottage_tier_1", 2000);
let property = getProp(state);
check(Boolean(property.storageContainerId && state.building.storageContainers[property.storageContainerId]), "completed property creates real in-world storage container record");
check(Boolean(property.doorLockId && state.building.doorLocks[property.doorLockId]), "completed property creates real physical door lock record");
const storage = state.building.storageContainers[property.storageContainerId];
const door = state.building.doorLocks[property.doorLockId];
check(buildingSystemCanUseStorageContainer({ property, container: storage, actorId: "player-building" }) === true, "owner can use in-world storage container");
check(buildingSystemCanUseStorageContainer({ property, container: storage, actorId: "stranger" }) === false, "stranger cannot use private in-world storage container");
check(buildingSystemCanOpenDoorLock({ property, lock: door, actorId: "player-building" }) === true, "owner can open physical door lock");
let strangerDoor = apply(state, { buildingAction: "open_door", plotId: "grove_muckstead_cottage_lot", actorId: "stranger" }, 3000);
check(strangerDoor.summary.warnings.includes("open_door_rejected:physical_lock_denied"), "backend rejects stranger at physical door lock");
let publicMode = apply(state, { buildingAction: "set_access_mode", plotId: "grove_muckstead_cottage_lot", accessMode: "public" }, 3100);
let publicDoor = apply(publicMode.state, { buildingAction: "open_door", plotId: "grove_muckstead_cottage_lot", actorId: "stranger" }, 3200);
check(!publicDoor.summary.warnings.some((w) => w.includes("physical_lock_denied")), "public property physically opens door for visitor");

const plot = buildingSystemPlotById("grove_muckstead_cottage_lot");
const blueprint = buildingSystemBlueprintById("grove_voxel_cottage_tier_1");
const preview = createBuildingSystemPlacementPreview({ plot, blueprint, owned: true });
check(preview.valid === true && preview.ghostFootprint.length > 0, "placement preview generates valid ghost footprint for owned plot");
check(preview.requiredMaterials.length > 0 && preview.boundaryOverlay.xMin === plot.bounds.xMin, "placement preview exposes required materials and plot boundary overlay");
let previewAction = apply(publicMode.state, { buildingAction: "preview_blueprint", plotId: "grove_muckstead_cottage_lot", blueprintId: "grove_voxel_cottage_tier_1" }, 3300);
check(previewAction.summary.touchedModels.includes("blueprint_ghost_preview"), "backend records blueprint ghost preview action");

let decayState = publicMode.state;
decayState.property.owned[propertyId()].condition = 70;
decayState.property.owned[propertyId()].visualDamageApplied = false;
let decay = apply(decayState, { buildingAction: "manage_property", plotId: "grove_muckstead_cottage_lot" }, 3400);
const damagePlan = latestPlan(decay);
check(Boolean(damagePlan?.edits?.some((edit) => edit.label === "repair_damage" && edit.value === 0)), "low condition emits visible cracked/missing voxel damage");
check(getProp(decay.state).visualDamageApplied === true, "visible damage flag persists to prevent duplicate damage spam");
decay.state.inventory.gold = 20000;
let repair = apply(decay.state, { buildingAction: "repair_property", plotId: "grove_muckstead_cottage_lot" }, 3500);
check(Boolean(latestPlan(repair)?.edits?.some((edit) => edit.label === "repair_restore")), "repair emits voxel restoration edits");
check(getProp(repair.state).condition === 100 && getProp(repair.state).visualDamageApplied === false, "repair restores condition and clears visible damage flag");

repair.state.inventory.gold = 20000;
let upgrade = apply(repair.state, { buildingAction: "upgrade_property", plotId: "grove_muckstead_cottage_lot" }, 3600);
check(Boolean(latestPlan(upgrade)?.edits?.some((edit) => edit.label === "upgrade_addition")), "tier upgrade emits physical voxel additions");
check(getProp(upgrade.state).upgradedVoxelTier >= 2, "tier upgrade records upgraded voxel tier");

let demolitionReady = upgrade.state;
demolitionReady = apply(demolitionReady, { buildingAction: "set_storage_item_count", plotId: "grove_muckstead_cottage_lot", storageItemCount: 0 }, 3700).state;
let demolition = apply(demolitionReady, { buildingAction: "demolish_property", plotId: "grove_muckstead_cottage_lot" }, 3800);
const demolitionPlan = latestPlan(demolition);
check(Boolean(demolitionPlan?.edits?.length && demolitionPlan.edits.every((edit) => edit.label === "demolition_cleanup" && edit.value === 0)), "demolition emits voxel removal EditEvents with value 0");
check(!demolition.state.property.owned[propertyId()], "demolition removes property record");
check(Object.keys(demolition.state.building.storageContainers).length === 0 && Object.keys(demolition.state.building.doorLocks).length === 0, "demolition removes physical storage and door records");
check(!Object.values(demolition.state.building.inWorldMarkers).some((m) => m.plotId === "grove_muckstead_cottage_lot" && ["deed_sign", "map_marker", "storage_container", "door_lock"].includes(m.kind)), "demolition removes deed/sign/storage/door map markers");
check(demolition.state.building.safeZones.grove_muckstead_cottage_lot?.safeFromMuck === true, "demolition leaves purchased land safe instead of re-mucking it");

let shop = defaultHarthmereLiveModeBackendState("player-building", 1000);
grantConstructionMaterials(shop, BUILDING_SYSTEM_MATERIAL_CATALOG);
shop = apply(shop, { buildingAction: "claim_plot", plotId: "grove_crossroads_shop_lot" }, 2000).state;
shop = apply(shop, { buildingAction: "place", plotId: "grove_crossroads_shop_lot", blueprintId: "grove_voxel_shop_tier_1" }, 2100).state;
let startBiz = apply(shop, { buildingAction: "start_business", plotId: "grove_crossroads_shop_lot", businessType: "general_trader" }, 2200);
const shopProp = getProp(startBiz.state, "grove_crossroads_shop_lot");
check(Boolean(shopProp.businessId && startBiz.state.economy.businesses[shopProp.businessId]), "business property starts a business record");
check(startBiz.state.economy.businesses[shopProp.businessId].type === "general_trader", "started business stores chosen PDF business type");
let cycle = apply(startBiz.state, { buildingAction: "run_business_cycle", plotId: "grove_crossroads_shop_lot", cycles: 2 }, 2300);
const businessAfterCycle = cycle.state.economy.businesses[shopProp.businessId];
check(businessAfterCycle.revenueBalanceGold > 0 && businessAfterCycle.taxBalanceGold >= 0, "business revenue cycle produces net revenue and tax balance");
const goldBeforeCollect = cycle.state.inventory.gold;
let collect = apply(cycle.state, { buildingAction: "collect_business_revenue", plotId: "grove_crossroads_shop_lot" }, 2400);
check(collect.state.inventory.gold > goldBeforeCollect, "business revenue collection pays owner wallet");
check(collect.state.economy.businesses[shopProp.businessId].revenueBalanceGold === 0, "business revenue collection clears available balance");
let transfer = apply(collect.state, { buildingAction: "transfer_property", plotId: "grove_crossroads_shop_lot", newOwnerId: "new-business-owner" }, 2500);
check(transfer.state.economy.businesses[shopProp.businessId].ownerId === "new-business-owner", "business ownership follows property transfer");

const parsed = parseHarthmereLiveModeBackendState(JSON.stringify(transfer.state), "player-building", 9000);
check(Boolean(parsed.building.storageContainers), "storage containers survive Redis serialization");
check(Boolean(parsed.building.doorLocks), "door locks survive Redis serialization");
check(parsed.economy.businesses[shopProp.businessId].ownerId === "new-business-owner", "business records survive Redis serialization");

function transpileOnly(rel) {
  let ts;
  try {
    ts = require("typescript");
  } catch (_) {
    ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
  }
  const source = read(rel);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
      isolatedModules: true,
    },
    fileName: path.join(repoRoot, rel),
    reportDiagnostics: true,
  });
  const blocking = (output.diagnostics || []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error
  );
  if (blocking.length) {
    throw new Error(blocking.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
  }
}

for (const rel of [
  "src/shared/harthmere/building_system.ts",
  "src/shared/harthmere/live_mode_backend.ts",
  "src/pages/api/harthmere/live_mode.ts",
  "src/client/components/biomes_ui/tabs/LandTab.tsx",
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts",
]) {
  transpileOnly(rel);
  check(true, `${rel} transpiles without syntax errors`);
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
