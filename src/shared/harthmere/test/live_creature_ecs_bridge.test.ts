/// <reference types="mocha" />
import {
  harthmereLiveCreatureAssetFor,
  harthmereLiveCreatureBridgeRecord,
  harthmereLiveCreatureEvadeVisual,
  harthmereLiveCreatureStaticFallbackTargetIds,
  isHarthmereLiveCreatureEntity,
  publishHarthmereLiveCreatureBridge,
  readHarthmereLiveCreatureBridgeSnapshot,
  reconcileHarthmereLiveCreatureBridge,
  type HarthmereLiveCreatureBridgeRecord,
  type HarthmereLiveCreatureEntityView,
} from "@/shared/harthmere/live_creature_ecs_bridge";
import assert from "assert";
import { harthmereServerMuckCombatTargetIdForSeed } from "@/shared/harthmere/visible_combat_target";
import { harthmereGroundedMuckMonsterSeedsInTerritory } from "@/shared/harthmere/live_entity_production_seed";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

describe("Harthmere live-creature bridge snapshot", () => {
  it("keeps one publication marker and emits one stale-empty marker", () => {
    const globalWithWindow = globalThis as any;
    const originalWindow = globalWithWindow.window;
    globalWithWindow.window = globalThis;
    try {
      const records = [
        {
          id: 1,
          at: [1, 2, 3],
          yaw: 0,
          family: "mucker",
          asset: "npcs/mossy_mucker",
          scale: 1,
          label: "Mucker",
        },
      ] satisfies HarthmereLiveCreatureBridgeRecord[];
      publishHarthmereLiveCreatureBridge(records);
      const first = readHarthmereLiveCreatureBridgeSnapshot();
      const unchanged = readHarthmereLiveCreatureBridgeSnapshot();
      assert.equal(first.at, unchanged.at);
      assert.equal(first.records, records);

      const bridge = globalWithWindow.__harthmereLiveCreatureEcsBridge!;
      bridge.at = Date.now() - 5_001;
      const stale = readHarthmereLiveCreatureBridgeSnapshot();
      assert.equal(stale.at, -Math.abs(bridge.at));
      assert.deepEqual(stale.records, []);
    } finally {
      if (originalWindow === undefined) {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = originalWindow;
      }
      delete globalWithWindow.__harthmereLiveCreatureEcsBridge;
    }
  });
});

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
      "npcs/cow"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", undefined, "Grey Wolf"),
      "/assets/harthmere/glb/creatures/animals/wolf.glb"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", "chicken", "Gate Chicken"),
      "/assets/harthmere/glb/creatures/animals/chicken.glb"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", undefined, "mystery"),
      "npcs/cow"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", "fish", "River Fish"),
      "npcs/fish"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("animal", undefined, "Old Pond Turtle"),
      "npcs/turtle"
    );
  });

  it("routes NPC robots to the authored helping-robot renderer", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("robot", undefined, "Restoro Bot"),
      "npcs/helping_robot"
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

  it("routes live bosses to their custom animated voxel GLBs before generic families", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("mucker", undefined, "Muck-Scarred Helix"),
      "/assets/harthmere/glb/bosses/muck_scarred_helix.glb"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("hex", undefined, "Thaedryn the Bellbound"),
      "/assets/harthmere/glb/bosses/thaedryn_bellbound.glb"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor(
        "hex",
        undefined,
        "Gravewood Pale Hexer 7",
        8_810_000_000_019_543
      ),
      "/assets/harthmere/glb/bosses/hex_wraith.glb"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor(
        "mucker",
        undefined,
        "Old Wood Mucker 1",
        8_810_000_000_019_509
      ),
      "/assets/harthmere/glb/bosses/alpha_mucker.glb"
    );
  });

  it("keeps an original animated creature mesh as the unlabeled fallback", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("mucker", undefined, undefined),
      "npcs/mossy_mucker"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("hex", undefined, undefined),
      "npcs/mossy_mucker"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("quest_creature", undefined, undefined),
      "npcs/mossy_mucker"
    );
  });

  it("maps every town human to the snapshot player mesh pipeline", () => {
    assert.equal(
      harthmereLiveCreatureAssetFor("live_entity", undefined, "Town Guard"),
      "snapshot/player_mesh"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor(
        "live_entity",
        undefined,
        "Brother Aldous, Chapel Clergy"
      ),
      "snapshot/player_mesh"
    );
    assert.equal(
      harthmereLiveCreatureAssetFor("live_entity", undefined, "Doc Harrow"),
      "snapshot/player_mesh"
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

  it("serializes movement while keeping animals on the native NPC renderer", () => {
    const record = harthmereLiveCreatureBridgeRecord(
      mucker({
        id: 45,
        label: { text: "Forest Wolf" },
        harthmere_creature_species: "wolf",
        movement_state: {
          action: "evade",
          action_start_time: 100,
          action_expiry_time: 100.52,
          direction: [1, 0, 0],
          action_nonce: 4,
        },
      })
    );
    assert.deepEqual(record?.movementAction, {
      action: "evade",
      startTime: 100,
      expiryTime: 100.52,
      direction: [1, 0, 0],
      nonce: 4,
    });
    assert.equal(
      record?.asset,
      "/assets/harthmere/glb/creatures/animals/wolf.glb"
    );
    assert.equal(record?.nativeNpcRenderer, true);
  });

  it("selects family-specific live-overlay evade clips", () => {
    const visual = (
      asset: string,
      label: string,
      direction: [number, number, number] = [1, 0, 0]
    ) =>
      harthmereLiveCreatureEvadeVisual({
        asset,
        label,
        movementAction: {
          action: "evade",
          startTime: 1,
          expiryTime: 2,
          direction,
        },
      });

    assert.deepEqual(visual("animal_wolf", "Forest Wolf"), {
      family: "sideLeap",
      preferredClipNames: [
        "SideLeap",
        "SidestepRight",
        "SidestepLeft",
        "Sidestep",
        "Jump",
      ],
    });
    assert.equal(visual("animal_bear", "Black Bear").family, "heavy");
    assert.equal(visual("animal_bunny", "Rabbit").family, "rabbit");
    assert.equal(visual("animal_crow", "Crow").family, "bird");
    assert.equal(visual("npcs/fish", "River Fish").family, "swim");
    assert.equal(visual("npcs/helping_robot", "Restoro Bot").family, "robot");
    assert.equal(visual("npcs/purple_hexer", "Hexer").family, "hexer");
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

  it("marks custom boss GLBs as native-NPC-rendered actors", () => {
    const record = harthmereLiveCreatureBridgeRecord(
      mucker({ id: 44, label: { text: "Muck-Scarred Helix" } })
    );
    assert.ok(record);
    assert.equal(
      record.asset,
      "/assets/harthmere/glb/bosses/muck_scarred_helix.glb"
    );
    assert.equal(record.nativeNpcRenderer, true);
  });

  it("routes fish, turtles, and NPC robots through native animated meshes", () => {
    for (const [id, label, species, asset] of [
      [46, "River Fish", "fish", "npcs/fish"],
      [47, "Old Pond Turtle", "turtle", "npcs/turtle"],
      [48, "Restoro Bot", undefined, "npcs/helping_robot"],
    ] as const) {
      const record = harthmereLiveCreatureBridgeRecord(
        mucker({
          id,
          label: { text: label },
          harthmere_creature_species: species,
        })
      );
      assert.equal(record?.asset, asset, label);
      assert.equal(record?.nativeNpcRenderer, true, label);
    }
  });
});

describe("reconcileHarthmereLiveCreatureBridge", () => {
  const rec = (id: number): HarthmereLiveCreatureBridgeRecord => ({
    id,
    at: [0, 54, 0],
    yaw: 0,
    family: "mucker",
    asset: "npcs/mossy_mucker",
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
