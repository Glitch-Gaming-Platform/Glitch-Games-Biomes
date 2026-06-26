#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const {
  BUILDING_SYSTEM_BUSINESS_TYPES,
  BUILDING_SYSTEM_CONSTRUCTION_STAGES,
  BUILDING_SYSTEM_MATERIAL_CATALOG,
  BUILDING_SYSTEM_PLOTS,
  buildingSystemBlueprintById,
  buildingSystemMaterialRequirementLines,
  buildingSystemMaterialSourceForSymbol,
  createBuildingSystemMuckAreaPlotDefinition,
} = require("../../src/shared/harthmere/building_system.ts");
const {
  HARTHMERE_BUSINESS_OUTPOSTS,
} = require("../../src/shared/harthmere/business_customer_simulator.ts");
const {
  HARTHMERE_BUILDING_MATERIAL_BUSINESS_VENDOR_ID,
  ensureHarthmereProductionVendorCatalog,
} = require("../../src/shared/harthmere/harthmere_vendor_catalog.ts");
const {
  getHarthmereVendorEntry,
} = require("../../src/shared/harthmere/mmo_inventory_authority.ts");
const {
  listHarthmereHomeDecorationDefinitions,
  validateHarthmereHomeDecorationGuidePlacement,
} = require("../../src/shared/harthmere/home_decoration_authority.ts");

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
const RUN_ID = `live-exhaustive-build-business-decor-${new Date()
  .toISOString()
  .replace(/[^0-9A-Za-z]+/g, "-")
  .replace(/-$/, "")}`;
const REPORT_PATH =
  process.env.HARTHMERE_LIVE_EXHAUSTIVE_BUILD_REPORT ??
  path.join(
    process.cwd(),
    `.harthmere-live-exhaustive-build-business-decor-${INSTALL_ID}-${RUN_ID}.json`
  );
const REQUEST_SLEEP_MS = Number(process.env.HARTHMERE_REQUEST_SLEEP_MS ?? 25);
const MAX_VENDOR_MATERIAL_BUY_CHUNK = Number(
  process.env.HARTHMERE_MAX_VENDOR_MATERIAL_BUY_CHUNK ?? 64
);
const MATERIAL_VENDOR_ID =
  process.env.HARTHMERE_BUILDING_MATERIAL_VENDOR_ID ??
  HARTHMERE_BUILDING_MATERIAL_BUSINESS_VENDOR_ID;
const SOURCE_STATIC_CHUNKS = (
  process.env.HARTHMERE_MATERIAL_SOURCE_STATIC_CHUNKS ??
  "/_next/static/chunks/9864-fa05cbdcbebfa1c7.js"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const RESUME_PHASE = (
  process.env.HARTHMERE_EXHAUSTIVE_RESUME_PHASE ?? ""
).toLowerCase();

const HOME_PLOT_ID = "grove_muckstead_cottage_lot";
const FINAL_HOME_BLUEPRINT_ID = "bikkie_space_age_shelter_frame";
const SHOP_PLOT_ID = "grove_crossroads_shop_lot";
const SHOP_BLUEPRINT_ID = "grove_voxel_shop_tier_1";
const FINAL_BUSINESS_TYPE =
  BUILDING_SYSTEM_BUSINESS_TYPES[BUILDING_SYSTEM_BUSINESS_TYPES.length - 1]
    .businessType;

const DYNAMIC_MUCK_BUILDS = [
  {
    plotId: "muck_claim_watchtower_live_a",
    propertyId: "property_muck_claim_watchtower_live_a",
    blueprintId: "grove_voxel_cottage_tier_1",
    muckAreaId: "watchtower_muck_clearing",
    origin: { x: 318, y: 55, z: -392 },
    claimGroundY: 54,
  },
  {
    plotId: "muck_claim_watchtower_live_b",
    propertyId: "property_muck_claim_watchtower_live_b",
    blueprintId: "grove_voxel_cottage_tier_1",
    muckAreaId: "watchtower_muck_clearing",
    origin: { x: 340, y: 55, z: -392 },
    claimGroundY: 54,
  },
];

const DYNAMIC_OVERLAP_REJECTION = {
  plotId: "muck_claim_watchtower_live_overlap",
  blueprintId: "grove_voxel_cottage_tier_1",
  muckAreaId: "watchtower_muck_clearing",
  origin: { x: 319, y: 55, z: -392 },
  claimGroundY: 54,
};

const FINAL_HOME = {
  plotId: HOME_PLOT_ID,
  propertyId: `property_${HOME_PLOT_ID}`,
  blueprintId: FINAL_HOME_BLUEPRINT_ID,
};
const FINAL_BUSINESS = {
  plotId: SHOP_PLOT_ID,
  propertyId: `property_${SHOP_PLOT_ID}`,
  blueprintId: SHOP_BLUEPRINT_ID,
  businessType: FINAL_BUSINESS_TYPE,
};

let sequence = 0;
const startedAt = Date.now();
const report = {
  version: 1,
  runId: RUN_ID,
  baseUrl: BASE_URL,
  installId: INSTALL_ID,
  startedAt: new Date(startedAt).toISOString(),
  actorId: undefined,
  totals: {},
  materialSourceAudit: [],
  staticChunkAudit: [],
  staticPlotClaimBatch: {},
  materialPurchases: [],
  materialBulkPurchases: [],
  dynamicMuckBuilds: [],
  authoredBlueprintCompletions: [],
  businessRuns: [],
  decorationTests: [],
  finalDecorations: [],
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
  return `${RUN_ID}:${String(sequence).padStart(5, "0")}:${label}`.slice(
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

async function textFetch(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    headers: {
      Accept: "text/javascript,text/plain,*/*",
      "Cache-Control": "no-cache",
      "X-Glitch-Install-Id": INSTALL_ID,
    },
  });
  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
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
    zoneId: options.zoneId ?? "harthmere_live_exhaustive_build_run",
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
    report.warnings.push({ requestId, actionKind, subsystem, warnings });
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
      subsystem,
      payload,
      unexpected,
    };
    report.failures.push(failure);
    writeReport();
    throw new Error(`${actionKind} rejected: ${unexpected.join("; ")}`);
  }
  return result;
}

