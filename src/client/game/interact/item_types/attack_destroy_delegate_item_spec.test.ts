import type { PermissionsManager } from "@/client/game/context_managers/permissions_manager";
import {
  AttackDestroyDelegateItemSpec,
  harthmereAttackImpactDelayMs,
  harthmereAttackImpactCandidates,
  harthmereMeleeImpactTargetInReach,
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
import { TriggerState } from "@/shared/ecs/gen/components";
import { anItem } from "@/shared/game/item";
import { hitExistingTerrain } from "@/shared/game/spatial";
import { HARTHMERE_BOW_ATTACK_TIMING } from "@/shared/harthmere/harthmere_bow_contract";
import { ensureHarthmereNativeItemCatalogue } from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeBiomesIdForNpcType,
} from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_MAGIC_CHARGE_MIN_SECS,
  HARTHMERE_MAGIC_RELEASE_WINDUP_SECS,
} from "@/shared/harthmere/magic_charge";
import { writeHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import assert from "assert";
import sinon from "sinon";
import type { StubbedInstance } from "ts-sinon";
import {
  resetHarthmereCombatLockForTest,
  setHarthmereCombatLockCandidates,
  toggleHarthmereCombatLock,
} from "@/client/components/challenges/harthmere_combat_lock_on";

describe("Attack and Destroy Spec", () => {
  let voxeloo: Awaited<ReturnType<typeof loadVoxeloo>>;
  const target = (id: number) =>
    ({
      id: id as BiomesId,
      position: { v: [1.5, 0, 0] },
      size: { v: [1, 2, 1] },
      health: { hp: 100, maxHp: 100 },
      npc_metadata: {
        type_id: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
        created_time: 0,
        spawn_position: [1.5, 0, 0],
        spawn_orientation: [0, 0],
      },
    }) as any;

  it("locks melee target identity without re-reading a drifting cursor", () => {
    const original = target(41);
    const refreshedOriginal = {
      ...original,
      position: { v: [2.25, 0, 0] },
    } as any;
    const bystander = target(42);
    assert.deepEqual(
      harthmereAttackImpactCandidates("basic", [original], [refreshedOriginal]),
      [refreshedOriginal],
      "contact refreshes the original entity even after the camera moves"
    );
    assert.deepEqual(
      harthmereAttackImpactCandidates("basic", [original], []),
      [],
      "a target deleted before contact must miss"
    );
    assert.deepEqual(
      harthmereAttackImpactCandidates("heavy", [original], [bystander]),
      [],
      "turning onto a bystander during wind-up must not transfer the hit"
    );
    assert.deepEqual(
      harthmereAttackImpactCandidates("basic", [], [bystander]),
      [],
      "a dummy swing must not acquire a target after button-down"
    );
  });

  it("keeps ranged and magic launch identities stable while refreshing ECS", () => {
    const original = target(51);
    const refreshedOriginal = {
      ...original,
      position: { v: [2.5, 0, 0] },
    } as any;
    const bystander = target(52);
    assert.deepEqual(
      harthmereAttackImpactCandidates(
        "ranged",
        [original],
        [refreshedOriginal, bystander]
      ),
      [refreshedOriginal]
    );
    assert.deepEqual(
      harthmereAttackImpactCandidates("magic", [original], [refreshedOriginal]),
      [refreshedOriginal]
    );
  });

  it("checks locked melee contact against ECS reach instead of camera aim", () => {
    const inReach = target(61);
    const fled = {
      ...target(61),
      position: { v: [7, 0, 2] },
    } as any;
    assert.equal(
      harthmereMeleeImpactTargetInReach([0, 0, 0], inReach, 3.5),
      true
    );
    assert.equal(
      harthmereMeleeImpactTargetInReach([0, 0, 0], fled, 3.5),
      false
    );
  });

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

  it("uses the authored frame-exact basic and heavy contacts", () => {
    const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
    const bowId = harthmereNativeBiomesIdForItemId("hunter_bow");
    const staffId = harthmereNativeBiomesIdForItemId("arcane_staff");
    const heavyId = harthmereNativeBiomesIdForItemId("two_handed_axe");
    const toolId = harthmereNativeBiomesIdForItemId("woodcutters_axe");
    assert.ok(swordId && bowId && staffId && heavyId && toolId);

    assert.equal(harthmereAttackImpactDelayMs(undefined), 250);
    assert.equal(harthmereAttackImpactDelayMs(anItem(swordId)), 250);
    assert.equal(harthmereAttackImpactDelayMs(anItem(toolId)), 250);
    assert.equal(harthmereAttackImpactDelayMs(anItem(heavyId)), 417);
    assert.equal(
      harthmereAttackImpactDelayMs(anItem(bowId)),
      HARTHMERE_BOW_ATTACK_TIMING.impactMs
    );
    assert.equal(harthmereAttackImpactDelayMs(anItem(staffId)), 700);
  });

  before(async () => {
    voxeloo = await loadVoxeloo();
    ensureHarthmereNativeItemCatalogue();
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
    resetHarthmereCombatLockForTest();
    deps = defaultTestClientContextWithActionThrottler();
    (deps as any).voxeloo = voxeloo;
    localPlayer = deps.resources.get(
      "/scene/local_player"
    ) as unknown as StubbedInstance<LocalPlayer>;
    player = localPlayer.player as unknown as StubbedInstance<Player>;
    player.movementActionInfo = undefined;
    resources = deps.resources as StubbedClientResources;
    permissionsManager =
      deps.permissionsManager as StubbedInstance<PermissionsManager>;
    itemSpec = new AttackDestroyDelegateItemSpec(deps, {});
  });

  it("prefers the valid locked ECS target over cursor drift", () => {
    const locked = target(43);
    const cursorTarget = target(44);
    const cursor = resources.get("/scene/cursor") as Cursor;
    stubClientResourceValue(resources, "/ecs/entity", locked.id, locked);
    stubClientResourceValue(
      resources,
      "/ecs/entity",
      cursorTarget.id,
      cursorTarget
    );
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [cursorTarget],
    });
    setHarthmereCombatLockCandidates([
      {
        offset: Number(locked.id),
        entityId: Number(locked.id),
        attackable: true,
        radius: 1,
        label: "Locked cow",
        species: "animal",
        behavior: "defensive",
        socialRole: "wildlife",
        health: { hp: 100, maxHp: 100 },
        world: [1.5, 0, 0],
        worldX: 1.5,
        worldY: 0,
        worldZ: 0,
        screenX: 640,
        screenY: 360,
        screenVisible: true,
        distance: 1.5,
        boss: false,
        hostile: false,
      },
    ]);
    toggleHarthmereCombatLock({
      viewportWidth: 1280,
      viewportHeight: 720,
      now: 1_000,
    });

    itemSpec.onPrimaryDown(hotbarItemInfo());
    assert.deepEqual(
      (itemSpec as any).pendingPrimaryPress.attackableEntities.map(
        ({ id }: { id: number }) => id
      ),
      [locked.id]
    );
  });

  it("starts a native attack from the nearby ECS body when the renderer registry misses it", () => {
    const muckerTypeId = harthmereNativeBiomesIdForNpcType(
      "monster_road_pack_muckling"
    );
    assert.ok(muckerTypeId);
    const attackTarget = {
      ...target(48),
      position: { v: [1.55, 0, -1.2] },
      size: { v: [1.2, 1.4, 1.2] },
      label: { text: "Road Pack Muckling" },
      npc_metadata: {
        ...target(48).npc_metadata,
        type_id: muckerTypeId,
        spawn_position: [1.55, 0, -1.2],
      },
    } as any;
    const cursor = resources.get("/scene/cursor") as Cursor;
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [],
    });
    stubClientResourceValue(
      resources,
      "/ecs/entity",
      attackTarget.id,
      attackTarget
    );
    (deps.table.scan as unknown as sinon.SinonStub).returns([attackTarget]);
    player.position = [0, 0, 0];
    player.orientation = [0, 0];
    itemSpec.onPrimaryDown(hotbarItemInfo());
    assert.deepEqual(
      (itemSpec as any).pendingPrimaryPress.attackableEntities.map(
        ({ id }: { id: number }) => id
      ),
      [attackTarget.id],
      "screen-center cursor and renderer-registry misses must not erase a nearby ECS body intersection"
    );
  });

  it("attacks on primary if cursor empty", async () => {
    assert.ok(!localPlayer.startAttack.calledOnce);
  });

  it("starts the melee animation immediately but publishes damage only at impact", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const attackTarget = target(44);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [attackTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        attackTarget.id,
        attackTarget
      );
      const publish = deps.events.publish as unknown as sinon.SinonStub;

      itemSpec.onAttackStart([attackTarget], hotbarItemInfo());
      assert.equal(localPlayer.startAttack.callCount, 1);
      assert.equal(publish.callCount, 0);

      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [],
      });

      await fakeTime.tickAsync(249);
      assert.equal(publish.callCount, 0);
      await fakeTime.tickAsync(1);
      assert.equal(
        publish.callCount,
        1,
        "camera motion after button-down must not erase the locked target"
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("retains the last valid aimed target through a short double-jump camera rise", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const attackTarget = target(45);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [attackTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        attackTarget.id,
        attackTarget
      );
      itemSpec.onTick(hotbarItemInfo());

      advanceClock(0.3);
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [],
      });
      player.onGround = false;
      player.movementActionInfo = {
        action: "doubleJump",
        startTime: resources.get("/clock").time - 0.05,
        expiryTime: resources.get("/clock").time + 0.4,
        nonce: 1,
      } as any;

      itemSpec.onPrimaryDown(hotbarItemInfo());
      itemSpec.onPrimaryUp(hotbarItemInfo());
      assert.equal(localPlayer.startAttack.callCount, 1);
      await fakeTime.tickAsync(250);
      assert.equal(
        (deps.events.publish as unknown as sinon.SinonStub).callCount,
        1,
        "a brief upward camera drift must not turn the jump attack into a whiff"
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("never retains an airborne target beyond the short jump-attack grace", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const attackTarget = target(47);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [attackTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        attackTarget.id,
        attackTarget
      );
      itemSpec.onTick(hotbarItemInfo());
      advanceClock(0.76);
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [],
      });
      player.onGround = false;

      itemSpec.onPrimaryDown(hotbarItemInfo());
      itemSpec.onPrimaryUp(hotbarItemInfo());
      await fakeTime.tickAsync(300);
      assert.equal(
        (deps.events.publish as unknown as sinon.SinonStub).callCount,
        0,
        "stale targets must not be hit after the player turns or falls away"
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("promotes a held primary press to one fast, committed 1.5x heavy hit", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const attackTarget = target(46);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [attackTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        attackTarget.id,
        attackTarget
      );
      const publish = deps.events.publish as unknown as sinon.SinonStub;

      itemSpec.onPrimaryDown(hotbarItemInfo());
      itemSpec.onPrimaryHoldTick(hotbarItemInfo());
      assert.equal(localPlayer.startAttack.callCount, 0);
      advanceClock(0.219);
      itemSpec.onPrimaryHoldTick(hotbarItemInfo());
      assert.equal(localPlayer.startAttack.callCount, 0);
      advanceClock(0.002);
      itemSpec.onPrimaryHoldTick(hotbarItemInfo());

      assert.equal(localPlayer.startAttack.callCount, 1);
      assert.equal(localPlayer.attackInfo?.timingClass, "heavy");
      assert.equal(localPlayer.attackInfo?.damageMultiplier, 1.5);
      assert.equal(localPlayer.attackInfo?.duration, 1.083);
      await fakeTime.tickAsync(416);
      assert.equal(publish.callCount, 0);
      await fakeTime.tickAsync(1);
      assert.equal(publish.callCount, 1);
      itemSpec.onPrimaryUp(hotbarItemInfo());
      assert.equal(
        localPlayer.startAttack.callCount,
        1,
        "release after the held heavy must not add a basic hit"
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("keeps magic release outside the four-swing melee combo budget", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const staffId = harthmereNativeBiomesIdForItemId("arcane_staff");
      assert.ok(staffId);
      const attackTarget = target(46);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [attackTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        attackTarget.id,
        attackTarget
      );
      const staffInfo = hotbarItemInfo({
        item: anItem(staffId),
        count: 1n,
      });
      const triggerState = TriggerState.create();
      writeHarthmereNativeVitals(triggerState, {
        mana: 500,
        maxMana: 500,
      });
      stubClientResourceValue(
        resources,
        "/ecs/c/trigger_state",
        deps.userId,
        triggerState
      );

      itemSpec.onAttackStart([attackTarget], staffInfo);
      assert.ok(
        (itemSpec as any).pendingMagicAttack,
        "magic windup should retain a pending release"
      );
      assert.equal(
        (itemSpec as any).hasLocalRangedResource(staffInfo.item, "mana"),
        true,
        "the pending cast should remain affordable"
      );
      assert.ok(!localPlayer.isAttacking(resources.get("/clock").time));
      await fakeTime.tickAsync(HARTHMERE_MAGIC_RELEASE_WINDUP_SECS * 1000 + 1);
      assert.equal(
        (itemSpec as any).pendingMagicAttack,
        undefined,
        "the release timeout should consume the pending cast"
      );

      assert.equal(localPlayer.startAttack.callCount, 1);
      const attackInfo = localPlayer.startAttack.firstCall.args[5];
      assert.equal(attackInfo.timingClass, "magic");
      assert.equal(attackInfo.combatCombo, undefined);
    } finally {
      fakeTime.restore();
    }
  });

  it("cancels a charging magic attack when the real hotbar selection changes", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const staffId = harthmereNativeBiomesIdForItemId("arcane_staff");
      assert.ok(staffId);
      const attackTarget = target(47);
      const staffInfo = hotbarItemInfo({
        item: anItem(staffId),
        count: 1n,
      });

      itemSpec.onAttackStart([attackTarget], staffInfo);
      itemSpec.onUnselected(staffInfo);
      await fakeTime.tickAsync(2_000);

      assert.equal(localPlayer.startAttack.callCount, 0);
      assert.equal(
        (deps.events.publish as unknown as sinon.SinonStub).callCount,
        0
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("preserves pending contact when hotbar selection changes", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const attackTarget = target(45);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [attackTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        attackTarget.id,
        attackTarget
      );
      const publish = deps.events.publish as unknown as sinon.SinonStub;

      itemSpec.onAttackStart([attackTarget], hotbarItemInfo());
      itemSpec.onUnselected(hotbarItemInfo());
      await fakeTime.tickAsync(2_000);

      assert.equal(
        publish.callCount,
        1,
        "changing the selected visual must not cancel an already-authored hit"
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("starts an attack immediately without cancelling the evade movement", () => {
    player.movementActionInfo = {
      action: "evade",
      startTime: 10,
      expiryTime: 10.75,
      direction: [0, 0, -1],
    };

    advanceClock(0.2);
    itemSpec.onPrimaryDown(hotbarItemInfo());

    assert.equal(localPlayer.startAttack.callCount, 1);
    assert.equal(player.cancelMovementAction.callCount, 0);
  });

  it("starts a late-evade attack immediately without waiting for recovery", () => {
    player.movementActionInfo = {
      action: "evade",
      startTime: 10,
      expiryTime: 10.75,
      direction: [0, 0, -1],
    };

    advanceClock(0.42);
    itemSpec.onPrimaryDown(hotbarItemInfo());
    itemSpec.onPrimaryUp(hotbarItemInfo());
    assert.equal(localPlayer.startAttack.callCount, 1);
    assert.equal(player.cancelMovementAction.callCount, 0);
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

    assert.equal(player.cancelMovementAction.callCount, 0);
    assert.equal(localPlayer.startAttack.callCount, 1);
  });

  it("retains an early follow-up press and links to the second target after contact", async () => {
    const fakeTime = sinon.useFakeTimers();
    try {
      const firstTarget = target(71);
      const secondTarget = target(72);
      const cursor = resources.get("/scene/cursor") as Cursor;
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [firstTarget],
      });
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        firstTarget.id,
        firstTarget
      );
      stubClientResourceValue(
        resources,
        "/ecs/entity",
        secondTarget.id,
        secondTarget
      );

      itemSpec.onAttackStart([firstTarget], hotbarItemInfo());
      assert.equal(localPlayer.startAttack.callCount, 1);

      advanceClock(0.1);
      stubClientResourceValue(resources, "/scene/cursor", {
        ...cursor,
        attackableEntities: [secondTarget],
      });
      itemSpec.onPrimaryDown(hotbarItemInfo());
      itemSpec.onPrimaryUp(hotbarItemInfo());
      assert.deepEqual(
        (itemSpec as any).queuedPrimaryAttack?.attackableEntities.map(
          ({ id }: { id: number }) => id
        ),
        [secondTarget.id],
        "the buffered press must retain the second cow's identity"
      );

      advanceClock(0.3);
      await fakeTime.tickAsync(400);
      assert.equal((itemSpec as any).attackInfo.start, 10);
      assert.equal((itemSpec as any).attackInfo.duration, 0.708);
      assert.equal(player.movementActionInfo, undefined);
      itemSpec.onTick(hotbarItemInfo());
      assert.equal(
        (itemSpec as any).queuedPrimaryAttack,
        undefined,
        "the ready follow-up must be consumed on the first recovery tick"
      );

      assert.equal(
        localPlayer.startAttack.callCount,
        2,
        "the second-cow input must execute instead of disappearing"
      );
      await fakeTime.tickAsync(400);
      assert.equal(
        (deps.events.publish as unknown as sinon.SinonStub).callCount,
        2,
        "both the first and linked second contact must publish exactly once"
      );
    } finally {
      fakeTime.restore();
    }
  });

  it("keeps the first queued target when later clicks cross another entity", () => {
    const firstTarget = target(73);
    const queuedTarget = target(74);
    const lateBystander = target(75);
    const cursor = resources.get("/scene/cursor") as Cursor;
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [firstTarget],
    });
    itemSpec.onAttackStart([firstTarget], hotbarItemInfo());

    advanceClock(0.1);
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [queuedTarget],
    });
    itemSpec.onPrimaryDown(hotbarItemInfo());
    itemSpec.onPrimaryUp(hotbarItemInfo());

    advanceClock(0.1);
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [lateBystander],
    });
    itemSpec.onPrimaryDown(hotbarItemInfo());
    itemSpec.onPrimaryUp(hotbarItemInfo());

    assert.deepEqual(
      (itemSpec as any).queuedPrimaryAttack.attackableEntities.map(
        ({ id }: { id: number }) => id
      ),
      [queuedTarget.id]
    );
  });

  it("replaces a dead despawned or out-of-range buffered target with the current valid cow", () => {
    const stale = {
      ...target(78),
      position: { v: [20, 0, 0] },
    } as any;
    const replacement = target(79);
    const cursor = resources.get("/scene/cursor") as Cursor;
    stubClientResourceValue(resources, "/ecs/entity", stale.id, stale);
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [replacement],
    });

    assert.deepEqual(
      (itemSpec as any)
        .validQueuedCombatTargets([stale], hotbarItemInfo())
        .map(({ id }: { id: number }) => id),
      [replacement.id],
      "an unreachable first cow must not swallow the buffered second cow"
    );

    stubClientResourceValue(resources, "/ecs/entity", stale.id, undefined);
    assert.deepEqual(
      (itemSpec as any)
        .validQueuedCombatTargets([stale], hotbarItemInfo())
        .map(({ id }: { id: number }) => id),
      [replacement.id],
      "a despawned target must fall through to the current valid target"
    );
  });

  it("survives one low-FPS recovery tick without dropping the queued attack", () => {
    const firstTarget = target(76);
    const secondTarget = target(77);
    const cursor = resources.get("/scene/cursor") as Cursor;
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [firstTarget],
    });
    itemSpec.onAttackStart([firstTarget], hotbarItemInfo());

    advanceClock(0.1);
    stubClientResourceValue(resources, "/scene/cursor", {
      ...cursor,
      attackableEntities: [secondTarget],
    });
    itemSpec.onPrimaryDown(hotbarItemInfo());
    itemSpec.onPrimaryUp(hotbarItemInfo());

    // A single 480 ms post-recovery frame must remain inside the 0.5 s handoff
    // grace. This is substantially worse than the ~60 ms frame in the HAR.
    advanceClock(1.088);
    itemSpec.onTick(hotbarItemInfo());
    assert.equal(localPlayer.startAttack.callCount, 2);
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
