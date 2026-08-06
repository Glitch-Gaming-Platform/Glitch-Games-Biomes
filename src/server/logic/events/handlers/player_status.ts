import { makeEventHandler } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import { decrementItemDurability } from "@/server/logic/utils/durability";
import {
  modifyPlayerHealth,
  setPlayerHealth,
  setPlayerMaxHealth,
} from "@/server/logic/utils/players";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import { attackIntervalSeconds } from "@/shared/game/damage";
import { anItem } from "@/shared/game/item";
import { movementActionIsInvulnerable } from "@/shared/game/movement_actions";
import { degToRad, diffAngle } from "@/shared/math/angles";
import { distSqToAABB, sub, yaw } from "@/shared/math/linear";
import {
  ATTACK_VERTICAL_REACH_METERS,
  bodyVerticalGap,
  horizontalDistance,
} from "@/shared/npc/behavior/combat_geometry";
import {
  canAttackTarget,
  effectiveAttackStrikeDelaySecs,
  enhancedNightMuckerHexCombatParams,
  isNightForNpcAggro,
  rangedAttackShape,
} from "@/shared/npc/behavior/chase_attack";
import {
  readCreatureProgression,
  scaleCreatureCombatStats,
} from "@/shared/npc/creature_level";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import {
  applyHarthmereNativeAttackStats,
  harthmereNativeAttackCadenceDecision,
  harthmereNativeNpcChaseAttackParams,
  harthmereNativeItemCombatProfile,
  harthmereNativeItemDefinitionForBiomesId,
  mitigateHarthmereNativeIncomingDamage,
  nativeCombatArmorStats,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeNpcCombatProfileForEntity } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { harthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import { log } from "@/shared/logging";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import {
  HARTHMERE_ARROW_DAMAGE,
  consumeHarthmereRangedResourceReceipt,
  harthmereRangedResourceKind,
  harthmereRangedResourceReceiptMatches,
  isHarthmereBowWeapon,
  readHarthmereRangedResourceReceipt,
} from "@/shared/harthmere/harthmere_ranged_resources";
import {
  awardHarthmereNativeSkillXp,
  harthmereNativeCombatSublevelMultipliers,
  harthmereNativeCombatSkillAwards,
  harthmereNativeShieldSkillAwards,
  readHarthmereNativeSkillLevel,
} from "@/shared/harthmere/harthmere_skill_progression";
import { harthmereSublevelPotencyMultiplier } from "@/shared/harthmere/harthmere_sublevel_benefits";

const HARTHMERE_NPC_ATTACK_REPLAY_LEDGER_LIMIT = 160;

function sameImpactPoint(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined
) {
  return Boolean(
    a &&
    b &&
    a.length >= 3 &&
    b.length >= 3 &&
    Math.abs(a[0] - b[0]) <= 0.001 &&
    Math.abs(a[1] - b[1]) <= 0.001 &&
    Math.abs(a[2] - b[2]) <= 0.001
  );
}

function recordNpcAttackReceipt(
  player: {
    mutableHarthmereEcsTransactionLedger(): { transaction_ids: string[] };
  },
  replayKey: string
) {
  const ledger = player.mutableHarthmereEcsTransactionLedger();
  if (ledger.transaction_ids.includes(replayKey)) {
    return false;
  }
  ledger.transaction_ids.push(replayKey);
  if (
    ledger.transaction_ids.length > HARTHMERE_NPC_ATTACK_REPLAY_LEDGER_LIMIT
  ) {
    ledger.transaction_ids.splice(
      0,
      ledger.transaction_ids.length - HARTHMERE_NPC_ATTACK_REPLAY_LEDGER_LIMIT
    );
  }
  return true;
}

export const playerInitEventHandler = makeEventHandler("playerInitEvent", {
  mergeKey: (event) => event.id,
  involves: (event) => ({
    player: event.id,
  }),
  apply: ({ player }, _event, context) => {
    if (player.playerStatus()?.init) {
      return;
    }
    player.mutablePlayerStatus().init = true;

    const inventory = new PlayerInventoryEditor(context, player);
    inventory.giveCurrency(BikkieIds.bling, 10n);
  },
});

export const playerSetNUXStatusEventHandler = makeEventHandler(
  "setNUXStatusEvent",
  {
    involves: (event) => ({
      player: q.includeIced(event.id),
    }),
    apply: ({ player }, event) => {
      player.mutablePlayerStatus().nux_status.set(event.nux_id, {
        ...event.status,
      });
    },
  }
);

export const updatePlayerHealthEventHandler = makeEventHandler(
  "updatePlayerHealthEvent",
  {
    prepareInvolves: (event) => ({
      player: q.id(event.id),
    }),
    prepare: ({ player }) => ({
      activeMinigameInstanceId: player.playing_minigame?.minigame_instance_id,
      activeMinigameId: player.playing_minigame?.minigame_id,
    }),
    mergeKey: (event) => event.id,
    involves: (event, { activeMinigameInstanceId, activeMinigameId }) => ({
      player: event.id,
      playerActiveMinigameInstance:
        activeMinigameInstanceId &&
        q.id(activeMinigameInstanceId).with("minigame_instance").includeIced(),
      playerActiveMinigame:
        activeMinigameId &&
        q.id(activeMinigameId).with("minigame_component").includeIced(),
      attacker:
        event.damageSource?.kind === "attack"
          ? q.id(event.damageSource.attacker)
          : undefined,
    }),
    apply: (
      { attacker, player, playerActiveMinigame, playerActiveMinigameInstance },
      event,
      context
    ) => {
      let authoritativeHp = event.hp;
      let authoritativeHpDelta = event.hpDelta;
      let authoritativeFixedArrowDamage = false;
      let shieldDamagePrevented = 0;
      if (event.damageSource?.kind === "attack") {
        if (
          movementActionIsInvulnerable(
            player.movementState(),
            secondsSinceEpoch()
          )
        ) {
          return;
        }
        const health = attacker?.health();
        if (health !== undefined && health.hp <= 0) {
          // You cannot attack if you're dead.
          return;
        }

        const npcTypeId = attacker?.npcMetadata()?.type_id;
        const serializedNpcState = attacker?.npcState()?.data;
        const npcCustomState = serializedNpcState?.length
          ? deserializeNpcCustomState(serializedNpcState)
          : undefined;
        const nativeProfile = npcTypeId
          ? harthmereNativeNpcCombatProfileForEntity({
              entityId: attacker?.id,
              typeId: npcTypeId,
              displayName: attacker?.label()?.text,
              maxHp: attacker?.health()?.maxHp,
            })
          : undefined;
        const attackerPosition = attacker?.position()?.v;
        const attackerSize = attacker?.size()?.v;
        const playerPosition = player.position()?.v;
        const playerAabb = getAabbForEntity(player.asReadonlyEntity());
        const attackerHeight = attacker?.size()?.v[1] ?? 1.8;
        const playerHeight = playerAabb
          ? playerAabb[1][1] - playerAabb[0][1]
          : 1.8;
        const meleeReceipt =
          npcTypeId !== undefined && event.attackAbilityId === undefined
            ? npcCustomState?.chaseAttack?.meleeAttack
            : undefined;
        if (npcTypeId !== undefined && event.attackAbilityId === undefined) {
          const now = secondsSinceEpoch();
          const direction =
            meleeReceipt && playerPosition
              ? yaw(sub(playerPosition, meleeReceipt.originPoint))
              : undefined;
          const validReceipt = Boolean(
            meleeReceipt &&
            attackerPosition &&
            playerPosition &&
            playerAabb &&
            event.attackTime !== undefined &&
            event.impactPoint &&
            npcCustomState?.chaseAttack?.attackTarget === player.id &&
            meleeReceipt.targetId === player.id &&
            Math.abs(meleeReceipt.attackTime - event.attackTime) <= 0.001 &&
            sameImpactPoint(meleeReceipt.impactPoint, event.impactPoint) &&
            meleeReceipt.result === "hit" &&
            meleeReceipt.lineOfSightAtImpact === true &&
            meleeReceipt.resolvedAt !== undefined &&
            meleeReceipt.resolvedAt + 0.1 >= meleeReceipt.impactTime &&
            meleeReceipt.resolvedAt <= meleeReceipt.expiresAt + 0.1 &&
            meleeReceipt.expiresAt - meleeReceipt.impactTime <= 0.5 &&
            now + 0.1 >= meleeReceipt.impactTime &&
            now - meleeReceipt.resolvedAt <= 2 &&
            meleeReceipt.attackDamage > 0 &&
            meleeReceipt.attackDistance >= 0 &&
            meleeReceipt.attackDistance <= 50 &&
            meleeReceipt.attackFovDeg >= 0 &&
            meleeReceipt.attackFovDeg <= 360 &&
            meleeReceipt.verticalReach >= 0 &&
            meleeReceipt.verticalReach <= 10 &&
            distSqToAABB(event.impactPoint, playerAabb) <= 0.75 * 0.75 &&
            direction !== undefined &&
            canAttackTarget({
              horizontalDistance: horizontalDistance(
                meleeReceipt.originPoint,
                playerPosition
              ),
              verticalGap: bodyVerticalGap({
                attackerFeetY: meleeReceipt.originPoint[1],
                attackerHeight,
                targetFeetY: playerAabb[0][1],
                targetHeight: playerHeight,
              }),
              targetOrientationDiff: diffAngle(direction, meleeReceipt.castYaw),
              attackRadius: meleeReceipt.attackDistance,
              attackFovDeg: meleeReceipt.attackFovDeg,
              verticalReach: meleeReceipt.verticalReach,
              attackerPosition: meleeReceipt.originPoint,
              attackerSize,
              targetPosition: playerPosition,
            })
          );
          if (!validReceipt) {
            log.debug(
              "Rejected NPC melee damage without a current impact receipt",
              {
                attackerId: attacker?.id,
                playerId: player.id,
              }
            );
            return;
          }
        }
        if (nativeProfile) {
          if (nativeProfile.attackDamage <= 0) return;
          const rangedAttack = event.attackAbilityId
            ? nativeProfile.rangedAttacks?.find(
                ({ abilityId }) => abilityId === event.attackAbilityId
              )
            : undefined;
          if (event.attackAbilityId) {
            const rangedState = npcCustomState?.chaseAttack?.rangedAttack;
            const now = secondsSinceEpoch();
            const rangedReleaseTime = rangedState
              ? (rangedState.releaseTime ??
                rangedState.castTime + (rangedState.chargeTimeSecs ?? 0))
              : undefined;
            const shape = rangedAttack
              ? rangedAttackShape(rangedAttack)
              : undefined;
            const attackOrigin = rangedState?.originPoint ?? attackerPosition;
            const recordedHit = Boolean(
              rangedState?.hitTargetIds?.includes(player.id) ??
              ((shape === "projectile" || shape === "beam") &&
                rangedState?.targetId === player.id)
            );
            const playerInsideAttack = (() => {
              if (
                !rangedAttack ||
                !rangedState ||
                !playerAabb ||
                !attackOrigin
              ) {
                return false;
              }
              if (shape === "self_aoe") {
                return (
                  distSqToAABB(attackOrigin, playerAabb) <=
                  rangedAttack.hitRadius * rangedAttack.hitRadius
                );
              }
              if (shape === "cone") {
                if (!playerPosition) return false;
                const direction = yaw(sub(playerPosition, attackOrigin));
                return (
                  horizontalDistance(attackOrigin, playerPosition) <=
                    rangedAttack.attackDistance + rangedAttack.hitRadius &&
                  Math.abs(
                    diffAngle(direction, rangedState.castYaw ?? direction)
                  ) <= degToRad((rangedAttack.coneAngleDeg ?? 60) / 2)
                );
              }
              return (
                distSqToAABB(rangedState.aimPoint, playerAabb) <=
                rangedAttack.hitRadius * rangedAttack.hitRadius
              );
            })();
            if (
              !rangedAttack ||
              !attackerPosition ||
              !playerAabb ||
              event.attackTime === undefined ||
              !event.impactPoint ||
              !rangedState ||
              rangedState.abilityId !== event.attackAbilityId ||
              ((shape === "projectile" || shape === "beam") &&
                rangedState.targetId !== player.id) ||
              rangedReleaseTime === undefined ||
              Math.abs(rangedReleaseTime - event.attackTime) > 0.001 ||
              !sameImpactPoint(rangedState.aimPoint, event.impactPoint) ||
              rangedState.result !== "hit" ||
              !recordedHit ||
              now + 0.1 < rangedReleaseTime ||
              now + 0.1 < rangedState.impactTime ||
              now - rangedReleaseTime > rangedAttack.castTimeSecs + 3 ||
              horizontalDistance(attackerPosition, event.impactPoint) >
                rangedAttack.attackDistance + rangedAttack.hitRadius ||
              !playerInsideAttack
            ) {
              log.debug("Rejected invalid native NPC ranged damage", {
                attackerId: attacker?.id,
                playerId: player.id,
                attackAbilityId: event.attackAbilityId,
              });
              return;
            }
            if (
              !recordNpcAttackReceipt(
                player,
                `npc-ranged:${attacker.id}:${event.attackAbilityId}:${event.attackTime}`
              )
            ) {
              return;
            }
          } else {
            const baseMeleeParams =
              harthmereNativeNpcChaseAttackParams(nativeProfile);
            if (!baseMeleeParams || !meleeReceipt) return;
            const effectiveMeleeParams =
              enhancedNightMuckerHexCombatParams(
                attacker?.label()?.text ?? nativeProfile.displayName,
                isNightForNpcAggro(meleeReceipt.attackTime),
                baseMeleeParams,
                baseMeleeParams
              ) ?? baseMeleeParams;
            const creatureProgression = readCreatureProgression(npcCustomState);
            const expectedMeleeStats = scaleCreatureCombatStats(
              {
                maxHp: nativeProfile.maxHp,
                attackDamage: effectiveMeleeParams.attackDamage,
                attackIntervalSecs: effectiveMeleeParams.attackIntervalSecs,
                walkSpeed: nativeProfile.walkSpeed,
                runSpeed: nativeProfile.runSpeed,
                killXp: nativeProfile.killXp,
              },
              creatureProgression.level
            );
            const expectedStrikeDelay = effectiveAttackStrikeDelaySecs({
              attackStrikeMomentSecs:
                effectiveMeleeParams.attackStrikeMomentSecs,
              attackAnimationMultiplier:
                effectiveMeleeParams.attackAnimationMultiplier,
              attackIntervalSecs: expectedMeleeStats.attackIntervalSecs,
            });
            const dynamicEncounterMelee = /gilded bull|ninth winter/i.test(
              attacker?.label()?.text ?? ""
            );
            if (
              (!dynamicEncounterMelee &&
                (meleeReceipt.attackDistance >
                  effectiveMeleeParams.attackDistance + 0.001 ||
                  meleeReceipt.attackFovDeg >
                    effectiveMeleeParams.attackFovDeg + 0.001 ||
                  meleeReceipt.attackDamage >
                    expectedMeleeStats.attackDamage + 0.001 ||
                  meleeReceipt.verticalReach >
                    ATTACK_VERTICAL_REACH_METERS + 0.001 ||
                  Math.abs(
                    meleeReceipt.impactTime -
                      (meleeReceipt.attackTime + expectedStrikeDelay)
                  ) > 0.001)) ||
              !recordNpcAttackReceipt(
                player,
                `npc-melee:${attacker!.id}:${meleeReceipt.attackTime}`
              )
            ) {
              log.debug(
                "Rejected mismatched or replayed native NPC melee damage",
                {
                  attackerId: attacker?.id,
                  playerId: player.id,
                }
              );
              return;
            }
          }

          const worn = [...(player.wearing()?.items.values() ?? [])];
          const armor = nativeCombatArmorStats(worn);
          const defender = readHarthmereNativeCombatProgression(
            player.triggerState()
          );
          const creatureProgression = readCreatureProgression(npcCustomState);
          const scaledNpcStats = scaleCreatureCombatStats(
            {
              maxHp: nativeProfile.maxHp,
              attackDamage:
                rangedAttack?.attackDamage ?? nativeProfile.attackDamage,
              attackIntervalSecs: nativeProfile.attackIntervalSecs,
              walkSpeed: nativeProfile.walkSpeed,
              runSpeed: nativeProfile.runSpeed,
              killXp: nativeProfile.killXp,
            },
            creatureProgression.level
          );
          const defenderStats = harthmereNativeLevelStats(defender.level);
          const attackerStats = harthmereNativeLevelStats(nativeProfile.level);
          const damage = mitigateHarthmereNativeIncomingDamage({
            rawDamage:
              rangedAttack?.attackDamage !== undefined
                ? scaledNpcStats.attackDamage
                : (meleeReceipt?.attackDamage ?? scaledNpcStats.attackDamage),
            armor: armor.armor + defenderStats.armor,
            defense: armor.defense + defenderStats.defense,
            magicResistance:
              armor.defense +
              defenderStats.defense * 0.75 +
              defenderStats.intelligence,
            damageType: rangedAttack?.damageType,
            evasion: armor.evasion + defenderStats.evasion,
            accuracy: attackerStats.accuracy,
            attackerLevel: nativeProfile.level,
            defenderLevel: defender.level,
          });
          authoritativeHp = undefined;
          authoritativeHpDelta = -damage;

          // Armor durability is consumed in the same event transaction as the
          // accepted hit. Rejected/out-of-range packets cannot wear equipment.
          const inventory = new PlayerInventoryEditor(context, player);
          for (const [slot, item] of player.wearing()?.items ?? []) {
            const profile = harthmereNativeItemCombatProfile(item);
            if (
              profile &&
              profile.armor + profile.defense + profile.evasion > 0 &&
              profile.durabilityCostMs > 0
            ) {
              decrementItemDurability(
                inventory,
                { kind: "wearable", key: slot },
                profile.durabilityCostMs
              );
            }
          }
        } else if (npcTypeId !== undefined && meleeReceipt) {
          if (
            !recordNpcAttackReceipt(
              player,
              `npc-melee:${attacker!.id}:${meleeReceipt.attackTime}`
            )
          ) {
            return;
          }
          authoritativeHp = undefined;
          authoritativeHpDelta = -Math.max(
            1,
            Math.round(meleeReceipt.attackDamage)
          );
        } else if (attacker?.playerStatus()) {
          const attackerProgress = readHarthmereNativeCombatProgression(
            attacker.triggerState()
          );
          const attackerInventory = new PlayerInventoryEditor(
            context,
            attacker
          );
          const selectedRef = attackerInventory.inventory().selected;
          const selected = attackerInventory.get(selectedRef);
          const nowMs = Date.now();
          const rangedResourceReceipt = readHarthmereRangedResourceReceipt(
            attacker.triggerState()
          );
          const receiptItem = rangedResourceReceipt.itemId
            ? anItem(rangedResourceReceipt.itemId)
            : undefined;
          const paidRangedResourceAttack = Boolean(
            receiptItem &&
            harthmereRangedResourceReceiptMatches(attacker.triggerState(), {
              attackTime: event.attackTime,
              itemId: receiptItem.id,
              targetId: player.id,
              nowMs,
            })
          );
          const attackItem = paidRangedResourceAttack
            ? receiptItem
            : selected?.item;
          authoritativeFixedArrowDamage = Boolean(
            paidRangedResourceAttack &&
            rangedResourceReceipt.kind === "arrow" &&
            isHarthmereBowWeapon(attackItem)
          );
          const definition = harthmereNativeItemDefinitionForBiomesId(
            attackItem?.id
          );
          const usesNativeCombat =
            attackerProgress.migrationVersion > 0 || definition !== undefined;
          if (usesNativeCombat) {
            const itemProfile = harthmereNativeItemCombatProfile(attackItem);
            if (
              harthmereRangedResourceKind(attackItem) &&
              !paidRangedResourceAttack
            ) {
              return;
            }
            if (paidRangedResourceAttack) {
              consumeHarthmereRangedResourceReceipt(
                attacker.mutableTriggerState()
              );
            }
            // Harthmere-native items must have an explicit combat profile, but
            // original Biomes minigames still author their loadouts with
            // legacy Bikkie weapons (for example Mega Axe). Migrating a player
            // must not make those server-issued ECS weapons harmless. Keep the
            // native authority boundary while deriving legacy weapon damage
            // from the selected ECS item instead of trusting the client delta.
            if (definition && (!itemProfile || itemProfile.damagePerHit <= 0)) {
              return;
            }
            if (attackerProgress.level < (itemProfile?.levelRequirement ?? 1)) {
              return;
            }
            const sublevel = harthmereNativeCombatSublevelMultipliers(
              attacker.triggerState(),
              {
                itemId: itemProfile?.itemId,
                kind: itemProfile?.kind ?? "melee",
              }
            );
            const effectiveManaCost = Math.max(
              0,
              Math.round((itemProfile?.manaCost ?? 0) * sublevel.efficiency)
            );
            const attackerVitals = readHarthmereNativeVitals(
              attacker.triggerState()
            );
            if (
              !paidRangedResourceAttack &&
              effectiveManaCost > attackerVitals.mana
            ) {
              return;
            }
            const attackerPosition = attacker.position()?.v;
            const playerAabb = getAabbForEntity(player.asReadonlyEntity());
            const reach = itemProfile?.reach ?? 3.5;
            if (
              !attackerPosition ||
              !playerAabb ||
              distSqToAABB(attackerPosition, playerAabb) > reach * reach
            ) {
              return;
            }
            const intervalMs = Math.round(
              1000 *
                (itemProfile?.intervalSecs ?? attackIntervalSeconds(attackItem))
            );
            const attackCadence = paidRangedResourceAttack
              ? {
                  allowed: true,
                  timingClass: undefined,
                  damageMultiplier: 1,
                  progression: {
                    lastAttackMs: rangedResourceReceipt.authorizedAtMs,
                  },
                }
              : harthmereNativeAttackCadenceDecision({
                  progression: attackerProgress,
                  nowMs,
                  itemIntervalMs: intervalMs,
                  itemKind: itemProfile?.kind ?? "melee",
                  requestedTimingClass: event.attackTimingClass,
                });
            if (!attackCadence.allowed) {
              return;
            }
            writeHarthmereNativeCombatProgression(
              attacker.mutableTriggerState(),
              attackCadence.progression ?? { lastAttackMs: nowMs }
            );
            if (!paidRangedResourceAttack && effectiveManaCost > 0) {
              writeHarthmereNativeVitals(attacker.mutableTriggerState(), {
                mana: attackerVitals.mana - effectiveManaCost,
              });
            }

            const worn = [...(player.wearing()?.items.values() ?? [])];
            const armor = nativeCombatArmorStats(worn);
            const defender = readHarthmereNativeCombatProgression(
              player.triggerState()
            );
            const attackerStats = harthmereNativeLevelStats(
              attackerProgress.level
            );
            const defenderStats = harthmereNativeLevelStats(defender.level);
            const statDamage = authoritativeFixedArrowDamage
              ? { damage: HARTHMERE_ARROW_DAMAGE, critical: false }
              : applyHarthmereNativeAttackStats({
                  baseDamage:
                    itemProfile?.damagePerHit ??
                    Math.max(
                      1,
                      Math.round(((attackItem?.dps ?? 16) * intervalMs) / 1000)
                    ),
                  kind: itemProfile?.kind ?? "melee",
                  stats: attackerStats,
                  criticalSeed: [
                    attacker.id,
                    player.id,
                    attackerProgress.lastAttackMs,
                    attackItem?.id,
                  ],
                });
            const damage = authoritativeFixedArrowDamage
              ? HARTHMERE_ARROW_DAMAGE
              : mitigateHarthmereNativeIncomingDamage({
                  rawDamage: Math.max(
                    1,
                    Math.round(
                      statDamage.damage *
                        sublevel.potency *
                        attackCadence.damageMultiplier
                    )
                  ),
                  armor: armor.armor + defenderStats.armor,
                  defense: armor.defense + defenderStats.defense,
                  evasion: armor.evasion + defenderStats.evasion,
                  accuracy: attackerStats.accuracy,
                  attackerLevel: attackerProgress.level,
                  defenderLevel: defender.level,
                });
            authoritativeHp = undefined;
            authoritativeHpDelta = -damage;
            awardHarthmereNativeSkillXp(
              attacker.mutableTriggerState(),
              harthmereNativeCombatSkillAwards({
                itemId: itemProfile?.itemId,
                kind: itemProfile?.kind ?? "melee",
                damage,
              })
            );
            if (
              !paidRangedResourceAttack &&
              selected &&
              (itemProfile?.durabilityCostMs ?? 0) > 0
            ) {
              decrementItemDurability(
                attackerInventory,
                selectedRef,
                Math.max(
                  1,
                  Math.round(
                    itemProfile!.durabilityCostMs * sublevel.efficiency
                  )
                )
              );
            }
          }
        }
      }

      if (
        event.damageSource?.kind === "attack" &&
        !authoritativeFixedArrowDamage &&
        authoritativeHpDelta !== undefined &&
        authoritativeHpDelta < 0
      ) {
        const equippedItemIds = [...(player.wearing()?.items.values() ?? [])]
          .map(
            (item) => harthmereNativeItemDefinitionForBiomesId(item.id)?.itemId
          )
          .filter((itemId): itemId is string => Boolean(itemId));
        if (equippedItemIds.some((itemId) => /shield|buckler/i.test(itemId))) {
          const incoming = -authoritativeHpDelta;
          const shieldPotency = harthmereSublevelPotencyMultiplier(
            readHarthmereNativeSkillLevel(
              player.triggerState(),
              "shield_mastery"
            )
          );
          const shieldSkillBonusPrevented =
            incoming > 1
              ? Math.max(
                  0,
                  Math.min(
                    incoming - 1,
                    Math.round(incoming * (shieldPotency - 1))
                  )
                )
              : 0;
          // Base shield armor was already included in the authoritative
          // mitigation above. Credit that real block for mastery progression,
          // while only the learned potency bonus removes additional HP here.
          shieldDamagePrevented =
            incoming > 1 ? Math.max(1, shieldSkillBonusPrevented) : 0;
          authoritativeHpDelta = -Math.max(
            1,
            incoming - shieldSkillBonusPrevented
          );
        }
        awardHarthmereNativeSkillXp(
          player.mutableTriggerState(),
          harthmereNativeShieldSkillAwards({
            equippedItemIds,
            damagePrevented: shieldDamagePrevented,
          })
        );
      }

      if (authoritativeHp !== undefined) {
        setPlayerHealth(
          player,
          authoritativeHp,
          event.damageSource,
          playerActiveMinigame,
          playerActiveMinigameInstance,
          context
        );
      } else if (authoritativeHpDelta !== undefined) {
        modifyPlayerHealth(
          player,
          authoritativeHpDelta,
          event.damageSource,
          playerActiveMinigame,
          playerActiveMinigameInstance,
          context
        );
      }
      if (event.maxHp !== undefined) {
        setPlayerMaxHealth(player, event.maxHp);
      }
    },
  }
);
