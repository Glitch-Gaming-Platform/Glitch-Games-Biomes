import type { PermissionsManager } from "@/client/game/context_managers/permissions_manager";
import {
  AttackDestroyDelegateItemSpec,
  harthmereAttackImpactDelayMs,
  harthmereMagicWeaponCharge,
} from "@/client/game/interact/item_types/attack_destroy_delegate_item_spec";
import type {
  StubbedClientContext,
  StubbedClientResources,
} from "@/client/game/interact/item_types/test_helpers";
import {
  cursorAtBlock,
  cursorAtBlueprint,
  cursorAtPlaceable,
  defaultTestClientContextWithActionThrottler,
  hotbarItemInfo,
  makeDestroyInfoFromCursor,
  stubClientResourceValue,
} from "@/client/game/interact/item_types/test_helpers";
import type { WithActionThottler } from "@/client/game/interact/types";
import type { Cursor } from "@/client/game/resources/cursor";
import type { LocalPlayer } from "@/client/game/resources/local_player";
import type { Player } from "@/client/game/resources/players";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { anItem } from "@/shared/game/item";
import { hitExistingTerrain } from "@/shared/game/spatial";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import { HARTHMERE_MAGIC_CHARGE_MIN_SECS } from "@/shared/harthmere/magic_charge";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import assert from "assert";
import sinon from "sinon";
import type { StubbedInstance } from "ts-sinon";

