/// <reference types="mocha" />

import assert from "assert";
import {
  createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1,
  createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1,
} from "../live_entity_ecs_bridge_v1";

describe("live entity ECS bridge v1", () => {
  it("converts real ECS-shaped NPC, robot, animal, label/place, and object records into combat snapshots", () => {
    const snapshots = createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1({
      "b:1001": {
        npc_metadata: { type_id: 42, spawn_position: [10, 60, 20] },
        position: { v: [11, 60, 21] },
        health: { hp: 75, maxHp: 100 },
        label: { text: "Road Bandit Scout" },
      },
      "b:1002": {
        npc_metadata: { type_id: 43, spawn_position: [0, 0, 0] },
        robot_component: { internal_battery_charge: 50 },
        position: { v: [12, 60, 21] },
        health: { hp: 140, maxHp: 140 },
        label: { text: "Archive Robot Sentinel" },
      },
      "b:1003": {
        npc_metadata: { type_id: 44, spawn_position: [0, 0, 0] },
        position: { v: [13, 60, 21] },
        health: { hp: 50, maxHp: 80 },
        label: { text: "Forest Wolf" },
      },
      "b:1004": {
        position: { v: [14, 60, 21] },
        label: { text: "Market Jobs Board Place Label" },
      },
      "b:1005": {
        position: { v: [15, 60, 21] },
        placeable_component: { item_id: 99 },
        label: { text: "Town Sign" },
      },
      "b:1006": {
        position: { v: [16, 60, 21] },
        health: { hp: 50, maxHp: 50 },
        label: { text: "Billy's Toolbag" },
      },
    });

    assert.equal(snapshots["b:1001"].entityKind, "human");
    assert.equal(snapshots["b:1001"].isAttackable, true);
    assert.equal(snapshots["b:1001"].retaliatesWhenAttacked, true);

    assert.equal(snapshots["b:1002"].entityKind, "robot");
    assert.equal(snapshots["b:1002"].isAttackable, true);
    assert.equal(snapshots["b:1002"].aiEnabled, true);

    assert.equal(snapshots["b:1003"].entityKind, "animal");
    assert.equal(snapshots["b:1003"].isAttackable, true);

    assert.equal(snapshots["b:1004"].entityKind, "object");
    assert.equal(snapshots["b:1004"].combatProtection, "label_or_place");
    assert.equal(snapshots["b:1004"].isAttackable, false);

    assert.equal(snapshots["b:1005"].entityKind, "object");
    assert.equal(snapshots["b:1005"].combatProtection, "label_or_place");
    assert.equal(snapshots["b:1005"].aiEnabled, false);

    assert.equal(snapshots["b:1006"].entityKind, "object");
    assert.equal(snapshots["b:1006"].combatProtection, "immobile_object");
    assert.equal(snapshots["b:1006"].isAttackable, false);
    assert.equal(snapshots["b:1006"].aiEnabled, false);
  });

  it("keeps protected species and friendly humans as noncombatants while livestock and owned pets stay attackable", () => {
    const livestock = createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1(
      "b:livestock",
      {
        npc_metadata: { type_id: 77, spawn_position: [0, 50, 0] },
        position: { v: [0, 50, 0] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Market livestock cow" },
      }
    );
    assert.ok(livestock);
    assert.equal(livestock.combatProtection, undefined);
    assert.equal(livestock.isLivestock, true);
    assert.equal(livestock.isAttackable, true);
    assert.equal(livestock.retaliatesWhenAttacked, true);

    const ownedPet = createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1(
      "b:pet",
      {
        npc_metadata: { type_id: 78, spawn_position: [0, 50, 0] },
        position: { v: [0, 50, 0] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Player Owned Pet Fox" },
        ownerId: "other_player",
      }
    );
    assert.ok(ownedPet);
    assert.equal(ownedPet.combatProtection, undefined);
    assert.equal(ownedPet.ownerId, "other_player");
    assert.equal(ownedPet.isAttackable, true);
    assert.equal(ownedPet.retaliatesWhenAttacked, true);

    const cases = [
      {
        label: "Protected Chapel Deer",
        protectedSpecies: true,
        expectedProtection: "protected_species",
      },
      {
        label: "Mira, Town Guide",
        expectedProtection: "friendly_noncombatant",
      },
    ] as const;

    for (const entry of cases) {
      const snapshot = createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1(
        `b:${entry.label}`,
        {
          npc_metadata: { type_id: 77, spawn_position: [0, 50, 0] },
          position: { v: [0, 50, 0] },
          health: { hp: 100, maxHp: 100 },
          label: { text: entry.label },
          protectedSpecies:
            "protectedSpecies" in entry ? entry.protectedSpecies : undefined,
          ownerId: "ownerId" in entry ? entry.ownerId : undefined,
        }
      );
      assert.ok(snapshot);
      assert.equal(snapshot.combatProtection, entry.expectedProtection);
      assert.equal(snapshot.isAttackable, false);
      assert.equal(snapshot.retaliatesWhenAttacked, false);
    }
  });

  it("skips records with no usable world position", () => {
    assert.equal(
      createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1("b:missing", {
        npc_metadata: { type_id: 1 },
        health: { hp: 10, maxHp: 10 },
      }),
      undefined
    );
  });
});
