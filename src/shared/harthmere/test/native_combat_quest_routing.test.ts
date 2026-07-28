import assert from "assert";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";
import { harthmereGroundedMuckMonsterSeedsInTerritory } from "@/shared/harthmere/live_entity_production_seed";
import {
  NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS,
  NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS,
} from "@/shared/harthmere/native_combat_quest_routing";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
} from "@/shared/harthmere/snapshot_grove_content";

function xzDistance(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function countTypeNear(
  typeId: number,
  position: readonly [number, number, number],
  radius: number
) {
  return harthmereGroundedMuckMonsterSeedsInTerritory().filter(
    (seed) =>
      Number(harthmereNativeNpcCombatProfileForSeed(seed).id) === typeId &&
      xzDistance(seed.position, position) <= radius
  ).length;
}

describe("native combat quest production routes", () => {
  it("keeps enough restored enemies at every routed quest pack", () => {
    assert.ok(
      countTypeNear(
        Number(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING),
        NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.COBBLED_PACK,
        60
      ) >= 4
    );
    assert.equal(
      countTypeNear(
        Number(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING),
        NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.SEEDY_PACK,
        25
      ),
      4
    );
    assert.ok(
      countTypeNear(
        Number(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER),
        NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_NORTH,
        40
      ) >= 4
    );
    // Both Juggermucker markers now sit inside the single West Muck Breach
    // territory rather than in two unrelated Muck zones the old map-wide pooling
    // had scattered them across, so the south marker is a lower bound: it has to
    // hold at least the four kills that finish the eight-kill contract.
    assert.ok(
      countTypeNear(
        Number(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER),
        NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_SOUTH,
        40
      ) >= 4
    );
    assert.equal(
      countTypeNear(
        Number(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER),
        NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_THREE,
        10
      ),
      3
    );
  });

  it("points The Moss That Went Quiet at a populated seedy nest", () => {
    const quest = SNAPSHOT_GROVE_QUESTS.find(
      (candidate) => candidate.id === "moss_that_went_quiet"
    );
    const marker = SNAPSHOT_GROVE_LANDMARKS.find(
      (candidate) => candidate.id === quest?.markerIds[3]
    );
    assert.ok(marker);
    // The nest used to be whichever Road Muckwads the map-wide pooling happened
    // to drop here; that family now lives in the open Wilds. The column is held
    // by the Watchtower Muckling pack instead, which is a better fit for a marker
    // literally labelled "Silent Moss Muckling Nest".
    const mucklingNestTypeId = 8722087466111636;
    assert.ok(countTypeNear(mucklingNestTypeId, marker.position, 40) >= 7);
  });
});
