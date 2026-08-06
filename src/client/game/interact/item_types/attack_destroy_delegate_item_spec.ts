import type { ClientContextSubset } from "@/client/game/context";
import type { BuildAction } from "@/client/game/helpers/blueprint";
import {
  checkActionAllowedIfBlueprintVoxel,
  getBlueprintAtPosition,
  isBlueprintEmpty,
  isTerrainAtPosition,
} from "@/client/game/helpers/blueprint";
import { plantExperimentalAt } from "@/client/game/helpers/farming";
import { groupOccupancyAt } from "@/client/game/helpers/occupancy";
import { AttackDestroyInteractionError } from "@/client/game/interact/errors";
import {
  actuallyDestroyPlaceable,
  beginAttackInteraction,
  changeRadius,
  destroyBlueprint,
  destroyGroup,
  destroyTerrain,
  handleInteractionError,
  resolveAttackInteraction,
  shapeTerrain,
} from "@/client/game/interact/helpers";
import type { LegacyInteractOutput } from "@/client/game/interact/item_types/attack_destroy_delegate_item_helpers";
import {
  destroyOrShapeTerrain,
  destroyPlaceable,
  isAttacking,
} from "@/client/game/interact/item_types/attack_destroy_delegate_item_helpers";
import type {
  ClickableItemInfo,
  ClickableItemSpec,
} from "@/client/game/interact/item_types/clickable_item_script";
import type {
  ActionType,
  ActiveAction,
  AttackInfo,
  DestroyInfo,
} from "@/client/game/interact/types";
import type { ShapeName } from "@/shared/asset_defs/shapes";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { HarthmereRangedResourceAttackEvent } from "@/shared/ecs/gen/events";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import type { AclAction, Item } from "@/shared/ecs/gen/types";
import {
  blockDestructionTimeMs,
  groupDestructionTimeMs,
  groupHardnessClass,
} from "@/shared/game/damage";
import { anItem } from "@/shared/game/item";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import {
  canAttackFilter,
  isNativeEcsAttackTarget,
} from "@/client/game/resources/melee_attack_region";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  getHarthmerePremiumWeapon,
  type HarthmerePremiumWeaponDefinition,
} from "@/shared/harthmere/premium_weapon_catalog";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";
import {
  HARTHMERE_MAGIC_RELEASE_WINDUP_SECS,
  harthmereMagicChargeDurationSecs,
  harthmereMagicChargePower,
} from "@/shared/harthmere/magic_charge";
import {
  dispatchHarthmereMagicCharge,
  harthmereMagicChargeId,
} from "@/client/game/util/harthmere_magic_charge";
import {
  PLAYER_EVADE_ATTACK_TRANSITION,
  movementActionAttackTransition,
} from "@/shared/game/movement_actions";
import { allowPlaceableDestruction } from "@/shared/game/placeables";
import { hitExistingTerrain } from "@/shared/game/spatial";
import { terrainMarch } from "@/shared/game/terrain_march";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3 } from "@/shared/math/types";
import { distSqToAABB, viewDir } from "@/shared/math/linear";
import type { TimeWindow } from "@/shared/util/throttling";
import { ok } from "assert";
import { HARTHMERE_BODY_WEAPON_TIMING_PROFILES } from "@/client/game/util/player_animations";
import {
  harthmereNativeItemCombatProfile,
  harthmereNativeMeleeGeometry,
} from "@/shared/harthmere/harthmere_native_combat";
import {
  HARTHMERE_BOW_ATTACK_TIMING,
  harthmereBackpackArrowCount,
  harthmereMagicManaCost,
  harthmereRangedResourceKind,
  isHarthmereBowWeapon,
} from "@/shared/harthmere/harthmere_ranged_resources";
import { readHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import { emitHarthmereSoundEffect } from "@/shared/harthmere/sound_effect_manifest";
import {
  HARTHMERE_ATTACK_INPUT_BUFFER_SECS,
  HARTHMERE_COMBAT_COMBO_MAX_HITS,
  HARTHMERE_HEAVY_ATTACK_DAMAGE_MULTIPLIER,
  HARTHMERE_HEAVY_ATTACK_HOLD_SECS,
  HARTHMERE_PLAYER_ATTACK_TIMINGS,
  harthmerePlayerAttackCommitmentSeconds,
  nextHarthmereCombatCombo,
  type HarthmerePlayerAttackTimingClass,
} from "@/shared/harthmere/deliberate_combat";
import { fireAndForget } from "@/shared/util/async";
import { readHarthmereCombatLockState } from "@/client/components/challenges/harthmere_combat_lock_on";
import { readHarthmereCrosshairCombatActors } from "@/client/components/challenges/harthmereCrosshairCombatTarget";
import { rankHarthmereMeleeSweepHits } from "@/client/game/interact/harthmere_melee_sweep";
import { expandHarthmereNativeCreatureMeleeTargetAabb } from "@/shared/harthmere/harthmere_native_combat_catalog";

export type AttackDestroyDelegateHandler = (
  itemInfo: ClickableItemInfo
) => boolean;

export interface AttackDestroyDelegateSpec {
  onSelected?: AttackDestroyDelegateHandler;
  onUnselected?: AttackDestroyDelegateHandler;
  allowsPrimaryDelegation?: AttackDestroyDelegateHandler;
  onPrimaryDown?: AttackDestroyDelegateHandler;
  onPrimaryHoldTick?: AttackDestroyDelegateHandler;
  onPrimaryUp?: AttackDestroyDelegateHandler;
  allowsSecondaryDelegation?: AttackDestroyDelegateHandler;
  onSecondaryDown?: AttackDestroyDelegateHandler;
  onSecondaryHoldTick?: AttackDestroyDelegateHandler;
  onSecondaryUp?: AttackDestroyDelegateHandler;
  onTick?: AttackDestroyDelegateHandler;
}

function localPlayerCombatIsResetting(localPlayer: {
  playerStatus?: string;
  warpingInfo?: unknown;
}) {
  const warping = localPlayer.warpingInfo as
    { startTime?: unknown } | undefined;
  return (
    localPlayer.playerStatus === "dead" ||
    localPlayer.playerStatus === "respawning" ||
    Boolean(warping && Number.isFinite(Number(warping.startTime)))
  );
}

export type AttackDestroyDelegateDeps = ClientContextSubset<
  | "userId"
  | "input"
  | "table"
  | "resources"
  | "events"
  | "audioManager"
  | "permissionsManager"
  | "gardenHose"
  | "voxeloo"
> & {
  actionThrottler: TimeWindow<ActionType>;
};

/**
 * Resolve the target set at the authored contact frame.
 *
 * Every attack retains the entity identity selected on button-down, then
 * refreshes that same entity from ECS at contact. Re-reading the live cursor at
 * contact made ordinary camera motion during melee wind-up erase a valid hit.
 * The authoritative health handler still rejects targets that died, became
 * protected, or moved beyond the selected weapon's current reach.
 */
export function harthmereAttackImpactCandidates(
  _timingClass: HarthmerePlayerAttackTimingClass,
  initial: readonly ReadonlyEntity[],
  current: readonly ReadonlyEntity[]
): ReadonlyEntity[] {
  const initialIds = new Set(initial.map(({ id }) => id));
  return current.filter(({ id }) => initialIds.has(id));
}

export function harthmereMeleeImpactTargetInReach(
  playerPosition: ReadonlyVec3,
  target: ReadonlyEntity,
  reach: number
): boolean {
  const targetAabb = harthmereMeleeTargetAabb(target);
  return Boolean(
    targetAabb &&
    Number.isFinite(reach) &&
    reach >= 0 &&
    distSqToAABB(playerPosition, targetAabb) <= reach * reach
  );
}

function harthmereMeleeTargetAabb(
  target: ReadonlyEntity,
  renderedPosition?: ReadonlyVec3
) {
  const aabb = getAabbForEntity(
    target,
    renderedPosition
      ? { motionOverrides: { position: [...renderedPosition] } }
      : undefined
  );
  return aabb
    ? expandHarthmereNativeCreatureMeleeTargetAabb(
        {
          entityId: target.id,
          typeId: target.npc_metadata?.type_id,
          displayName: target.label?.text,
          maxHp: target.health?.maxHp,
        },
        aabb
      )
    : undefined;
}

export function harthmereMagicWeaponCharge(input: Item | undefined):
  | {
      definition: HarthmerePremiumWeaponDefinition;
      projectileVisualId: string;
      chargeTimeSecs: number;
      power: number;
    }
  | undefined {
  if (!input) {
    return undefined;
  }
  const semanticItemId =
    harthmereNativeItemIdForBiomesId(Number(input.id)) ?? String(input.id);
  const definition = getHarthmerePremiumWeapon(semanticItemId);
  if (
    !definition ||
    (definition.profile !== "magic" && definition.profile !== "magicBook")
  ) {
    return undefined;
  }
  const projectileVisualId =
    getHarthmereProjectileVisual(semanticItemId)?.id ?? "spark";
  const power = harthmereMagicChargePower({
    attackDamage: definition.attackPoints,
  });
  return {
    definition,
    projectileVisualId,
    power,
    chargeTimeSecs: harthmereMagicChargeDurationSecs({
      explicitMagic: true,
      projectileVisualId,
      attackDamage: definition.attackPoints,
    }),
  };
}

export class AttackDestroyDelegateItemSpec implements ClickableItemSpec {
  responsibleForPrimary: boolean = false;
  responsibleForSecondary: boolean = false;
  private queuedPrimaryAttack?: {
    expiresAt: number;
    attackableEntities: ReadonlyEntity[];
    itemInfo?: ClickableItemInfo;
    forcedTimingClass?: HarthmerePlayerAttackTimingClass;
  };
  private pendingPrimaryPress?: {
    startedAt: number;
    itemInfo: ClickableItemInfo;
    attackableEntities: ReadonlyEntity[];
  };
  private lastAirborneAim?: {
    capturedAt: number;
    attackableEntities: ReadonlyEntity[];
  };

  // This allows us to keep the wacking animation if you are holding and destroying multiple things
  private cancelWackTimeout?: ReturnType<typeof setTimeout>;
  private pendingMagicAttack?: {
    chargeId: string;
    timeout: ReturnType<typeof setTimeout>;
  };
  private readonly pendingImpactAttacks = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();
  private nextImpactAttackNonce = 1;

  constructor(
    readonly deps: AttackDestroyDelegateDeps,
    readonly attackDestroySpec: AttackDestroyDelegateSpec
  ) {}

  onUnselected(itemInfo: ClickableItemInfo) {
    this.queuedPrimaryAttack = undefined;
    this.pendingPrimaryPress = undefined;
    this.lastAirborneAim = undefined;
    this.cancelPendingMagicAttack("weapon_unselected");
    this.guardInteractionError(() => {
      this.attackDestroySpec.onUnselected?.(itemInfo);
    });
  }

  onSelected(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      this.attackDestroySpec.onSelected?.(itemInfo);
    });
  }

  onTick(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      const localPlayer = this.deps.resources.get("/scene/local_player");
      if (localPlayerCombatIsResetting(localPlayer)) {
        this.queuedPrimaryAttack = undefined;
        this.lastAirborneAim = undefined;
        this.cancelPendingMagicAttack("combat_state_reset");
        this.cancelPendingImpactAttacks();
        localPlayer.resetCombatAttackState();
        return;
      }
      const nowSeconds = this.deps.resources.get("/clock").time;
      // Per-frame maintenance keeps only lock/cursor state. The body sweep is
      // intentionally input-driven so fixing melee does not add a full nearby-
      // actor traversal to every render tick during a crowded fight.
      const currentAttackTargets = this.currentAttackableEntities(
        itemInfo,
        false
      );
      if (currentAttackTargets.length > 0) {
        this.lastAirborneAim = {
          capturedAt: nowSeconds,
          attackableEntities: [...currentAttackTargets],
        };
      } else if (
        this.lastAirborneAim &&
        nowSeconds - this.lastAirborneAim.capturedAt > 0.75
      ) {
        this.lastAirborneAim = undefined;
      }
      this.flushQueuedPrimaryAttack(itemInfo);
      this.attackDestroySpec.onTick?.(itemInfo);
    });
  }

  private queuePrimaryAttack(
    expiresAt: number,
    options?: {
      attackableEntities?: readonly ReadonlyEntity[];
      itemInfo?: ClickableItemInfo;
      forcedTimingClass?: HarthmerePlayerAttackTimingClass;
    }
  ) {
    // The first buffered press owns the follow-up. Repeated clicks during the
    // same commitment must not silently retarget the queued attack to whichever
    // entity happens to be under the cursor last.
    this.queuedPrimaryAttack ??= {
      expiresAt,
      attackableEntities: [
        ...(options?.attackableEntities ??
          (options?.itemInfo
            ? this.currentAttackableEntities(options.itemInfo)
            : this.cursor.attackableEntities)),
      ],
      itemInfo: options?.itemInfo,
      forcedTimingClass: options?.forcedTimingClass,
    };
  }

  private deferPrimaryAttackForMovementRecovery(
    nowSeconds: number,
    options?: {
      attackableEntities?: readonly ReadonlyEntity[];
      itemInfo?: ClickableItemInfo;
      forcedTimingClass?: HarthmerePlayerAttackTimingClass;
    }
  ): boolean {
    const player = this.deps.resources.get("/scene/local_player").player;
    const movement = player.movementActionInfo;
    if (!movement) {
      return false;
    }
    switch (
      movementActionAttackTransition({
        action: movement.action,
        startTimeSeconds: movement.startTime,
        expiryTimeSeconds: movement.expiryTime,
        nowSeconds,
      })
    ) {
      case "blocked":
      case "queue":
        this.queuePrimaryAttack(
          movement.expiryTime +
            PLAYER_EVADE_ATTACK_TRANSITION.inputGraceSeconds,
          options
        );
        return true;
      case "open":
        return false;
      case "none":
        return false;
    }
  }

  /**
   * Hold an attack press made during an existing attack's commitment.
   *
   * Keep the first follow-up press throughout commitment. The target identity
   * is captured with that press so a second cow remains the second target even
   * if camera/cursor state changes before the first swing recovers.
   */
  private bufferPrimaryAttackDuringCommitment(
    nowSeconds: number,
    options?: {
      attackableEntities?: readonly ReadonlyEntity[];
      itemInfo?: ClickableItemInfo;
      forcedTimingClass?: HarthmerePlayerAttackTimingClass;
    }
  ) {
    const attackInfo = this.attackInfo;
    if (!attackInfo) {
      return;
    }
    const commitmentEnd = attackInfo.start + attackInfo.duration;
    if (!Number.isFinite(commitmentEnd)) {
      return;
    }
    this.queuePrimaryAttack(
      Math.max(
        commitmentEnd,
        attackInfo.combatCombo?.nextAttackAt ?? commitmentEnd
      ) + HARTHMERE_ATTACK_INPUT_BUFFER_SECS,
      options
    );
  }

  private canLinkCombatAttack(nowSeconds: number) {
    const combo = this.attackInfo?.combatCombo;
    return Boolean(
      combo &&
      combo.hit < HARTHMERE_COMBAT_COMBO_MAX_HITS &&
      nowSeconds >= combo.nextAttackAt
    );
  }

  private validQueuedCombatTargets(
    queued: readonly ReadonlyEntity[],
    itemInfo: ClickableItemInfo
  ): ReadonlyEntity[] {
    const valid = this.combatTargetValidator(itemInfo);
    const refreshed = queued
      .map((entity) => this.deps.resources.get("/ecs/entity", entity.id))
      .filter(valid);
    if (refreshed.length > 0) {
      return refreshed;
    }
    return this.currentAttackableEntities(itemInfo).filter(valid);
  }

  private combatTargetValidator(itemInfo: ClickableItemInfo) {
    const timingClass = harthmereAttackTimingClass(itemInfo.item);
    const melee = timingClass === "basic" || timingClass === "heavy";
    const reach =
      (harthmereNativeItemCombatProfile(itemInfo.item)?.reach ??
        this.deps.resources.get("/tweaks").combat.meleeAttackRegion.far) +
      this.deps.resources.get("/player/modifiers").reach.increase;
    const playerPosition = this.deps.resources.get("/scene/local_player").player
      .position;
    return (entity: ReadonlyEntity | undefined): entity is ReadonlyEntity =>
      Boolean(
        entity?.position &&
        (!entity.health || entity.health.hp > 0) &&
        !entity.protection &&
        (!melee ||
          harthmereMeleeImpactTargetInReach(playerPosition, entity, reach))
      );
  }

  private currentAttackableEntities(
    itemInfo: ClickableItemInfo,
    includeBodySweep = true
  ) {
    const valid = this.combatTargetValidator(itemInfo);
    const lockTarget = readHarthmereCombatLockState().target;
    if (lockTarget) {
      const entityId = lockTarget.entityId ?? lockTarget.offset;
      const lockedEntity = Number.isFinite(entityId)
        ? this.deps.resources.get("/ecs/entity", entityId as BiomesId)
        : undefined;
      if (valid(lockedEntity)) {
        return [lockedEntity];
      }
    }
    const cursorTargets = this.cursor.attackableEntities.filter(valid);
    if (cursorTargets.length > 0) {
      return cursorTargets;
    }
    if (!includeBodySweep) {
      return [];
    }
    // Invalid/dead/out-of-range locks must never swallow a valid new cursor
    // target. When the center ray misses, resolve the visible rendered body
    // against the actual horizontal hand/weapon sweep. This deliberately does
    // not widen the terrain-edit cursor and therefore cannot turn an ordinary
    // off-target mining click into long-range creature damage.
    return this.currentMeleeSweepTarget(itemInfo, valid);
  }

  private currentMeleeSweepTarget(
    itemInfo: ClickableItemInfo,
    valid: (entity: ReadonlyEntity | undefined) => entity is ReadonlyEntity
  ): ReadonlyEntity[] {
    const timingClass = harthmereAttackTimingClass(itemInfo.item);
    if (timingClass !== "basic" && timingClass !== "heavy") {
      return [];
    }
    const geometry = harthmereNativeMeleeGeometry(itemInfo.item);
    if (!geometry) {
      return [];
    }
    const localPlayer = this.deps.resources.get("/scene/local_player");
    const player = localPlayer.player;
    const facing = viewDir([0, player.orientation[1]]);
    const ruleSet = this.deps.resources.get("/ruleset/current");
    const me = this.deps.resources.get("/ecs/entity", localPlayer.id);
    const reach =
      geometry.reach +
      this.deps.resources.get("/player/modifiers").reach.increase;
    const seen = new Set<BiomesId>();
    const hidden = new Set<BiomesId>();
    const aabbByEntityId = new Map<
      BiomesId,
      NonNullable<ReturnType<typeof getAabbForEntity>>
    >();
    const candidates: Array<{
      value: ReadonlyEntity;
      aabb: NonNullable<ReturnType<typeof getAabbForEntity>>;
    }> = [];

    const addCandidate = (
      entity: ReadonlyEntity | undefined,
      renderedPosition?: ReadonlyVec3
    ) => {
      if (
        !entity ||
        seen.has(entity.id) ||
        hidden.has(entity.id) ||
        !valid(entity) ||
        !isNativeEcsAttackTarget(entity)
      ) {
        return;
      }
      const aclAllowsPlayers =
        this.deps.permissionsManager.clientActionAllowedAt(
          "pvp",
          entity.position.v
        );
      if (!canAttackFilter(ruleSet, aclAllowsPlayers, me, entity)) {
        return;
      }
      const smoothedPosition =
        renderedPosition ??
        this.deps.resources
          .cached("/scene/npc/render_state", entity.id)
          ?.smoothedPosition();
      const aabb = harthmereMeleeTargetAabb(entity, smoothedPosition);
      if (!aabb) {
        return;
      }
      seen.add(entity.id);
      aabbByEntityId.set(entity.id, aabb);
      candidates.push({ value: entity, aabb });
    };

    for (const actor of readHarthmereCrosshairCombatActors()) {
      const rawEntityId = actor.entityId ?? actor.offset;
      if (!Number.isFinite(rawEntityId)) {
        continue;
      }
      const entityId = rawEntityId as BiomesId;
      if (actor.attackable === false || actor.screenVisible === false) {
        hidden.add(entityId);
        continue;
      }
      const entity = this.deps.resources.get("/ecs/entity", entityId);
      const actorPosition =
        Number.isFinite(actor.worldX) &&
        Number.isFinite(actor.worldY) &&
        Number.isFinite(actor.worldZ)
          ? ([actor.worldX, actor.worldY, actor.worldZ] as [
              number,
              number,
              number,
            ])
          : undefined;
      addCandidate(entity, actorPosition);
    }

    // The renderer bridge is useful presentation evidence, but it is not an
    // authority boundary and can be absent for a freshly streamed or focused
    // native NPC. Scan the small nearby ECS sphere only on actual attack input
    // and resolve the same smoothed render state when available. The AABB arc
    // and terrain line-of-sight checks below remain the final body-hit gates.
    for (const entity of this.deps.table.scan(
      NpcMetadataSelector.query.spatial.inSphere({
        center: player.position,
        radius: reach + 4,
      })
    )) {
      addCandidate(entity);
    }

    const ranked = rankHarthmereMeleeSweepHits({
      playerPosition: player.position,
      forward: [facing[0], facing[2]],
      reach,
      hitRadius: geometry.hitRadius,
      timingClass,
      candidates,
    });
    for (const hit of ranked) {
      const aabb = aabbByEntityId.get(hit.value.id);
      if (aabb && this.meleeSweepHasLineOfSight(player.position, aabb)) {
        // One input owns one native melee target. The server's per-player
        // cadence therefore advances once, even when several bodies overlap
        // the visual arc; the nearest unobstructed body wins deterministically.
        return [hit.value];
      }
    }
    return [];
  }

  private meleeSweepHasLineOfSight(
    playerPosition: ReadonlyVec3,
    targetAabb: NonNullable<ReturnType<typeof getAabbForEntity>>
  ) {
    const source: [number, number, number] = [
      playerPosition[0],
      playerPosition[1] + 1.15,
      playerPosition[2],
    ];
    const target: [number, number, number] = [
      (targetAabb[0][0] + targetAabb[1][0]) * 0.5,
      Math.max(
        targetAabb[0][1] + 0.25,
        Math.min(source[1], targetAabb[1][1] - 0.1)
      ),
      (targetAabb[0][2] + targetAabb[1][2]) * 0.5,
    ];
    const dx = target[0] - source[0];
    const dy = target[1] - source[1];
    const dz = target[2] - source[2];
    const distance = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(distance) || distance < 0.05) {
      return true;
    }
    const direction: [number, number, number] = [
      dx / distance,
      dy / distance,
      dz / distance,
    ];
    let blocked = false;
    terrainMarch(
      this.deps.voxeloo,
      this.deps.resources,
      source,
      direction,
      Math.max(0, distance - 0.12),
      () => {
        blocked = true;
        return false;
      }
    );
    return !blocked;
  }

  private flushQueuedPrimaryAttack(itemInfo: ClickableItemInfo) {
    const queued = this.queuedPrimaryAttack;
    if (!queued) {
      return;
    }
    const nowSeconds = this.deps.resources.get("/clock").time;
    if (nowSeconds > queued.expiresAt) {
      this.queuedPrimaryAttack = undefined;
      return;
    }

    // A buffered attack waits for the previous attack's commitment to end. The
    // evade-recovery path below owns the movement-action case.
    if (
      isAttacking(this.attackInfo, nowSeconds) &&
      !this.canLinkCombatAttack(nowSeconds)
    ) {
      return;
    }

    const localPlayer = this.deps.resources.get("/scene/local_player");
    const movement = localPlayer.player.movementActionInfo;
    const transition = movement
      ? movementActionAttackTransition({
          action: movement.action,
          startTimeSeconds: movement.startTime,
          expiryTimeSeconds: movement.expiryTime,
          nowSeconds,
        })
      : "none";
    const recoveryReached =
      transition === "open" ||
      !movement ||
      (transition === "none" && nowSeconds >= movement.expiryTime);
    if (!recoveryReached) {
      return;
    }

    this.queuedPrimaryAttack = undefined;
    if (
      isAttacking(this.attackInfo, nowSeconds) &&
      !this.canLinkCombatAttack(nowSeconds)
    ) {
      return;
    }
    const queuedItemInfo = queued.itemInfo ?? itemInfo;
    const targets = this.validQueuedCombatTargets(
      queued.attackableEntities,
      queuedItemInfo
    );
    if (targets.length > 0) {
      this.onAttackStart(targets, queuedItemInfo, queued.forcedTimingClass);
    } else {
      this.doDummyAttack(itemInfo);
    }
  }

  onPrimaryDown(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      const secondsSinceEpoch = this.deps.resources.get("/clock").time;
      const allowsDelegate =
        this.attackDestroySpec.allowsPrimaryDelegation?.(itemInfo) ?? true;
      if (allowsDelegate) {
        const cursorTargets = this.currentAttackableEntities(itemInfo);
        if (cursorTargets.length > 0) {
          this.lastAirborneAim = {
            capturedAt: secondsSinceEpoch,
            attackableEntities: [...cursorTargets],
          };
        }
        const localPlayer = this.deps.resources.get("/scene/local_player");
        const canRetainAirborneAim =
          cursorTargets.length === 0 &&
          this.lastAirborneAim &&
          secondsSinceEpoch - this.lastAirborneAim.capturedAt <= 0.75 &&
          (localPlayer.player.onGround === false ||
            localPlayer.player.movementActionInfo?.action === "doubleJump");
        const attackableEntities =
          cursorTargets.length > 0
            ? cursorTargets
            : canRetainAirborneAim
              ? this.validQueuedCombatTargets(
                  this.lastAirborneAim!.attackableEntities,
                  itemInfo
                )
              : [];
        if (attackableEntities.length > 0) {
          this.pendingPrimaryPress = {
            startedAt: secondsSinceEpoch,
            itemInfo,
            attackableEntities: [...attackableEntities],
          };
          this.responsibleForPrimary = true;
          return;
        }
        if (
          isAttacking(this.attackInfo, secondsSinceEpoch) &&
          !this.canLinkCombatAttack(secondsSinceEpoch)
        ) {
          this.bufferPrimaryAttackDuringCommitment(secondsSinceEpoch);
          this.responsibleForPrimary = true;
          return;
        }

        if (this.deferPrimaryAttackForMovementRecovery(secondsSinceEpoch)) {
          this.responsibleForPrimary = true;
          return;
        }

        if (this.tryAttack(itemInfo)) {
          this.responsibleForPrimary = true;
          return;
        }
      }

      const handled = this.attackDestroySpec.onPrimaryDown?.(itemInfo);

      if (!handled && allowsDelegate) {
        this.doDummyAttack(itemInfo);
        this.responsibleForPrimary = true;
        return;
      }
    });
  }

  onPrimaryHoldTick(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (!this.responsibleForPrimary) {
        this.attackDestroySpec.onPrimaryHoldTick?.(itemInfo);
        return;
      }
      const pending = this.pendingPrimaryPress;
      if (!pending) {
        return;
      }
      const nowSeconds = this.deps.resources.get("/clock").time;
      if (nowSeconds - pending.startedAt >= HARTHMERE_HEAVY_ATTACK_HOLD_SECS) {
        this.pendingPrimaryPress = undefined;
        this.commitPrimaryAttack(pending, "heavy");
      }
    });
  }

  onPrimaryUp(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (!this.responsibleForPrimary) {
        this.attackDestroySpec.onPrimaryUp?.(itemInfo);
        return;
      }

      const pending = this.pendingPrimaryPress;
      this.pendingPrimaryPress = undefined;
      if (pending) {
        this.commitPrimaryAttack(pending);
      }

      this.responsibleForPrimary = false;
    });
  }

  private commitPrimaryAttack(
    pending: {
      startedAt: number;
      itemInfo: ClickableItemInfo;
      attackableEntities: ReadonlyEntity[];
    },
    forcedTimingClass?: HarthmerePlayerAttackTimingClass
  ) {
    const nowSeconds = this.deps.resources.get("/clock").time;
    const options = {
      attackableEntities: pending.attackableEntities,
      itemInfo: pending.itemInfo,
      forcedTimingClass,
    };
    if (
      isAttacking(this.attackInfo, nowSeconds) &&
      !this.canLinkCombatAttack(nowSeconds)
    ) {
      this.bufferPrimaryAttackDuringCommitment(nowSeconds, options);
      return;
    }
    if (this.deferPrimaryAttackForMovementRecovery(nowSeconds, options)) {
      return;
    }
    this.onAttackStart(
      pending.attackableEntities,
      pending.itemInfo,
      forcedTimingClass
    );
  }

  onSecondaryDown(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (
        this.attackDestroySpec.allowsSecondaryDelegation?.(itemInfo) ??
        true
      ) {
        const secondsSinceEpoch = this.deps.resources.get("/clock").time;
        if (
          isAttacking(this.attackInfo, secondsSinceEpoch) &&
          !this.canLinkCombatAttack(secondsSinceEpoch)
        ) {
          this.bufferPrimaryAttackDuringCommitment(secondsSinceEpoch);
          this.responsibleForSecondary = true;
          return;
        }
        if (this.tryAttack(itemInfo)) {
          this.responsibleForSecondary = true;
          return;
        }

        if (!(this.attackDestroySpec.onSecondaryDown?.(itemInfo) ?? false)) {
          this.tryDestroyTick(itemInfo, "secondary");
          const handled = Boolean(this.destroyInfo);
          this.responsibleForSecondary = true;
          if (!handled) {
            this.doDummyAttack(itemInfo);
            return;
          }
          return;
        }
      } else {
        this.attackDestroySpec.onSecondaryDown?.(itemInfo);
        return;
      }
    });
  }

  onSecondaryHoldTick(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (!this.responsibleForSecondary) {
        this.attackDestroySpec.onSecondaryHoldTick?.(itemInfo);
        return;
      }

      const secondsSinceEpoch = this.deps.resources.get("/clock").time;
      if (isAttacking(this.attackInfo, secondsSinceEpoch)) {
        return;
      }

      this.tryDestroyTick(itemInfo, "secondary");
    });
  }

  onSecondaryUp(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (!this.responsibleForSecondary) {
        this.attackDestroySpec.onSecondaryUp?.(itemInfo);
        return;
      }

      this.responsibleForSecondary = false;
      if (this.destroyInfo) {
        this.handleDestroyInfoChangeInteraction(undefined);
      }
    });
  }

  tryAttack(itemInfo: ClickableItemInfo) {
    const attackableEntities = this.currentAttackableEntities(itemInfo);

    if (attackableEntities.length > 0) {
      this.onAttackStart(attackableEntities, itemInfo);
      return true;
    }
  }

  doDummyAttack(itemInfo: ClickableItemInfo) {
    this.onAttackStart([], itemInfo);
  }

  tryDestroyTick(
    itemInfo: ClickableItemInfo,
    clickType: "primary" | "secondary"
  ) {
    const activeActionToPass: ActiveAction = {
      action: "destroy",
      click: clickType,
      tool: itemInfo.item,
      toolRef: itemInfo.itemRef,
    };
    const secondsSinceEpoch = this.deps.resources.get("/clock").time;
    const { hit } = this.cursor;

    if (this.deps.actionThrottler.shouldThrottle("destroy")) {
      return;
    }

    const destroyInfo = this.destroyInfo;

    if (
      hit?.kind === "entity" &&
      hit.entity.placeable_component &&
      hit.distance <= this.changeRadius
    ) {
      if (
        this.applyLegacyItemOutput(
          destroyPlaceable(this.legacyItemInput, activeActionToPass, hit)
        )
      ) {
        // maybe fire "onDestroyStopped" /  "onDestroyStarted"
        return;
      }
    }

    if (hitExistingTerrain(hit) && hit.distance <= this.changeRadius) {
      if (
        this.applyLegacyItemOutput(
          destroyOrShapeTerrain(
            this.deps,
            this.legacyItemInput,
            activeActionToPass,
            hit
          )
        )
      ) {
        // maybe fire "onDestroyStopped" /  "onDestroyStarted"
        return;
      }
    }

    if (hit?.kind === "blueprint" && hit.distance <= this.changeRadius) {
      if (!isBlueprintEmpty(this.deps.resources, hit.blueprintEntityId)) {
        // Don't allow destroying non-empty blueprints.
        // Skip
        return;
      }

      // TODO: add hold time delay
      if (
        destroyInfo?.blueprintId !== hit.blueprintEntityId ||
        destroyInfo?.finished
      ) {
        // Use grass hand destuction time for now.
        const actionTimeMs = blockDestructionTimeMs(
          anItem(BikkieIds.grass),
          undefined
        );

        this.handleDestroyInfoChangeInteraction({
          start: secondsSinceEpoch,
          pos: hit.pos,
          face: 0,
          blueprintId: hit.blueprintEntityId,
          canDestroy: true,
          allowed: true,
          hardnessClass: 0,
          activeAction: { ...activeActionToPass, action: "destroy" },
          finished: false,
          actionTimeMs,
        });
      }

      if (destroyInfo && destroyInfo.blueprintId) {
        const actionDelta = 1000 * (secondsSinceEpoch - destroyInfo.start);
        if (actionDelta > destroyInfo.actionTimeMs) {
          this.handleDestroyInfoChangeInteraction({
            ...destroyInfo,
            finished: true,
          });
        } else {
          this.handleDestroyInfoChangeInteraction({
            ...destroyInfo,
            percentage: actionDelta / destroyInfo.actionTimeMs,
          });
        }
      }
      return;
    }

    this.handleDestroyInfoChangeInteraction(undefined);
  }

  onAttackStart(
    attackedEntities: ReadonlyEntity[],
    itemInfo: ClickableItemInfo,
    forcedTimingClass?: HarthmerePlayerAttackTimingClass
  ) {
    const secondsSinceEpoch = this.deps.resources.get("/clock").time;
    const resourceKind = harthmereRangedResourceKind(itemInfo.item);
    if (!this.hasLocalRangedResource(itemInfo.item, resourceKind)) {
      this.emitEmptyRangedResourceSound(resourceKind);
      return;
    }
    const magicCharge = harthmereMagicWeaponCharge(itemInfo.item);
    if (magicCharge) {
      if (this.pendingMagicAttack) {
        return;
      }
      const chargeId = harthmereMagicChargeId({
        casterKind: "player",
        abilityId: magicCharge.projectileVisualId,
        castTime: secondsSinceEpoch,
      });
      // Release is owned by the shared magic windup, not by the charge graphic.
      // `chargeTimeSecs` still travels with the event so the VFX can size
      // itself by spell power; only the timing is taken from combat.
      const releaseTime =
        secondsSinceEpoch + HARTHMERE_MAGIC_RELEASE_WINDUP_SECS;
      dispatchHarthmereMagicCharge({
        phase: "start",
        chargeId,
        abilityId: magicCharge.projectileVisualId,
        projectileVisualId: magicCharge.projectileVisualId,
        casterKind: "player",
        chargeStartedAt: secondsSinceEpoch,
        chargeTimeSecs: magicCharge.chargeTimeSecs,
        releaseTime,
        power: magicCharge.power,
        source: "native_magic_weapon_attack",
      });
      const timeout = setTimeout(() => {
        if (this.pendingMagicAttack?.chargeId !== chargeId) {
          return;
        }
        this.pendingMagicAttack = undefined;
        if (!this.hasLocalRangedResource(itemInfo.item, "mana")) {
          dispatchHarthmereMagicCharge({
            phase: "cancel",
            chargeId,
            casterKind: "player",
            source: "insufficient_mana_at_release",
          });
          this.emitEmptyRangedResourceSound("mana");
          return;
        }
        dispatchHarthmereMagicCharge({
          phase: "release",
          chargeId,
          abilityId: magicCharge.projectileVisualId,
          projectileVisualId: magicCharge.projectileVisualId,
          casterKind: "player",
          chargeStartedAt: secondsSinceEpoch,
          chargeTimeSecs: magicCharge.chargeTimeSecs,
          releaseTime,
          power: magicCharge.power,
          source: "native_magic_weapon_release",
        });
        const releasedAt = this.deps.resources.get("/clock").time;
        this.beginAndScheduleAttackImpact(
          attackedEntities,
          itemInfo,
          releasedAt,
          forcedTimingClass
        );
      }, HARTHMERE_MAGIC_RELEASE_WINDUP_SECS * 1000);
      this.pendingMagicAttack = { chargeId, timeout };
      return;
    }
    this.beginAndScheduleAttackImpact(
      attackedEntities,
      itemInfo,
      secondsSinceEpoch,
      forcedTimingClass
    );
  }

  private beginAndScheduleAttackImpact(
    attackedEntities: ReadonlyEntity[],
    itemInfo: ClickableItemInfo,
    attackStart: number,
    forcedTimingClass?: HarthmerePlayerAttackTimingClass
  ) {
    const naturalTimingClass = harthmereAttackTimingClass(itemInfo.item);
    const timingClass =
      forcedTimingClass === "heavy" &&
      (naturalTimingClass === "basic" || naturalTimingClass === "heavy")
        ? "heavy"
        : naturalTimingClass;
    const bow = isHarthmereBowWeapon(itemInfo.item);
    const timing = bow
      ? HARTHMERE_BOW_ATTACK_TIMING
      : HARTHMERE_PLAYER_ATTACK_TIMINGS[timingClass];
    const participatesInSwingCombo =
      timingClass === "basic" || timingClass === "heavy";
    const comboDecision =
      attackedEntities.length && participatesInSwingCombo
        ? nextHarthmereCombatCombo(
            this.attackInfo?.combatCombo,
            attackStart,
            timingClass
          )
        : undefined;
    if (comboDecision && !comboDecision.allowed) {
      this.queuePrimaryAttack(
        comboDecision.readyAt + HARTHMERE_ATTACK_INPUT_BUFFER_SECS,
        {
          attackableEntities: attackedEntities,
          itemInfo,
          forcedTimingClass,
        }
      );
      return;
    }
    const interaction = {
      attackedEntities,
      tool: itemInfo.item,
      attackInfo: {
        start: attackStart,
        attackTime:
          harthmereRangedResourceKind(itemInfo.item) !== undefined
            ? attackStart
            : undefined,
        duration: bow
          ? (HARTHMERE_BOW_ATTACK_TIMING.impactMs +
              HARTHMERE_BOW_ATTACK_TIMING.recoveryMs) /
            1000
          : harthmerePlayerAttackCommitmentSeconds(timingClass),
        movementScale: timing.movementScale,
        timingClass,
        damageMultiplier:
          timingClass === "heavy"
            ? HARTHMERE_HEAVY_ATTACK_DAMAGE_MULTIPLIER
            : 1,
        combatCombo: comboDecision?.state,
      },
    };
    if (!beginAttackInteraction(this.deps, interaction)) {
      this.bufferPrimaryAttackDuringCommitment(attackStart);
      return;
    }

    if (harthmereRangedResourceKind(itemInfo.item)) {
      fireAndForget(
        this.deps.events.publish(
          new HarthmereRangedResourceAttackEvent({
            id: this.deps.userId,
            target_id: attackedEntities[0]?.id,
            attack_time: attackStart,
          })
        )
      );
    }

    const nonce = this.nextImpactAttackNonce++;
    const timeout = setTimeout(() => {
      if (!this.pendingImpactAttacks.has(nonce)) {
        return;
      }
      this.pendingImpactAttacks.delete(nonce);
      const localPlayer = this.deps.resources.get("/scene/local_player");
      if (
        localPlayerCombatIsResetting(localPlayer) ||
        (Number.isFinite(Number(localPlayer.lastWarp)) &&
          Number(localPlayer.lastWarp) / 1000 > attackStart)
      ) {
        return;
      }
      const currentAttackedEntities = attackedEntities
        .map((entity) => this.deps.resources.get("/ecs/entity", entity.id))
        .filter((entity): entity is ReadonlyEntity => entity !== undefined);
      const melee = timingClass === "basic" || timingClass === "heavy";
      const reach =
        (harthmereNativeItemCombatProfile(itemInfo.item)?.reach ??
          this.deps.resources.get("/tweaks").combat.meleeAttackRegion.far) +
        this.deps.resources.get("/player/modifiers").reach.increase;
      const playerPosition = this.deps.resources.get("/scene/local_player")
        .player.position;
      const refreshedEntities = harthmereAttackImpactCandidates(
        timingClass,
        attackedEntities,
        currentAttackedEntities
      ).filter(
        (entity) =>
          Boolean(entity.position) &&
          (!entity.health || entity.health.hp > 0) &&
          !entity.protection &&
          (!melee ||
            harthmereMeleeImpactTargetInReach(playerPosition, entity, reach))
      );
      resolveAttackInteraction(this.deps, {
        ...interaction,
        attackedEntities: refreshedEntities,
      });
    }, timing.impactMs);
    this.pendingImpactAttacks.set(nonce, timeout);
  }

  private hasLocalRangedResource(
    item: Item | undefined,
    kind = harthmereRangedResourceKind(item)
  ) {
    if (kind === "arrow") {
      return (
        harthmereBackpackArrowCount(
          this.deps.resources.get("/ecs/c/inventory", this.deps.userId)
        ) > 0n
      );
    }
    if (kind === "mana") {
      const cost = harthmereMagicManaCost(item);
      const vitals = readHarthmereNativeVitals(
        this.deps.resources.get("/ecs/c/trigger_state", this.deps.userId)
      );
      return cost > 0 && cost <= vitals.mana;
    }
    return true;
  }

  private emitEmptyRangedResourceSound(
    kind: ReturnType<typeof harthmereRangedResourceKind>
  ) {
    if (!kind) return;
    emitHarthmereSoundEffect(
      kind === "arrow" ? "bow_empty_click" : "magic_empty_fizzle",
      {
        position: this.deps.resources.get("/scene/local_player").player
          .position,
      }
    );
  }

  private cancelPendingImpactAttacks() {
    for (const timeout of this.pendingImpactAttacks.values()) {
      clearTimeout(timeout);
    }
    this.pendingImpactAttacks.clear();
  }

  private cancelPendingMagicAttack(source: string) {
    if (!this.pendingMagicAttack) {
      return;
    }
    clearTimeout(this.pendingMagicAttack.timeout);
    dispatchHarthmereMagicCharge({
      phase: "cancel",
      chargeId: this.pendingMagicAttack.chargeId,
      casterKind: "player",
      source,
    });
    this.pendingMagicAttack = undefined;
  }

  guardInteractionError<T>(code: () => T): T | undefined {
    try {
      return code();
    } catch (error: any) {
      if (error instanceof AttackDestroyInteractionError) {
        handleInteractionError(this.deps, error.interactionError);
        return;
      } else {
        throw error;
      }
    }
  }

  get changeRadius() {
    return changeRadius(this.deps.resources);
  }

  get cursor() {
    return this.deps.resources.get("/scene/cursor");
  }

  get destroyInfo() {
    return this.deps.resources.get("/scene/local_player").destroyInfo;
  }

  set destroyInfo(newInfo: DestroyInfo | undefined) {
    this.deps.resources.get("/scene/local_player").destroyInfo = newInfo;
  }

  get attackInfo() {
    return this.deps.resources.get("/scene/local_player").attackInfo;
  }

  set attackInfo(newInfo: AttackInfo | undefined) {
    this.deps.resources.get("/scene/local_player").attackInfo = newInfo;
  }

  private applyLegacyItemOutput(output: LegacyInteractOutput) {
    let applied = false;
    if (output.destroyInfoChange !== undefined) {
      this.handleDestroyInfoChangeInteraction(
        output.destroyInfoChange.newValue
      );
      applied = true;
    }
    if (output.gameModal !== undefined) {
      this.deps.resources.set("/game_modal", output.gameModal);
      applied = true;
    }
    if (output.interactionError !== undefined) {
      throw new AttackDestroyInteractionError(output.interactionError);
    }
    return applied;
  }

  /*
   * For interaction with fallback item script helpers
   */

  private handleDestroyInfoChangeInteraction(
    destroyInfo: DestroyInfo | undefined
  ) {
    const localPlayer = this.deps.resources.get("/scene/local_player");
    localPlayer.destroyInfo = destroyInfo;
    const secondsSinceEpoch = this.deps.resources.get("/clock").time;

    if ((!destroyInfo || destroyInfo.finished) && !this.cancelWackTimeout) {
      const delay = destroyInfo?.finished
        ? this.deps.actionThrottler.windowSizeMs + 10
        : 50;

      const startEmoteTime = localPlayer.player.emoteInfo?.emoteStartTime;
      this.cancelWackTimeout = setTimeout(() => {
        if (
          localPlayer.player.isEmoting(secondsSinceEpoch, "destroy") &&
          localPlayer.player.emoteInfo?.emoteStartTime === startEmoteTime
        ) {
          localPlayer.player.eagerCancelEmote(this.deps.events);
        }
        this.cancelWackTimeout = undefined;
      }, delay);
    } else if (destroyInfo) {
      if (!localPlayer.player.isEmoting(secondsSinceEpoch, "destroy")) {
        localPlayer.player.eagerEmote(
          this.deps.events,
          this.deps.resources,
          "destroy"
        );
      }
    }

    if (destroyInfo && !destroyInfo.finished && this.cancelWackTimeout) {
      clearTimeout(this.cancelWackTimeout);
      this.cancelWackTimeout = undefined;
    }

    if (destroyInfo?.finished) {
      switch (destroyInfo.activeAction.action) {
        case "shape":
          shapeTerrain(
            this.deps,
            destroyInfo.pos,
            destroyInfo.activeAction.tool?.shape as ShapeName,
            destroyInfo.activeAction.toolRef
          );
          break;
        case "destroy":
          if (destroyInfo.blueprintId) {
            destroyBlueprint(
              this.deps,
              destroyInfo.blueprintId,
              destroyInfo.pos,
              destroyInfo.activeAction.toolRef
            );
          } else if (destroyInfo.groupId) {
            destroyGroup(
              this.deps,
              destroyInfo.pos,
              destroyInfo.groupId,
              destroyInfo.activeAction.toolRef
            );
          } else if (destroyInfo.placeableId) {
            actuallyDestroyPlaceable(
              this.deps,
              destroyInfo.placeableId,
              destroyInfo.pos,
              destroyInfo.activeAction.toolRef
            );
          } else {
            ok(destroyInfo.terrainId);
            destroyTerrain(
              this.deps,
              destroyInfo.pos,
              destroyInfo.activeAction.toolRef,
              destroyInfo.terrainId
            );
          }
          break;
      }
    }
  }

  get legacyItemInput() {
    const localPlayer = this.deps.resources.get("/scene/local_player");

    return {
      actionAllowed: (
        pos: ReadonlyVec3,
        action: AclAction,
        entityId?: BiomesId
      ) => {
        return this.deps.permissionsManager.getPermissionForAction(
          pos,
          action,
          entityId
        );
      },

      groupOccupancyAt: (pos: ReadonlyVec3) =>
        groupOccupancyAt(this.deps.resources, pos),
      plantExperimentalAt: (pos: ReadonlyVec3) =>
        plantExperimentalAt(this.deps.resources, pos),
      groupHardnessClass: (groupId: BiomesId) =>
        groupHardnessClass(
          this.deps.voxeloo,
          this.deps.resources.get("/ecs/c/group_component", groupId)
        ),
      isTerrainAtPosition: (pos: ReadonlyVec3) =>
        isTerrainAtPosition(this.deps.resources, pos),
      checkActionAllowedIfBlueprintVoxel: (
        pos: ReadonlyVec3,
        action: BuildAction
      ) =>
        checkActionAllowedIfBlueprintVoxel(
          getBlueprintAtPosition(this.deps.table, pos)?.id,
          this.deps.resources,
          pos,
          action
        ),
      groupDestructionTimeMs: (groupId: BiomesId, tool: Item | undefined) =>
        groupDestructionTimeMs(
          this.deps.voxeloo,
          localPlayer.id,
          this.deps.resources.get("/ecs/c/group_component", groupId),
          this.deps.resources.get("/ecs/c/created_by", groupId)?.id,
          tool
        ),
      entityGroupPermitsPlaceableDestruction: (entity: ReadonlyEntity) =>
        entity.in_group
          ? allowPlaceableDestruction(
              entity,
              this.deps.resources.get("/ecs/entity", entity.in_group.id)
            )
          : true,

      playerDestroyInfo: localPlayer.destroyInfo,
      secondsSinceEpoch: this.deps.resources.get("/clock").time,
    } as const;
  }
}