function propertyIdForPlot(plotId) {
  return `property_${plotId}`;
}

function projectIdForPlot(plotId) {
  return `project_${plotId}`;
}

function markerPosition(marker) {
  const [x, y, z] = marker?.position ?? [];
  return Number.isFinite(Number(x)) &&
    Number.isFinite(Number(y)) &&
    Number.isFinite(Number(z))
    ? { x: Number(x), y: Number(y), z: Number(z) }
    : undefined;
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

function liveMaterialAvailable(state, line) {
  return (
    countMaterial(state.inventoryItems ?? {}, line) +
    countMaterial(state.materialStorage ?? {}, line)
  );
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

function addRequirement(combined, blueprintId, multiplier = 1) {
  for (const line of materialRequirementsForBlueprint(blueprintId)) {
    const existing = combined.get(line.material) ?? { ...line, required: 0 };
    existing.required += line.required * multiplier;
    combined.set(line.material, existing);
  }
}

function buildMatrix() {
  const authoredBlueprintCases = [];
  const businessCases = [];
  for (const plot of BUILDING_SYSTEM_PLOTS) {
    if (plot.plotId === SHOP_PLOT_ID) {
      for (const blueprintId of plot.allowedBlueprintIds) {
        if (blueprintId !== SHOP_BLUEPRINT_ID) {
          authoredBlueprintCases.push({
            kind: "authored_blueprint",
            plotId: plot.plotId,
            propertyId: propertyIdForPlot(plot.plotId),
            blueprintId,
            keep: false,
          });
        }
      }
      for (const businessType of BUILDING_SYSTEM_BUSINESS_TYPES.map(
        (entry) => entry.businessType
      )) {
        businessCases.push({
          kind: "business_variant",
          plotId: plot.plotId,
          propertyId: propertyIdForPlot(plot.plotId),
          blueprintId: SHOP_BLUEPRINT_ID,
          businessType,
          keep: businessType === FINAL_BUSINESS_TYPE,
        });
      }
      continue;
    }
    const orderedBlueprints =
      plot.plotId === HOME_PLOT_ID
        ? [
            ...plot.allowedBlueprintIds.filter(
              (id) => id !== FINAL_HOME_BLUEPRINT_ID
            ),
            FINAL_HOME_BLUEPRINT_ID,
          ]
        : plot.allowedBlueprintIds;
    for (const blueprintId of orderedBlueprints) {
      authoredBlueprintCases.push({
        kind: "authored_blueprint",
        plotId: plot.plotId,
        propertyId: propertyIdForPlot(plot.plotId),
        blueprintId,
        keep:
          plot.plotId === HOME_PLOT_ID &&
          blueprintId === FINAL_HOME_BLUEPRINT_ID,
      });
    }
  }
  return { authoredBlueprintCases, businessCases };
}

function combinedRequirements() {
  const { authoredBlueprintCases, businessCases } = buildMatrix();
  const combined = new Map();
  for (const buildCase of authoredBlueprintCases) {
    addRequirement(combined, buildCase.blueprintId);
  }
  for (const buildCase of businessCases) {
    addRequirement(combined, buildCase.blueprintId);
  }
  for (const buildCase of DYNAMIC_MUCK_BUILDS) {
    addRequirement(combined, buildCase.blueprintId);
  }
  return [...combined.values()].sort((a, b) =>
    a.material.localeCompare(b.material)
  );
}

function shopBusinessRequirements() {
  const combined = new Map();
  for (const _businessType of BUILDING_SYSTEM_BUSINESS_TYPES) {
    addRequirement(combined, SHOP_BLUEPRINT_ID);
  }
  return [...combined.values()].sort((a, b) =>
    a.material.localeCompare(b.material)
  );
}

async function auditProductionStaticMaterialSourceChunk() {
  for (const chunkPath of SOURCE_STATIC_CHUNKS) {
    const result = await textFetch(chunkPath);
    const audit = {
      path: chunkPath,
      status: result.status,
      ok: result.ok,
      hasCinderlaneSource: result.text.includes(
        "Cinderlane Tool Forge counter"
      ),
      hasOldBlackAnvilSource: result.text.includes(
        "black_anvil_building_counter"
      ),
    };
    report.staticChunkAudit.push(audit);
  }
  const good = report.staticChunkAudit.some(
    (entry) =>
      entry.ok && entry.hasCinderlaneSource && !entry.hasOldBlackAnvilSource
  );
  if (!good) {
    throw new Error("production material-source UI chunk audit failed");
  }
}

async function auditMaterialSources(lines, liveState) {
  ensureHarthmereProductionVendorCatalog();
  if (HARTHMERE_BUSINESS_OUTPOSTS.length !== 19) {
    throw new Error(
      `expected 19 business outposts, found ${HARTHMERE_BUSINESS_OUTPOSTS.length}`
    );
  }
  if (BUILDING_SYSTEM_BUSINESS_TYPES.length !== 19) {
    throw new Error(
      `expected 19 business types, found ${BUILDING_SYSTEM_BUSINESS_TYPES.length}`
    );
  }
  const outpostById = new Map(
    HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => [outpost.outpostId, outpost])
  );
  const sourceOutpostId = "outpost_tools_cinderlane";
  const sourceMarkerId = `${sourceOutpostId}:business-counter`;
  const sourceMarker = liveState.inWorldMarkers?.[sourceMarkerId];
  report.materialSourceAudit = lines.map((line) => {
    const source = buildingSystemMaterialSourceForSymbol(line.material);
    const materialSourceOutpostId = String(source?.sourceId ?? "").split(
      ":"
    )[0];
    const sourceOutpost = outpostById.get(materialSourceOutpostId);
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
      liveMarker: sourceMarker
        ? {
            markerId: sourceMarker.markerId,
            kind: sourceMarker.kind,
            label: sourceMarker.label,
            position: sourceMarker.position,
          }
        : undefined,
      vendorId: MATERIAL_VENDOR_ID,
      vendorSellsMaterial: Boolean(vendorEntry),
      sourceOutpostId: materialSourceOutpostId,
      sourceOutpostName: sourceOutpost?.displayName,
      sourceIsOneOf19Businesses: Boolean(sourceOutpost),
      ok:
        source?.sourceKind === "buy" &&
        source?.sourceId === `${sourceOutpostId}:business-counter` &&
        source?.sourceName === "Cinderlane Tool Forge counter" &&
        Array.isArray(source?.position) &&
        source.position.join(",") === "1630,43,-775" &&
        Boolean(source?.actionLabel) &&
        Boolean(source?.description) &&
        Boolean(vendorEntry) &&
        Boolean(sourceOutpost) &&
        sourceOutpost?.businessType === MATERIAL_VENDOR_ID &&
        sourceMarker?.label === "Cinderlane Tool Forge counter",
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
  await auditProductionStaticMaterialSourceChunk();
}

async function buyMaterialAndVerify(line, count, reason) {
  if (count <= 0) return;
  const before = await getBuildingState();
  const beforeCount = liveMaterialAvailable(before, line);
  const requestIds = [];
  let remaining = count;
  while (remaining > 0) {
    const chunk = Math.min(
      remaining,
      Math.max(1, Math.trunc(MAX_VENDOR_MATERIAL_BUY_CHUNK))
    );
    const result = await checkedPost(
      "request_vendor_transaction",
      "economy",
      {
        vendorId: MATERIAL_VENDOR_ID,
        transactionKind: "buy",
        itemId: line.material,
        count: chunk,
      },
      {
        label: `${reason}-${line.material}-${requestIds.length + 1}`,
      }
    );
    requestIds.push({ requestId: result.requestId, count: chunk });
    remaining -= chunk;
  }
  const after = await getBuildingState();
  const afterCount = liveMaterialAvailable(after, line);
  const entry = {
    material: line.material,
    count,
    reason,
    requestIds,
    before: beforeCount,
    after: afterCount,
    ok: afterCount >= beforeCount + count,
  };
  if (reason === "single-source-buy") {
    report.materialPurchases.push(entry);
  } else {
    report.materialBulkPurchases.push(entry);
  }
  if (!entry.ok) {
    throw new Error(
      `material purchase did not increase ${line.material}: ${beforeCount} -> ${afterCount}`
    );
  }
}

async function acquireMaterials() {
  console.log("== Material source and purchase audit ==");
  const requirements = combinedRequirements();
  report.totals.materialSymbols = Object.keys(
    BUILDING_SYSTEM_MATERIAL_CATALOG
  ).length;
  report.totals.totalMaterialUnitsRequired = requirements.reduce(
    (sum, line) => sum + line.required,
    0
  );
  await auditMaterialSources(requirements, await getBuildingState());
  for (const line of requirements) {
    await buyMaterialAndVerify(line, 1, "single-source-buy");
  }
  let state = await getBuildingState();
  for (const line of requirements) {
    const available = liveMaterialAvailable(state, line);
    const missing = Math.max(0, line.required - available);
    if (missing > 0) {
      await buyMaterialAndVerify(line, missing, "bulk-staged-build-buy");
      state = await getBuildingState();
    }
  }
}

async function acquireBusinessResumeMaterials() {
  console.log("== Business resume material audit and purchase ==");
  const requirements = shopBusinessRequirements();
  await auditMaterialSources(requirements, await getBuildingState());
  let state = await getBuildingState();
  for (const line of requirements) {
    const available = liveMaterialAvailable(state, line);
    const missing = Math.max(0, line.required - available);
    if (missing > 0) {
      await buyMaterialAndVerify(line, missing, "resume-business-build-buy");
      state = await getBuildingState();
    }
  }
}

async function claimAllStaticPlotsBatch() {
  console.log("== Claiming all six authored plots as one batch ==");
  const requests = [];
  for (const plot of BUILDING_SYSTEM_PLOTS) {
    requests.push(
      await checkedPost(
        "request_property_building_mutation",
        "building",
        { buildingAction: "claim_plot", plotId: plot.plotId },
        {
          label: `claim-static-${plot.plotId}`,
          allowedWarnings: ["plot_claim_idempotent:already_owned_by_actor"],
        }
      )
    );
  }
  const state = await getBuildingState();
  const owned = state.ownedPlotIds ?? state.ownedPlots ?? [];
  const missing = BUILDING_SYSTEM_PLOTS.map((plot) => plot.plotId).filter(
    (plotId) => !owned.includes(plotId)
  );
  report.staticPlotClaimBatch = {
    requestedPlotCount: BUILDING_SYSTEM_PLOTS.length,
    ownedPlotIdsAfterBatch: owned,
    requestIds: requests.map((request) => request.requestId),
    ok: missing.length === 0,
    missing,
  };
  if (missing.length) {
    throw new Error(`static plot batch claim missing: ${missing.join(", ")}`);
  }
}

async function claimPlot(input) {
  const payload = {
    buildingAction: "claim_plot",
    plotId: input.plotId,
    blueprintId: input.blueprintId,
    muckAreaId: input.muckAreaId,
    originX: input.origin ? input.origin.x : undefined,
    originY: input.claimGroundY,
    originZ: input.origin ? input.origin.z : undefined,
  };
  await checkedPost(
    "request_property_building_mutation",
    "building",
    payload,
    {
      label: `claim-${input.plotId}`,
      allowedWarnings: ["plot_claim_idempotent:already_owned_by_actor"],
    }
  );
}

async function verifyCompletedProperty(input) {
  const state = await getBuildingState();
  const property = state.completedProperties?.[input.propertyId];
  const progress = state.buildingProgress?.[input.propertyId];
  const structure = Object.values(state.placedStructures ?? {}).find(
    (entry) =>
      entry.plotId === input.plotId && entry.blueprintId === input.blueprintId
  );
  const result = {
    propertyId: input.propertyId,
    plotId: input.plotId,
    blueprintId: input.blueprintId,
    exists: Boolean(property),
    use: property?.use,
    status: property?.status,
    progress,
    structure: structure
      ? {
          plotId: structure.plotId,
          blueprintId: structure.blueprintId,
          origin: structure.origin,
          use: structure.use,
          voxelEditCount: structure.voxelEditCount,
          materializedInEcs: structure.materializedInEcs,
        }
      : undefined,
    hasAnyPlotMarker: Object.values(state.inWorldMarkers ?? {}).some(
      (marker) => marker.plotId === input.plotId
    ),
    homeAccess:
      property?.use === "home"
        ? {
            storage: Boolean(
              state.storageContainers?.[`storage_${input.propertyId}`]
            ),
            door: Boolean(state.doorLocks?.[`door_${input.propertyId}`]),
            console: Boolean(
              state.inWorldMarkers?.[`home_console_${input.propertyId}`]
            ),
          }
        : undefined,
    businessAccess:
      property?.use === "business"
        ? {
            storage: Boolean(
              state.storageContainers?.[`storage_${input.propertyId}`]
            ),
            door: Boolean(state.doorLocks?.[`door_${input.propertyId}`]),
          }
        : undefined,
  };
  const failures = [];
  if (!result.exists) failures.push("property_missing");
  if (result.progress !== 100) failures.push("progress_not_100");
  if (!result.structure) failures.push("placed_structure_missing");
  if (!result.hasAnyPlotMarker) failures.push("plot_marker_missing");
  if (result.homeAccess) {
    if (!result.homeAccess.storage) failures.push("home_storage_missing");
    if (!result.homeAccess.door) failures.push("home_door_missing");
    if (!result.homeAccess.console) failures.push("home_console_missing");
  }
  if (result.businessAccess) {
    if (!result.businessAccess.storage) failures.push("business_storage_missing");
    if (!result.businessAccess.door) failures.push("business_door_missing");
  }
  result.ok = failures.length === 0;
  result.failures = failures;
  if (failures.length) {
    throw new Error(
      `property verification failed ${input.propertyId}: ${failures.join(", ")}`
    );
  }
  return result;
}

async function claimAndBuild(input) {
  const blueprint = buildingSystemBlueprintById(input.blueprintId);
  if (!blueprint) throw new Error(`unknown blueprint ${input.blueprintId}`);
  await claimPlot(input);
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "start_construction",
      plotId: input.plotId,
      blueprintId: input.blueprintId,
      propertyId: input.propertyId,
      originX: input.origin?.x,
      originY: input.origin?.y,
      originZ: input.origin?.z,
    },
    {
      label: `start-${input.plotId}-${input.blueprintId}`,
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
        label: `stage-${input.plotId}-${input.blueprintId}-${stage}`,
        allowedWarnings: [
          "building_stage_idempotent:stage_already_completed",
          "building_stage_rejected:active_project_not_found",
        ],
      }
    );
  }
  return verifyCompletedProperty(input);
}

