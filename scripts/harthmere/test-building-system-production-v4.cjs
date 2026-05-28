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

function envelope(actionKind, payload = {}, actorId = "player-building-v4") {
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

function apply(state, payload, now = 2000, actorId = "player-building-v4") {
  const { reduceHarthmereLiveModeBackendStateV1 } = require("../../src/shared/harthmere/live_mode_backend_v1");
  return reduceHarthmereLiveModeBackendStateV1(
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
  state.inventory.gold = 2000;
  for (const entry of Object.values(catalog)) {
    state.inventory.items[entry.itemId] = 2000;
  }
}

function completeCottage(state, now = 2000) {
  const { BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1 } = require("../../src/shared/harthmere/building_system_v1");
  state = apply(state, { buildingAction: "claim_plot", plotId: "grove_muckstead_cottage_lot" }, now).state;
  state = apply(state, { buildingAction: "start_construction", plotId: "grove_muckstead_cottage_lot", blueprintId: "grove_voxel_cottage_tier_1" }, now + 100).state;
  for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1) {
    state = apply(state, {
      buildingAction: "contribute_stage",
      plotId: "grove_muckstead_cottage_lot",
      stage,
      contributeAll: true,
      laborDelta: 999,
    }, now + 200).state;
  }
  return state;
}

console.log("== Building System production hardening v4 ==");

const catalogSource = read("src/shared/harthmere/building_system_v1.ts");
const backendSource = read("src/shared/harthmere/live_mode_backend_v1.ts");
const landTabSource = read("src/client/components/biomes_ui/tabs/LandTab.tsx");
const localQuestSource = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const groveContentSource = read("src/shared/harthmere/snapshot_grove_content_v75.ts");

check(catalogSource.includes("BuildingSystemPropertyPermissionsV1"), "shared catalogue defines real property permissions");
check(catalogSource.includes("storage_access") && catalogSource.includes("build_edit") && catalogSource.includes("demolition") && catalogSource.includes("transfer_sale"), "permission model covers storage, build/edit, demolition, transfer/sale");
check(catalogSource.includes("applyBuildingSystemPropertyLifecycleV1"), "shared catalogue defines tax and repair lifecycle helper");
check(catalogSource.includes("businessTaxRate") && catalogSource.includes("guildTaxRate"), "property records include business and guild tax rates");
check(catalogSource.includes("BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1"), "shared catalogue defines Mira intro quest");
check(backendSource.includes('subAction === "set_access_mode"') && backendSource.includes('subAction === "set_permission"'), "backend implements access mode and permission mutations");
check(backendSource.includes('subAction === "repair_property"') && backendSource.includes('subAction === "upgrade_property"'), "backend implements repair and upgrade flows");
check(backendSource.includes('subAction === "demolish_property"') && backendSource.includes('storage_not_empty'), "backend blocks demolition when storage contains items");
check(backendSource.includes('subAction === "pay_property_tax"') && backendSource.includes("houseTaxAccumulated"), "backend implements tax payment and economy sink");
check(backendSource.includes('subAction === "talk_to_steward"') && backendSource.includes("building_steward_intro"), "backend completes Mira intro quest when talking to steward");
check(landTabSource.includes('submit("talk_to_steward"') && landTabSource.includes("Pay Taxes") && landTabSource.includes("Upgrade T2") && landTabSource.includes("Demolish"), "BiomesUI exposes Mira talk and hardened property actions");
check(localQuestSource.includes("BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1") && localQuestSource.indexOf("BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1") < localQuestSource.indexOf('"welcome-to-harthmere"'), "local quest list puts Mira intro before older starter quest");
check(groveContentSource.includes("BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1") && groveContentSource.includes('triggers: ["talk_npc"]'), "Grove snapshot quests include one-step talk-to-Mira quest");

installTypeScriptRuntime();

const {
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1,
  BUILDING_SYSTEM_MATERIAL_CATALOG_V1,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1,
  buildingSystemCanActorAccessPropertyV1,
  buildingSystemDemolitionRefundGoldV1,
} = require("../../src/shared/harthmere/building_system_v1");
const {
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeBackendStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");

let state = defaultHarthmereLiveModeBackendStateV1("player-building-v4", 1000);
check(Boolean(state.quests.active[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId]), "new players start with Mira intro quest active");
let talked = apply(state, { buildingAction: "talk_to_steward" }, 1500);
check(Boolean(talked.state.quests.completed[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId]), "talking to Mira completes intro quest server-side");
check(!talked.state.quests.active[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId], "Mira intro quest is removed from active quests after talk");
check(Object.values(talked.state.building.inWorldMarkers).some((m) => m.kind === "npc_board" && m.label.includes("Mira")), "talking to Mira persists NPC/board marker metadata");

state = defaultHarthmereLiveModeBackendStateV1("player-building-v4", 1000);
grantConstructionMaterials(state, BUILDING_SYSTEM_MATERIAL_CATALOG_V1);
state = completeCottage(state, 2000);
let property = getProp(state);
check(Boolean(property), "completed construction creates a full property record");
check(property.ownerId === "player-building-v4", "property record stores owner id");
check(property.permissions.owner.storage_access && property.permissions.owner.build_edit && property.permissions.owner.demolition && property.permissions.owner.transfer_sale, "owner receives all property permissions");
check(!property.permissions.public.build_edit && !property.permissions.public.demolition && !property.permissions.public.transfer_sale, "public role cannot edit, demolish, or transfer by default");
check(buildingSystemCanActorAccessPropertyV1({ property, actorId: "player-building-v4", permission: "demolition" }) === true, "owner can pass demolition permission check");
check(buildingSystemCanActorAccessPropertyV1({ property, actorId: "stranger", permission: "demolition" }) === false, "stranger cannot pass demolition permission check");

let publicAccess = apply(state, { buildingAction: "set_access_mode", plotId: "grove_muckstead_cottage_lot", accessMode: "public" }, 3000);
property = getProp(publicAccess.state);
check(property.accessMode === "public", "set_access_mode changes property public/private setting");
check(property.permissions.public.storage_access === true, "public access mode grants public storage access only when explicitly public");
check(property.permissions.public.build_edit === false, "public access mode still does not grant public build/edit");
state = publicAccess.state;

let friendPerm = apply(state, { buildingAction: "set_permission", plotId: "grove_muckstead_cottage_lot", subject: "friends_guests", permission: "storage_access", enabled: true }, 3100);
property = getProp(friendPerm.state);
check(property.permissions.friends_guests.storage_access === true, "owner can grant friend/guest storage access");
state = friendPerm.state;

let addGuest = apply(state, { buildingAction: "add_guest", plotId: "grove_muckstead_cottage_lot", guestActorId: "friend-1" }, 3200);
property = getProp(addGuest.state);
check(property.guestActorIds.includes("friend-1"), "owner can add guest access records");
check(buildingSystemCanActorAccessPropertyV1({ property, actorId: "friend-1", permission: "storage_access" }) === true, "guest receives granted storage access");
let removeGuest = apply(addGuest.state, { buildingAction: "remove_guest", plotId: "grove_muckstead_cottage_lot", guestActorId: "friend-1" }, 3300);
check(!getProp(removeGuest.state).guestActorIds.includes("friend-1"), "owner can remove guest access records");
state = removeGuest.state;

// Force lifecycle clocks into the past so manage_property must assess taxes and repair decay.
state.property.owned[propertyId()].lastTaxAssessedAtMs = 1000;
state.property.owned[propertyId()].lastRepairDecayAtMs = 1000;
const lifecycleNow = 1000 + 3 * 24 * 60 * 60 * 1000;
let lifecycle = apply(state, { buildingAction: "manage_property", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow);
property = getProp(lifecycle.state);
check(property.taxBalanceGold > 0, "manage_property assesses unpaid taxes over time");
check(property.condition < 100 && property.repairDebtGold > 0, "manage_property applies repair decay over time");
check(lifecycle.summary.touchedModels.includes("property_tax") && lifecycle.summary.touchedModels.includes("property_repair_decay"), "lifecycle mutation reports tax and repair touched models");
state = lifecycle.state;

const taxDue = getProp(state).taxBalanceGold;
const goldBeforeTax = state.inventory.gold;
let tax = apply(state, { buildingAction: "pay_property_tax", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow + 1000);
property = getProp(tax.state);
check(property.taxBalanceGold === 0, "pay_property_tax clears assessed taxes when enough gold exists");
check(tax.state.inventory.gold === goldBeforeTax - taxDue, "pay_property_tax deducts gold from server wallet");
check(tax.state.economy.houseTaxAccumulated >= taxDue, "paid taxes accumulate in economy sink");
state = tax.state;

const repairCostGold = 100 - getProp(state).condition;
let repair = apply(state, { buildingAction: "repair_property", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow + 2000);
property = getProp(repair.state);
check(property.condition === 100 && property.repairDebtGold === 0, "repair_property restores condition and clears repair debt");
check(repair.state.inventory.gold <= state.inventory.gold - repairCostGold, "repair_property charges gold for decay repair");
state = repair.state;

const tierBefore = getProp(state).tier;
const valueBefore = getProp(state).value;
const storageBefore = getProp(state).storageSlots;
let upgrade = apply(state, { buildingAction: "upgrade_property", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow + 3000);
property = getProp(upgrade.state);
check(property.tier === tierBefore + 1, "upgrade_property raises tier from 1 to 2");
check(property.value > valueBefore && property.storageSlots > storageBefore, "upgrade_property increases value and storage slots");
let duplicateUpgrade = apply(upgrade.state, { buildingAction: "upgrade_property", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow + 4000);
check(duplicateUpgrade.summary.warnings.includes("property_upgrade_rejected:max_tier_reached"), "duplicate tier-2 upgrade is rejected");
state = upgrade.state;

let storage = apply(state, { buildingAction: "set_storage_item_count", plotId: "grove_muckstead_cottage_lot", storageItemCount: 2 }, lifecycleNow + 5000);
let blockedDemolition = apply(storage.state, { buildingAction: "demolish_property", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow + 6000);
check(blockedDemolition.summary.warnings.includes("property_demolition_rejected:storage_not_empty"), "demolition is blocked while storage contains items");
storage = apply(storage.state, { buildingAction: "set_storage_item_count", plotId: "grove_muckstead_cottage_lot", storageItemCount: 0 }, lifecycleNow + 7000);
const refundEstimate = buildingSystemDemolitionRefundGoldV1(getProp(storage.state));
const goldBeforeDemolition = storage.state.inventory.gold;
let demolished = apply(storage.state, { buildingAction: "demolish_property", plotId: "grove_muckstead_cottage_lot" }, lifecycleNow + 8000);
check(!getProp(demolished.state), "demolition removes completed property record");
check(!demolished.state.building.ownedPlots.includes("grove_muckstead_cottage_lot"), "demolition releases owned plot claim");
check(demolished.state.inventory.gold === goldBeforeDemolition + refundEstimate, "demolition grants calculated refund when eligible");

let saleState = defaultHarthmereLiveModeBackendStateV1("player-building-v4", 1000);
grantConstructionMaterials(saleState, BUILDING_SYSTEM_MATERIAL_CATALOG_V1);
saleState = completeCottage(saleState, 2000);
let sale = apply(saleState, { buildingAction: "list_property_for_sale", plotId: "grove_muckstead_cottage_lot", salePriceGold: 777 }, 3000);
property = getProp(sale.state);
check(property.listedForSale === true && property.salePriceGold === 777 && property.status === "for_sale", "owner can list property for sale with server price");
let transfer = apply(sale.state, { buildingAction: "transfer_property", plotId: "grove_muckstead_cottage_lot", newOwnerId: "new-owner" }, 4000);
property = getProp(transfer.state);
check(property.ownerId === "new-owner" && property.listedForSale === false, "owner can transfer/sell property to a new owner id");
let postTransferEdit = apply(transfer.state, { buildingAction: "set_access_mode", plotId: "grove_muckstead_cottage_lot", accessMode: "private" }, 5000);
check(postTransferEdit.summary.warnings.includes("property_rejected:not_owner"), "previous owner cannot edit transferred property");

let abandoned = defaultHarthmereLiveModeBackendStateV1("player-building-v4", 1000);
grantConstructionMaterials(abandoned, BUILDING_SYSTEM_MATERIAL_CATALOG_V1);
abandoned = completeCottage(abandoned, 2000);
abandoned.property.owned[propertyId()].taxBalanceGold = 999;
abandoned.property.owned[propertyId()].unpaidTaxSinceMs = 1000;
let abandonment = apply(abandoned, { buildingAction: "manage_property", plotId: "grove_muckstead_cottage_lot" }, 1000 + BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1 + 1);
property = getProp(abandonment.state);
check(property.abandoned === true && property.status === "abandoned", "unpaid taxes can mark a property abandoned");
check(abandonment.summary.warnings.includes("property_marked_abandoned:unpaid_taxes"), "abandonment warning is emitted for unpaid taxes");

let shop = defaultHarthmereLiveModeBackendStateV1("player-building-v4", 1000);
grantConstructionMaterials(shop, BUILDING_SYSTEM_MATERIAL_CATALOG_V1);
shop = apply(shop, { buildingAction: "claim_plot", plotId: "grove_crossroads_shop_lot" }, 2000).state;
shop = apply(shop, { buildingAction: "place", plotId: "grove_crossroads_shop_lot", blueprintId: "grove_voxel_shop_tier_1" }, 2100).state;
const shopProp = getProp(shop, "grove_crossroads_shop_lot");
check(shopProp.use === "business" && shopProp.businessTaxRate >= 0.08, "business property receives hardened business tax rate");
let guild = defaultHarthmereLiveModeBackendStateV1("player-building-v4", 1000);
grantConstructionMaterials(guild, BUILDING_SYSTEM_MATERIAL_CATALOG_V1);
guild = apply(guild, { buildingAction: "claim_plot", plotId: "grove_guild_green_lot" }, 2000).state;
guild = apply(guild, { buildingAction: "place", plotId: "grove_guild_green_lot", blueprintId: "grove_voxel_guild_hall_tier_1" }, 2100).state;
const guildProp = getProp(guild, "grove_guild_green_lot");
check(guildProp.use === "guild" && guildProp.guildTaxRate >= 0.05, "guild property receives hardened guild tax rate");

const parsed = parseHarthmereLiveModeBackendStateV1(JSON.stringify(transfer.state), "player-building-v4", 9000);
check(parsed.property.owned[propertyId()].ownerId === "new-owner", "property owner/permissions survive Redis serialization");
check(parsed.property.owned[propertyId()].permissions.owner.transfer_sale === true, "property permission record survives Redis serialization");

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
  "src/shared/harthmere/building_system_v1.ts",
  "src/shared/harthmere/live_mode_backend_v1.ts",
  "src/client/components/biomes_ui/tabs/LandTab.tsx",
  "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
  "src/shared/harthmere/snapshot_grove_content_v75.ts",
]) {
  transpileOnly(rel);
  check(true, `${rel} transpiles without syntax errors`);
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
