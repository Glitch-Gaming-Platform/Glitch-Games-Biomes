import assert from "assert";

import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";
import { isPointInsideHarthmereBusinessSafeSite } from "@/shared/harthmere/business_customer_simulator";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
import {
  harthmereNativeNpcBiscuit,
  harthmereNativeNpcCombatProfileForSeed,
} from "@/shared/harthmere/harthmere_native_combat";
import { HARTHMERE_NATIVE_NPC_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import {
  HARTHMERE_COBBLED_MUCKLING_ANCHOR,
  HARTHMERE_COBBLED_MUCKLING_AREA_ID,
  HARTHMERE_COBBLED_MUCKLING_AUTHORED_POSITIONS,
  HARTHMERE_COBBLED_MUCKLING_COUNT,
  HARTHMERE_COBBLED_MUCKLING_FIRST_OFFSET,
  HARTHMERE_COBBLED_MUCKLING_NAME,
  HARTHMERE_MUCKER_TOOTH_BIKKIE_ITEM_ID,
  HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereMuckMonsterPositionIsInSafeZone,
} from "@/shared/harthmere/live_entity_production_seed";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import {
  NATIVE_IN_STORAGE_MUCKER_TOOTH_COUNT,
  NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION,
  NATIVE_POST_GIMME_ITEM_IDS,
} from "@/shared/harthmere/native_post_gimme_contract";
import { HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";

/**
 * HARTHMERE_COBBLED_MUCKLING_HUNT — world-data coverage for the one hard
 * blocker in the post-Gimme quest arc.
 *
 * "In Storage" asks for six Mucker Teeth from Cobbled Mucklings. Before this
 * pack existed the restored world had neither: no creature named Cobbled
 * Muckling, and no drop table anywhere containing a Mucker Tooth. Because the
 * objective is `inventoryHas` rather than `npcKilled`, the legacy kill aliases
 * in `native_combat_quest_routing.ts` could not close the gap.
 *
 * These assertions are the same shape as `muck_pack_relocation.test.ts`: prove
 * the pack exists, is named what the dialogue says, sits on legal open ground,
 * is not buried in another encounter, and yields exactly the six teeth asked
 * for.
 */

function xzDistance(a: readonly number[], b: readonly number[]) {
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[2]) - Number(b[2]));
}

function cobbledMucklingSeeds() {
  return harthmereGroundedMuckMonsterSeedsInTerritory().filter(
    (seed) => seed.areaId === HARTHMERE_COBBLED_MUCKLING_AREA_ID
  );
}

