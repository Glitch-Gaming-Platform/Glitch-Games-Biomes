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

function envelope(actionKind, payload = {}, actorId = "player-building-v3") {
  const suffix = `${payload.buildingAction || actionKind}-${payload.plotId || payload.stage || Math.random().toString(36).slice(2)}`;
  return {
    requestId: `req-${suffix}-${Math.random().toString(36).slice(2)}`,
    idempotencyKey: `idem-${suffix}-${Math.random().toString(36).slice(2)}`,
    actorId,
    actionKind,
    subsystem: "building",
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

function apply(state, payload, now = 2000) {
  const { reduceHarthmereLiveModeBackendStateV1 } = require("../../src/shared/harthmere/live_mode_backend_v1");
  return reduceHarthmereLiveModeBackendStateV1(
    state,
    envelope("request_property_building_mutation", payload),
    now
  );
}

function labels(result) {
  return (result.summary.buildingMaterializationPlans || []).flatMap((plan) =>
    (plan.edits || []).map((edit) => edit.label)
  );
}

function project(state, plotId = "grove_muckstead_cottage_lot") {
  return Object.values(state.building.activeProjects).find((entry) => entry.plotId === plotId);
}

console.log("== Building System production integration v3 ==");

const catalogSource = read("src/shared/harthmere/building_system_v1.ts");
const backendSource = read("src/shared/harthmere/live_mode_backend_v1.ts");
const routeSource = read("src/pages/api/harthmere/live_mode.ts");
const landTabSource = read("src/client/components/biomes_ui/tabs/LandTab.tsx");
const adapterSource = read("src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts");

check(catalogSource.includes("BUILDING_SYSTEM_MATERIAL_CATALOG_V1"), "building materials have a shared server catalogue");
check(catalogSource.includes("bikkieId: BikkieIds.cobblestone") && catalogSource.includes("itemId: String(BikkieIds"), "material catalogue maps symbolic materials to real Bikkie item ids");
check(catalogSource.includes("createBuildingSystemStageMaterializationPlanV1"), "stage-specific voxel materialization planner exists");
check(catalogSource.includes('stage === "foundation"') && catalogSource.includes('stage === "walls"') && catalogSource.includes('stage === "roof"'), "foundation, walls, and roof are separate materialization stages");
check(catalogSource.includes('label: "boundary_marker"') && catalogSource.includes('label: "deed_marker"') && catalogSource.includes('label: "map_marker"'), "plot claim emits in-world boundary, deed, and map markers");
check(backendSource.includes("activeProjects") && backendSource.includes("stageProgress"), "backend persists authoritative construction projects and stage progress");
check(backendSource.includes("buildingSystemRemainingMaterialItemDeltasV1"), "backend consumes materials through real item deltas");
check(backendSource.includes("duplicate_stage_contribution") && backendSource.includes("stage_out_of_order"), "backend rejects duplicate and out-of-order stage contributions");
check(routeSource.includes("buildingState") && routeSource.includes("createHarthmereLiveModeBuildingClientSnapshotV1"), "live_mode returns server-hydrated Building System state");
check(!landTabSource.includes("localStorage") && !adapterSource.includes("localStorage"), "BiomesUI no longer uses local storage as building truth");
check(landTabSource.includes('submit("read_state"') && landTabSource.includes('submit("start_construction"'), "BiomesUI hydrates from backend and starts server projects");
check(landTabSource.includes("contributeAll: true") && landTabSource.includes("laborDelta"), "BiomesUI submits server-side staged material/labor contributions");

installTypeScriptRuntime();

const {
  BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1,
  BUILDING_SYSTEM_MATERIAL_CATALOG_V1,
  buildingSystemBlueprintByIdV1,
  buildingSystemMaterialRequirementLinesV1,
  createBuildingSystemStageMaterializationPlanV1,
} = require("../../src/shared/harthmere/building_system_v1");
const {
  createHarthmereLiveModeBuildingClientSnapshotV1,
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeBackendStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");

const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_cottage_tier_1");
check(Boolean(blueprint), "voxel cottage blueprint exists for v3 tests");
check(BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.join(">") === "site_preparation>foundation>frame>walls>roof>interior>utility_setup", "construction stage order is explicit and excludes completed as an action stage");
check(Object.values(BUILDING_SYSTEM_MATERIAL_CATALOG_V1).every((entry) => /^\d+$/.test(entry.itemId)), "all material catalogue entries expose real numeric Bikkie item ids");

let poor = defaultHarthmereLiveModeBackendStateV1("player-building-v3", 1000);
poor.inventory.gold = 100;
poor = apply(poor, { buildingAction: "claim_plot", plotId: "grove_muckstead_cottage_lot" }).state;
poor = apply(poor, { buildingAction: "start_construction", plotId: "grove_muckstead_cottage_lot", blueprintId: "grove_voxel_cottage_tier_1" }).state;
const poorContrib = apply(poor, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "site_preparation", contributeAll: true });
check(poorContrib.summary.warnings.some((w) => w.includes("insufficient_material")), "stage contribution rejects missing inventory materials");
check(project(poorContrib.state).currentStage === "site_preparation", "missing materials do not advance the construction stage");

let state = defaultHarthmereLiveModeBackendStateV1("player-building-v3", 1000);
state.inventory.gold = 500;
for (const entry of Object.values(BUILDING_SYSTEM_MATERIAL_CATALOG_V1)) {
  state.inventory.items[entry.itemId] = 500;
}

let claim = apply(state, { buildingAction: "claim_plot", plotId: "grove_muckstead_cottage_lot" }, 2000);
check(claim.state.building.ownedPlots.includes("grove_muckstead_cottage_lot"), "claim creates owned Grove plot");
check(labels(claim).includes("safe_ground"), "claim emits safe-ground voxels");
check(labels(claim).includes("boundary_marker"), "claim emits boundary marker voxels");
check(labels(claim).includes("deed_marker"), "claim emits deed sign marker voxels");
check(labels(claim).includes("map_marker"), "claim emits map marker voxels");
check(Object.values(claim.state.building.inWorldMarkers).some((m) => m.kind === "deed_sign" && m.label.includes("Purchased by")), "claim persists deed marker metadata with owner label");
state = claim.state;

let blockedGuideStart = apply(state, {
  buildingAction: "start_construction",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
  originZ: -142,
}, 2500);
check(
  blockedGuideStart.summary.warnings.includes("building_project_rejected:preview_warning:doorsill_stair_outside_plot"),
  "start_construction rejects guide-invalid doorsill placement"
);
check(!project(blockedGuideStart.state), "guide-invalid start_construction does not create a project");

let blockedGuidePlace = apply(state, {
  buildingAction: "place",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
  originZ: -142,
}, 2600);
check(
  blockedGuidePlace.summary.warnings.includes("building_rejected:preview_warning:doorsill_stair_outside_plot"),
  "direct place rejects guide-invalid doorsill placement"
);
check(
  !blockedGuidePlace.state.property.owned.property_grove_muckstead_cottage_lot,
  "guide-invalid direct place does not create a property"
);

let start = apply(state, { buildingAction: "start_construction", plotId: "grove_muckstead_cottage_lot", blueprintId: "grove_voxel_cottage_tier_1" }, 3000);
let active = project(start.state);
check(Boolean(active), "start_construction creates an authoritative active project");
check(active.currentStage === "site_preparation", "new project starts at site preparation");
check((start.summary.buildingMaterializationPlans || []).length === 0, "start_construction does not spawn the whole building");
check(start.state.property.buildingProgress.property_grove_muckstead_cottage_lot === 0, "new project persists zero building progress");
state = start.state;

const roughStoneItemId = BUILDING_SYSTEM_MATERIAL_CATALOG_V1.rough_stone.itemId;
const beforePartialStone = state.inventory.items[roughStoneItemId];
let partial = apply(state, {
  buildingAction: "contribute_stage",
  plotId: "grove_muckstead_cottage_lot",
  stage: "site_preparation",
  materials: { rough_stone: 2 },
  laborDelta: 5,
}, 4000);
active = project(partial.state);
check(partial.state.inventory.items[roughStoneItemId] === beforePartialStone - 2, "partial material submission consumes real Bikkie item count");
check(active.stageProgress.site_preparation.materials.rough_stone === 2, "partial material submission persists symbolic progress server-side");
check(active.currentStage === "site_preparation", "partial material submission does not complete the stage early");
check(!(partial.summary.buildingMaterializationPlans || []).length, "partial material submission does not emit stage voxels until stage completion");
state = partial.state;

let prep = apply(state, {
  buildingAction: "contribute_stage",
  plotId: "grove_muckstead_cottage_lot",
  stage: "site_preparation",
  contributeAll: true,
  laborDelta: 99,
}, 5000);
active = project(prep.state);
check(active.completedStages.includes("site_preparation"), "site preparation completes after remaining materials and labor");
check(active.currentStage === "foundation", "site preparation advances to foundation");
check(labels(prep).includes("boundary_marker") && !labels(prep).includes("foundation"), "site preparation shows boundary feedback without foundation voxels");
state = prep.state;

let outOfOrder = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "walls", contributeAll: true, laborDelta: 99 }, 6000);
check(outOfOrder.summary.warnings.includes("building_stage_rejected:stage_out_of_order"), "out-of-order wall contribution is rejected before foundation");
let duplicatePrep = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "site_preparation", contributeAll: true, laborDelta: 99 }, 6100);
check(duplicatePrep.summary.warnings.includes("building_stage_rejected:duplicate_stage_contribution"), "duplicate completed stage contribution is rejected");

