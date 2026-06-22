// HARTHMERE_QUEST_PARTY_TEST
//
// Per request: "multiple users can do the same quest together and pass/fail
// together." This test locks in the party-scoped helpers added to
// quest_runtime:
//
//   * advanceHarthmereQuestObjectiveParty emits a unique per-member
//     eventId so per-member reward grants remain idempotent.
//   * completeHarthmereQuestParty refuses to grant if any member is not
//     yet ready_to_complete (pass-together).
//   * failHarthmereQuestParty fails every member at once (fail-together).
//
// Driven against starter_welcome_to_harthmere because its objectives are
// short and uniform (talk/inspect/choice/choice).

import { getHarthmereQuestById } from "@/shared/harthmere/quest_compendium";
import {
  acceptHarthmereQuest,
  advanceHarthmereQuestObjectiveParty,
  completeHarthmereQuestParty,
  createHarthmereQuestRuntimeContext,
  failHarthmereQuestParty,
  getHarthmereQuestResolvedWaypoint,
  type HarthmereQuestPartyMember,
  type HarthmereQuestRuntimeContext,
} from "@/shared/harthmere/quest_runtime";

export const HARTHMERE_QUEST_PARTY_TEST_VERSION =
  "harthmere-quest-party-test" as const;

function memberContext(
  quest: any,
  playerId: string,
): HarthmereQuestRuntimeContext {
  return createHarthmereQuestRuntimeContext({
    playerId,
    playerLevel: quest.levelBand?.min ?? 1,
    hour: (quest.activeRules.activeHours ?? [12])[0],
    timeOfDay: (quest.activeRules.timeOfDay ?? ["day"])[0] as any,
    weather: (quest.activeRules.weather ?? ["clear"])[0] as any,
    tick: 100,
    flags: [...(quest.activeRules.requiredFlags ?? [])],
    completedQuestIds: [...(quest.activeRules.prerequisiteQuestIds ?? [])],
    inventoryFreeSlots: 20,
    questStates: {},
    runtimeRecords: {},
    grantedRewardIds: [],
    authority: "server",
  });
}

import assert from "assert";

declare const describe: unknown;
declare const it: unknown;

if (
  typeof (describe as any) === "function" &&
  typeof (it as any) === "function"
) {
  (describe as any)("Harthmere quest party (multiplayer) contract current", () => {
    const quest = getHarthmereQuestById("starter_welcome_to_harthmere");

    function buildParty(size: number): HarthmereQuestPartyMember[] {
      return Array.from({ length: size }, (_, i) => ({
        memberId: `m${i}`,
        context: memberContext(quest, `member-${i}`),
      }));
    }

    function acceptForAll(members: HarthmereQuestPartyMember[]) {
      for (const m of members) acceptHarthmereQuest(m.context, quest.id);
    }

    function authoredPos(obj: any): [number, number, number] {
      return getHarthmereQuestResolvedWaypoint(quest.id, obj) ?? [0, 0, 0];
    }

    (it as any)("party-advance progresses every member together", () => {
      const party = buildParty(3);
      acceptForAll(party);
      const obj = quest.objectives[0];
      const results = advanceHarthmereQuestObjectiveParty(party, {
        questId: quest.id,
        objectiveId: obj.id,
        type: "talk",
        tick: 100,
        authority: "server",
        actorPosition: authoredPos(obj),
        lineOfSight: true,
        revalidatedChoice: "primary",
        combatResult: "encounter_cleared",
        inventoryStateChanged: true,
        eventIdSuffix: "step0",
      });
      assert.ok(results.every((r) => r.result.ok));
      for (const m of party) {
        const rec = m.context.runtimeRecords[quest.id];
        assert.ok(rec.objectiveProgress[obj.id].completed);
      }
    });

    (it as any)("party-complete refuses when any member is not ready", () => {
      const party = buildParty(2);
      acceptForAll(party);
      for (const obj of quest.objectives) {
        advanceHarthmereQuestObjectiveParty(party.slice(0, 1), {
          questId: quest.id,
          objectiveId: obj.id,
          type: obj.type,
          tick: 100,
          authority: "server",
          actorPosition: authoredPos(obj),
          lineOfSight: true,
          revalidatedChoice: "primary",
          combatResult: "encounter_cleared",
          inventoryStateChanged: true,
          eventIdSuffix: `step-${obj.id}`,
        });
      }
      const results = completeHarthmereQuestParty(party, quest.id, 200);
      assert.ok(results.every((r) => !r.result.ok));
      assert.ok(
        results.every((r) =>
          r.result.reasons.includes("party_member_not_ready"),
        ),
      );
    });

    (it as any)(
      "party-complete grants reward to every member exactly once",
      () => {
        const party = buildParty(2);
        acceptForAll(party);
        for (const obj of quest.objectives) {
          advanceHarthmereQuestObjectiveParty(party, {
            questId: quest.id,
            objectiveId: obj.id,
            type: obj.type,
            tick: 100,
            authority: "server",
            actorPosition: authoredPos(obj),
            lineOfSight: true,
            revalidatedChoice: "primary",
            combatResult: "encounter_cleared",
            inventoryStateChanged: true,
            eventIdSuffix: `step-${obj.id}`,
          });
        }
        const results = completeHarthmereQuestParty(party, quest.id, 300);
        assert.ok(results.every((r) => r.result.ok));
        for (const m of party) {
          assert.strictEqual(
            m.context.grantedRewardIds.filter(
              (g) => g === `reward:${quest.id}`,
            ).length,
            1,
          );
        }
      },
    );

    (it as any)("party-fail fails every member together", () => {
      const party = buildParty(3);
      acceptForAll(party);
      const results = failHarthmereQuestParty(
        party,
        quest.id,
        "test_party_fail",
      );
      assert.ok(results.every((r) => r.result.ok));
      for (const m of party) {
        assert.strictEqual(m.context.questStates[quest.id], "failed");
      }
    });
  });
}
