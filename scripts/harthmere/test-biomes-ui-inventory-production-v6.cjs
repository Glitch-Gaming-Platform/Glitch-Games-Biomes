#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const files = {
  inventoryTab: path.join(root, 'src/client/components/biomes_ui/tabs/InventoryTab.tsx'),
  adapter: path.join(root, 'src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts'),
  guildsTab: path.join(root, 'src/client/components/biomes_ui/tabs/GuildsTab.tsx'),
  theme: path.join(root, 'src/client/components/biomes_ui/theme/biomesUITheme.ts'),
  uniqueIds: path.join(root, 'src/client/components/biomes_ui/uniqueIds.ts'),
  building: path.join(root, 'src/shared/harthmere/building_system_v1.ts'),
};

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`OK ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}
function read(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}
function transpiles(file) {
  const source = read(file);
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const diagnostics = result.diagnostics || [];
  if (diagnostics.length) {
    diagnostics.forEach((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.error(`${file}: ${message}`);
    });
  }
  return diagnostics.length === 0;
}

const inventoryTab = read(files.inventoryTab);
const adapter = read(files.adapter);
const guildsTab = read(files.guildsTab);
const theme = read(files.theme);
const uniqueIds = read(files.uniqueIds);
const building = read(files.building);

console.log('== BiomesUI production inventory v6 ==');
ok(fs.existsSync(files.inventoryTab), 'InventoryTab exists');
ok(inventoryTab.includes('data-production-inventory="true"'), 'Inventory tab declares production inventory mode');
ok(!inventoryTab.includes('empty scaffold so the panel'), 'Inventory tab no longer describes placeholder scaffold behavior');
ok(inventoryTab.includes('Search inventory'), 'Inventory tab has item search');
ok(inventoryTab.includes('Inventory filters'), 'Inventory tab has category filters');
ok(inventoryTab.includes('RovingGrid'), 'Inventory backpack remains keyboard navigable with RovingGrid');
ok(inventoryTab.includes('getCurrencies'), 'Inventory tab displays currency balances');
ok(inventoryTab.includes('getSelectedItem'), 'Inventory tab displays selected item details');
ok(inventoryTab.includes('data-inventory-action="sort"'), 'Inventory tab exposes sort action');
ok(inventoryTab.includes('data-inventory-action="equip"'), 'Inventory tab exposes equip action');
ok(inventoryTab.includes('data-inventory-action="move-hotbar"'), 'Inventory tab exposes hotbar move action');
ok(inventoryTab.includes('data-inventory-action="split"'), 'Inventory tab exposes split stack action');
ok(inventoryTab.includes('data-inventory-action="drop-one"') && inventoryTab.includes('data-inventory-action="drop-all"'), 'Inventory tab exposes drop one/all actions');
ok(inventoryTab.includes('data-inventory-action="destroy"'), 'Inventory tab exposes destroy action');
ok(inventoryTab.includes('adapter?.selectItem') && inventoryTab.includes('adapter?.equipItem'), 'Inventory tab delegates behavior to live adapter instead of mutating local truth');
ok(!inventoryTab.includes('localStorage'), 'Inventory tab does not use localStorage as inventory truth');

ok(adapter.includes('reactResources.use("/ecs/c/inventory", userId)'), 'live adapter reads real ECS inventory component');
ok(adapter.includes('reactResources.use("/ecs/c/wearing", userId)'), 'live adapter reads real ECS wearing/equipment component');
ok(adapter.includes('InventoryChangeSelectionEvent'), 'live adapter publishes selection events');
ok(adapter.includes('InventorySwapEvent'), 'live adapter publishes swap/move/equip events');
ok(adapter.includes('InventorySplitEvent'), 'live adapter publishes split events');
ok(adapter.includes('InventoryCombineEvent'), 'live adapter publishes combine events');
ok(adapter.includes('InventorySortEvent'), 'live adapter publishes sort events');
ok(adapter.includes('throwInventoryItem'), 'live adapter delegates item dropping to real throw helper');
ok(adapter.includes('destroyInventoryItem'), 'live adapter delegates deletion to real destroy helper');
ok(adapter.includes('slotToInventoryUiItem'), 'live adapter normalizes live item slots for BiomesUI');
ok(adapter.includes('inferEquipSlot'), 'live adapter infers equipment slots from item metadata');
ok(adapter.includes('getCurrencies: inventoryAdapter.getCurrencies'), 'banking and inventory share live currency source');
ok(!adapter.includes('sample Bare Hands') && !adapter.includes('Singularity Block'), 'live adapter does not use sample inventory data');

ok(theme.includes('.biomes-ui-inventory'), 'runtime theme includes inventory layout styles');
ok(theme.includes('.biomes-ui-inventory__toolbar'), 'runtime theme includes inventory toolbar styles');
ok(theme.includes('.biomes-ui-inventory__actions'), 'runtime theme includes inventory action styles');
ok(theme.includes('@media (max-width: 980px)') && theme.includes('@media (max-width: 560px)'), 'runtime theme includes tablet/mobile inventory breakpoints');
ok(uniqueIds.includes('INVENTORY_BACKPACK_SLOT'), 'unique ids expose backpack slot helper');
ok(uniqueIds.includes('INVENTORY_ACTION'), 'unique ids expose inventory action helper');

ok(guildsTab.includes('BUILDING_SYSTEM_BLUEPRINTS_V1'), 'Guild tab reads building catalogue');
ok(guildsTab.includes('buildingUse === "guild"') || guildsTab.includes('use === "guild"'), 'Guild tab verifies guild building type');
ok(guildsTab.includes('data-guild-building-guide="true"'), 'Guild tab includes guild hall building guide');
ok(guildsTab.includes('Open the Building System tab'), 'Guild guide tells players how to build a guild hall');
ok(uniqueIds.includes('GUILD_BUILDING_GUIDE'), 'unique ids expose guild guide highlight target');
ok(/buildingUse\s*:\s*["']guild["']/.test(building) || /use\s*:\s*["']guild["']/.test(building), 'Building catalogue still contains guild building type');

for (const file of [files.inventoryTab, files.adapter, files.guildsTab, files.theme, files.uniqueIds]) {
  ok(transpiles(file), `${path.relative(root, file)} transpiles without syntax errors`);
}

console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
if (failed) {
  console.error(`${passed} passed, ${failed} failed.`);
  process.exit(1);
}
