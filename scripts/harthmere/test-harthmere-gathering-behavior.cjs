#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere gathering behavior integration current");
const src = h.read("src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx");
const performStart = src.indexOf("export function performHarthmereGather");
const performEnd = src.indexOf("export const __harthmereGatheringAuthorityTestHooks");
const perform = src.slice(performStart, performEnd);
h.ok(perform.includes("validateHarthmereGatherAttempt({"), "gather executes authority validation before normal success path");
h.ok(perform.includes("playerState: options?.playerState"), "gather accepts mocked player/server state");
h.ok(/cooldownReady:\s*Boolean\(options\?\.ignoreCooldown\)\s*\|\|\s*cooldownReady\(state, node\)/.test(perform), "gather authority owns cooldown preflight");
h.ok(perform.includes("toolDurability: options?.toolDurability"), "gather authority can reject broken tools");
h.ok(perform.includes("routeHarthmereGatheredMaterials({"), "gather plans storage route after yield roll");
h.ok(perform.indexOf("routeHarthmereGatheredMaterials({") < perform.indexOf("grantHarthmereItem("), "gather routes before granting so full inventory cannot delete items");
h.ok(perform.includes("inventoryCapacity: options?.inventoryCapacity"), "gather can simulate material storage/backpack/quest pouch capacity");
h.ok(perform.includes("authority: storagePlan"), "gather returns storage authority failure details");
h.done();