async function demolishProperty(input) {
  const state = await getBuildingState();
  if (!state.completedProperties?.[input.propertyId]) {
    return { skipped: true, reason: "property_not_present" };
  }
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "demolish_property",
      plotId: input.plotId,
      propertyId: input.propertyId,
      refund: false,
    },
    { label: `demolish-${input.propertyId}` }
  );
  const after = await getBuildingState();
  const removed = !after.completedProperties?.[input.propertyId];
  if (!removed) {
    throw new Error(`property demolition failed: ${input.propertyId}`);
  }
  return { skipped: false, removed };
}

async function buildDynamicMuckClaims() {
  console.log("== Building beyond the six authored plots in muck areas ==");
  for (const input of DYNAMIC_MUCK_BUILDS) {
    const preview = createBuildingSystemMuckAreaPlotDefinition({
      plotId: input.plotId,
      blueprint: buildingSystemBlueprintById(input.blueprintId),
      origin: {
        x: input.origin.x,
        y: input.claimGroundY,
        z: input.origin.z,
      },
      areaId: input.muckAreaId,
    });
    if (!preview.ok) {
      throw new Error(
        `dynamic local precheck failed ${input.plotId}: ${preview.errors.join(", ")}`
      );
    }
    const verification = await claimAndBuild(input);
    const state = await getBuildingState();
    const owned = state.ownedPlotIds ?? state.ownedPlots ?? [];
    const entry = {
      ...input,
      generatedBounds: preview.plot.bounds,
      ownedPlotCountAfterBuild: owned.length,
      verification,
    };
    report.dynamicMuckBuilds.push(entry);
  }
  const overlap = DYNAMIC_OVERLAP_REJECTION;
  const result = await postLive(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "claim_plot",
      plotId: overlap.plotId,
      blueprintId: overlap.blueprintId,
      muckAreaId: overlap.muckAreaId,
      originX: overlap.origin.x,
      originY: overlap.claimGroundY,
      originZ: overlap.origin.z,
    },
    { label: `claim-overlap-${overlap.plotId}` }
  );
  const expected = rejectionWarnings(result.warnings).some(
    (warning) =>
      String(warning).includes("plot_claim_rejected:area_already_claimed") ||
      String(warning).includes("plot_claim_rejected:existing_building")
  );
  report.dynamicMuckBuilds.push({
    ...overlap,
    expectedRejection: true,
    warnings: result.warnings,
    ok: expected,
  });
  if (!expected) {
    throw new Error(
      `dynamic overlap claim was not rejected: ${result.warnings.join(", ")}`
    );
  }
}

