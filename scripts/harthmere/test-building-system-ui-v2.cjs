#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");

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

function transpile(rel) {
  let ts;
  try {
    ts = require("typescript");
  } catch (_) {
    ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
  }
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
  const errors = (result.diagnostics || []).filter(
    (diag) => diag.category === ts.DiagnosticCategory.Error
  );
  check(
    errors.length === 0,
    `${rel} transpiles without syntax errors`,
    errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, "\n")).join("\n")
  );
}

console.log("== Building System BiomesUI UX v2 ==");

const landTab = read("src/client/components/biomes_ui/tabs/LandTab.tsx");
const adapters = read("src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts");
const types = read("src/client/components/biomes_ui/BiomesUITypes.ts");
const theme = read("src/client/components/biomes_ui/theme/biomesUITheme.ts");
const ids = read("src/client/components/biomes_ui/uniqueIds.ts");
const catalog = read("src/shared/harthmere/building_system_v1.ts");

check(types.includes('label: "Building System"'), "BiomesUI Land tab is renamed to Building System");
check(types.includes('code: "BLD"'), "Building System tab uses BLD code");
check(types.includes('shortcut: "L"'), "Building System keeps the L shortcut");

check(landTab.includes("BUILDING_SYSTEM_PLOTS_V1"), "Building UI reads real shared Grove plot catalogue");
check(landTab.includes("BUILDING_SYSTEM_BLUEPRINTS_V1"), "Building UI reads real shared blueprint catalogue");
check(landTab.includes("BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1"), "Building UI uses the real Grove land steward NPC");
check(!landTab.includes("PLACEHOLDER"), "Building UI does not render placeholder plot/blueprint data");
check(catalog.includes("grove_muckstead_cottage_lot") && catalog.includes("grove_voxel_cottage_tier_1"), "catalog still contains Grove house plot and voxel home blueprint");
check(!catalog.includes('blueprintId: "grove_voxel_shop_tier_1",\n    blueprintId:'), "catalog has no duplicate shop blueprint property");

check(landTab.includes('role="tablist"') && landTab.includes('aria-label="Building System flow"'), "Building flow exposes an accessible tab rail");
check(landTab.includes('event.key === "ArrowRight"') && landTab.includes('event.key === "ArrowLeft"'), "Building flow supports arrow-key tab navigation");
check(landTab.includes('event.key === "Home"') && landTab.includes('event.key === "End"'), "Building flow supports Home/End tab navigation");
check(landTab.includes("RovingGrid") && landTab.includes('ariaLabel="Grove purchasable plots"'), "plot selection uses BiomesUI roving grid navigation");
check(landTab.includes('ariaLabel="Allowed voxel blueprints"'), "blueprint selection uses BiomesUI roving grid navigation");

check(landTab.includes("Buy selected plot") && landTab.includes("Start construction") && landTab.includes("Contribute"), "UI covers buy, start construction, and staged contribution actions");
check(landTab.includes("manage_property") && landTab.includes("Sync property management"), "UI covers completed property management");
check(landTab.includes("home, business, or guild property") || landTab.includes("homes, businesses") || landTab.includes("guild"), "UI communicates non-home building uses");

check(landTab.includes('fetch("/api/harthmere/live_mode"') || landTab.includes("fetch('/api/harthmere/live_mode'"), "Land tab has a direct backend fallback to live_mode route");
check(landTab.includes('credentials: "same-origin"'), "Land tab sends authenticated same-origin backend requests");
check(landTab.includes('actionKind: "request_property_building_mutation"'), "Land tab sends building mutation action kind");
check(landTab.includes('subsystem: "building"'), "Land tab sends building subsystem");
check(landTab.includes('buildingAction: action'), "Land tab forwards the selected building action to backend payload");

check(adapters.includes("BUILDING_SYSTEM_PLOTS_V1") && adapters.includes("BUILDING_SYSTEM_BLUEPRINTS_V1"), "live adapter provides real Building System catalog data");
check(adapters.includes("submitBuildingSystemLiveModeAction"), "live adapter exposes a backend submit function");
check(adapters.includes('fetch("/api/harthmere/live_mode"'), "live adapter connects Building System UI to backend route");
check(adapters.includes('credentials: "same-origin"'), "live adapter uses authenticated same-origin requests");
check(adapters.includes("submitBuildingAction: submitBuildingSystemLiveModeAction"), "BiomesUI land adapter wires submitBuildingAction to backend");

check(ids.includes("BUILDING_TALK_STEWARD"), "unique ids include steward action highlight target");
check(ids.includes("BUILDING_PLOT") && ids.includes("BUILDING_BLUEPRINT"), "unique ids include plot and blueprint highlight targets");

check(theme.includes(".biomes-building-system"), "theme includes Building System container styles");
check(theme.includes(".biomes-building-step-rail"), "theme includes Building System tab rail styles");
check(theme.includes(".biomes-building-grid"), "theme includes Building System selection grid styles");
check(theme.includes("@media (max-width: 860px)") && theme.includes("@media (max-width: 520px)"), "theme includes tablet and mobile responsive breakpoints");
check(theme.includes("grid-template-columns: 1fr") && theme.includes("flex-direction: column"), "mobile CSS collapses layout and grid rows");

transpile("src/client/components/biomes_ui/tabs/LandTab.tsx");
transpile("src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts");
transpile("src/client/components/biomes_ui/BiomesUITypes.ts");
transpile("src/client/components/biomes_ui/theme/biomesUITheme.ts");
transpile("src/client/components/biomes_ui/uniqueIds.ts");
transpile("src/shared/harthmere/building_system_v1.ts");

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
