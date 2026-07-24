/// <reference types="mocha" />
import {
  harthmereLiveCreatureAssetFor,
  harthmereLiveCreatureBridgeRecord,
  harthmereLiveCreatureStaticFallbackTargetIds,
  isHarthmereLiveCreatureEntity,
  reconcileHarthmereLiveCreatureBridge,
  type HarthmereLiveCreatureBridgeRecord,
  type HarthmereLiveCreatureEntityView,
} from "@/shared/harthmere/live_creature_ecs_bridge";
import assert from "assert";
import { harthmereServerMuckCombatTargetIdForSeed } from "@/shared/harthmere/visible_combat_target";
import { harthmereGroundedMuckMonsterSeedsInTerritory } from "@/shared/harthmere/live_entity_production_seed";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

function mucker(
  over: Partial<HarthmereLiveCreatureEntityView> & { id: number }
): HarthmereLiveCreatureEntityView {
  return {
    npc_metadata: {},
    label: { text: "Old Wood Mucker 13" },
    position: { v: [10, 54, -20] },
    orientation: { v: [0, 1.2] },
    health: { hp: 200, maxHp: 240 },
    ...over,
  };
}

describe("isHarthmereLiveCreatureEntity", () => {
  it("accepts muck/animal/hex NPCs with position + health", () => {
    assert.equal(isHarthmereLiveCreatureEntity(mucker({ id: 1 })), true);
    assert.equal(
      isHarthmereLiveCreatureEntity(
        mucker({ id: 2, label: { text: "Gravewood Hexer 4" } })
      ),
      true
    );
    assert.equal(
      isHarthmereLiveCreatureEntity(
        mucker({
          id: 3,
          label: { text: "Spotted Cow" },
          harthmere_creature_species: "cow",
        })
      ),
      true
    );
  });

  it("rejects robots, players, placeables, and the dead", () => {
    assert.equal(
      isHarthmereLiveCreatureEntity(mucker({ id: 4, robot_component: {} })),
      false
    );
    assert.equal(
      isHarthmereLiveCreatureEntity(mucker({ id: 5, player_status: {} })),
      false
    );
    assert.equal(
      isHarthmereLiveCreatureEntity(mucker({ id: 6, placeable_component: {} })),
      false
    );
    assert.equal(
      isHarthmereLiveCreatureEntity(
        mucker({ id: 7, health: { hp: 0, maxHp: 240 } })
      ),
      false
    );
  });

  it("rejects non-NPC entities (no npc_metadata)", () => {
    assert.equal(
      isHarthmereLiveCreatureEntity({ id: 8, position: { v: [0, 0, 0] } }),
      false
    );
  });

  it("accepts town humans / escort / quest NPCs (rendered from ECS, no flicker)", () => {
    assert.equal(
      isHarthmereLiveCreatureEntity(
        mucker({ id: 9, label: { text: "Jackie the Grove Keeper" } })
      ),
      true
    );
    assert.equal(
      isHarthmereLiveCreatureEntity(
        mucker({ id: 11, label: { text: "Doc Harrow" } })
      ),
      true
    );
  });

  it("treats quest-creature flagged entities as renderable", () => {
    assert.equal(
      isHarthmereLiveCreatureEntity(
        mucker({
          id: 10,
          label: { text: "Quest Wraith" },
          harthmere_quest_creature: true,
        })
      ),
      true
    );
  });
});

