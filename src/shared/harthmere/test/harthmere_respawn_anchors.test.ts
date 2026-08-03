/// <reference types="mocha" />
//
// HARTHMERE_RESPAWN_ANCHORS tests.
//
// The regression: every native respawn went to one hard-coded Grove point, so a
// death anywhere in Harthmere put the player ~1,600 blocks west and made them
// walk the connector road back.

import assert from "assert";
import {
  HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION,
  harthmereRespawnPositionForDeath,
  harthmereRespawnRegionForPosition,
  harthmereShiftedChapelRespawnPosition,
  validateHarthmereRespawnAnchors,
} from "@/shared/harthmere/harthmere_respawn_anchors";
import { HARTHMERE_GROVE_RESPAWN_POSITION } from "@/shared/harthmere/harthmere_native_vitals";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXTENSION_FEET_Y,
} from "@/shared/harthmere/world_extension";
import { HARTHMERE_BIBLE_DISTRICTS } from "@/shared/harthmere/harthmere_district_bible_layout";
import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import { HARTHMERE_STILL_WATER_FEATURES } from "@/shared/harthmere/harthmere_still_water";
import { harthmereRiverContains } from "@/shared/harthmere/harthmere_river";
import { harthmereForestWildlifePlacements } from "@/shared/harthmere/harthmere_forest_wildlife";

describe("harthmere respawn anchors", () => {
  it("satisfies its own contract", () => {
    const result = validateHarthmereRespawnAnchors();
    assert.ok(result.ok, result.failures.join("\n"));
  });

  it("returns a Harthmere anchor for a death in the extension town", () => {
    // Where the player actually plays: the shifted live town.
    const death: [number, number, number] = [
      486 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
      HARTHMERE_EXTENSION_FEET_Y,
      -209,
    ];
    const resolved = harthmereRespawnPositionForDeath(death);
    assert.equal(resolved.region, "harthmere_extension");
    assert.deepEqual(
      resolved.position,
      harthmereShiftedChapelRespawnPosition()
    );
    assert.notDeepEqual(
      resolved.position,
      [...HARTHMERE_GROVE_RESPAWN_POSITION],
      "still sending Harthmere deaths to the Grove"
    );
  });

  it("respawns in the coordinate frame the town actually occupies", () => {
    // The trap this exists to prevent: a death in the +1600 town resolving to
    // authored space, where the town is not.
    const resolved = harthmereRespawnPositionForDeath([
      486 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
      53,
      -209,
    ]);
    assert.ok(
      resolved.position[0] > 1700,
      `extension death resolved to x=${resolved.position[0]}`
    );
    assert.equal(
      resolved.position[0],
      HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION[0] +
        HARTHMERE_ADDITIVE_TOWN_OFFSET_X
    );
  });

  it("covers a death anywhere in the extension town, not just the core", () => {
    for (const [x, z] of [
      [200, -500],
      [760, 180],
      [486, -209],
      [374, -404], // the watermill
    ]) {
      const resolved = harthmereRespawnPositionForDeath([
        x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        53,
        z,
      ]);
      assert.equal(
        resolved.region,
        "harthmere_extension",
        `death at authored ${x},${z} fell through to the Grove`
      );
    }
  });

  it("keeps every generated Harthmere forest death in Harthmere", () => {
    const forest = harthmereForestWildlifePlacements();
    assert.ok(forest.length > 0);
    for (const placement of forest) {
      const death: [number, number, number] = [
        placement.authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        HARTHMERE_EXTENSION_FEET_Y,
        placement.authoredZ,
      ];
      assert.equal(
        harthmereRespawnPositionForDeath(death).region,
        "harthmere_extension",
        `${placement.species} forest position ${death} fell through to the Grove`
      );
    }
  });

  it("uses X/Z extension ownership for Harthmere caves and high places", () => {
    for (const y of [-80, 220]) {
      assert.equal(
        harthmereRespawnRegionForPosition([2200, y, -540]),
        "harthmere_extension",
        `Harthmere position at Y=${y} fell through to the Grove`
      );
    }
  });

  it("leaves the normal Grove spawn alone everywhere else", () => {
    for (const death of [
      [...HARTHMERE_GROVE_RESPAWN_POSITION] as [number, number, number],
      [425, 54, -96] as [number, number, number],
      [900, 54, -209] as [number, number, number], // the connector road
      undefined,
    ]) {
      const resolved = harthmereRespawnPositionForDeath(death);
      assert.equal(resolved.region, "grove", `death at ${death}`);
      assert.deepEqual(resolved.position, [
        ...HARTHMERE_GROVE_RESPAWN_POSITION,
      ]);
    }
  });

  it("classifies regions without a position as the Grove", () => {
    assert.equal(harthmereRespawnRegionForPosition(undefined), "grove");
  });

  describe("the anchor is somewhere you can actually stand", () => {
    it("sits on Temple Green, the district that heals people", () => {
      const temple = HARTHMERE_BIBLE_DISTRICTS.find(
        (district) => district.id === "temple_green"
      );
      assert.ok(temple);
      assert.ok(
        temple!.services.includes("chapel_healing"),
        "the anchor district no longer offers healing"
      );
      const [x, , z] = HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION;
      assert.ok(
        x >= temple!.bounds.minX &&
          x <= temple!.bounds.maxX &&
          z >= temple!.bounds.minZ &&
          z <= temple!.bounds.maxZ,
        `anchor ${x},${z} is outside Temple Green`
      );
    });

    it("is not inside a building", () => {
      const [x, , z] = HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION;
      for (const building of HARTHMERE_BUILDINGS) {
        const inside =
          x >= building.x0 &&
          x <= building.x1 &&
          z >= building.z0 &&
          z <= building.z1;
        assert.equal(inside, false, `anchor is inside ${building.name}`);
      }
    });

    it("is not in the river", () => {
      const [x, , z] = HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION;
      assert.equal(harthmereRiverContains(x, z), false);
    });

    it("is not inside a water feature", () => {
      const [x, , z] = HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION;
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        const inside =
          x >= feature.bounds.x0 &&
          x <= feature.bounds.x1 &&
          z >= feature.bounds.z0 &&
          z <= feature.bounds.z1;
        assert.equal(inside, false, `anchor is inside ${feature.label}`);
      }
    });

    it("stands on the feet plane, not buried in the ground cap", () => {
      assert.ok(
        HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION[1] >= 53,
        "anchor Y is at or below the ground cap"
      );
    });
  });
});
