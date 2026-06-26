#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const {
  BUILDING_SYSTEM_CONSTRUCTION_STAGES,
  buildingSystemBlueprintById,
  buildingSystemMaterialRequirementLines,
  buildingSystemMaterialSourceForSymbol,
} = require("../../src/shared/harthmere/building_system.ts");
const {
  HARTHMERE_BUSINESS_OUTPOSTS,
} = require("../../src/shared/harthmere/business_customer_simulator.ts");
const {
  HARTHMERE_HOME_DECORATION_ITEM_IDS,
} = require("../../src/shared/harthmere/mmo_crafting_catalogue.ts");
const {
  HARTHMERE_BUILDING_MATERIAL_BUSINESS_VENDOR_ID,
  ensureHarthmereProductionVendorCatalog,
} = require("../../src/shared/harthmere/harthmere_vendor_catalog.ts");
const {
  getHarthmereVendorEntry,
} = require("../../src/shared/harthmere/mmo_inventory_authority.ts");

const DEFAULT_BASE_URL =
  "https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io";
const INSTALL_ID =
  process.env.HARTHMERE_INSTALL_ID ??
  process.argv[2] ??
  "25f687dd-9ebe-4c31-8810-719ddfafe66b";
const BASE_URL = (process.env.HARTHMERE_BASE_URL ?? DEFAULT_BASE_URL).replace(
  /\/$/,
  ""
);
const RUN_ID = `live-build-decor-${new Date()
  .toISOString()
  .replace(/[^0-9A-Za-z]+/g, "-")
  .replace(/-$/, "")}`;
const REPORT_PATH =
  process.env.HARTHMERE_LIVE_BUILD_REPORT ??
  path.join(
    process.cwd(),
    `.harthmere-live-build-decor-${INSTALL_ID}-${RUN_ID}.json`
  );
const REQUEST_SLEEP_MS = Number(process.env.HARTHMERE_REQUEST_SLEEP_MS ?? 30);
const MATERIAL_VENDOR_ID =
  process.env.HARTHMERE_BUILDING_MATERIAL_VENDOR_ID ??
  HARTHMERE_BUILDING_MATERIAL_BUSINESS_VENDOR_ID;

const HOME = {
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
  propertyId: "property_grove_muckstead_cottage_lot",
};
const BUSINESS = {
  plotId: "grove_crossroads_shop_lot",
  blueprintId: "grove_voxel_shop_tier_1",
  propertyId: "property_grove_crossroads_shop_lot",
  businessType: "general_trader",
};

