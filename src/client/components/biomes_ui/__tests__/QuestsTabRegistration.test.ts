/// <reference types="mocha" />
/// <reference types="node" />
//
// Registration contract for the dedicated Quests tab (2026-07-24).
// The tab itself is exercised by the browser suite; this locks the wiring so
// a TabKey/descriptor/shortcut mismatch fails in CI, not in a play session.

import assert from "assert";
import {
  BIOMES_UI_QUESTS_SHORTCUT,
  TAB_DESCRIPTORS,
  TAB_ORDER,
} from "../BiomesUITypes";
import { UI_IDS } from "../uniqueIds";

describe("BiomesUI quests tab registration", () => {
  it("registers the tab in the rail, before the map", () => {
    const questsIndex = TAB_ORDER.indexOf("quests");
    const mapIndex = TAB_ORDER.indexOf("map");
    assert.ok(questsIndex >= 0, "quests tab missing from TAB_ORDER");
    assert.ok(
      questsIndex < mapIndex,
      "the quest log belongs before the chart it used to live inside"
    );
  });

  it("has a descriptor with the reserved J shortcut and no map language", () => {
    const desc = TAB_DESCRIPTORS.quests;
    assert.ok(desc, "no descriptor for quests");
    assert.equal(desc.key, "quests");
    assert.equal(desc.code, "QST");
    assert.equal(
      desc.shortcut,
      BIOMES_UI_QUESTS_SHORTCUT,
      "the long-reserved J shortcut belongs to this tab"
    );
    assert.ok(
      !/map|chart|beacon/i.test(`${desc.label} ${desc.subtitle}`),
      "the quests tab is explicitly the no-map surface"
    );
  });

  it("has a stable unique id", () => {
    assert.equal(UI_IDS.TAB_QUESTS, "tab.quests");
  });

  it("leaves the Map tab focused on geography instead of duplicating quests", () => {
    const map = TAB_DESCRIPTORS.map;
    assert.equal(map.label, "Map");
    assert.ok(!/quest|mission log/i.test(`${map.label} ${map.subtitle}`));
  });

  it("every tab in TAB_ORDER has a descriptor (no rail gaps)", () => {
    for (const key of TAB_ORDER) {
      assert.ok(TAB_DESCRIPTORS[key], `tab "${key}" has no descriptor`);
      assert.equal(TAB_DESCRIPTORS[key].key, key);
    }
    const codes = TAB_ORDER.map((k) => TAB_DESCRIPTORS[k].code);
    assert.equal(
      new Set(codes).size,
      codes.length,
      "two tabs share a rail code"
    );
    const shortcuts = TAB_ORDER.map((k) => TAB_DESCRIPTORS[k].shortcut).filter(
      (shortcut): shortcut is string => Boolean(shortcut)
    );
    assert.equal(
      new Set(shortcuts).size,
      shortcuts.length,
      "two tabs share a keyboard shortcut"
    );
  });
});