export function harthmereAttackImpactDelayMs(item: Item | undefined): number {
  if (isHarthmereBowWeapon(item)) {
    return HARTHMERE_BOW_ATTACK_TIMING.impactMs;
  }
  return HARTHMERE_BODY_WEAPON_TIMING_PROFILES[harthmereAttackTimingClass(item)]
    .impactMs;
}

export function harthmereAttackTimingClass(
  item: Item | undefined
): HarthmerePlayerAttackTimingClass {
  const semanticItemId = item
    ? harthmereNativeItemIdForBiomesId(Number(item.id))
    : undefined;
  const descriptor = `${semanticItemId ?? ""} ${item?.name ?? ""} ${
    item?.displayName ?? ""
  }`.toLowerCase();
  if (
    (item as (Item & { readonly twoHanded?: boolean }) | undefined)
      ?.twoHanded === true ||
    /two.?hand|greatsword|maul|war.?axe/.test(descriptor)
  ) {
    return "heavy";
  }
  switch (harthmereNativeItemCombatProfile(item)?.kind) {
    case "heavy":
      return "heavy";
    case "ranged":
      return "ranged";
    case "spell":
      return "magic";
    case "unarmed":
    case "melee":
      return "basic";
  }
  if (/staff|wand|tome|spell|scroll|focus/.test(descriptor)) {
    return "magic";
  }
  if (/bow|crossbow|dart|throwing/.test(descriptor)) {
    return "ranged";
  }
  return "basic";
}