async function runBusinessForProperty(buildCase) {
  const start = await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "start_business",
      plotId: buildCase.plotId,
      propertyId: buildCase.propertyId,
      businessType: buildCase.businessType,
    },
    {
      label: `start-business-${buildCase.businessType}`,
      allowedWarnings: [
        "business_idempotent:already_started",
        "jobs_board",
      ],
    }
  );
  const state = await getBuildingState();
  const property = state.completedProperties?.[buildCase.propertyId];
  const businessId = property?.businessId ?? `business_${buildCase.propertyId}`;
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "run_business_cycle",
      plotId: buildCase.plotId,
      propertyId: buildCase.propertyId,
      businessId,
      cycles: 2,
    },
    { label: `run-business-${buildCase.businessType}` }
  );
  await checkedPost(
    "request_property_building_mutation",
    "building",
    {
      buildingAction: "collect_business_revenue",
      plotId: buildCase.plotId,
      propertyId: buildCase.propertyId,
      businessId,
    },
    { label: `collect-business-${buildCase.businessType}` }
  );
  const after = await getBuildingState();
  const business = after.businesses?.[businessId];
  const entry = {
    businessType: buildCase.businessType,
    propertyId: buildCase.propertyId,
    businessId,
    startRequestId: start.requestId,
    businessExists: Boolean(business),
    lifetimeRevenueGold: business?.lifetimeRevenueGold,
    marker: Boolean(after.inWorldMarkers?.[`${businessId}:marker`]),
    ownerNpc: Boolean(after.inWorldMarkers?.[`${businessId}:owner-npc`]),
    ok:
      Boolean(business) &&
      Boolean(after.inWorldMarkers?.[`${businessId}:marker`]) &&
      Boolean(after.inWorldMarkers?.[`${businessId}:owner-npc`]),
  };
  report.businessRuns.push(entry);
  if (!entry.ok) {
    throw new Error(`business verification failed ${buildCase.businessType}`);
  }
  return entry;
}

