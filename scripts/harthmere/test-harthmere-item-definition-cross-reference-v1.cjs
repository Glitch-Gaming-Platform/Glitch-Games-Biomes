#!/usr/bin/env node
/* eslint-disable no-console */
const {
  createHarness,
  itemIds,
  catalogItemIds,
  economySource,
  challengeSource,
} = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere item definition cross-reference v1");
const defs = new Set(itemIds(h));
for (const id of catalogItemIds(h)) {
  h.ok(defs.has(id), `vendor stock item ${id} exists in ITEM_DEFINITIONS`);
}
const eco = economySource(h);
for (const [, id] of eco.matchAll(/itemId:\s*"([a-zA-Z0-9_]+)"/g)) {
  h.ok(defs.has(id), `economy item/listing ${id} exists in ITEM_DEFINITIONS`);
}
const gathering = challengeSource(h, "LocalDevHarthmereGatheringSystem.tsx");
for (const [, id] of gathering.matchAll(
  /itemId:\s*"([a-zA-Z0-9_]+)"|yieldItemId:\s*"([a-zA-Z0-9_]+)"|rareItemId:\s*"([a-zA-Z0-9_]+)"/g
)) {
  const value = id;
  if (value)
    h.ok(
      defs.has(value),
      `gathering yield item ${value} exists in ITEM_DEFINITIONS`
    );
}
const liveEntityHelperQuests = h.read(
  "src/shared/harthmere/live_entity_helper_quests_v1.ts"
);
const liveEntityHelperItemIds = new Set();
for (const [, id] of liveEntityHelperQuests.matchAll(
  /itemId:\s*"([a-zA-Z0-9_]+)"/g
)) {
  liveEntityHelperItemIds.add(id);
  h.ok(
    defs.has(id),
    `live entity helper quest item ${id} exists in ITEM_DEFINITIONS`
  );
}
const implementationWords =
  /\b(debug|developer|local[- ]?dev|server|backend|payload|test|placeholder|todo)\b/i;
const rawIdentifierText = /[_]|[a-z][A-Z]/;
const inventorySource = challengeSource(
  h,
  "LocalDevHarthmereInventorySystem.tsx"
);
for (const id of liveEntityHelperItemIds) {
  const idIndex = inventorySource.indexOf(`id: "${id}"`);
  h.ok(
    idIndex >= 0,
    `live entity helper item ${id} has a local item definition`
  );
  if (idIndex < 0) continue;
  const block = inventorySource.slice(idIndex, idIndex + 900);
  const name = block.match(/name:\s*"([^"]+)"/)?.[1];
  const description = block.match(/description:\s*"([^"]+)"/)?.[1];
  h.ok(Boolean(name), `live entity helper item ${id} has a display name`);
  h.ok(Boolean(description), `live entity helper item ${id} has a description`);
  if (name) {
    h.ok(
      !rawIdentifierText.test(name),
      `live entity helper item ${id} display name is player-facing`
    );
    h.ok(
      !implementationWords.test(name),
      `live entity helper item ${id} display name has no implementation wording`
    );
  }
  if (description) {
    h.ok(
      !rawIdentifierText.test(description),
      `live entity helper item ${id} description is player-facing`
    );
    h.ok(
      !implementationWords.test(description),
      `live entity helper item ${id} description has no implementation wording`
    );
    h.ok(
      description.length >= 24,
      `live entity helper item ${id} description is substantial`
    );
  }
}
h.ok(
  eco.includes("auctionable") && eco.includes("tradeable"),
  "auction/trade metadata exists for economy items"
);
h.done();
