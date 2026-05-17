#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere inventory contracts v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx", "Inventory system exists");
const src = inventorySource(h);
h.ok(/biomes\.localDev\.harthmere\.inventoryState\.v1/.test(src), "inventory uses versioned localStorage key");
h.ok(src.includes("readHarthmereInventoryState") && src.includes("writeHarthmereInventoryState"), "inventory has read/write state contract");
h.ok(src.includes("appendLog") && src.includes("recent"), "inventory mutations have log path");
h.ok(src.includes("resetInventory") && src.includes("Reset local-dev inventory"), "inventory has reset/debug path");
h.ok(src.includes("HARTHMERE_VENDOR_STOCK"), "inventory uses unified vendor stock catalog");
h.done();
