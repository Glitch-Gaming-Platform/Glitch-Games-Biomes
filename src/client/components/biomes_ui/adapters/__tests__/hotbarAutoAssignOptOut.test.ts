/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import { createRequire } from "module";
import { applyOptimisticStaminaToStatusForTest } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";

// HARTHMERE_HOTBAR_AUTO_ASSIGN_OPT_OUT + HARTHMERE_OPTIMISTIC_STAMINA:
// regression locks for the biomes_501 fixes — removed hotbar items must never
// auto-reassign, and eating food must reflect on the HUD immediately.

const globalAny = global as any;
const localStorageValues = new Map<string, string>();

// Other suites in a combined mocha run install their own window shims at
// module load, so this one must be (re)installed per test via installShim()
// in beforeEach — module-load-only installation is test-order dependent.
function installWindowShim() {
  globalAny.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: {
      getItem: (key: string) => localStorageValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageValues.set(key, String(value));
      },
      removeItem: (key: string) => {
        localStorageValues.delete(key);
      },
      clear: () => localStorageValues.clear(),
    },
  };
}

installWindowShim();

// The adapter module imports /public/*.png assets; shim them like the other
// adapter tests do.
const requireForTest = createRequire(import.meta.url);
const Module = requireForTest("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolvePublicAsset(
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request.startsWith("/public/")) {
    return request;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
requireForTest.extensions[".png"] = (module: any, filename: string) => {
  module.exports = filename;
};

const {
  harthmereHotbarItemIdFromRefKey,
  rememberHarthmereHotbarAutoAssignOptOut,
  resetHarthmereHotbarAutoAssignOptOutForTest,
} = requireForTest("../useBiomesUILiveAdapters");

describe("harthmereHotbarItemIdFromRefKey", () => {
  it("extracts item ids that themselves contain colons", () => {
    assert.equal(
      harthmereHotbarItemIdFromRefKey("harthmere_hotbar:3:b:3588133005856146"),
      "b:3588133005856146"
    );
  });

  it("extracts plain item ids", () => {
    assert.equal(
      harthmereHotbarItemIdFromRefKey("harthmere_hotbar:1:4732724694489497"),
      "4732724694489497"
    );
  });

  it("returns undefined for non-harthmere keys", () => {
    assert.equal(harthmereHotbarItemIdFromRefKey("hotbar_3"), undefined);
    assert.equal(harthmereHotbarItemIdFromRefKey(undefined), undefined);
    assert.equal(harthmereHotbarItemIdFromRefKey(""), undefined);
  });
});

describe("rememberHarthmereHotbarAutoAssignOptOut", () => {
  beforeEach(() => {
    installWindowShim();
    localStorageValues.clear();
    resetHarthmereHotbarAutoAssignOptOutForTest();
  });

  it("persists removed item ids and ignores empty values", () => {
    rememberHarthmereHotbarAutoAssignOptOut("b:3588133005856146");
    rememberHarthmereHotbarAutoAssignOptOut("  ");
    rememberHarthmereHotbarAutoAssignOptOut(undefined);
    const raw = localStorageValues.get(
      "biomes.localDev.harthmere.hotbarAutoAssignOptOut"
    );
    assert.ok(raw, "opt-out list should persist to storage");
    assert.deepEqual(JSON.parse(raw!), ["b:3588133005856146"]);
  });

  it("is idempotent for repeat removals", () => {
    rememberHarthmereHotbarAutoAssignOptOut("4732724694489497");
    rememberHarthmereHotbarAutoAssignOptOut("4732724694489497");
    const raw = localStorageValues.get(
      "biomes.localDev.harthmere.hotbarAutoAssignOptOut"
    );
    assert.deepEqual(JSON.parse(raw!), ["4732724694489497"]);
  });
});

describe("applyOptimisticStaminaToStatusForTest", () => {
  const baseStatus = () => ({
    combat: {
      hp: 90,
      maxHp: 108,
      primaryResource: "stamina",
      resource: 100,
      maxResource: 108,
      resources: { stamina: 100, mana: 110 },
      maxResources: { stamina: 108, mana: 120 },
    },
  });

  it("applies the food restore to both stamina channels, clamped to max", () => {
    const next = applyOptimisticStaminaToStatusForTest(baseStatus(), 5);
    assert.equal(next?.combat?.resources?.stamina, 105);
    assert.equal(next?.combat?.resource, 105);
    const capped = applyOptimisticStaminaToStatusForTest(baseStatus(), 50);
    assert.equal(capped?.combat?.resources?.stamina, 108);
    assert.equal(capped?.combat?.resource, 108);
  });

  it("leaves other resources untouched", () => {
    const next = applyOptimisticStaminaToStatusForTest(baseStatus(), 5);
    assert.equal(next?.combat?.resources?.mana, 110);
  });

  it("does not touch the primary resource when it is not stamina", () => {
    const status = baseStatus();
    status.combat.primaryResource = "mana";
    const next = applyOptimisticStaminaToStatusForTest(status, 5);
    assert.equal(next?.combat?.resource, 100);
    assert.equal(next?.combat?.resources?.stamina, 105);
  });

  it("is a no-op without a snapshot or without a delta", () => {
    assert.equal(applyOptimisticStaminaToStatusForTest(undefined, 5), undefined);
    const status = baseStatus();
    assert.equal(applyOptimisticStaminaToStatusForTest(status, 0), status);
    assert.equal(
      applyOptimisticStaminaToStatusForTest(status, Number.NaN),
      status
    );
  });

  it("never drops stamina below zero", () => {
    const next = applyOptimisticStaminaToStatusForTest(baseStatus(), -500);
    assert.equal(next?.combat?.resources?.stamina, 0);
    assert.equal(next?.combat?.resource, 0);
  });
});
