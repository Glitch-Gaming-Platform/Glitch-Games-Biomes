/// <reference types="mocha" />
//
// HARTHMERE_ADDITIVE_TOWN_MAP_MARKERS tests.
//
// The regression these pin: the additive town rendered fine but had zero
// presence in any map feed, so its people, buildings, and districts could not
// be found or set as a destination. These assert the derivation stays complete,
// stays in WORLD coordinates (the +1600 extension band, not authored space),
// and keeps ids stable/unique so an active map pin never goes stale.

import assert from "assert";
import {
  HARTHMERE_TOWN_BUILDING_MAP_MARKERS,
  HARTHMERE_TOWN_LOCATION_MAP_MARKERS,
  HARTHMERE_TOWN_MAP_MARKERS,
  HARTHMERE_TOWN_MARKER_SOURCE,
  HARTHMERE_TOWN_NPC_MAP_MARKERS,
  HARTHMERE_TOWN_PEOPLE_MAP_MARKERS,
  HARTHMERE_TOWN_ROAMING_MAP_MARKERS,
  harthmereTownMapMarkerById,
} from "@/shared/harthmere/harthmere_town_map_markers";
import { HARTHMERE_BIBLE_DISTRICTS } from "@/shared/harthmere/harthmere_district_bible_layout";
import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import { HARTHMERE_ALL_NPCS } from "@/shared/harthmere/npc_compendium";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
} from "@/shared/harthmere/world_extension";

describe("harthmere additive town map markers", () => {
  it("covers every authored building", () => {
    assert.equal(
      HARTHMERE_TOWN_BUILDING_MAP_MARKERS.length,
      HARTHMERE_BUILDINGS.length
    );
    for (const building of HARTHMERE_BUILDINGS) {
      const marker = harthmereTownMapMarkerById(
        `harthmere_town_building_${building.name}`
      );
      assert.ok(marker, `missing map marker for building ${building.name}`);
      assert.equal(marker!.kind, "building");
      assert.equal(marker!.buildingName, building.name);
    }
  });

  it("covers every embodied NPC and separates people from roaming actors", () => {
    const embodied = HARTHMERE_ALL_NPCS.filter((npc: any) =>
      ["humanoid", "hostile", "animal"].includes(String(npc.kind))
    );
    assert.equal(HARTHMERE_TOWN_NPC_MAP_MARKERS.length, embodied.length);
    assert.equal(
      HARTHMERE_TOWN_PEOPLE_MAP_MARKERS.length +
        HARTHMERE_TOWN_ROAMING_MAP_MARKERS.length,
      HARTHMERE_TOWN_NPC_MAP_MARKERS.length
    );
    assert.ok(HARTHMERE_TOWN_PEOPLE_MAP_MARKERS.length >= 100);
    // Roaming hostiles/wildlife are intentionally kept out of the default feed.
    for (const marker of HARTHMERE_TOWN_MAP_MARKERS) {
      assert.notEqual(marker.kind, "hostile");
      assert.notEqual(marker.kind, "animal");
    }
  });

  it("covers every bible district anchor and its authored landmarks", () => {
    const expected = HARTHMERE_BIBLE_DISTRICTS.reduce(
      (total, district) => total + 1 + district.landmarks.length,
      0
    );
    assert.equal(HARTHMERE_TOWN_LOCATION_MAP_MARKERS.length, expected);
    for (const district of HARTHMERE_BIBLE_DISTRICTS) {
      const anchor = harthmereTownMapMarkerById(
        `harthmere_town_district_${district.id}`
      );
      assert.ok(anchor, `missing district anchor for ${district.id}`);
      assert.equal(anchor!.kind, "district");
      for (const landmark of district.landmarks) {
        const pin = harthmereTownMapMarkerById(landmark.id);
        assert.ok(pin, `missing district landmark ${landmark.id}`);
        assert.equal(pin!.kind, "landmark");
      }
    }
  });

  it("emits stable, unique ids so an active map pin never looks stale", () => {
    const ids = HARTHMERE_TOWN_MAP_MARKERS.map((marker) => marker.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate town marker id");
    for (const id of ids) {
      assert.ok(id.trim().length > 0);
    }
    // A known character keeps the compendium id the renderer and dialogue
    // router use, so the pin and the body you walk up to are the same actor.
    const bram = harthmereTownMapMarkerById(
      "harthmere_town_npc_sergeant_bram_holt"
    );
    assert.ok(bram);
    assert.equal(bram!.npcId, "sergeant_bram_holt");
    assert.equal(bram!.label, "Sergeant Bramwell Holt");
  });

  it("publishes WORLD positions inside the additive extension band", () => {
    for (const marker of HARTHMERE_TOWN_MAP_MARKERS) {
      assert.ok(
        Number.isFinite(marker.position[0]) &&
          Number.isFinite(marker.position[1]) &&
          Number.isFinite(marker.position[2]),
        `non-finite position for ${marker.id}`
      );
      assert.equal(
        marker.position[0],
        marker.authoredPosition[0] + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        `${marker.id} was not shifted east with the rest of the town`
      );
      assert.ok(
        marker.position[0] >= HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X - 64,
        `${marker.id} landed west of the extension at x=${marker.position[0]}`
      );
    }
  });

  it("tags every marker with the town source", () => {
    for (const marker of HARTHMERE_TOWN_MAP_MARKERS) {
      assert.equal(marker.source, HARTHMERE_TOWN_MARKER_SOURCE);
      assert.ok(marker.label.trim().length > 0, `${marker.id} has no label`);
      assert.ok(
        marker.description.trim().length > 0,
        `${marker.id} has no description`
      );
    }
  });
});