let sequence = 0;
const report = {
  version: 1,
  runId: RUN_ID,
  baseUrl: BASE_URL,
  installId: INSTALL_ID,
  startedAt: new Date().toISOString(),
  actorId: undefined,
  materialSourceAudit: [],
  actions: [],
  warnings: [],
  failures: [],
  verification: {},
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeReport() {
  const tmp = `${REPORT_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(report, null, 2));
  fs.renameSync(tmp, REPORT_PATH);
}

function nextRequestId(label) {
  sequence += 1;
  return `${RUN_ID}:${String(sequence).padStart(4, "0")}:${label}`.slice(
    0,
    180
  );
}

function liveUrl(pathname) {
  return `${BASE_URL}${pathname}?install_id=${encodeURIComponent(INSTALL_ID)}`;
}

async function jsonFetch(pathname, options = {}) {
  const response = await fetch(liveUrl(pathname), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Glitch-Install-Id": INSTALL_ID,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { parseError: text.slice(0, 1000) };
  }
  if (!response.ok || body?.ok === false) {
    const error = new Error(
      body?.error ??
        body?.validation?.errors?.join(",") ??
        body?.parseError ??
        `HTTP ${response.status}`
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function getBuildingState() {
  const body = await jsonFetch("/api/harthmere/live_mode_building_state");
  report.actorId = body?.buildingState?.actorId ?? report.actorId;
  return body.buildingState;
}

async function getInventoryState() {
  const body = await jsonFetch("/api/harthmere/live_mode_inventory_loot_state");
  return body.inventoryLootState;
}

function rejectionWarnings(warnings) {
  return (warnings ?? []).filter((warning) =>
    /(^|:)rejected:|_rejected:/.test(String(warning))
  );
}

async function postLive(actionKind, subsystem, payload, options = {}) {
  const requestId =
    options.requestId ?? nextRequestId(options.label ?? actionKind);
  const body = {
    requestId,
    idempotencyKey: requestId,
    targetId: options.targetId,
    actionKind,
    subsystem,
    actorEntityVersion: 1,
    targetEntityVersion: options.targetId ? 1 : undefined,
    zoneId: options.zoneId ?? "harthmere_live_building_run",
    clientSentAtMs: Date.now(),
    payload,
    clientClaims: options.clientClaims ?? {},
  };
  const response = await jsonFetch("/api/harthmere/live_mode", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const warnings =
    response?.backendMutation?.warnings ?? response?.warnings ?? [];
  const entry = {
    requestId,
    actionKind,
    subsystem,
    payload,
    warnings,
    touchedModels: response?.backendMutation?.touchedModels ?? [],
  };
  report.actions.push(entry);
  if (warnings.length) {
    report.warnings.push({ requestId, actionKind, warnings });
  }
  await sleep(REQUEST_SLEEP_MS);
  writeReport();
  return { requestId, response, warnings };
}

async function checkedPost(actionKind, subsystem, payload, options = {}) {
  const result = await postLive(actionKind, subsystem, payload, options);
  const rejected = rejectionWarnings(result.warnings);
  const allowed = options.allowedWarnings ?? [];
  const unexpected = rejected.filter(
    (warning) =>
      !allowed.some((allowedWarning) =>
        String(warning).includes(allowedWarning)
      )
  );
  if (unexpected.length) {
    const failure = {
      requestId: result.requestId,
      actionKind,
      payload,
      unexpected,
    };
    report.failures.push(failure);
    writeReport();
    throw new Error(`${actionKind} rejected: ${unexpected.join("; ")}`);
  }
  return result;
}

function materialKeys(line) {
  return [line.itemId, line.material, line.bikkieName].filter(Boolean);
}

function countMaterial(record, line) {
  const keys = new Set(materialKeys(line));
  let total = 0;
  for (const key of keys) {
    total += Math.max(0, Math.trunc(Number(record?.[key] ?? 0) || 0));
  }
  return total;
}

function materialRequirementsForBlueprint(blueprintId) {
  const blueprint = buildingSystemBlueprintById(blueprintId);
  if (!blueprint) throw new Error(`missing blueprint ${blueprintId}`);
  const byMaterial = new Map();
  for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
    for (const line of buildingSystemMaterialRequirementLines({
      blueprint,
      stage,
    })) {
      const existing = byMaterial.get(line.material) ?? {
        ...line,
        required: 0,
      };
      existing.required += line.required;
      byMaterial.set(line.material, existing);
    }
  }
  return [...byMaterial.values()].sort((a, b) =>
    a.material.localeCompare(b.material)
  );
}

function combinedRequirements() {
  const combined = new Map();
  for (const line of [
    ...materialRequirementsForBlueprint(HOME.blueprintId),
    ...materialRequirementsForBlueprint(BUSINESS.blueprintId),
  ]) {
    const existing = combined.get(line.material) ?? { ...line, required: 0 };
    existing.required += line.required;
    combined.set(line.material, existing);
  }
  return [...combined.values()].sort((a, b) =>
    a.material.localeCompare(b.material)
  );
}

function auditMaterialSources(lines) {
  ensureHarthmereProductionVendorCatalog();
  const outpostById = new Map(
    HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => [outpost.outpostId, outpost])
  );
  report.materialSourceAudit = lines.map((line) => {
    const source = buildingSystemMaterialSourceForSymbol(line.material);
    const sourceOutpostId = String(source?.sourceId ?? "").split(":")[0];
    const sourceOutpost = outpostById.get(sourceOutpostId);
    const vendorEntry = getHarthmereVendorEntry(
      MATERIAL_VENDOR_ID,
      line.material
    );
    return {
      material: line.material,
      displayName: line.displayName,
      required: line.required,
      sourceId: source?.sourceId,
      sourceName: source?.sourceName,
      sourceKind: source?.sourceKind,
      actionLabel: source?.actionLabel,
      description: source?.description,
      position: source?.position,
      vendorId: MATERIAL_VENDOR_ID,
      vendorSellsMaterial: Boolean(vendorEntry),
      sourceOutpostId,
      sourceOutpostName: sourceOutpost?.displayName,
      sourceIsOneOf19Businesses: Boolean(sourceOutpost),
      ok:
        Boolean(source?.sourceId) &&
        Boolean(source?.sourceName) &&
        Boolean(source?.actionLabel) &&
        Boolean(source?.description) &&
        Boolean(vendorEntry) &&
        Boolean(sourceOutpost),
    };
  });
  const missing = report.materialSourceAudit.filter((entry) => !entry.ok);
  if (missing.length) {
    throw new Error(
      `material source audit failed: ${missing
        .map((entry) => entry.material)
        .join(", ")}`
    );
  }
}

async function acquireMaterials() {
  console.log("== Acquiring building materials ==");
  const state = await getBuildingState();
  const requirements = combinedRequirements();
  auditMaterialSources(requirements);
  const missing = requirements
    .map((line) => {
      const available =
        countMaterial(state.inventoryItems, line) +
        countMaterial(state.materialStorage, line);
      return {
        ...line,
        available,
        missing: Math.max(0, line.required - available),
      };
    })
    .filter((line) => line.missing > 0);

  for (const line of missing) {
    try {
      await checkedPost(
        "request_vendor_transaction",
        "economy",
        {
          vendorId: MATERIAL_VENDOR_ID,
          transactionKind: "buy",
          itemId: line.material,
          count: line.missing,
        },
        { label: `buy-${line.material}` }
      );
      continue;
    } catch (error) {
      report.warnings.push({
        material: line.material,
        acquisitionFallback: "request_loot_roll",
        reason: String(error.message ?? error),
      });
    }
    await checkedPost(
      "request_loot_roll",
      "loot",
      { itemId: line.material, count: line.missing },
      { label: `grant-material-${line.material}` }
    );
  }
}

async function acquireDecorationItems() {
  console.log("== Acquiring decoration items ==");
  const wanted = {
    [HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet]: 1,
    [HARTHMERE_HOME_DECORATION_ITEM_IDS.hearthLamp]: 2,
    [HARTHMERE_HOME_DECORATION_ITEM_IDS.gardenPlanterBox]: 1,
    [HARTHMERE_HOME_DECORATION_ITEM_IDS.businessServiceCounter]: 1,
  };
  const inventory = await getInventoryState();
  const held = inventory?.actor?.items ?? {};
  for (const [itemId, count] of Object.entries(wanted)) {
    const missing = Math.max(0, count - Math.max(0, Number(held[itemId] ?? 0)));
    if (missing <= 0) continue;
    await checkedPost(
      "request_loot_roll",
      "loot",
      { itemId, count: missing },
      { label: `grant-decor-${itemId}` }
    );
  }
}

async function claimAndBuild(input) {
  console.log(`== Building ${input.propertyId} ==`);
  await checkedPost(
    "request_property_building_mutation",
    "building",
    { buildingAction: "claim_plot", plotId: input.plotId },
    {
      label: `claim-${input.plotId}`,
      allowedWarnings: ["plot_claim_idempotent:already_owned_by_actor"],
    }
  );
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "start_construction",
      plotId: input.plotId,
      blueprintId: input.blueprintId,
      propertyId: input.propertyId,
    },
    {
      label: `start-${input.plotId}`,
      allowedWarnings: [
        "building_project_idempotent:project_already_exists",
        "building_project_idempotent:property_already_completed",
      ],
    }
  );

  for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
    await checkedPost(
      "request_property_building_mutation",
      "building",
      {
        buildingAction: "contribute_stage",
        plotId: input.plotId,
        blueprintId: input.blueprintId,
        propertyId: input.propertyId,
        stage,
        contributeAll: true,
      },
      {
        label: `stage-${input.plotId}-${stage}`,
        allowedWarnings: [
          "building_stage_idempotent:stage_already_completed",
          "building_stage_rejected:active_project_not_found",
        ],
      }
    );
  }
}

async function runBusiness() {
  console.log("== Starting and operating business ==");
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "start_business",
      plotId: BUSINESS.plotId,
      propertyId: BUSINESS.propertyId,
      businessType: BUSINESS.businessType,
    },
    {
      label: "start-business",
      allowedWarnings: ["business_idempotent:already_started"],
    }
  );
  const state = await getBuildingState();
  const property = state.completedProperties?.[BUSINESS.propertyId];
  const businessId = property?.businessId ?? `business_${BUSINESS.propertyId}`;
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "run_business_cycle",
      plotId: BUSINESS.plotId,
      propertyId: BUSINESS.propertyId,
      businessId,
      cycles: 2,
    },
    { label: "run-business-cycle" }
  );
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "collect_business_revenue",
      plotId: BUSINESS.plotId,
      propertyId: BUSINESS.propertyId,
      businessId,
    },
    { label: "collect-business-revenue" }
  );
}

function markerPosition(marker) {
  const [x, y, z] = marker?.position ?? [];
  return Number.isFinite(Number(x)) &&
    Number.isFinite(Number(y)) &&
    Number.isFinite(Number(z))
    ? { x: Number(x), y: Number(y), z: Number(z) }
    : undefined;
}

async function decorateProperties() {
  console.log("== Decorating home and business interiors ==");
  const before = await getBuildingState();
  const homeConsole =
    before.inWorldMarkers?.[`home_console_${HOME.propertyId}`];
  const homePosition = markerPosition(homeConsole);
  await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "place_decoration",
      propertyId: HOME.propertyId,
      itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet,
      position: { x: 0, y: 0, z: 2 },
    },
    {
      label: "decorate-home-storage",
      clientClaims: homePosition
        ? { runtimePosition: homePosition, actorPosition: homePosition }
        : {},
    }
  );
  await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "place_decoration",
      propertyId: HOME.propertyId,
      itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.hearthLamp,
      position: { x: 0, y: 0, z: 0 },
    },
    {
      label: "decorate-home-lamp",
      clientClaims: homePosition
        ? { runtimePosition: homePosition, actorPosition: homePosition }
        : {},
    }
  );
  await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "place_decoration",
      propertyId: HOME.propertyId,
      itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.gardenPlanterBox,
      position: { x: 2, y: 0, z: 0 },
    },
    {
      label: "decorate-home-planter",
      clientClaims: homePosition
        ? { runtimePosition: homePosition, actorPosition: homePosition }
        : {},
    }
  );

  await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "place_decoration",
      propertyId: BUSINESS.propertyId,
      itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.businessServiceCounter,
      position: { x: 1, y: 0, z: 3 },
    },
    { label: "decorate-business-counter" }
  );
  await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "place_decoration",
      propertyId: BUSINESS.propertyId,
      itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.hearthLamp,
      position: { x: 0, y: 0, z: 0 },
    },
    { label: "decorate-business-lamp" }
  );
}

async function verifyFinalState() {
  console.log("== Verifying final state ==");
  const state = await getBuildingState();
  const home = state.completedProperties?.[HOME.propertyId];
  const business = state.completedProperties?.[BUSINESS.propertyId];
  const businessId = business?.businessId ?? `business_${BUSINESS.propertyId}`;
  const decorations = Object.values(state.homeDecoration?.placed ?? {});
  const homeDecor = decorations.filter(
    (decor) => decor.propertyId === HOME.propertyId
  );
  const businessDecor = decorations.filter(
    (decor) => decor.propertyId === BUSINESS.propertyId
  );
  report.verification = {
    actorId: state.actorId,
    gold: state.gold,
    home: {
      exists: Boolean(home),
      progress: state.buildingProgress?.[HOME.propertyId],
      storage: Boolean(state.storageContainers?.[`storage_${HOME.propertyId}`]),
      door: Boolean(state.doorLocks?.[`door_${HOME.propertyId}`]),
      console: Boolean(
        state.inWorldMarkers?.[`home_console_${HOME.propertyId}`]
      ),
      decorationCount: homeDecor.length,
      decorations: homeDecor.map((decor) => decor.displayName),
    },
    business: {
      exists: Boolean(business),
      progress: state.buildingProgress?.[BUSINESS.propertyId],
      businessId,
      businessExists: Boolean(state.businesses?.[businessId]),
      storage: Boolean(
        state.storageContainers?.[`storage_${BUSINESS.propertyId}`]
      ),
      door: Boolean(state.doorLocks?.[`door_${BUSINESS.propertyId}`]),
      marker: Boolean(state.inWorldMarkers?.[`${businessId}:marker`]),
      ownerNpc: Boolean(state.inWorldMarkers?.[`${businessId}:owner-npc`]),
      decorationCount: businessDecor.length,
      decorations: businessDecor.map((decor) => decor.displayName),
    },
    materialSources: report.materialSourceAudit,
  };

  const failures = [];
  if (!report.verification.home.exists) failures.push("home property missing");
  if (report.verification.home.progress !== 100)
    failures.push("home progress not 100");
  if (!report.verification.home.storage) failures.push("home storage missing");
  if (!report.verification.home.door) failures.push("home door missing");
  if (!report.verification.home.console) failures.push("home console missing");
  if (report.verification.home.decorationCount < 3)
    failures.push("home decoration count below 3");
  if (!report.verification.business.exists)
    failures.push("business property missing");
  if (report.verification.business.progress !== 100)
    failures.push("business progress not 100");
  if (!report.verification.business.businessExists)
    failures.push("business record missing");
  if (!report.verification.business.storage)
    failures.push("business storage missing");
  if (!report.verification.business.door)
    failures.push("business door missing");
  if (!report.verification.business.marker)
    failures.push("business marker missing");
  if (!report.verification.business.ownerNpc)
    failures.push("business owner NPC missing");
  if (report.verification.business.decorationCount < 2)
    failures.push("business decoration count below 2");
  if (failures.length) {
    report.failures.push({ phase: "verifyFinalState", failures });
    writeReport();
    throw new Error(`final verification failed: ${failures.join("; ")}`);
  }
  writeReport();
}

async function main() {
  console.log(`Live build/decor run ${RUN_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Install ID: ${INSTALL_ID}`);
  await getBuildingState();
  await acquireMaterials();
  await acquireDecorationItems();
  await claimAndBuild(HOME);
  await claimAndBuild(BUSINESS);
  await runBusiness();
  await decorateProperties();
  await verifyFinalState();
  report.completedAt = new Date().toISOString();
  writeReport();
  console.log(`\nPASS ${RUN_ID}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  report.failedAt = new Date().toISOString();
  report.error = {
    message: String(error?.message ?? error),
    stack: error?.stack,
    body: error?.body,
  };
  writeReport();
  console.error(`\nFAIL ${RUN_ID}`);
  console.error(error?.stack ?? error);
  console.error(`Report: ${REPORT_PATH}`);
  process.exitCode = 1;
});
