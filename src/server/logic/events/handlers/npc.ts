import { makeEventHandler, newIds } from "@/server/logic/events/core";
import { decrementItemDurability } from "@/server/logic/utils/durability";
import { q } from "@/server/logic/events/query";
import {
  MAX_DROPS_FOR_SPEC,
  createDropsForBag,
  rollSpec,
} from "@/server/logic/utils/drops";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { NpcState } from "@/shared/ecs/gen/components";
import type * as ecs from "@/shared/ecs/gen/types";
import type { SellToEntityEvent } from "@/shared/firehose/events";
import { resolveItemAttributeId } from "@/shared/game/item";
import { createBag } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import { sellPrice } from "@/shared/game/sales";
import { idToNpcType } from "@/shared/npc/bikkie";
import { modifyNpcHealth } from "@/shared/npc/modify_health";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import {
  applyCreatureLevelResistance,
  readCreatureProgression,
  scaleCreatureCombatStats,
} from "@/shared/npc/creature_level";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import { attackIntervalSeconds } from "@/shared/game/damage";
import { movementActionIsInvulnerable } from "@/shared/game/movement_actions";
import {
  add,
  dist,
  distSqToAABB,
  normalizev,
  scale,
  sub,
} from "@/shared/math/linear";
import {
  applyHarthmereNativeAttackStats,
  awardHarthmereNativeCombatXp,
  harthmereNativeItemCombatProfile,
  harthmereNativeItemDefinitionForBiomesId,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeNpcCombatProfileForEntity } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { ch1EscortIsUnkillable } from "@/shared/harthmere/ch1_dungeon_encounters";
import {
  harthmereNativeLevelStats,
  syncHarthmereNativeLevelStats,
} from "@/shared/harthmere/harthmere_native_level_stats";
import { log } from "@/shared/logging";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { any } from "@/shared/util/helpers";
import { ok } from "assert";
import { HARTHMERE_NATIVE_NPC_MELEE_MAX_CENTER_DISTANCE } from "@/shared/harthmere/combat_reach";
import { harthmereRespawningLiveCreatureSeedIds } from "@/shared/harthmere/live_entity_production_seed";
import { harthmereSharedLiveCreatureRespawnRegistry } from "@/shared/harthmere/live_creature_respawn_registry";
import { recordHarthmereJobsBoardNativeKill } from "@/shared/harthmere/jobs_board_native_kill_ledger";
import {
  awardHarthmereNativeSkillXp,
  harthmereNativeCombatSkillAwards,
  harthmereNativeGatheringSkillAwards,
} from "@/shared/harthmere/harthmere_skill_progression";
import {
  getHarthmereEnergyWeapon,
  harthmereEnergyWeaponDamageAtDistance,
  type HarthmereEnergyWeaponDefinition,
} from "@/shared/harthmere/energy_weapon_catalog";
import {
  advanceHarthmerePulseCarbineShotCount,
  beginHarthmereEnergySecondaryAuthorization,
  consumeHarthmereEnergySecondaryTarget,
  harthmereEnergySecondaryAlreadyHit,
  readHarthmereEnergySecondaryAuthorization,
} from "@/shared/harthmere/energy_weapon_native_state";

const HARTHMERE_RESPAWNING_CREATURE_IDS = new Set(
  harthmereRespawningLiveCreatureSeedIds()
);

const HARTHMERE_ENERGY_SECONDARY_WINDOW_MS = 1_250;
const HARTHMERE_ENERGY_MAX_SECONDARY_TARGETS = 12;

function distanceFromEnergyPenetrationLine(input: {
  attacker: readonly [number, number, number];
  origin: readonly [number, number, number];
  target: readonly [number, number, number];
}) {
  const axis = sub(input.origin, input.attacker);
  const length = Math.max(
    0.001,
    Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2)
  );
  const direction = scale(1 / length, axis);
  const fromOrigin = sub(input.target, input.origin);
  const forward =
    fromOrigin[0] * direction[0] +
    fromOrigin[1] * direction[1] +
    fromOrigin[2] * direction[2];
  const closest = add(input.origin, scale(Math.max(0, forward), direction));
  return { forward, distance: dist(input.target, closest) };
}