async function runAuthoredBlueprintMatrix() {
  console.log("== Building all authored plot blueprint variations ==");
  const { authoredBlueprintCases, businessCases } = buildMatrix();
  report.totals.authoredPlotCount = BUILDING_SYSTEM_PLOTS.length;
  report.totals.authoredBlueprintCompletionsPlanned =
    authoredBlueprintCases.length + businessCases.length;
  report.totals.businessTypesPlanned = BUILDING_SYSTEM_BUSINESS_TYPES.length;

  for (const buildCase of authoredBlueprintCases) {
    const verification = await claimAndBuild(buildCase);
    const entry = { ...buildCase, verification };
    if (!buildCase.keep) {
      entry.demolition = await demolishProperty(buildCase);
    }
    report.authoredBlueprintCompletions.push(entry);
    writeReport();
  }

  console.log("== Building and operating all 19 business types ==");
  for (const buildCase of businessCases) {
    const verification = await claimAndBuild(buildCase);
    await runBusinessForProperty(buildCase);
    const entry = { ...buildCase, verification };
    if (!buildCase.keep) {
      entry.demolition = await demolishProperty(buildCase);
    }
    report.authoredBlueprintCompletions.push(entry);
    writeReport();
  }
}

async function runBusinessMatrixOnly() {
  console.log("== Resume: building and operating all 19 business types ==");
  const { businessCases } = buildMatrix();
  report.totals.authoredBlueprintCompletionsPlanned = businessCases.length;
  report.totals.businessTypesPlanned = BUILDING_SYSTEM_BUSINESS_TYPES.length;
  for (const buildCase of businessCases) {
    const verification = await claimAndBuild(buildCase);
    await runBusinessForProperty(buildCase);
    const entry = { ...buildCase, verification };
    if (!buildCase.keep) {
      entry.demolition = await demolishProperty(buildCase);
    }
    report.authoredBlueprintCompletions.push(entry);
    writeReport();
  }
}

