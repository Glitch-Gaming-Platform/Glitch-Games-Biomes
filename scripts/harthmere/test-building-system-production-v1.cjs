#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Module = require("module");

const repoRoot = path.resolve(__dirname, "../..");

function installTypeScriptRuntime() {
  let installedTsNode = false;
  try {
    require("ts-node/register/transpile-only");
    installedTsNode = true;
  } catch (_) {
    let ts;
    try {
      ts = require("typescript");
    } catch (err) {
      try {
        ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
      } catch (_) {
        throw new Error(
          "TypeScript runtime missing. Install project dependencies or make the global typescript package available."
        );
      }
    }
    const compilerOptions = {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.Preserve,
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
        const blocking = (output.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
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

  // Minimal @/ alias support for environments where tsconfig-paths is absent.
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
  return { installedTsNode };
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

function envelope(actionKind, payload = {}, actorId = "player-building-v1") {
  return {
    requestId: `req-${actionKind}-${payload.plotId || payload.blueprintId || Math.random().toString(36).slice(2)}`,
    idempotencyKey: `idem-${actionKind}-${payload.plotId || payload.blueprintId || Math.random().toString(36).slice(2)}`,
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

function apply(state, actionKind, payload, now = 2000) {
  const { reduceHarthmereLiveModeBackendStateV1 } = require("../../src/shared/harthmere/live_mode_backend_v1");
  return reduceHarthmereLiveModeBackendStateV1(state, envelope(actionKind, payload), now);
}

console.log("== Building System production integration v1 ==");

// Static contract checks: these catch regressions even in stripped CI/runtime bundles.
const catalogSource = read("src/shared/harthmere/building_system_v1.ts");
const backendSource = read("src/shared/harthmere/live_mode_backend_v1.ts");
const routeSource = read("src/pages/api/harthmere/live_mode.ts");
const uiSource = read("src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx");
const groveSource = read("src/shared/harthmere/snapshot_grove_content_v75.ts");
const questSource = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");

check(catalogSource.includes("BUILDING_SYSTEM_PLOTS_V1"), "shared Building System plot catalogue exists");
check(catalogSource.includes("grove_muckstead_cottage_lot"), "Grove muck cottage lot is registered");
check(catalogSource.includes("grove_crossroads_shop_lot"), "Grove business lot is registered");
check(catalogSource.includes("grove_guild_green_lot"), "Grove guild lot is registered");
check(catalogSource.includes("materializesSolidVoxelBuilding: true"), "solid voxel building materialization is declared");
check(catalogSource.includes('"foundation"') && catalogSource.includes('"wall"') && catalogSource.includes('"roof"') && catalogSource.includes("pushVoxelBox"), "materialization plan emits foundation/wall/roof voxel edits");
check(!backendSource.includes("terrainColumns: []"), "backend no longer uses empty placeholder terrain columns");
check(!backendSource.includes("plot: undefined"), "backend no longer uses undefined placeholder plot data");
check(!backendSource.includes("hasRoadAccess: true,"), "backend no longer grants placeholder road access");
check(routeSource.includes("new EditEvent") && routeSource.includes("voxelShard"), "server route publishes voxel EditEvents into ECS/world terrain");
check(routeSource.includes('auth: "required"') && routeSource.includes("auth: { userId }"), "server route requires authenticated user identity");
check(routeSource.includes("PlaceGroupEvent"), "server route preserves PlaceGroupEvent path for real pre-created groups");
check(routeSource.includes("logicApi.publish"), "server route materializes approved plans through server-side logic API");
check(uiSource.includes("/api/harthmere/live_mode") && uiSource.includes('credentials: "same-origin"'), "UI calls authenticated server live-mode route");
check(!uiSource.includes("Harthmere Building & Property"), "user-facing UI is renamed to Building System");
check(groveSource.includes("BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1") && groveSource.includes("seedServerNpc: true"), "Grove land steward NPC is seeded");
check(questSource.includes("BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1"), "Grove land steward has a quest/dialogue target");

installTypeScriptRuntime();

const {
  BUILDING_SYSTEM_BLUEPRINTS_V1,
  BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1,
  BUILDING_SYSTEM_PLOTS_V1,
  buildingSystemBlueprintByIdV1,
  buildingSystemDefaultOriginV1,
  buildingSystemPlotByIdV1,
  countBuildingSystemVoxelLabelsV1,
  createBuildingSystemMaterializationPlanV1,
} = require("../../src/shared/harthmere/building_system_v1");
const {
  defaultHarthmereLiveModeBackendStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");

check(BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.idOffset === 9315, "Grove land steward uses stable NPC offset");
check(BUILDING_SYSTEM_PLOTS_V1.every((p) => p.area === "the_grove"), "all new purchasable plots are in the Grove");
check(BUILDING_SYSTEM_PLOTS_V1.every((p) => p.startsMucked && p.safeAfterPurchase), "all Grove purchase plots start mucked and become safe after purchase");
check(new Set(BUILDING_SYSTEM_BLUEPRINTS_V1.map((b) => b.use)).has("home"), "home blueprint exists");
check(new Set(BUILDING_SYSTEM_BLUEPRINTS_V1.map((b) => b.use)).has("business"), "business blueprint exists");
check(new Set(BUILDING_SYSTEM_BLUEPRINTS_V1.map((b) => b.use)).has("guild"), "guild blueprint exists");

for (const plot of BUILDING_SYSTEM_PLOTS_V1) {
  const blueprint = buildingSystemBlueprintByIdV1(plot.allowedBlueprintIds[0]);
  check(Boolean(blueprint), `plot ${plot.plotId} has a real allowed blueprint`);
  const origin = buildingSystemDefaultOriginV1(plot, blueprint);
  const plan = createBuildingSystemMaterializationPlanV1({
    requestId: `plan-${plot.plotId}`,
    actorId: "player-building-v1",
    plot,
    blueprint,
    origin,
    activatedAtMs: 3000,
  });
  const counts = countBuildingSystemVoxelLabelsV1(plan);
  check(plan.materializesSolidVoxelBuilding === true, `plot ${plot.plotId} creates a solid voxel building plan`);
  check((counts.foundation || 0) >= blueprint.footprint.width * blueprint.footprint.depth, `plot ${plot.plotId} has full foundation support`);
  check((counts.floor || 0) >= blueprint.footprint.width * blueprint.footprint.depth, `plot ${plot.plotId} has a walkable floor`);
  check((counts.wall || 0) > 0, `plot ${plot.plotId} has real voxel walls`);
  check((counts.roof || 0) >= blueprint.footprint.width * blueprint.footprint.depth, `plot ${plot.plotId} has a standable roof`);
  check(plan.placeGroup.kind === "placeGroupEvent", `plot ${plot.plotId} carries a PlaceGroupEvent materialization contract`);
}

let state = defaultHarthmereLiveModeBackendStateV1("player-building-v1", 1000);
state.inventory.gold = 500;

let claim = apply(state, "request_property_building_mutation", {
  buildingAction: "claim_plot",
  plotId: "grove_muckstead_cottage_lot",
});
check(claim.state.building.ownedPlots.includes("grove_muckstead_cottage_lot"), "claim_plot records Grove land ownership");
check(claim.state.building.safeZones.grove_muckstead_cottage_lot?.safeFromMuck === true, "claim_plot turns muck land safe");
check(claim.summary.buildingMaterializationPlans?.[0]?.edits?.some((e) => e.label === "safe_ground"), "claim_plot emits safe-ground voxel edits");
check(claim.state.inventory.gold === 475, "claim_plot deducts server-priced gold");
state = claim.state;

let build = apply(state, "request_property_building_mutation", {
  buildingAction: "place",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
});
const cottagePlan = build.summary.buildingMaterializationPlans?.find((p) => p.materializesSolidVoxelBuilding === true);
const cottageCounts = cottagePlan ? countBuildingSystemVoxelLabelsV1(cottagePlan) : {};
check(Boolean(cottagePlan), "place creates a server-approved materialization plan");
check((cottageCounts.foundation || 0) > 0 && (cottageCounts.wall || 0) > 0 && (cottageCounts.roof || 0) > 0, "place emits foundation/wall/roof voxel EditEvents");
check(Object.values(build.state.building.placedStructures).some((s) => s.use === "home" && s.materializedInEcs === true), "home building is persisted as materialized");
check(build.state.property.owned.property_grove_muckstead_cottage_lot.status === "home", "home property deed is created");
state = build.state;

let shopClaim = apply(state, "request_property_building_mutation", {
  buildingAction: "claim_plot",
  plotId: "grove_crossroads_shop_lot",
});
state = shopClaim.state;
let shopBuild = apply(state, "request_property_building_mutation", {
  buildingAction: "place",
  plotId: "grove_crossroads_shop_lot",
  blueprintId: "grove_voxel_shop_tier_1",
});
check(shopBuild.state.property.owned.property_grove_crossroads_shop_lot.status === "business", "building can become a business, not only a home");
state = shopBuild.state;

let guildClaim = apply(state, "request_property_building_mutation", {
  buildingAction: "claim_plot",
  plotId: "grove_guild_green_lot",
});
state = guildClaim.state;
let guildBuild = apply(state, "request_property_building_mutation", {
  buildingAction: "place",
  plotId: "grove_guild_green_lot",
  blueprintId: "grove_voxel_guild_hall_tier_1",
});
check(guildBuild.state.property.owned.property_grove_guild_green_lot.status === "guild", "building can become a guild hall");
state = guildBuild.state;

let poor = defaultHarthmereLiveModeBackendStateV1("player-building-v1", 1000);
poor.inventory.gold = 0;
let poorClaim = apply(poor, "request_property_building_mutation", {
  buildingAction: "claim_plot",
  plotId: "grove_muckstead_cottage_lot",
});
check(!poorClaim.state.building.ownedPlots.includes("grove_muckstead_cottage_lot"), "insufficient gold cannot claim plot");
check(poorClaim.summary.warnings.some((w) => w.includes("insufficient_gold_for_plot_claim")), "insufficient-gold plot claim reports server rejection");

let duplicate = apply(state, "request_property_building_mutation", {
  buildingAction: "claim_plot",
  plotId: "grove_muckstead_cottage_lot",
});
check(duplicate.summary.warnings.includes("plot_claim_rejected:plot_already_owned_by_actor"), "duplicate plot claim is rejected");

let noOwned = defaultHarthmereLiveModeBackendStateV1("player-building-v1", 1000);
noOwned.inventory.gold = 500;
let placeUnowned = apply(noOwned, "request_property_building_mutation", {
  buildingAction: "place",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
});
check(placeUnowned.summary.warnings.includes("building_rejected:plot_not_owned_by_actor"), "cannot build on unowned Grove land");

let wrongBlueprint = apply(state, "request_property_building_mutation", {
  buildingAction: "place",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_shop_tier_1",
});
check(wrongBlueprint.summary.warnings.includes("building_rejected:blueprint_not_allowed_on_plot"), "wrong blueprint cannot be placed on a plot");

let outside = apply(state, "request_property_building_mutation", {
  buildingAction: "place",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
  originX: 99999,
  originY: 53,
  originZ: 99999,
});
check(outside.summary.warnings.some((w) => w.includes("structure_outside_plot_boundary")), "out-of-plot origin is rejected by placement authority");

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