function energySecondaryDamage(input: {
  weapon: HarthmereEnergyWeaponDefinition;
  mode: "penetration" | "nova" | "singularity";
  attackerPosition: readonly [number, number, number];
  targetPosition: readonly [number, number, number];
  origin: readonly [number, number, number];
  primaryKilled: boolean;
}) {
  const primaryDistance = dist(input.attackerPosition, input.origin);
  const radiusDistance = dist(input.targetPosition, input.origin);
  switch (input.mode) {
    case "penetration": {
      if (input.weapon.special.kind !== "energy_burn") return undefined;
      const line = distanceFromEnergyPenetrationLine({
        attacker: input.attackerPosition,
        origin: input.origin,
        target: input.targetPosition,
      });
      if (
        line.forward <= 0 ||
        line.distance > 1.35 ||
        dist(input.attackerPosition, input.targetPosition) >
          input.weapon.hardMaxRange + 2
      ) {
        return undefined;
      }
      return harthmereEnergyWeaponDamageAtDistance(
        input.weapon,
        dist(input.attackerPosition, input.targetPosition),
        input.weapon.special.penetrationDamageMultiplier
      );
    }
    case "nova": {
      if (input.weapon.special.kind !== "nova") return undefined;
      let multiplier =
        radiusDistance <= input.weapon.special.impactRadius
          ? input.weapon.special.impactDamageMultiplier
          : 0;
      if (
        input.primaryKilled &&
        radiusDistance <= input.weapon.special.killRadius
      ) {
        multiplier += input.weapon.special.killDamageMultiplier;
      }
      return multiplier > 0
        ? harthmereEnergyWeaponDamageAtDistance(
            input.weapon,
            primaryDistance,
            multiplier
          )
        : undefined;
    }
    case "singularity":
      if (
        input.weapon.special.kind !== "singularity" ||
        radiusDistance > input.weapon.special.radius
      ) {
        return undefined;
      }
      return harthmereEnergyWeaponDamageAtDistance(
        input.weapon,
        primaryDistance,
        input.weapon.special.explosionDamageMultiplier
      );
  }
}

