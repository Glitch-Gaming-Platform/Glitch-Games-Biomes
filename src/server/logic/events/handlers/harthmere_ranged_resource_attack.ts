import { makeEventHandler } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { decrementItemDurability } from "@/server/logic/utils/durability";
import {
  findHarthmereBackpackArrow,
  harthmereMagicManaCost,
  harthmereRangedResourceCooldownMs,
  harthmereRangedResourceKind,
  oneHarthmereArrow,
  readHarthmereRangedResourceReceipt,
  writeHarthmereRangedResourceReceipt,
} from "@/shared/harthmere/harthmere_ranged_resources";
import {
  harthmereNativeItemCombatProfile,
  readHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { log } from "@/shared/logging";

const HARTHMERE_RESOURCE_ATTACK_CLOCK_SKEW_MS = 15_000;
const HARTHMERE_RESOURCE_ATTACK_CADENCE_GRACE_MS = 35;

/**
 * Owns the release phase of every player attack whose projectile is paid for by
 * a finite resource. The later health event is intentionally separate: a miss
 * still consumes its arrow or mana, while a forged hit without this receipt is
 * rejected by the health handlers.
 */
export const harthmereRangedResourceAttackEventHandler = makeEventHandler(
  "harthmereRangedResourceAttackEvent",
  {
    involves: (event) => ({ player: q.player(event.id) }),
    apply: ({ player }, event, _context) => {
      if ((player.delta().health()?.hp ?? 0) <= 0) return;

      const selectedRef = player.inventory.inventory().selected;
      // The visible hotbar selection is the combat authority. A bow or focus in
      // a backpack cell cannot fire merely because the client names it.
      if (!selectedRef || selectedRef.kind !== "hotbar") return;
      const selected = player.inventory.get(selectedRef);
      const resourceKind = harthmereRangedResourceKind(selected?.item);
      if (!selected || !resourceKind) return;
      const profile = harthmereNativeItemCombatProfile(selected.item);
      const progression = readHarthmereNativeCombatProgression(
        player.delta().triggerState()
      );
      if (!profile || progression.level < profile.levelRequirement) return;

      const nowMs = Date.now();
      const attackTimeMs = Math.round(event.attack_time * 1000);
      if (
        !Number.isFinite(attackTimeMs) ||
        attackTimeMs <= 0 ||
        Math.abs(nowMs - attackTimeMs) > HARTHMERE_RESOURCE_ATTACK_CLOCK_SKEW_MS
      ) {
        return;
      }

      const prior = readHarthmereRangedResourceReceipt(
        player.delta().triggerState()
      );
      // Strictly increasing client attack time makes a replay an exact no-op,
      // even if it arrives after the ordinary cadence window.
      if (attackTimeMs <= prior.attackTimeMs) return;
      const cooldownMs = harthmereRangedResourceCooldownMs(selected.item);
      if (
        nowMs -
          prior.lastResourceAttackAtMs +
          HARTHMERE_RESOURCE_ATTACK_CADENCE_GRACE_MS <
        cooldownMs
      ) {
        return;
      }

      if (resourceKind === "arrow") {
        const arrow = findHarthmereBackpackArrow(player.inventory.inventory());
        const oneArrow = oneHarthmereArrow();
        if (!arrow || !oneArrow) return;
        player.inventory.takeFromSlot(arrow.ref, oneArrow);
      } else {
        const manaCost = harthmereMagicManaCost(selected.item);
        const vitals = readHarthmereNativeVitals(player.delta().triggerState());
        if (manaCost <= 0 || manaCost > vitals.mana) {
          log.debug("Rejected Harthmere cast with insufficient native mana", {
            playerId: player.id,
            mana: vitals.mana,
            requiredMana: manaCost,
          });
          return;
        }
        writeHarthmereNativeVitals(player.delta().mutableTriggerState(), {
          mana: vitals.mana - manaCost,
        });
      }

      if ((profile?.durabilityCostMs ?? 0) > 0) {
        decrementItemDurability(
          player.inventory,
          selectedRef,
          profile!.durabilityCostMs
        );
      }

      writeHarthmereRangedResourceReceipt(
        player.delta().mutableTriggerState(),
        {
          attackTimeMs,
          authorizedAtMs: nowMs,
          lastResourceAttackAtMs: nowMs,
          itemId: selected.item.id,
          targetId: event.target_id,
          kind: resourceKind,
          used: false,
        }
      );
    },
  }
);
