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
import type { AclAction, Item } from "@/shared/ecs/gen/types";
import {
  blockDestructionTimeMs,
  groupDestructionTimeMs,
  groupHardnessClass,
} from "@/shared/game/damage";
import { anItem } from "@/shared/game/item";
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
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3 } from "@/shared/math/types";
import type { TimeWindow } from "@/shared/util/throttling";
import { ok } from "assert";
import { HARTHMERE_BODY_WEAPON_TIMING_PROFILES } from "@/client/game/util/player_animations";
import { harthmereNativeItemCombatProfile } from "@/shared/harthmere/harthmere_native_combat";
import {
  HARTHMERE_ATTACK_INPUT_BUFFER_SECS,
  HARTHMERE_PLAYER_ATTACK_TIMINGS,
  harthmerePlayerAttackCommitmentSeconds,
  type HarthmerePlayerAttackTimingClass,
} from "@/shared/harthmere/deliberate_combat";

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
  private queuedPrimaryAttack?: { expiresAt: number };

  // This allows us to keep the wacking animation if you are holding and destroying multiple things
  private cancelWackTimeout?: ReturnType<typeof setTimeout>;
  private pendingMagicAttack?: {
    chargeId: string;
    timeout: ReturnType<typeof setTimeout>;
  };
  private pendingImpactAttack?: {
    nonce: number;
    timeout: ReturnType<typeof setTimeout>;
  };
  private nextImpactAttackNonce = 1;

  constructor(
    readonly deps: AttackDestroyDelegateDeps,
    readonly attackDestroySpec: AttackDestroyDelegateSpec
  ) {}

  onUnselected(itemInfo: ClickableItemInfo) {
    this.queuedPrimaryAttack = undefined;
    this.cancelPendingMagicAttack("weapon_unselected");
    this.cancelPendingImpactAttack();
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
      this.flushQueuedPrimaryAttack(itemInfo);
      this.attackDestroySpec.onTick?.(itemInfo);
    });
  }

  private deferPrimaryAttackForEvadeRecovery(nowSeconds: number): boolean {
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
        return true;
      case "queue":
        this.queuedPrimaryAttack = {
          expiresAt:
            movement.expiryTime +
            PLAYER_EVADE_ATTACK_TRANSITION.inputGraceSeconds,
        };
        return true;
      case "open":
        player.cancelMovementAction();
        return false;
      case "none":
        return false;
    }
  }

  /**
   * Hold an attack press made during an existing attack's commitment.
   *
   * Only presses inside the buffer window at the tail of commitment are kept.
   * An early press during windup is still discarded, so buffering cannot be
   * used to queue a whole exchange from one input — it only rescues the press a
   * player makes when they can already see recovery beginning.
   */
  private bufferPrimaryAttackDuringCommitment(nowSeconds: number) {
    const attackInfo = this.attackInfo;
    if (!attackInfo) {
      return;
    }
    const commitmentEnd = attackInfo.start + attackInfo.duration;
    if (!Number.isFinite(commitmentEnd)) {
      return;
    }
    if (nowSeconds < commitmentEnd - HARTHMERE_ATTACK_INPUT_BUFFER_SECS) {
      return;
    }
    this.queuedPrimaryAttack = {
      expiresAt: commitmentEnd + HARTHMERE_ATTACK_INPUT_BUFFER_SECS,
    };
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
    if (isAttacking(this.attackInfo, nowSeconds)) {
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
    localPlayer.player.cancelMovementAction();
    if (isAttacking(this.attackInfo, nowSeconds)) {
      return;
    }
    if (!this.tryAttack(itemInfo)) {
      this.doDummyAttack(itemInfo);
    }
  }

  onPrimaryDown(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      const secondsSinceEpoch = this.deps.resources.get("/clock").time;
      const allowsDelegate =
        this.attackDestroySpec.allowsPrimaryDelegation?.(itemInfo) ?? true;
      if (allowsDelegate) {
        if (isAttacking(this.attackInfo, secondsSinceEpoch)) {
          this.bufferPrimaryAttackDuringCommitment(secondsSinceEpoch);
          this.responsibleForPrimary = true;
          return;
        }

        if (this.deferPrimaryAttackForEvadeRecovery(secondsSinceEpoch)) {
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
    });
  }

  onPrimaryUp(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (!this.responsibleForPrimary) {
        this.attackDestroySpec.onPrimaryUp?.(itemInfo);
        return;
      }

      this.responsibleForPrimary = false;
    });
  }

  onSecondaryDown(itemInfo: ClickableItemInfo) {
    this.guardInteractionError(() => {
      if (
        this.attackDestroySpec.allowsSecondaryDelegation?.(itemInfo) ??
        true
      ) {
        const secondsSinceEpoch = this.deps.resources.get("/clock").time;
        if (isAttacking(this.attackInfo, secondsSinceEpoch)) {
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
    const { attackableEntities } = this.cursor;

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
    itemInfo: ClickableItemInfo
  ) {
    const secondsSinceEpoch = this.deps.resources.get("/clock").time;
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
          releasedAt
        );
      }, HARTHMERE_MAGIC_RELEASE_WINDUP_SECS * 1000);
      this.pendingMagicAttack = { chargeId, timeout };
      return;
    }
    this.beginAndScheduleAttackImpact(
      attackedEntities,
      itemInfo,
      secondsSinceEpoch
    );
  }

  private beginAndScheduleAttackImpact(
    attackedEntities: ReadonlyEntity[],
    itemInfo: ClickableItemInfo,
    attackStart: number
  ) {
    this.cancelPendingImpactAttack();
    const timingClass = harthmereAttackTimingClass(itemInfo.item);
    const timing = HARTHMERE_PLAYER_ATTACK_TIMINGS[timingClass];
    const interaction = {
      attackedEntities,
      tool: itemInfo.item,
      attackInfo: {
        start: attackStart,
        duration: harthmerePlayerAttackCommitmentSeconds(timingClass),
        movementScale: timing.movementScale,
      },
    };
    beginAttackInteraction(this.deps, interaction);

    const nonce = this.nextImpactAttackNonce++;
    const timeout = setTimeout(() => {
      if (this.pendingImpactAttack?.nonce !== nonce) {
        return;
      }
      this.pendingImpactAttack = undefined;
      const melee = timingClass === "basic" || timingClass === "heavy";
      const impactCandidates = melee
        ? this.cursor.attackableEntities
        : attackedEntities;
      const refreshedEntities = impactCandidates.map(
        (entity) => this.deps.resources.get("/ecs/entity", entity.id) ?? entity
      );
      resolveAttackInteraction(this.deps, {
        ...interaction,
        attackedEntities: refreshedEntities,
      });
    }, harthmereAttackImpactDelayMs(itemInfo.item));
    this.pendingImpactAttack = { nonce, timeout };
  }

  private cancelPendingImpactAttack() {
    if (!this.pendingImpactAttack) return;
    clearTimeout(this.pendingImpactAttack.timeout);
    this.pendingImpactAttack = undefined;
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