function emptyDecorationStateIfMissing(state) {
  return (
    state.homeDecoration ?? {
      placed: {},
      nextDecorationNumber: 1,
      propertySummaries: {},
      appliedRequestIds: {},
    }
  );
}

function findPlacementForDefinition(definition, state, propertyId) {
  const property = state.completedProperties?.[propertyId];
  const decorationState = emptyDecorationStateIfMissing(state);
  const rotations = [0, 90, 180, 270];
  for (const rotationDegrees of rotations) {
    for (let z = 0; z <= 12; z += 1) {
      for (let x = 0; x <= 12; x += 1) {
        const position = { x, y: 0, z };
        const result = validateHarthmereHomeDecorationGuidePlacement({
          definition,
          state: decorationState,
          property,
          position,
          rotationDegrees,
        });
        if (result.ok) {
          return { position, rotationDegrees };
        }
      }
    }
  }
  throw new Error(
    `no valid decoration position for ${definition.itemId} on ${propertyId}`
  );
}

async function ensureCarriedItem(itemId) {
  const inventory = await getInventoryState();
  const have = Math.max(0, Math.trunc(Number(inventory.actor?.items?.[itemId] ?? 0)));
  if (have > 0) return;
  await checkedPost(
    "request_loot_roll",
    "loot",
    { itemId, count: 1 },
    { label: `grant-decor-${itemId}` }
  );
}

async function clearBackpackForDecorationRun() {
  const before = await getInventoryState();
  const beforeItems = before.actor?.items ?? {};
  const entries = Object.entries(beforeItems)
    .map(([itemId, count]) => [itemId, Math.max(0, Math.trunc(Number(count) || 0))])
    .filter(([, count]) => count > 0);
  if (!entries.length) {
    report.decorationBackpackPrep = {
      beforeItemCount: 0,
      afterItemCount: 0,
      bankDeposits: 0,
      destroyed: 0,
    };
    return;
  }

  let bankDeposits = 0;
  for (const [itemId, count] of entries) {
    await checkedPost(
      "request_bank_transaction",
      "bank",
      { operation: "deposit", itemId, count },
      {
        label: `decor-prep-bank-${itemId}`,
        allowedWarnings: [
          "bank_rejected:bank_full",
          "bank_rejected:cannot_bank_quest_item",
          "bank_rejected:insufficient_item_count",
          "bank_rejected:unknown_item_id",
          "bank_rejected:invalid_count",
        ],
      }
    );
    bankDeposits += 1;
  }

  const afterBank = await getInventoryState();
  const remainingEntries = Object.entries(afterBank.actor?.items ?? {})
    .map(([itemId, count]) => [itemId, Math.max(0, Math.trunc(Number(count) || 0))])
    .filter(([, count]) => count > 0);

  let destroyed = 0;
  for (const [itemId, count] of remainingEntries) {
    await checkedPost(
      "request_inventory_item_action",
      "inventory",
      { operation: "destroy_item", itemId, count },
      {
        label: `decor-prep-destroy-${itemId}`,
        allowedWarnings: [
          "inventory_item_rejected:insufficient_item_count",
          "inventory_item_rejected:unknown_item_id",
          "inventory_item_rejected:cannot_destroy_quest_item",
          "inventory_item_rejected:cannot_destroy_bound_item",
          "inventory_item_rejected:cannot_remove_bound_item",
        ],
      }
    );
    destroyed += 1;
  }

  const after = await getInventoryState();
  report.decorationBackpackPrep = {
    beforeItemCount: entries.length,
    afterItemCount: Object.keys(after.actor?.items ?? {}).length,
    bankDeposits,
    destroyed,
    remainingItems: after.actor?.items ?? {},
  };
  writeReport();
}

function decorationClaimsForProperty(state, propertyId) {
  const property = state.completedProperties?.[propertyId];
  const markerIds = [];
  if (property?.use === "home") {
    markerIds.push(`home_console_${propertyId}`);
  }

  const businessId = property?.businessId ?? `business_${propertyId}`;
  if (property?.use === "business" || state.businesses?.[businessId]) {
    markerIds.push(`${businessId}:marker`, `${businessId}:owner-npc`);
  }

  for (const markerId of markerIds) {
    const position = markerPosition(state.inWorldMarkers?.[markerId]);
    if (position) {
      return { runtimePosition: position, actorPosition: position };
    }
  }

  return {};
}