describe("Attack and Destroy Spec", () => {
  it("charges native magic weapons while leaving physical weapons immediate", () => {
    const staffId = harthmereNativeBiomesIdForItemId("arcane_staff");
    const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
    assert.ok(staffId);
    assert.ok(swordId);

    const staffCharge = harthmereMagicWeaponCharge(anItem(staffId));
    assert.ok(staffCharge);
    assert.equal(staffCharge.projectileVisualId, "spark");
    assert.ok(staffCharge.chargeTimeSecs >= HARTHMERE_MAGIC_CHARGE_MIN_SECS);
    assert.equal(harthmereMagicWeaponCharge(anItem(swordId)), undefined);
  });

  it("uses the authored body-contact frame for every player combat class", () => {
    const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
    const bowId = harthmereNativeBiomesIdForItemId("hunter_bow");
    const staffId = harthmereNativeBiomesIdForItemId("arcane_staff");
    const heavyId = harthmereNativeBiomesIdForItemId("two_handed_axe");
    const toolId = harthmereNativeBiomesIdForItemId("woodcutters_axe");
    assert.ok(swordId && bowId && staffId && heavyId && toolId);

    assert.equal(harthmereAttackImpactDelayMs(undefined), 400);
    assert.equal(harthmereAttackImpactDelayMs(anItem(swordId)), 400);
    assert.equal(harthmereAttackImpactDelayMs(anItem(toolId)), 400);
    assert.equal(harthmereAttackImpactDelayMs(anItem(heavyId)), 720);
    assert.equal(harthmereAttackImpactDelayMs(anItem(bowId)), 520);
    assert.equal(harthmereAttackImpactDelayMs(anItem(staffId)), 700);
  });

  before(async () => {
    await loadVoxeloo();
  });

  let deps!: WithActionThottler<StubbedClientContext>;
  let localPlayer: StubbedInstance<LocalPlayer>;
  let player: StubbedInstance<Player>;
  let resources!: StubbedClientResources;
  let itemSpec!: AttackDestroyDelegateItemSpec;
  let permissionsManager!: StubbedInstance<PermissionsManager>;

  const advanceClock = (seconds: number) => {
    stubClientResourceValue(resources, "/clock", {
      time: ((resources.get("/clock")! as any).time as number) + seconds,
    });
  };

  beforeEach(() => {
    deps = defaultTestClientContextWithActionThrottler();
    localPlayer = deps.resources.get(
      "/scene/local_player"
    ) as unknown as StubbedInstance<LocalPlayer>;
    player = localPlayer.player as unknown as StubbedInstance<Player>;
    resources = deps.resources as StubbedClientResources;
    permissionsManager =
      deps.permissionsManager as StubbedInstance<PermissionsManager>;
    itemSpec = new AttackDestroyDelegateItemSpec(deps, {});
  });

  it("attacks on primary if cursor empty", async () => {
    assert.ok(!localPlayer.startAttack.calledOnce);
  });

  it("starts the melee animation immediately but publishes damage only at impact", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const target = {
        id: 44 as BiomesId,
        position: { v: [1.5, 0, 0] },
        size: { v: [1, 2, 1] },
        health: { hp: 100, maxHp: 100 },
        npc_metadata: {
          type_id: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          created_time: 0,
          spawn_position: [1.5, 0, 0],
          spawn_orientation: [0, 0],
        },
      } as any;
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [target],
      });
      const publish = deps.events.publish as unknown as sinon.SinonStub;

      itemSpec.onAttackStart([target], hotbarItemInfo());
      assert.equal(localPlayer.startAttack.callCount, 1);
      assert.equal(publish.callCount, 0);

      await fakeTime.tickAsync(399);
      assert.equal(publish.callCount, 0);
      await fakeTime.tickAsync(1);
      assert.equal(publish.callCount, 1);
    } finally {
      fakeTime.restore();
    }
  });

  it("preserves the evade's strong pose before accepting an attack", () => {
    player.movementActionInfo = {
      action: "evade",
      startTime: 10,
      expiryTime: 10.75,
      direction: [0, 0, -1],
    };

    advanceClock(0.2);
    itemSpec.onPrimaryDown(hotbarItemInfo());

    assert.equal(localPlayer.startAttack.callCount, 0);
    assert.equal(player.cancelMovementAction.callCount, 0);
  });

  it("buffers a late-evade attack and starts it at the recovery window", () => {
    player.movementActionInfo = {
      action: "evade",
      startTime: 10,
      expiryTime: 10.75,
      direction: [0, 0, -1],
    };

    advanceClock(0.52);
    itemSpec.onPrimaryDown(hotbarItemInfo());
    itemSpec.onPrimaryUp(hotbarItemInfo());
    assert.equal(localPlayer.startAttack.callCount, 0);

    advanceClock(0.1);
    itemSpec.onTick(hotbarItemInfo());

    assert.equal(player.cancelMovementAction.callCount, 1);
    assert.equal(localPlayer.startAttack.callCount, 1);
  });

  it("attacks immediately from the evade recovery window", () => {
    player.movementActionInfo = {
      action: "evade",
      startTime: 10,
      expiryTime: 10.75,
      direction: [0, 0, -1],
    };

    advanceClock(0.63);
    itemSpec.onPrimaryDown(hotbarItemInfo());

    assert.equal(player.cancelMovementAction.callCount, 1);
    assert.equal(localPlayer.startAttack.callCount, 1);
  });

  it("destroys on primary when nothing is selected and cursor hits", async () => {
    const cursor = cursorAtBlock("grass");
    stubClientResourceValue(resources, "/scene/cursor", cursor);

    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.deepEqual(localPlayer.destroyInfo, {
      actionTimeMs: 1400.560224089636,
      activeAction: {
        action: "destroy",
        click: "primary",
        tool: undefined,
        toolRef: {
          idx: 0,
          kind: "hotbar",
        },
      },
      allowed: true,
      canDestroy: true,
      face: 0,
      finished: false,
      groupId: undefined,
      hardnessClass: 1,
      pos: hitExistingTerrain(cursor.hit) ? cursor.hit.pos : undefined,
      start: 10,
      terrainId: 1,
      terrainSample: {
        dye: 0,
        moisture: 0,
        muck: 0,
        terrainId: 1,
      },
    });
  });

  it("destroy deactivates after looking away from terrain", () => {
    localPlayer.destroyInfo = makeDestroyInfoFromCursor(cursorAtBlock("grass"));
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.deepEqual(localPlayer.destroyInfo, undefined);
  });

  it("disallow destruction if destruction not allowed", () => {
    const cursor = cursorAtBlock("grass");
    stubClientResourceValue(resources, "/scene/cursor", cursor);
    permissionsManager.getPermissionForAction.returns(false);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.strictEqual(localPlayer.destroyInfo?.canDestroy, false);

    stubClientResourceValue(resources, "/clock", {
      time: 100000000,
    });

    assert.throws(() => {
      itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    });
  });

  it("gives an error if hardness is too high", () => {
    const cursor = cursorAtBlock("bedrock");
    stubClientResourceValue(resources, "/scene/cursor", cursor);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.strictEqual(localPlayer.destroyInfo?.canDestroy, false);

    stubClientResourceValue(resources, "/clock", {
      time: 100000000,
    });

    assert.throws(() => {
      itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    });
  });

  it("can destroy terrain", () => {
    const cursor = cursorAtBlock("grass");
    assert(cursor.hit?.kind === "terrain");
    stubClientResourceValue(resources, "/scene/cursor", cursor);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.terrainId, cursor.hit.terrainId);
    assert(!localPlayer.destroyInfo?.finished);
    assert(!localPlayer.destroyInfo?.percentage);

    advanceClock(1);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.terrainId, cursor.hit.terrainId);
    assert(!localPlayer.destroyInfo?.finished);
    assert(localPlayer.destroyInfo?.percentage);

    advanceClock(99);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.terrainId, cursor.hit.terrainId);
    assert(localPlayer.destroyInfo?.finished);
    assert(localPlayer.destroyInfo?.percentage);
  });

  it("can destroy placeable", () => {
    const TEST_PLACEABLE_ID = 11 as BiomesId;
    stubClientResourceValue(
      resources,
      "/scene/cursor",
      cursorAtPlaceable(TEST_PLACEABLE_ID)
    );
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.placeableId, TEST_PLACEABLE_ID);
    assert(!localPlayer.destroyInfo?.finished);
    assert(!localPlayer.destroyInfo?.percentage);

    advanceClock(1);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.placeableId, TEST_PLACEABLE_ID);
    assert(!localPlayer.destroyInfo?.finished);
    assert(localPlayer.destroyInfo?.percentage);

    advanceClock(99);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.placeableId, TEST_PLACEABLE_ID);
    assert(localPlayer.destroyInfo?.finished);
    assert(localPlayer.destroyInfo?.percentage);
  });

  it("can destroy blueprints", () => {
    const TEST_BLUEPRINT_ID = 11 as BiomesId;
    stubClientResourceValue(
      resources,
      "/scene/cursor",
      cursorAtBlueprint(TEST_BLUEPRINT_ID)
    );
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.blueprintId, TEST_BLUEPRINT_ID);
    assert(!localPlayer.destroyInfo?.finished);
    assert(!localPlayer.destroyInfo?.percentage);

    advanceClock(1);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.blueprintId, TEST_BLUEPRINT_ID);
    assert(!localPlayer.destroyInfo?.finished);
    assert(localPlayer.destroyInfo?.percentage);

    advanceClock(9999);
    itemSpec.tryDestroyTick(hotbarItemInfo(), "primary");
    assert.equal(localPlayer.destroyInfo?.blueprintId, TEST_BLUEPRINT_ID);
    assert(localPlayer.destroyInfo?.finished);
    assert(localPlayer.destroyInfo?.percentage);
  });
});