let foundation = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "foundation", contributeAll: true, laborDelta: 99 }, 7000);
check(labels(foundation).includes("foundation") && labels(foundation).includes("floor"), "foundation stage emits only foundation and walkable floor voxels");
check(!labels(foundation).includes("wall") && !labels(foundation).includes("roof"), "foundation stage does not emit walls or roof early");
state = foundation.state;

let frame = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "frame", contributeAll: true, laborDelta: 99 }, 8000);
check(labels(frame).includes("frame"), "frame stage emits frame voxels");
state = frame.state;

let walls = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "walls", contributeAll: true, laborDelta: 99 }, 9000);
check(labels(walls).includes("wall"), "walls stage emits wall voxels");
check(!labels(walls).includes("roof"), "walls stage does not emit roof early");
state = walls.state;

let roof = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "roof", contributeAll: true, laborDelta: 99 }, 10000);
check(labels(roof).includes("roof"), "roof stage emits standable roof voxels");
state = roof.state;

let interior = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "interior", contributeAll: true, laborDelta: 99 }, 11000);
check(labels(interior).includes("interior") || labels(interior).includes("stair"), "interior stage emits interior/stair voxels");
check(!interior.state.property.owned.property_grove_muckstead_cottage_lot, "interior stage does not unlock property storage yet");
state = interior.state;

