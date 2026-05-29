// Mocha + assert tests for the BiomesUI HighlightRegistry.
//
// These verify the contract that every visual and tutorial system depends on:
//   * register -> requestHighlight -> onHighlight is called
//   * unregister -> onHighlight is NOT called
//   * requestHighlight before register -> queued and delivered on register
//   * multiple targets under same id -> all fire
//   * clearHighlight stops the active state
//   * subscribeHighlights observes the active map

import assert from "assert";
import {
  _resetHighlightRegistryForTest,
  _internalsForTest,
  clearAllHighlights,
  clearHighlight,
  registerHighlightTarget,
  requestHighlight,
  subscribeHighlights,
} from "../highlight/HighlightRegistry";

function makeTarget(uniqueId: string) {
  const calls = { highlights: [] as any[], clears: 0 };
  const unregister = registerHighlightTarget({
    uniqueId,
    element: null,
    onHighlight: (req) => calls.highlights.push(req),
    onClear: () => { calls.clears++; },
  });
  return { calls, unregister };
}

describe("BiomesUI HighlightRegistry", () => {
  beforeEach(() => {
    _resetHighlightRegistryForTest();
  });

  it("register -> requestHighlight delivers to target", () => {
    const t = makeTarget("tab.inventory");
    requestHighlight({ uniqueId: "tab.inventory" });
    assert.equal(t.calls.highlights.length, 1);
    assert.equal(t.calls.highlights[0].uniqueId, "tab.inventory");
    assert.equal(t.calls.highlights[0].style, "pulse"); // default
  });

  it("unregister stops further deliveries", () => {
    const t = makeTarget("tab.inventory");
    t.unregister();
    requestHighlight({ uniqueId: "tab.inventory" });
    assert.equal(t.calls.highlights.length, 0);
  });

  it("requestHighlight before register -> queued and delivered on register", () => {
    requestHighlight({ uniqueId: "tab.skills", caption: "early" });
    const t = makeTarget("tab.skills");
    assert.equal(t.calls.highlights.length, 1);
    assert.equal(t.calls.highlights[0].caption, "early");
  });

  it("multiple registrations under same id all receive the request", () => {
    const t1 = makeTarget("hotbar.slot_1");
    const t2 = makeTarget("hotbar.slot_1");
    requestHighlight({ uniqueId: "hotbar.slot_1" });
    assert.equal(t1.calls.highlights.length, 1);
    assert.equal(t2.calls.highlights.length, 1);
  });

  it("requesting for a non-existent id does not throw", () => {
    assert.doesNotThrow(() => {
      requestHighlight({ uniqueId: "does.not.exist" });
    });
  });

  it("clearHighlight calls onClear and removes from active map", () => {
    const t = makeTarget("tab.map");
    requestHighlight({ uniqueId: "tab.map", durationMs: 0 });
    clearHighlight("tab.map");
    assert.equal(t.calls.clears, 1);
    const { activeHighlights } = _internalsForTest();
    assert.equal(activeHighlights.has("tab.map"), false);
  });

  it("clearHighlight removes queued requests before a late target registers", () => {
    requestHighlight({ uniqueId: "tab.map", durationMs: 0 });
    clearHighlight("tab.map");
    const t = makeTarget("tab.map");
    assert.equal(t.calls.highlights.length, 0);
    const { queued, activeHighlights } = _internalsForTest();
    assert.equal(queued.has("tab.map"), false);
    assert.equal(activeHighlights.has("tab.map"), false);
  });

  it("clearAllHighlights wipes everything including queued requests", () => {
    requestHighlight({ uniqueId: "queued.only" });
    const t = makeTarget("tab.guilds");
    requestHighlight({ uniqueId: "tab.guilds", durationMs: 0 });
    clearAllHighlights();
    const { activeHighlights, queued } = _internalsForTest();
    assert.equal(activeHighlights.size, 0);
    assert.equal(queued.size, 0);
    assert.ok(t.calls.clears >= 1, "tab.guilds should have been cleared");
  });

  it("subscribeHighlights is invoked on changes", () => {
    let lastSize = -1;
    const unsubscribe = subscribeHighlights((m) => { lastSize = m.size; });
    assert.equal(lastSize, 0);
    requestHighlight({ uniqueId: "tab.banking", durationMs: 0 });
    assert.equal(lastSize, 1);
    clearHighlight("tab.banking");
    assert.equal(lastSize, 0);
    unsubscribe();
  });

  it("a thrown error in onHighlight does not break other targets", () => {
    registerHighlightTarget({
      uniqueId: "tab.land",
      element: null,
      onHighlight: () => { throw new Error("boom"); },
      onClear: () => {},
    });
    const t = makeTarget("tab.land");
    assert.doesNotThrow(() => {
      requestHighlight({ uniqueId: "tab.land" });
    });
    assert.equal(t.calls.highlights.length, 1);
  });

  it("non-default style is preserved through delivery", () => {
    const t = makeTarget("inventory.slot.chest");
    requestHighlight({ uniqueId: "inventory.slot.chest", style: "ring" });
    assert.equal(t.calls.highlights[0].style, "ring");
  });

  it("re-registering after unregister still receives queued requests", () => {
    let calls = 0;
    const unreg = registerHighlightTarget({
      uniqueId: "tab.options", element: null,
      onHighlight: () => { calls++; }, onClear: () => {},
    });
    unreg();
    requestHighlight({ uniqueId: "tab.options" });
    assert.equal(calls, 0);
    registerHighlightTarget({
      uniqueId: "tab.options", element: null,
      onHighlight: () => { calls++; }, onClear: () => {},
    });
    assert.equal(calls, 1, "should drain queued requests on re-register");
  });
});