describe("Harthmere Cobbled Muckling hunt (In Storage)", () => {
  it("seeds exactly six creatures named Cobbled Muckling", () => {
    const pack = cobbledMucklingSeeds();
    assert.equal(pack.length, HARTHMERE_COBBLED_MUCKLING_COUNT);
    assert.equal(pack.length, NATIVE_IN_STORAGE_MUCKER_TOOTH_COUNT);
    for (const seed of pack) {
      // Display names carry a trailing index ("Cobbled Muckling 3"); the combat
      // profile strips it, and that stripped name is what the player reads.
      assert.equal(
        harthmereNativeNpcCombatProfileForSeed(seed).displayName,
        HARTHMERE_COBBLED_MUCKLING_NAME
      );
    }
  });

  it("has no Hexer hiding in the six-kill count", () => {
    const pack = cobbledMucklingSeeds();
    assert.equal(pack.filter((seed) => /hex/i.test(seed.displayName)).length, 0);
  });

  it("keeps every authored, terrain-measured column verbatim", () => {
    const pack = cobbledMucklingSeeds();
    for (const authored of HARTHMERE_COBBLED_MUCKLING_AUTHORED_POSITIONS) {
      assert.ok(
        pack.some((seed) => xzDistance(seed.position, authored) < 0.001),
        `missing authored column ${JSON.stringify(authored)}`
      );
    }
    // Individually probed Ys, not one shared centre Y. The Muckerhorn slope
    // spans eleven voxels across the pack; flattening it would bury or float
    // half the members.
    assert.ok(
      new Set(pack.map((seed) => Number(seed.position[1]))).size > 1,
      "pack collapsed onto a single Y"
    );
  });

  it("stands on legal open ground", () => {
    for (const seed of cobbledMucklingSeeds()) {
      const position = seed.position;
      assert.equal(
        harthmereMuckMonsterPositionIsInSafeZone(position),
        false,
        `${seed.displayName} is inside a safe zone`
      );
      assert.equal(
        Boolean(muckMonsterAreaForPosition(position, 1.5)),
        false,
        `${seed.displayName} drifted into Muck containment`
      );
      assert.ok(
        Number(position[0]) < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
        `${seed.displayName} landed in the additive Harthmere extension`
      );
      assert.equal(
        isPointInsideHarthmereBusinessSafeSite({
          x: Number(position[0]),
          z: Number(position[2]),
        }),
        false
      );
      assert.equal(
        BUILDING_SYSTEM_PLOTS.some(
          (plot) =>
            Number(position[0]) >= plot.bounds.xMin &&
            Number(position[0]) <= plot.bounds.xMax &&
            Number(position[2]) >= plot.bounds.zMin &&
            Number(position[2]) <= plot.bounds.zMax
        ),
        false
      );
    }
  });

  it("is not buried inside another encounter", () => {
    const pack = new Set(cobbledMucklingSeeds().map((seed) => seed.entityId));
    const others = [
      ...harthmereGroundedMuckMonsterSeedsInTerritory(),
      ...harthmereGroundedLivestockSeedsInTerritory(),
    ].filter((seed) => !pack.has(seed.entityId));
    for (const seed of cobbledMucklingSeeds()) {
      for (const other of others) {
        assert.ok(
          xzDistance(seed.position, other.position) >=
            HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE,
          `${other.displayName} crowds ${seed.displayName}`
        );
      }
    }
  });

  it("uses its own checked-in native NPC type identity", () => {
    const profiles = cobbledMucklingSeeds().map(
      harthmereNativeNpcCombatProfileForSeed
    );
    for (const profile of profiles) {
      assert.equal(profile.key, "monster_cobbled_muckling");
      assert.equal(
        profile.id,
        HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_cobbled_muckling
      );
      assert.ok(
        Number.isFinite(Number(profile.id)),
        "an undefined NPC id fails the Bikkie overlay and blocks server boot"
      );
    }
  });

  it("guarantees exactly one Mucker Tooth per kill", () => {
    const profile = harthmereNativeNpcCombatProfileForSeed(
      cobbledMucklingSeeds()[0]
    );
    assert.deepEqual(profile.questDropBikkieItems, [
      { bikkieItemId: HARTHMERE_MUCKER_TOOTH_BIKKIE_ITEM_ID, count: 1 },
    ]);

    const biscuit = harthmereNativeNpcBiscuit(profile);
    const guaranteed = (biscuit.drop ?? []).find(
      ([bucket]) => bucket === "guaranteed"
    );
    assert.ok(guaranteed, "quest drops must be guaranteed, never rolled");
    const entries = guaranteed![1] as unknown as Array<[unknown, number]>;
    const tooth = entries.find(
      ([itemId]) =>
        Number(itemId) === Number(HARTHMERE_MUCKER_TOOTH_BIKKIE_ITEM_ID)
    );
    assert.equal(Number(tooth?.[1]), 1);
    // The family drop must survive alongside the quest item.
    assert.ok(
      entries.length > 1,
      "quest drop replaced the family loot instead of joining it"
    );
  });

  it("gives six kills exactly the six teeth In Storage requires", () => {
    const teeth = cobbledMucklingSeeds()
      .map(harthmereNativeNpcCombatProfileForSeed)
      .flatMap((profile) => profile.questDropBikkieItems)
      .filter(
        (drop) =>
          Number(drop.bikkieItemId) ===
          Number(NATIVE_POST_GIMME_ITEM_IDS.MUCKER_TOOTH)
      )
      .reduce((total, drop) => total + drop.count, 0);
    assert.equal(teeth, NATIVE_IN_STORAGE_MUCKER_TOOTH_COUNT);
  });

  it("points the quest marker at the pack it seeds", () => {
    assert.deepEqual(
      [...NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION],
      [...HARTHMERE_COBBLED_MUCKLING_ANCHOR]
    );
    const nearest = Math.min(
      ...cobbledMucklingSeeds().map((seed) =>
        xzDistance(seed.position, NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION)
      )
    );
    assert.ok(nearest < 1, "marker does not stand on a member of the pack");
  });

  it("does not collide with any other seeded id band", () => {
    const pack = cobbledMucklingSeeds();
    const offsets = new Set(pack.map((seed) => seed.idOffset));
    assert.equal(offsets.size, HARTHMERE_COBBLED_MUCKLING_COUNT);
    for (const offset of offsets) {
      assert.ok(
        offset >= HARTHMERE_COBBLED_MUCKLING_FIRST_OFFSET &&
          offset <
            HARTHMERE_COBBLED_MUCKLING_FIRST_OFFSET +
              HARTHMERE_COBBLED_MUCKLING_COUNT
      );
    }
    const everyoneElse = [
      ...harthmereGroundedMuckMonsterSeedsInTerritory(),
      ...harthmereGroundedLivestockSeedsInTerritory(),
    ].filter((seed) => !pack.some((member) => member.entityId === seed.entityId));
    for (const seed of everyoneElse) {
      assert.ok(
        !offsets.has(seed.idOffset),
        `id offset ${seed.idOffset} is claimed twice`
      );
    }
  });

  it("keeps every native NPC type identity unique", () => {
    const profiles = allHarthmereNativeNpcCombatProfiles();
    const ids = profiles.map((profile) => Number(profile.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(
      profiles.some((profile) => profile.key === "monster_cobbled_muckling")
    );
  });
});