describe("harthmereLiveCreatureAssetFor", () => {
  it("maps animals by species then label", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", "cow", undefined),
      "animal_cow"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", undefined, "Grey Wolf"),
      "animal_wolf"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", undefined, "mystery"),
      "animal_boar"
    );
  });

  it("maps labeled muck/hex actors to authored native creature assets", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("mucker", undefined, "Road Muckwad 1"),
      "npcs/seedy_muckling"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("mucker", undefined, "Old Wood Mucker 3"),
      "npcs/tree_mucker"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("hex", undefined, "Gravewood Pale Hexer 7"),
      "npcs/purple_hexer"
    );
  });

  it("keeps the procedural creature mesh as an unlabeled compatibility fallback", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("mucker", undefined, undefined),
      "townsperson_undead"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("hex", undefined, undefined),
      "townsperson_undead"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("quest_creature", undefined, undefined),
      "townsperson_undead"
    );
  });

  it("maps town humans to a believable body variant from their name", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("live_entity", undefined, "Town Guard"),
      "townsperson_guard"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor(
        "live_entity",
        undefined,
        "Brother Aldous, Chapel Clergy"
      ),
      "townsperson_clergy"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("live_entity", undefined, "Doc Harrow"),
      "townsperson_market"
    );
  });
});

describe("harthmereLiveCreatureBridgeRecord", () => {
  it("serializes a creature with position, yaw, asset and hp", () => {
    const record = harthmereLiveCreatureBridgeRecord(mucker({ id: 42 }));
    assert.ok(record);
    assert.equal(record?.id, 42);
    assert.deepEqual(record?.at, [10, 54, -20]);
    assert.equal(record?.yaw, 1.2);
    assert.equal(record?.family, "mucker");
    assert.equal(record?.asset, "npcs/tree_mucker");
    assert.equal(record?.hp, 200);
    assert.equal(record?.maxHp, 240);
    assert.equal(record?.nativeNpcRenderer, true);
  });

  it("returns undefined for non-creatures", () => {
    assert.equal(
      harthmereLiveCreatureBridgeRecord(mucker({ id: 1, robot_component: {} })),
      undefined
    );
  });

  it("routes player-like humans to the native generated-avatar renderer", () => {
    const record = harthmereLiveCreatureBridgeRecord(
      mucker({
        id: 43,
        label: { text: "Foreman Calla Ashe" },
        npc_metadata: { type_id: Number(LOCAL_DEV_HUMAN_NPC_TYPE_ID) },
      })
    );
    assert.ok(record);
    assert.equal(record.nativeNpcRenderer, true);
  });
});

describe("reconcileHarthmereLiveCreatureBridge", () => {
  const rec = (id: number): HarthmereLiveCreatureBridgeRecord => ({
    id,
    at: [0, 54, 0],
    yaw: 0,
    family: "mucker",
    asset: "townsperson_undead",
    scale: 1,
    label: `m${id}`,
  });

  it("classifies adds, updates and removals", () => {
    const result = reconcileHarthmereLiveCreatureBridge(new Set([1, 2, 3]), [
      rec(2),
      rec(3),
      rec(4),
    ]);
    assert.deepEqual(
      result.toAdd.map((r) => r.id),
      [4]
    );
    assert.deepEqual(result.toUpdate.map((r) => r.id).sort(), [2, 3]);
    assert.deepEqual(result.toRemove.sort(), [1]);
  });

  it("removes everything when the bridge goes empty", () => {
    const result = reconcileHarthmereLiveCreatureBridge(new Set([5, 6]), []);
    assert.deepEqual(result.toRemove.sort(), [5, 6]);
    assert.equal(result.toAdd.length, 0);
  });
});

describe("Harthmere live creature static fallback handoff", () => {
  it("suppresses the stationary fallback when its authoritative ECS creature is bridged", () => {
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    assert.ok(seed, "expected a production Mucker seed");
    const targetIds = harthmereLiveCreatureStaticFallbackTargetIds([
      {
        id: Number(seed.entityId),
        at: [...seed.position],
        yaw: seed.orientation[1],
        family: seed.combatKind === "hex" ? "hex" : "mucker",
        asset: "townsperson_undead",
        scale: 1,
        label: seed.displayName,
      },
    ]);
    assert.deepEqual(
      [...targetIds],
      [harthmereServerMuckCombatTargetIdForSeed(seed)]
    );
  });

  it("keeps static fallback targets available while the ECS bridge is empty", () => {
    assert.equal(harthmereLiveCreatureStaticFallbackTargetIds([]).size, 0);
  });
});