let utility = apply(state, { buildingAction: "contribute_stage", plotId: "grove_muckstead_cottage_lot", stage: "utility_setup", contributeAll: true, laborDelta: 99 }, 12000);
active = project(utility.state);
check(active.status === "completed" && active.currentStage === "completed", "utility setup completes the construction project");
check(active.storageUnlocked === true, "storage unlocks only when project is completed");
check(utility.state.property.owned.property_grove_muckstead_cottage_lot.status === "home", "completed construction creates the property deed");
check(utility.state.property.buildingProgress.property_grove_muckstead_cottage_lot === 100, "completed construction persists 100 percent progress");
check(Object.values(utility.state.building.placedStructures).some((entry) => entry.plotId === "grove_muckstead_cottage_lot" && entry.materializedInEcs === true), "completed construction persists materialized ECS/world structure record");
state = utility.state;

const snapshot = createHarthmereLiveModeBuildingClientSnapshotV1(state);
check(snapshot.ownedPlotIds.includes("grove_muckstead_cottage_lot"), "server building snapshot includes owned plots for UI hydration");
check(Boolean(snapshot.activeProjects.project_grove_muckstead_cottage_lot), "server building snapshot includes active/completed project records");
check(Boolean(snapshot.completedProperties.property_grove_muckstead_cottage_lot), "server building snapshot includes completed properties");
const reparsed = parseHarthmereLiveModeBackendStateV1(JSON.stringify(state), "player-building-v3", 13000);
check(Boolean(reparsed.building.activeProjects.project_grove_muckstead_cottage_lot), "building project state survives reload/Redis serialization");
check(Boolean(createHarthmereLiveModeBuildingClientSnapshotV1(reparsed).completedProperties.property_grove_muckstead_cottage_lot), "second session/device can hydrate completed property from server state");

const foundationPlan = createBuildingSystemStageMaterializationPlanV1({
  requestId: "direct-foundation-plan",
  actorId: "player-building-v3",
  projectId: "project_grove_muckstead_cottage_lot",
  plot: require("../../src/shared/harthmere/building_system_v1").buildingSystemPlotByIdV1("grove_muckstead_cottage_lot"),
  blueprint,
  stage: "foundation",
  activatedAtMs: 14000,
});
const directFoundationLabels = foundationPlan.edits.map((edit) => edit.label);
check(directFoundationLabels.includes("foundation") && directFoundationLabels.includes("floor"), "direct foundation stage plan creates floor/foundation only");
check(!directFoundationLabels.includes("wall") && !directFoundationLabels.includes("roof"), "direct foundation stage plan does not leak later stages");

for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1) {
  const lines = buildingSystemMaterialRequirementLinesV1({ blueprint, stage });
  check(lines.every((line) => /^\d+$/.test(line.itemId)), `stage ${stage} material lines use real Bikkie item ids`);
}

for (const rel of [
  "src/shared/harthmere/building_system_v1.ts",
  "src/shared/harthmere/live_mode_backend_v1.ts",
  "src/pages/api/harthmere/live_mode.ts",
  "src/client/components/biomes_ui/tabs/LandTab.tsx",
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts",
]) {
  let ts;
  try { ts = require("typescript"); } catch (_) { ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript"); }
  const source = read(rel);
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
    },
    fileName: path.join(repoRoot, rel),
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
  check(errors.length === 0, `${rel} transpiles without syntax errors`, errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, "\n")).join("\n"));
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
