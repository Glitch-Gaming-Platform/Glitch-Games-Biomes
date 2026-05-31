#!/usr/bin/env node
/* eslint-disable no-console */
const {
  createHarness,
  vendorSource,
  itemBlocks,
} = require("./harthmere-economy-test-lib-v1.cjs");

const h = createHarness("Harthmere production vendor catalog v1");

const clientCatalog = vendorSource(h);
const productionCatalog = h.read("src/shared/harthmere/harthmere_vendor_catalog_v1.ts");
const liveBackend = h.read("src/shared/harthmere/live_mode_backend_v1.ts");

function parseCatalog(source) {
  const matches = Array.from(source.matchAll(/^\s{2}(\d+):\s*vendor\(\{/gm));
  const catalog = new Map();
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end =
      i + 1 < matches.length
        ? matches[i + 1].index
        : source.indexOf("\n};", start);
    const block = source.slice(start, end);
    const offset = Number(matches[i][1]);
    const vendorId = block.match(/vendorId:\s*"([^"]+)"/)?.[1];
    const stocks = Array.from(
      block.matchAll(
        /\{\s*itemId:\s*"([^"]+)",\s*quantity:\s*(\d+),\s*price:\s*(\d+)\s*\}/g
      )
    ).map((match) => ({
      itemId: match[1],
      quantity: Number(match[2]),
      price: Number(match[3]),
    }));
    catalog.set(offset, { vendorId, stocks });
  }
  return catalog;
}

function stockSignature(stocks) {
  return stocks
    .map((stock) => `${stock.itemId}:${stock.quantity}:${stock.price}`)
    .join("|");
}

const client = parseCatalog(clientCatalog);
const production = parseCatalog(productionCatalog);

h.ok(client.size > 0, "client vendor catalog is parseable");
h.ok(production.size === client.size, "production catalog has the same vendor count as client");

for (const [offset, clientProfile] of client.entries()) {
  const productionProfile = production.get(offset);
  h.ok(Boolean(productionProfile), `production has vendor offset ${offset}`);
  if (!productionProfile) continue;
  h.ok(
    productionProfile.vendorId === clientProfile.vendorId,
    `production vendor ${offset} uses the client vendor id`
  );
  h.ok(
    stockSignature(productionProfile.stocks) === stockSignature(clientProfile.stocks),
    `production vendor ${offset} stocks match client catalog`
  );
}

const seedBlock = productionCatalog.slice(
  productionCatalog.indexOf("const HARTHMERE_VENDOR_ITEM_DEFINITIONS_V1"),
  productionCatalog.indexOf("function itemDefinitionFromSeed")
);
const localItemBlocks = itemBlocks(h);
const productionStockIds = new Set(
  Array.from(production.values()).flatMap((profile) =>
    profile.stocks.map((stock) => stock.itemId)
  )
);

for (const itemId of productionStockIds) {
  h.ok(localItemBlocks.has(itemId), `${itemId} exists in local item definitions`);
  h.ok(
    new RegExp(`\\n\\s{2}${itemId}:\\s*\\{`).test(seedBlock),
    `${itemId} has a production authority definition seed`
  );
}

const toolCategories = new Set(
  Array.from(localItemBlocks.entries())
    .filter(([, block]) => /category:\s*"tool"/.test(block))
    .map(([itemId]) => itemId)
);
for (const [offset, profile] of production.entries()) {
  h.ok(
    profile.stocks.some((stock) => toolCategories.has(stock.itemId)),
    `production vendor offset ${offset} stocks at least one tool`
  );
}

h.ok(
  Array.from(production.values()).some((profile) =>
    profile.stocks.some((stock) => stock.itemId === "stabilized_exotic_matter")
  ),
  "production catalog includes an exotic matter vendor"
);
h.ok(
  productionCatalog.includes("registerHarthmereVendorEntryV1"),
  "production catalog registers vendor entries"
);
h.ok(
  productionCatalog.includes("registerHarthmereItemDefinitionV1"),
  "production catalog registers missing item definitions"
);
h.ok(
  productionCatalog.includes("ensureHarthmereProductionCraftingCatalogueV1"),
  "production catalog preserves crafting catalogue definitions first"
);
h.ok(
  liveBackend.includes("ensureHarthmereProductionVendorCatalogV1"),
  "live mode initializes the production vendor catalog"
);

h.done();