const updateNpcHealthEventHandler = makeEventHandler("updateNpcHealthEvent", {
  involves: (event) => ({
    npc: q
      .id(event.id)
      .with(
        "health",
        "npc_metadata",
        "position",
        "rigid_body",
        "size",
        "npc_state"
      ),
    dropIds: newIds(MAX_DROPS_FOR_SPEC),
    attacker:
      event.damageSource?.kind === "attack"
        ? q.player(event.damageSource.attacker)
        : undefined,
  }),
  apply: ({ npc, attacker }, event, context) => {
    if (npc.health().hp <= 0) {
      // Health updates have no effect on dead NPCs.
      return;
    }

    // CHAPTER_1_UNKILLABLE_ESCORTS
    //
    // ch1_engine_contracts.ts ANIMA RULE 3 says Iris Fen, Marrow and Dr. Sorrel
    // are "unkillable, non-negotiable", but the only enforcement was a test that
    // searched encounter strings for their names. They were seeded with ordinary
    // Health, their escort combat policies walk them into 90 HP Salt-Cured
    // Muckers and a 420 HP Gilded Bull, and Chapter 1 has no revive path for an
    // escort NPC. One dead companion permanently blocked the escort objective —
    // and in the desert that objective is what sets `ch1_iris_rescued`, which
    // the exit requires. Healing still applies; harm does not.
    if (ch1EscortIsUnkillable(npc.id) && event.hp < 0) {
      return;
    }

    if (
      event.damageSource?.kind === "attack" &&
      movementActionIsInvulnerable(npc.movementState(), secondsSinceEpoch())
    ) {
      return;
    }

    const npcTypeId = npc.npcMetadata().type_id;
    const nativeProfile = harthmereNativeNpcCombatProfileForEntity({
      entityId: npc.id,
      typeId: npcTypeId,
      displayName: npc.label()?.text,
      maxHp: npc.health().maxHp,
    });
    const serializedNpcState = npc.npcState()?.data;
    const deserializedNpcState = serializedNpcState?.length
      ? deserializeNpcCustomState(serializedNpcState)
      : deserializeNpcCustomState(undefined);
    const creatureProgression = nativeProfile
      ? readCreatureProgression(deserializedNpcState)
      : undefined;
    let hpDelta = event.hp;
    let energyWeaponForResistance: HarthmereEnergyWeaponDefinition | undefined;
    let pendingEnergySpecialSoundId:
      | "photon_shield_overheat"
      | "pulse_carbine_overcharge"
      | "helix_energy_burn"
      | "nova_cannon_mini_nova"
      | "singularity_gravity_collapse"
      | undefined;
    let pendingEnergySpecialAtMs = 0;
    let pendingEnergyAuthorization:
      | {
          mode: "penetration" | "nova" | "singularity";
          weaponId: HarthmereEnergyWeaponDefinition["id"];
          startedAtMs: number;
          origin: [number, number, number];
          remainingTargets: number;
        }
      | undefined;

    if (event.damageSource?.kind === "attack") {
      const attackerPosition = attacker?.position();
      if (!attackerPosition) return;

      if (nativeProfile) {
        // Native Harthmere damage is computed from the attacker's ECS-selected
        // item. Client hp, item ids, levels, and cooldowns are observations only.
        if (!attacker?.has("player_status")) return;
        if ((attacker.delta().health()?.hp ?? 0) <= 0) {
          // Match the native player-damage path: death disables attacks until
          // the authoritative respawn/health transaction revives the player.
          return;
        }
        if (nativeProfile.behaviorKind === "sentinel") {
          // Protected robots/training sentinels are authored as non-attackable.
          // Enforce that on the server as well as in cursor filtering so a
          // forged UpdateNpcHealthEvent cannot reproduce the robot-only kill.
          return;
        }
        const nowMs = Date.now();
        const burn = deserializedNpcState.energyWeapon?.burn;
        const helixWeapon = getHarthmereEnergyWeapon("helix_projector");
        const authorizedBurnTick = Boolean(
          burn &&
            helixWeapon &&
            burn.source === attacker.id &&
            burn.ticksRemaining > 0 &&
            nowMs + 50 >= burn.nextTickAtMs &&
            event.hp < 0
        );
        if (authorizedBurnTick && burn && helixWeapon) {
          hpDelta = -burn.tickDamage;
          energyWeaponForResistance = helixWeapon;
          pendingEnergySpecialSoundId = "helix_energy_burn";
          pendingEnergySpecialAtMs = nowMs;
          if (burn.ticksRemaining <= 1) {
            if (deserializedNpcState.energyWeapon) {
              delete deserializedNpcState.energyWeapon.burn;
            }
          } else {
            burn.ticksRemaining -= 1;
            burn.nextTickAtMs +=
              helixWeapon.special.kind === "energy_burn"
                ? helixWeapon.special.tickIntervalMs
                : 900;
          }
        }

        const selectedRef = attacker.inventory.inventory().selected;
        const selected = attacker.inventory.get(selectedRef);
        const definition = harthmereNativeItemDefinitionForBiomesId(
          selected?.item.id
        );
        const itemProfile = harthmereNativeItemCombatProfile(selected?.item);
        const energyWeapon = getHarthmereEnergyWeapon(
          itemProfile?.energyWeaponId
        );
        if (
          !authorizedBurnTick &&
          definition &&
          (!itemProfile || itemProfile.damagePerHit <= 0)
        ) {
          log.debug("Rejected Harthmere attack with non-combat selected item", {
            attackerId: attacker.id,
            targetId: npc.id,
            itemId: selected?.item.id,
          });
          return;
        }

        const progression = readHarthmereNativeCombatProgression(
          attacker.delta().triggerState()
        );
        const authorization = readHarthmereEnergySecondaryAuthorization(
          attacker.delta().triggerState()
        );
        const targetPosition = npc.position().v;
        const secondaryDamage =
          !authorizedBurnTick &&
          energyWeapon &&
          authorization?.weaponId === energyWeapon.id &&
          authorization.primaryTargetId !== npc.id &&
          nowMs - authorization.startedAtMs >= 0 &&
          nowMs - authorization.startedAtMs <=
            HARTHMERE_ENERGY_SECONDARY_WINDOW_MS &&
          !harthmereEnergySecondaryAlreadyHit(
            attacker.delta().triggerState(),
            npc.id,
            authorization.startedAtMs
          )
            ? energySecondaryDamage({
                weapon: energyWeapon,
                mode: authorization.mode,
                attackerPosition,
                targetPosition,
                origin: authorization.origin,
                primaryKilled: authorization.primaryKilled,
              })
            : undefined;
        const authorizedSecondary =
          secondaryDamage !== undefined &&
          authorization !== undefined &&
          consumeHarthmereEnergySecondaryTarget(
            attacker.delta().mutableTriggerState(),
            npc.id,
            authorization.startedAtMs
          );

        if (authorizedSecondary && energyWeapon && secondaryDamage) {
          hpDelta = -secondaryDamage;
          energyWeaponForResistance = energyWeapon;
          if (
            authorization?.mode === "singularity" &&
            energyWeapon.special.kind === "singularity"
          ) {
            const pull = normalizev(sub(authorization.origin, targetPosition));
            npc.setRigidBody({
              velocity: add(
                npc.rigidBody().velocity,
                scale(energyWeapon.special.pullStrength, pull)
              ),
            });
          }
        }

        if (
          !authorizedBurnTick &&
          !authorizedSecondary &&
          progression.level < (itemProfile?.levelRequirement ?? 1)
        ) {
          log.debug("Rejected under-level Harthmere weapon use", {
            attackerId: attacker.id,
            targetId: npc.id,
            level: progression.level,
            requiredLevel: itemProfile?.levelRequirement,
          });
          return;
        }
        const vitals = readHarthmereNativeVitals(
          attacker.delta().triggerState()
        );
        if (
          !authorizedBurnTick &&
          !authorizedSecondary &&
          (itemProfile?.manaCost ?? 0) > vitals.mana
        ) {
          log.debug("Rejected Harthmere spell with insufficient native mana", {
            attackerId: attacker.id,
            targetId: npc.id,
            mana: vitals.mana,
            requiredMana: itemProfile?.manaCost,
          });
          return;
        }
        const intervalMs = Math.round(
          1000 *
            (itemProfile?.intervalSecs ?? attackIntervalSeconds(selected?.item))
        );
        if (
          !authorizedBurnTick &&
          !authorizedSecondary &&
          nowMs - progression.lastAttackMs < intervalMs
        ) {
          return;
        }

        if (!authorizedBurnTick && !authorizedSecondary) {
          const reach = itemProfile?.reach ?? 3.5;
          const targetAabb = getAabbForEntity(npc.asReadonlyEntity());
          const distanceToTarget = targetAabb
            ? Math.sqrt(distSqToAABB(attackerPosition, targetAabb))
            : Number.POSITIVE_INFINITY;
          if (!targetAabb || distanceToTarget > reach) {
            log.debug("Rejected out-of-range Harthmere attack", {
              attackerId: attacker.id,
              targetId: npc.id,
              reach,
            });
            return;
          }

          let baseDamage = energyWeapon
            ? harthmereEnergyWeaponDamageAtDistance(
                energyWeapon,
                distanceToTarget
              )
            : itemProfile?.damagePerHit ??
              Math.max(
                1,
                Math.round(((selected?.item.dps ?? 16) * intervalMs) / 1000)
              );
          const overheat = deserializedNpcState.energyWeapon?.shieldOverheat;
          const photonSidearm = getHarthmereEnergyWeapon("photon_sidearm");
          if (
            energyWeapon &&
            overheat &&
            overheat.untilMs > nowMs &&
            photonSidearm?.special.kind === "shield_overheat"
          ) {
            baseDamage = Math.max(
              1,
              Math.round(
                baseDamage * photonSidearm.special.followupDamageMultiplier
              )
            );
          }
          if (
            energyWeapon?.special.kind === "tenth_shot_overcharge" &&
            advanceHarthmerePulseCarbineShotCount(
              attacker.delta().mutableTriggerState()
            ) %
              energyWeapon.special.shotInterval ===
              0
          ) {
            pendingEnergySpecialSoundId = "pulse_carbine_overcharge";
            pendingEnergySpecialAtMs = nowMs;
            baseDamage = Math.max(
              1,
              Math.round(baseDamage * energyWeapon.special.damageMultiplier)
            );
          }

          const attackerStats = harthmereNativeLevelStats(progression.level);
          const targetStats = harthmereNativeLevelStats(nativeProfile.level);
          const statDamage = applyHarthmereNativeAttackStats({
            baseDamage,
            kind: itemProfile?.kind ?? "unarmed",
            stats: attackerStats,
            targetEvasion: targetStats.evasion,
            criticalSeed: [
              attacker.id,
              npc.id,
              progression.lastAttackMs,
              selected?.item.id,
            ],
          });
          const levelFactor = Math.max(
            0.65,
            Math.min(1.75, 1 + (progression.level - nativeProfile.level) * 0.04)
          );
          hpDelta = -Math.max(1, Math.round(statDamage.damage * levelFactor));
          energyWeaponForResistance = energyWeapon;

          if (
            energyWeapon?.special.kind === "shield_overheat" &&
            statDamage.critical
          ) {
            deserializedNpcState.energyWeapon ??= {};
            deserializedNpcState.energyWeapon.shieldOverheat = {
              source: attacker.id,
              untilMs: nowMs + energyWeapon.special.durationMs,
            };
            pendingEnergySpecialSoundId = "photon_shield_overheat";
            pendingEnergySpecialAtMs = nowMs;
          } else if (energyWeapon?.special.kind === "energy_burn") {
            deserializedNpcState.energyWeapon ??= {};
            deserializedNpcState.energyWeapon.burn = {
              source: attacker.id,
              weaponId: "helix_projector",
              tickDamage: energyWeapon.special.tickDamage,
              ticksRemaining: energyWeapon.special.ticks,
              nextTickAtMs: nowMs + energyWeapon.special.tickIntervalMs,
            };
            pendingEnergySpecialSoundId = "helix_energy_burn";
            pendingEnergySpecialAtMs = nowMs;
            pendingEnergyAuthorization = {
              mode: "penetration",
              weaponId: energyWeapon.id,
              startedAtMs: nowMs,
              origin: [targetPosition[0], targetPosition[1], targetPosition[2]],
              remainingTargets: energyWeapon.special.penetrationTargets,
            };
          } else if (energyWeapon?.special.kind === "nova") {
            pendingEnergyAuthorization = {
              mode: "nova",
              weaponId: energyWeapon.id,
              startedAtMs: nowMs,
              origin: [targetPosition[0], targetPosition[1], targetPosition[2]],
              remainingTargets: HARTHMERE_ENERGY_MAX_SECONDARY_TARGETS,
            };
          } else if (energyWeapon?.special.kind === "singularity") {
            pendingEnergySpecialSoundId = "singularity_gravity_collapse";
            pendingEnergySpecialAtMs = nowMs;
            pendingEnergyAuthorization = {
              mode: "singularity",
              weaponId: energyWeapon.id,
              startedAtMs: nowMs,
              origin: [targetPosition[0], targetPosition[1], targetPosition[2]],
              remainingTargets: HARTHMERE_ENERGY_MAX_SECONDARY_TARGETS,
            };
          }

          writeHarthmereNativeCombatProgression(
            attacker.delta().mutableTriggerState(),
            { lastAttackMs: nowMs }
          );
          awardHarthmereNativeSkillXp(
            attacker.delta().mutableTriggerState(),
            harthmereNativeCombatSkillAwards({
              itemId: itemProfile?.itemId,
              kind: itemProfile?.kind ?? "unarmed",
              damage: -hpDelta,
            })
          );
          const manaCost = itemProfile?.manaCost ?? 0;
          if (manaCost > 0) {
            writeHarthmereNativeVitals(attacker.delta().mutableTriggerState(), {
              mana: vitals.mana - manaCost,
            });
          }
          const durabilityCostMs = itemProfile?.durabilityCostMs ?? 0;
          if (selected && durabilityCostMs > 0) {
            decrementItemDurability(
              attacker.inventory,
              selectedRef,
              durabilityCostMs
            );
          }
        }
      } else {
        const npcPosition = npc.staleOk().position().v;
        const dx = attackerPosition[0] - npcPosition[0];
        const dy = attackerPosition[1] - npcPosition[1];
        const dz = attackerPosition[2] - npcPosition[2];
        if (
          dx * dx + dy * dy + dz * dz >
          HARTHMERE_NATIVE_NPC_MELEE_MAX_CENTER_DISTANCE ** 2
        ) {
          return;
        }
      }
    }

    if (
      nativeProfile &&
      creatureProgression &&
      event.damageSource?.kind === "attack" &&
      hpDelta < 0
    ) {
      const rawDamage = -hpDelta;
      const resistedDamage = applyCreatureLevelResistance(
        rawDamage,
        creatureProgression.level
      );
      const armorPenetration = energyWeaponForResistance?.armorPenetration ?? 0;
      hpDelta = -Math.max(
        1,
        Math.round(
          resistedDamage + (rawDamage - resistedDamage) * armorPenetration
        )
      );
    }

    // Native Health is authoritative for every NPC, including Harthmere's
    // seeded creatures.  The former live-mode exception left the ECS entity at
    // full health while a private Redis snapshot died, which split AI, drops,
    // quest triggers, and multiplayer visibility.  Keep all damage, death, and
    // drop handling in this one transaction.
    modifyNpcHealth(
      npc,
      Math.max(0, npc.health().hp + hpDelta),
      event.damageSource,
      secondsSinceEpoch()
    );

    if (pendingEnergyAuthorization?.mode === "nova" && npc.health().hp <= 0) {
      pendingEnergySpecialSoundId = "nova_cannon_mini_nova";
      pendingEnergySpecialAtMs = pendingEnergyAuthorization.startedAtMs;
    }
    if (pendingEnergySpecialSoundId && attacker) {
      deserializedNpcState.energyWeapon ??= {};
      deserializedNpcState.energyWeapon.lastEffect = {
        id: pendingEnergySpecialSoundId,
        source: attacker.id,
        atMs: pendingEnergySpecialAtMs || Date.now(),
      };
      npc.setNpcState(
        NpcState.create({ data: serializeNpcCustomState(deserializedNpcState) })
      );
    }

    if (pendingEnergyAuthorization && attacker?.has("player_status")) {
      beginHarthmereEnergySecondaryAuthorization(
        attacker.delta().mutableTriggerState(),
        {
          ...pendingEnergyAuthorization,
          primaryTargetId: npc.id,
          primaryKilled: npc.health().hp <= 0,
        }
      );
    }

    if (npc.health().hp > 0) {
      return;
    }

    if (HARTHMERE_RESPAWNING_CREATURE_IDS.has(npc.id)) {
      // The native death transaction is the only place that schedules the
      // fixed-id seed's reappearance. Without this bridge the seed reconciler
      // recreated a corpse as soon as its 90-second ECS expiry elapsed.
      harthmereSharedLiveCreatureRespawnRegistry().recordKill(
        npc.id,
        secondsSinceEpoch() * 1000
      );
    }

    const npcTypeInfo = idToNpcType(npcTypeId);

    // Emit an event for the trigger server to track, if this mucker was
    // killed by an attack
    if (event.damageSource?.kind === "attack") {
      if (attacker?.has("player_status")) {
        recordHarthmereJobsBoardNativeKill(
          attacker.delta().mutableTriggerState(),
          npc.id,
          secondsSinceEpoch() * 1000
        );
      }
      if (nativeProfile && attacker?.has("player_status")) {
        // HARTHMERE_CREATURE_LEVELING: reward the creature that was actually
        // fought, not its shared type baseline. A level 9 road-pack Hex has more
        // HP and hits harder than the level 1 profile, so paying the level 1 XP
        // would make the road ramp strictly worse value than the flats it
        // replaces. Level 1 (every migrated creature) returns the profile XP
        // unchanged, and the multiplier is capped in `creature_level.ts`.
        const creatureLevel = creatureProgression?.level ?? 1;
        awardHarthmereNativeCombatXp(
          attacker.delta().mutableTriggerState(),
          scaleCreatureCombatStats(
            {
              maxHp: nativeProfile.maxHp,
              attackDamage: nativeProfile.attackDamage,
              attackIntervalSecs: nativeProfile.attackIntervalSecs,
              walkSpeed: nativeProfile.walkSpeed,
              runSpeed: nativeProfile.runSpeed,
              killXp: nativeProfile.killXp,
            },
            creatureLevel
          ).killXp,
          nativeProfile.isBoss
        );
        awardHarthmereNativeSkillXp(attacker.delta().mutableTriggerState(), [
          ...(nativeProfile.key.startsWith("livestock_")
            ? harthmereNativeGatheringSkillAwards({
                sourceId: nativeProfile.key,
                tracking: true,
              })
            : []),
          ...(/undead|grave|death|spirit|thaedryn/i.test(
            `${nativeProfile.key} ${nativeProfile.displayName}`
          )
            ? [
                {
                  skillId: "death_lore",
                  xp: 10,
                  source: "native_death_creature_kill",
                },
              ]
            : []),
        ]);
        // A kill that crosses a level boundary must update every persistent
        // level-owned value too (resource ceilings and backpack slots).
        syncHarthmereNativeLevelStats(attacker.delta());
      }
      context.publish({
        kind: "npcKilled",
        entityId: event.damageSource.attacker,
        npcTypeId,
      });
    }

    const npcSize = npc.size().v;
    const npcPosition = npc.staleOk().position().v;
    const dropPosition: ecs.Vec3f = [
      npcPosition[0],
      npcPosition[1] + npcSize[1] / 2,
      npcPosition[2],
    ];

    if (npcTypeInfo.drop) {
      const dropBag = rollSpec(npcTypeInfo.drop);
      createDropsForBag(context, "dropIds", dropBag, dropPosition, false);
    }
  },
});

