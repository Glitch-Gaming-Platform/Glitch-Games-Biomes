#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, assertItemFields, assertNoDuplicateItemNames, itemBlocks } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere item catalog v1");
assertItemFields(h);
assertNoDuplicateItemNames(h);
const training = itemBlocks(h).get("training_dagger") || "";
h.ok(/name:\s*"Training Dagger"/.test(training), "training_dagger is not mislabeled as Iron Longsword");
h.done();
