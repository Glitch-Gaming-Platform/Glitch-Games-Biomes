#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, assertUnifiedVendorCatalog, catalogOffsets } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere vendor contracts current");
assertUnifiedVendorCatalog(h);
h.ok(catalogOffsets(h).length >= 16, "unified vendor catalog covers all current shop/fence/service offsets");
h.done();