const sellToEntityEventHandler = makeEventHandler("sellToEntityEvent", {
  involves: (event) => ({
    player: q.player(event.seller_id),
    buyer: q.id(event.purchaser_id).with("item_buyer"),
  }),
  apply: ({ player, buyer }, event, context) => {
    const buyingAttributes = buyer.itemBuyer().attribute_ids;
    ok(buyingAttributes);
    for (const [_, item] of event.src) {
      ok(
        any(buyingAttributes, (e) =>
          Boolean(resolveItemAttributeId(item.item, e))
        )
      );
    }

    let price = 0n;
    for (const [_, item] of event.src) {
      price += sellPrice(item);
    }
    player.inventory.take(event.src);
    player.inventory.giveCurrency(BikkieIds.bling, price);

    context.publish(<SellToEntityEvent>{
      kind: "sell_to_entity",
      entityId: player.id,
      bag: itemBagToString(createBag(...event.src.map((e) => e[1]))),
      buyerId: buyer.id,
    });
  },
});

const setNPCPositionEventHandler = makeEventHandler("setNPCPositionEvent", {
  involves: (event) => ({
    player: q.player(event.id),
    npc: q
      .id(event.entity_id)
      .with(
        "health",
        "npc_metadata",
        "position",
        "rigid_body",
        "size",
        "npc_state"
      ),
  }),
  apply: ({ player, npc }, event, _context) => {
    if (!(player.roles() ?? new Set()).has("admin")) {
      log.error(
        `Player ${player.id} tried to reposition NPC ${npc.id} without the admin role`
      );
      return;
    }
    const state = deserializeNpcCustomState(npc.npcState().data);
    state.cinematicPauseUntil = secondsSinceEpoch() + 1.5;
    npc.setNpcState(NpcState.create({ data: serializeNpcCustomState(state) }));
    if (event.position) {
      npc.setPosition({
        v: event.position,
      });

      if (event.update_spawn) {
        npc.mutableNpcMetadata().spawn_position = event.position;
      }
    }

    if (event.orientation) {
      npc.setOrientation({
        v: event.orientation,
      });
      if (event.update_spawn) {
        npc.mutableNpcMetadata().spawn_orientation = event.orientation;
      }
    }
  },
});

export const npcEventHandlers = [
  updateNpcHealthEventHandler,
  sellToEntityEventHandler,
  setNPCPositionEventHandler,
];