async function placeDecoration(definition, propertyId, reason) {
  await ensureCarriedItem(definition.itemId);
  const before = await getBuildingState();
  const beforeIds = new Set(Object.keys(before.homeDecoration?.placed ?? {}));
  const placement = findPlacementForDefinition(definition, before, propertyId);
  const result = await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "place_decoration",
      propertyId,
      itemId: definition.itemId,
      position: placement.position,
      rotationDegrees: placement.rotationDegrees,
    },
    {
      label: `${reason}-place-${definition.itemId}`,
      clientClaims: decorationClaimsForProperty(before, propertyId),
    }
  );
  const after = await getBuildingState();
  const placed = Object.values(after.homeDecoration?.placed ?? {}).find(
    (record) =>
      record.propertyId === propertyId &&
      record.itemId === definition.itemId &&
      !beforeIds.has(record.decorationId)
  );
  if (!placed) {
    throw new Error(`decoration place did not create record: ${definition.itemId}`);
  }
  return { requestId: result.requestId, record: placed, placement };
}

async function removeDecoration(record, propertyId, reason) {
  const state = await getBuildingState();
  await checkedPost(
    "request_home_decoration",
    "home_decoration",
    {
      operation: "remove_decoration",
      propertyId,
      decorationId: record.decorationId,
    },
    {
      label: `${reason}-remove-${record.itemId}`,
      clientClaims: decorationClaimsForProperty(state, propertyId),
    }
  );
  await checkedPost(
    "request_inventory_item_action",
    "inventory",
    {
      operation: "destroy_item",
      itemId: record.itemId,
      count: 1,
    },
    {
      label: `${reason}-destroy-${record.itemId}`,
      allowedWarnings: ["inventory_item_rejected:insufficient_item_count"],
    }
  );
}

function targetPropertyForDecoration(definition) {
  if (definition.allowedPropertyUses.includes("home")) {
    return FINAL_HOME.propertyId;
  }
  if (definition.allowedPropertyUses.includes("business")) {
    return FINAL_BUSINESS.propertyId;
  }
  throw new Error(
    `decoration ${definition.itemId} is not placeable in final home or business`
  );
}

async function exerciseAllDecorationOptions() {
  console.log("== Exercising every decoration option on live ==");
  await clearBackpackForDecorationRun();
  const definitions = listHarthmereHomeDecorationDefinitions();
  report.totals.decorationDefinitionsPlanned = definitions.length;
  for (const definition of definitions) {
    const propertyId = targetPropertyForDecoration(definition);
    const placed = await placeDecoration(definition, propertyId, "decor-test");
    const entry = {
      itemId: definition.itemId,
      displayName: definition.displayName,
      kind: definition.kind,
      propertyId,
      decorationId: placed.record.decorationId,
      position: placed.record.position,
      rotationDegrees: placed.record.rotationDegrees,
      placeRequestId: placed.requestId,
      ok: true,
    };
    await removeDecoration(placed.record, propertyId, "decor-test");
    report.decorationTests.push(entry);
    writeReport();
  }
}

async function placeFinalDecorations() {
  console.log("== Leaving final home and business decorated ==");
  const definitions = new Map(
    listHarthmereHomeDecorationDefinitions().map((definition) => [
      definition.itemId,
      definition,
    ])
  );
  const wanted = [
    { itemId: "home_storage_cabinet", propertyId: FINAL_HOME.propertyId },
    { itemId: "hearth_lamp", propertyId: FINAL_HOME.propertyId },
    { itemId: "garden_planter_box", propertyId: FINAL_HOME.propertyId },
    { itemId: "small_bed", propertyId: FINAL_HOME.propertyId },
    {
      itemId: "business_service_counter",
      propertyId: FINAL_BUSINESS.propertyId,
    },
    { itemId: "utility_core", propertyId: FINAL_BUSINESS.propertyId },
    { itemId: "table", propertyId: FINAL_BUSINESS.propertyId },
    { itemId: "hearth_lamp", propertyId: FINAL_BUSINESS.propertyId },
  ];
  for (const entry of wanted) {
    const definition = definitions.get(entry.itemId);
    if (!definition) throw new Error(`missing final decor definition ${entry.itemId}`);
    const placed = await placeDecoration(
      definition,
      entry.propertyId,
      "decor-final"
    );
    report.finalDecorations.push({
      itemId: definition.itemId,
      displayName: definition.displayName,
      propertyId: entry.propertyId,
      decorationId: placed.record.decorationId,
      position: placed.record.position,
      rotationDegrees: placed.record.rotationDegrees,
      requestId: placed.requestId,
    });
    writeReport();
  }
}

