#!/usr/bin/env node
/* eslint-disable no-console */
const {
  createHarness,
  inventorySource,
} = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere vendor live UI contract current");
const inv = inventorySource(h);
h.ok(
  inv.includes("data-harthmere-vendor-trade-panel"),
  "vendor trade panel exposes a stable live-test selector"
);
h.ok(
  inv.includes("BiomesUIShopChrome") && inv.includes('variant="vendor"'),
  "every catalog vendor uses the shared BiomesUI Store chrome"
);
h.ok(
  inv.includes("BiomesUIShopItemIcon"),
  "vendor items use the shared icon renderer instead of printing icon URL strings"
);
h.ok(
  inv.includes('className="biomes-ui-container-backdrop"'),
  "vendor store uses the shared BiomesUI modal backdrop"
);
h.ok(
  inv.includes("HarthmereVendorTradeRequest | undefined\n  >(undefined);") &&
    inv.includes("openRequest();"),
  "persisted vendor requests restore after hydration instead of changing the first client render"
);
h.ok(
  inv.includes("data-harthmere-dynamic-vendor-price"),
  "vendor UI exposes dynamic price marker"
);
h.ok(
  inv.includes("data-harthmere-dynamic-vendor-modifiers"),
  "vendor UI explains dynamic modifiers"
);
h.ok(
  inv.includes("getHarthmereCurrentVendorStockLine"),
  "vendor UI reads live vendor stock state"
);
h.ok(
  inv.includes("biomes:harthmere-open-vendor-trade"),
  "vendor UI opens through the Harthmere vendor trade event"
);
h.ok(
  inv.includes("Buy") &&
    inv.includes("Sell") &&
    inv.includes("Transaction log"),
  "vendor panel keeps buy/sell/log visible to users"
);
h.done();
