import { validateCh1WarpAuthorization } from "@/server/harthmere/ch1_warp_token";
import { makeEventHandler, RollbackError } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import {
  forcePlayerWarp,
  startPlayerEmote,
} from "@/server/logic/utils/players";
import {
  ch1ElsewhenSlot,
  ch1ElsewhenSlotAt,
  isInsideCh1ElsewhenBand,
} from "@/shared/harthmere/ch1_elsewhen_region";
import {
  clearCh1NativeRunAdmission,
  readCh1NativeRunAdmission,
  writeCh1NativeRunAdmission,
} from "@/shared/harthmere/ch1_native_run";
import {
  ch1DungeonEncounterNpcsForDungeon,
  ch1DungeonEscortNpcsForDungeon,
} from "@/shared/harthmere/ch1_dungeon_encounters";
import { NpcState } from "@/shared/ecs/gen/components";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

/**
 * `stage` is the Grove-side counterpart of `enter`.
 *
 * Chapter 1 opens on the player waking up in the spare room above the Grove
 * road-house. It used to open wherever the player happened to be standing when
 * Muck vs. Machine completed — in the reported case, mid-combat in the Rat
 * Crowns drain — and then instruct them to get out of bed. A staging warp makes
 * the chapter's first sentence true.
 *
 * It is deliberately the most restricted action: it must land OUTSIDE the
 * Elsewhen band and it must clear no admission, so it can never be used to
 * reach a dungeon or to escape one.
 */
const ACTIONS = new Set(["enter", "exit", "evict", "recover", "stage"]);

export const harthmereChapter1WarpEventHandler = makeEventHandler(
  "harthmereChapter1WarpEvent",
  {
    mergeKey: (event) => event.id,
    involves: (event) => ({
      player: q.player(event.id),
      encounters:
        event.action === "enter" && event.reset_encounters
          ? q
              .ids(
                [
                  ...ch1DungeonEncounterNpcsForDungeon(event.dungeon_id),
                  ...ch1DungeonEscortNpcsForDungeon(event.dungeon_id),
                ].map((npc) => npc.entityId)
              )
              .includeIced()
          : undefined,
    }),
    apply: ({ player, encounters }, event) => {
      if (!ACTIONS.has(event.action)) {
        throw new RollbackError("Invalid Chapter 1 warp action");
      }
      if (
        !validateCh1WarpAuthorization(
          {
            id: event.id,
            action: event.action,
            dungeon_id: event.dungeon_id,
            run_id: event.run_id,
            party_id: event.party_id,
            reset_encounters: event.reset_encounters,
            position: event.position,
            orientation: event.orientation,
          },
          event.authorization
        )
      ) {
        throw new RollbackError("Chapter 1 warp authorization failed");
      }

      const triggerState = player.delta().mutableTriggerState();
      if (event.action === "enter") {
        const slot = ch1ElsewhenSlot(event.dungeon_id);
        const destinationSlot = ch1ElsewhenSlotAt(event.position);
        if (
          !slot ||
          destinationSlot?.dungeonId !== slot.dungeonId ||
          !event.run_id ||
          !event.party_id
        ) {
          throw new RollbackError("Invalid Chapter 1 entry destination");
        }
        writeCh1NativeRunAdmission(triggerState, {
          dungeonId: event.dungeon_id,
          runId: event.run_id,
          partyId: event.party_id,
        });
        if (event.reset_encounters) {
          const specs = new Map(
            ch1DungeonEncounterNpcsForDungeon(event.dungeon_id).map((npc) => [
              npc.entityId,
              npc,
            ])
          );
          const escortSpecs = new Map(
            ch1DungeonEscortNpcsForDungeon(event.dungeon_id).map((npc) => [
              npc.entityId,
              npc,
            ])
          );
          for (const encounter of encounters ?? []) {
            const spec = specs.get(encounter.id);
            const escortSpec = escortSpecs.get(encounter.id);
            if (!spec && !escortSpec) continue;
            if (spec) {
              const health = encounter.mutableHealth();
              health.hp = spec.maxHp;
              health.maxHp = spec.maxHp;
              health.lastDamageSource = undefined;
              health.lastDamageAmount = undefined;
              health.lastDamageTime = undefined;
            }
            const npcState = deserializeNpcCustomState(
              encounter.npcState()?.data
            );
            npcState.chapter1Encounter = undefined;
            if (escortSpec) npcState.schedule = undefined;
            encounter.setNpcState(
              NpcState.create({ data: serializeNpcCustomState(npcState) })
            );
            // Position and RigidBody are replace-only components on a generic
            // ECS Delta. Their player wrapper has mutable helpers, but these
            // encounter entities do not; using those helpers rolled back the
            // complete first-entry warp transaction in production.
            encounter.setPosition({
              v: [...(spec?.position ?? escortSpec!.startPosition)],
            });
            encounter.setRigidBody({ velocity: [0, 0, 0] });
          }
        }
      } else if (event.action === "recover") {
        const admission = readCh1NativeRunAdmission(triggerState);
        const destinationSlot = ch1ElsewhenSlotAt(event.position);
        if (
          !admission ||
          admission.dungeonId !== event.dungeon_id ||
          admission.runId !== event.run_id ||
          admission.partyId !== event.party_id ||
          destinationSlot?.dungeonId !== event.dungeon_id
        ) {
          throw new RollbackError("Invalid Chapter 1 recovery destination");
        }
      } else if (event.action === "stage") {
        // Grove-side only, and never while the player holds a run admission —
        // staging out of a dungeon would be an exit without its retrieval check.
        if (isInsideCh1ElsewhenBand(event.position)) {
          throw new RollbackError("Chapter 1 staging must stay outside Elsewhen");
        }
        if (readCh1NativeRunAdmission(triggerState)) {
          throw new RollbackError(
            "Chapter 1 staging is not available inside a gate"
          );
        }
      } else {
        if (isInsideCh1ElsewhenBand(event.position)) {
          throw new RollbackError("Chapter 1 exit must leave Elsewhen");
        }
        clearCh1NativeRunAdmission(triggerState);
      }

      forcePlayerWarp(player.delta(), event.position, event.orientation);
      startPlayerEmote(player.delta(), { emote_type: "warp" });
    },
  }
);
