// HARTHMERE_QUEST_PARTY_TEST_V1
//
// Per request: "multiple users can do the same quest together and pass/fail
// together." This test locks in the party-scoped helpers added to
// quest_runtime_v47:
//
//   * advanceHarthmereQuestObjectivePartyV47 emits a unique per-member
//     eventId so per-member reward grants remain idempotent.
//   * completeHarthmereQuestPartyV47 refuses to grant if any member is not
//     yet ready_to_complete (pass-together).
//   * failHarthmereQuestPartyV47 fails every member at once (fail-together).
//
// Driven against starter_welcome_to_harthmere because its objectives are
// short and uniform (talk/inspect/choice/choice).

import { getHarthmereQuestByIdV46 } from "@/shared/harthmere/quest_compendium_v46";
import {
  acceptHarthmereQuestV47,
  advanceHarthmereQuestObjectivePartyV47,
  completeHarthmereQuestPartyV47,
  createHarthmereQuestRuntimeContextV47,
  failHarthmereQuestPartyV47,
  type HarthmereQuestPartyMemberV47,
  type HarthmereQuestRuntimeContextV47,
} from "@/shared/harthmere/quest_runtime_v47";
import { shiftHarthmereAuthoredPositionToWorldV71 } from "@/shared/harthmere/coordinate_transform_v71";

export const HARTHMERE_QUEST_PARTY_TEST_VERSION_V1 =
  "harthmere-quest-party-test-v1" as const;

function memberContext(
  quest: any,
  playerId: string,
): HarthmereQuestRuntimeContextV47 {
  return createHarthmereQuestRuntimeContextV47({
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
  (describe as any)("Harthmere quest party (multiplayer) contract v1", () => {
    const quest = getHarthmereQuestByIdV46("starter_welcome_to_harthmere");

    function buildParty(size: number): HarthmereQuestPartyMemberV47[] {
      return Array.from({ length: size }, (_, i) => ({
        memberId: `m${i}`,
        context: memberContext(quest, `member-${i}`),
      }));
    }

    function acceptForAll(members: HarthmereQuestPartyMemberV47[]) {
      for (const m of members) acceptHarthmereQuestV47(m.context, quest.id);
    }

    function authoredPos(obj: any): [number, number, number] {
      return shiftHarthmereAuthoredPositionToWorldV71(
        obj?.location?.waypoint ?? [0, 0, 0],
      ) as [number, number, number];
    }

    (it as any)("party-advance progresses every member together", () => {
      const party = buildParty(3);
      acceptForAll(party);
      const obj = quest.objectives[0];
      const results = advanceHarthmereQuestObjectivePartyV47(party, {
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
        advanceHarthmereQuestObjectivePartyV47(party.slice(0, 1), {
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
      const results = completeHarthmereQuestPartyV47(party, quest.id, 200);
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
          advanceHarthmereQuestObjectivePartyV47(party, {
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
        const results = completeHarthmereQuestPartyV47(party, quest.id, 300);
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
      const results = failHarthmereQuestPartyV47(
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