async function verifyFinalState() {
  console.log("== Final live verification ==");
  const state = await getBuildingState();
  const decorations = Object.values(state.homeDecoration?.placed ?? {});
  const homeDecor = decorations.filter(
    (record) => record.propertyId === FINAL_HOME.propertyId
  );
  const businessDecor = decorations.filter(
    (record) => record.propertyId === FINAL_BUSINESS.propertyId
  );
  const business = state.completedProperties?.[FINAL_BUSINESS.propertyId];
  const businessId = business?.businessId ?? `business_${FINAL_BUSINESS.propertyId}`;
  const owned = state.ownedPlotIds ?? state.ownedPlots ?? [];
  report.verification = {
    actorId: state.actorId,
    gold: state.gold,
    ownedPlotIds: owned,
    completedPropertyIds: Object.keys(state.completedProperties ?? {}),
    staticAuthoredBlueprintsCompleted:
      report.authoredBlueprintCompletions.length,
    dynamicMuckBuildsCompleted: report.dynamicMuckBuilds.filter(
      (entry) => entry.verification?.ok
    ).length,
    materialSourceAuditCount: report.materialSourceAudit.length,
    materialSingleBuys: report.materialPurchases.length,
    businessRuns: report.businessRuns.length,
    decorationDefinitionsTested: report.decorationTests.length,
    finalHome: {
      propertyId: FINAL_HOME.propertyId,
      exists: Boolean(state.completedProperties?.[FINAL_HOME.propertyId]),
      progress: state.buildingProgress?.[FINAL_HOME.propertyId],
      storage: Boolean(
        state.storageContainers?.[`storage_${FINAL_HOME.propertyId}`]
      ),
      door: Boolean(state.doorLocks?.[`door_${FINAL_HOME.propertyId}`]),
      console: Boolean(
        state.inWorldMarkers?.[`home_console_${FINAL_HOME.propertyId}`]
      ),
      decorationCount: homeDecor.length,
      decorations: homeDecor.map((record) => record.displayName),
    },
    finalBusiness: {
      propertyId: FINAL_BUSINESS.propertyId,
      businessType: FINAL_BUSINESS.businessType,
      businessId,
      exists: Boolean(business),
      progress: state.buildingProgress?.[FINAL_BUSINESS.propertyId],
      businessExists: Boolean(state.businesses?.[businessId]),
      storage: Boolean(
        state.storageContainers?.[`storage_${FINAL_BUSINESS.propertyId}`]
      ),
      door: Boolean(state.doorLocks?.[`door_${FINAL_BUSINESS.propertyId}`]),
      marker: Boolean(state.inWorldMarkers?.[`${businessId}:marker`]),
      ownerNpc: Boolean(state.inWorldMarkers?.[`${businessId}:owner-npc`]),
      decorationCount: businessDecor.length,
      decorations: businessDecor.map((record) => record.displayName),
    },
  };
  const failures = [];
  const resumeDecorOnly = RESUME_PHASE === "decor_only";
  const resumeBusinessDecor = RESUME_PHASE === "business_decor" || resumeDecorOnly;
  if (!resumeBusinessDecor && report.staticPlotClaimBatch.ok !== true)
    failures.push("static_plot_batch_claim_not_verified");
  if (
    !resumeBusinessDecor &&
    report.dynamicMuckBuilds.filter((entry) => entry.verification?.ok).length < 2
  )
    failures.push("dynamic_muck_builds_below_2");
  if (
    !resumeBusinessDecor &&
    !report.dynamicMuckBuilds.some(
      (entry) => entry.expectedRejection === true && entry.ok === true
    )
  ) {
    failures.push("dynamic_overlap_rejection_missing");
  }
  if (
    !resumeBusinessDecor &&
    report.authoredBlueprintCompletions.length !==
    report.totals.authoredBlueprintCompletionsPlanned
  ) {
    failures.push("authored_blueprint_completion_count_mismatch");
  }
  if (
    !resumeDecorOnly &&
    report.businessRuns.length !== BUILDING_SYSTEM_BUSINESS_TYPES.length
  )
    failures.push("business_run_count_mismatch");
  if (
    report.decorationTests.length !==
    listHarthmereHomeDecorationDefinitions().length
  ) {
    failures.push("decoration_test_count_mismatch");
  }
  if (!report.verification.finalHome.exists) failures.push("final_home_missing");
  if (report.verification.finalHome.progress !== 100)
    failures.push("final_home_progress_not_100");
  if (!report.verification.finalHome.storage)
    failures.push("final_home_storage_missing");
  if (!report.verification.finalHome.door)
    failures.push("final_home_door_missing");
  if (!report.verification.finalHome.console)
    failures.push("final_home_console_missing");
  if (report.verification.finalHome.decorationCount < 4)
    failures.push("final_home_decor_below_4");
  if (!report.verification.finalBusiness.exists)
    failures.push("final_business_missing");
  if (report.verification.finalBusiness.progress !== 100)
    failures.push("final_business_progress_not_100");
  if (!report.verification.finalBusiness.businessExists)
    failures.push("final_business_record_missing");
  if (!report.verification.finalBusiness.marker)
    failures.push("final_business_marker_missing");
  if (!report.verification.finalBusiness.ownerNpc)
    failures.push("final_business_owner_npc_missing");
  if (report.verification.finalBusiness.decorationCount < 4)
    failures.push("final_business_decor_below_4");
  if (failures.length) {
    report.failures.push({ phase: "verifyFinalState", failures });
    writeReport();
    throw new Error(`final verification failed: ${failures.join("; ")}`);
  }
  writeReport();
}

async function main() {
  console.log(`Live exhaustive build/business/decor run ${RUN_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Install ID: ${INSTALL_ID}`);
  console.log(`Report: ${REPORT_PATH}`);
  await getBuildingState();
  if (RESUME_PHASE === "decor_only") {
    console.log("== Resume: decoration and final verification only ==");
  } else if (RESUME_PHASE === "business_decor") {
    await acquireBusinessResumeMaterials();
    await runBusinessMatrixOnly();
  } else {
    await acquireMaterials();
    await claimAllStaticPlotsBatch();
    await buildDynamicMuckClaims();
    await runAuthoredBlueprintMatrix();
  }
  await exerciseAllDecorationOptions();
  await placeFinalDecorations();
  await verifyFinalState();
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;
  report.totals.actionCount = report.actions.length;
  report.totals.warningCount = report.warnings.length;
  report.totals.failureCount = report.failures.length;
  writeReport();
  console.log(`\nPASS ${RUN_ID}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  report.failedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;
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
