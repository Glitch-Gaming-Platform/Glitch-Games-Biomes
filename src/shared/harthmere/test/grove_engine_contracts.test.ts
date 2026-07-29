/// <reference types="mocha" />
/// <reference types="node" />
//
// GROVE_ENGINE_CONTRACTS + END-TO-END PLAYTHROUGH
//
// The ECS / Gaia / Anima rules and the full 51-quest walk, all decidable from
// authored data. Runs as `t.sh grove:catalog`.
//
// WHAT THIS TIER DOES NOT PROVE. It proves quest topology, ids, gates and that
// a waypoint exists. It does not prove items appear, controls work, dialogue
// completes, exact recipes count, rewards materialize, or the map renders. The
// live authority rows (`grove:live`) and the browser run are separate tiers and
// neither is optional because this one is green.

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  GROVE_GAIA_UNTOUCHED,
  GROVE_NATIVE_ECS_OWNED,
  GROVE_NON_ECS_OWNED,
  GROVE_NON_ECS_TARGET,
  groveValidateNonEcsStateIsDeclared,
  groveLiftedWaypointCount,
  groveQuestsMissingSteps,
  groveValidateEngineContracts,
  groveValidateEveryStepIsAddressable,
  groveValidateGateEnforcedQuestsHaveConditions,
  groveValidateGiverIsNearQuestOpening,
  groveValidateTalkStepsPointAtTheirGiver,
  groveValidateGiversResolve,
  groveValidateMarkersResolve,
  groveValidateNoEcsMovesAuthored,
  groveValidateStepIndexesMatchPosition,
  groveValidateStepRequirements,
  groveMultiTargetSteps,
  groveValidateWaypointsAreLive,
} from "../grove/grove_engine_contracts";
import {
  groveFountainLessonCountErrors,
  groveGraduationReachabilityErrors,
  groveRunFullPlaythrough,
  groveUnofferableQuestIds,
} from "../grove/grove_e2e_playthrough";
import {
  groveLandmark,
  groveLandmarkIsStranded,
  groveStrandedLandmarks,
  groveMarkerWorldPosition,
} from "../grove/grove_waypoints";
import { GROVE_QUEST_CATALOG, groveQuest } from "../grove/grove_quest_catalog";
import { groveStepTargetMarkerIds } from "../grove/grove_quest_schema";
import {
  snapshotGroveObjectiveRequiredCount,
  snapshotGroveObjectiveTargetMarkerIds,
} from "../snapshot_grove_trigger_contract";
import { groveNativeStepId } from "../grove/grove_quest_ids";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "../harthmere_native_quest_manifest";
import { isHarthmereInspectableWorldObject } from "../harthmere_world_object_inspectable";
import {
  SNAPSHOT_GROVE_LIVE_MARKER_Y,
  SNAPSHOT_GROVE_MARKER_Y,
  SNAPSHOT_GROVE_NPCS,
} from "../snapshot_grove_content";

const GROVE_DIR = path.resolve(__dirname, "../grove");

/**
 * The live Grove runtime still keeps its own accepted/completed/objective sets
 * beside native Challenges. Flip this to `false` in the same commit that
 * removes them, and the contract will require the non-ECS list to be empty.
 */
const LIVE_RUNTIME_STILL_MIRRORS_QUEST_STATE = true;

const npcAreaById = new Map(
  (SNAPSHOT_GROVE_NPCS as ReadonlyArray<{ id: string; homeArea: string }>).map(
    (npc) => [npc.id, npc.homeArea]
  )
);

/** Giver world position, taken from that NPC's own map landmark. */
function giverPosition(giverId: string) {
  return groveMarkerWorldPosition(`npc_${giverId}`);
}

/** Which NPC a marker represents, or undefined when it is not an NPC marker. */
function markerNpcId(markerId: string) {
  const landmark = groveLandmark(markerId);
  return landmark?.kind === "npc" ? landmark.npcId : undefined;
}

describe("Grove engine contracts — native ECS", () => {
  it("makes every authored step addressable by the signed progress path", () => {
    assert.deepEqual(groveValidateEveryStepIsAddressable(), []);
  });

  it("has no quest without objectives", () => {
    assert.deepEqual(
      groveQuestsMissingSteps().map((quest) => quest.id),
      []
    );
  });

  // Grove native step ids are pinned BY POSITION, because the retired shape
  // had no per-objective ids. A step whose index disagrees with its position
  // resolves to a different pinned id than the trigger tree built, and the
  // objective silently never completes.
  it("keeps every step index equal to its array position", () => {
    assert.deepEqual(groveValidateStepIndexesMatchPosition(), []);
  });

  // HONESTY, NOT ASPIRATION. This used to assert the list was EMPTY, with a
  // comment saying onboarding owns nothing outside ECS. That was the intended
  // end state, not the code: cloud save still carries acceptedQuestIds,
  // completedQuestIds and completedObjectiveIds beside native Challenges.
  it("declares the quest state Grove still keeps outside ECS", () => {
    assert(
      GROVE_NON_ECS_OWNED.length > 0,
      "the live runtime still mirrors quest state; the list must say so"
    );
    assert.deepEqual(
      groveValidateNonEcsStateIsDeclared(
        LIVE_RUNTIME_STILL_MIRRORS_QUEST_STATE
      ),
      []
    );
    assert(GROVE_NATIVE_ECS_OWNED.includes("objective step completion"));
  });

  it("keeps the ECS-only end state recorded as a target, not a claim", () => {
    assert.deepEqual([...GROVE_NON_ECS_TARGET], []);
    assert.notDeepEqual([...GROVE_NON_ECS_OWNED], [...GROVE_NON_ECS_TARGET]);
  });

  it("keeps every gate-enforced quest actually gated", () => {
    assert.deepEqual(groveValidateGateEnforcedQuestsHaveConditions(), []);
  });
});

describe("Grove engine contracts — Gaia", () => {
  it("declares that Grove quests do not simulate terrain", () => {
    assert.equal(GROVE_GAIA_UNTOUCHED, true);
  });

  it("resolves every objective marker to a real landmark", () => {
    assert.deepEqual(groveValidateMarkersResolve(), []);
  });

  // SCOPE: this proves THE RESOLVER is correct, not that the player-facing
  // map is fixed. Production wiring is asserted separately in
  // grove_waypoints_production_wiring.test.ts — while any live pin path still
  // reads landmark.position directly, a stranded marker can still be drawn.
  it("resolves no waypoint into the retired coordinate space", () => {
    assert.deepEqual(groveValidateWaypointsAreLive(), []);
    for (const quest of GROVE_QUEST_CATALOG) {
      for (const step of quest.steps) {
        const position = groveMarkerWorldPosition(step.markerId)!;
        assert.notEqual(
          position[1],
          0,
          `${quest.id}/${step.id} resolved to Y=0`
        );
      }
    }
  });

  // The landmark table genuinely mixes two vertical datums. This asserts the
  // premise, so the lifting test above cannot quietly stop proving anything.
  it("confirms Grove-area landmarks really are stranded in authored space", () => {
    const stranded = groveStrandedLandmarks();
    assert.equal(stranded.length, 15);
    for (const landmark of stranded) {
      assert.equal(landmark.position[1], SNAPSHOT_GROVE_MARKER_Y);
      assert(!["harthmere", "harthmere_connector"].includes(landmark.area));
      // The resolver must lift it to the live height.
      assert.equal(
        groveMarkerWorldPosition(landmark.id)![1],
        SNAPSHOT_GROVE_LIVE_MARKER_Y
      );
    }
  });

  it("leaves Harthmere-extension landmarks at their correct authored height", () => {
    // Y=54 is RIGHT for the additive extension: its ground really is at 52.
    // Lifting those would break the connector quests in the other direction.
    const harthmere = {
      area: "harthmere",
      position: [0, SNAPSHOT_GROVE_MARKER_Y, 0],
    };
    assert.equal(groveLandmarkIsStranded(harthmere as any), false);
  });

  it("lifts every Grove waypoint onto live terrain", () => {
    assert(groveLiftedWaypointCount() > 0);
  });

  it("keeps every physical interaction objective reachable through the shared F path", () => {
    const physicalTriggers = new Set(["interact", "collect", "item_grant"]);
    const npcBacked: string[] = [];
    const unreachable: string[] = [];
    for (const quest of GROVE_QUEST_CATALOG) {
      for (const step of quest.steps) {
        if (!physicalTriggers.has(step.trigger)) continue;
        const landmark = groveLandmark(step.markerId);
        assert(landmark, `${quest.id}/${step.id} has no landmark`);
        if (landmark.kind === "npc") {
          npcBacked.push(`${quest.id}/${step.id}:${step.markerId}`);
          continue;
        }
        if (!isHarthmereInspectableWorldObject({ label: landmark.label })) {
          unreachable.push(`${quest.id}/${step.id}:${landmark.label}`);
        }
      }
    }
    assert.deepEqual(unreachable, []);
    assert.deepEqual(npcBacked, [
      "fountain_chat_channels/fountain_chat_channels_obj_04:npc_taye",
    ]);
  });

  it("records Sil's songline pattern at the physical tuning strip", () => {
    const step = groveQuest("songline_under_the_lawn")!.steps[2];
    assert.equal(step.trigger, "interact");
    assert.equal(step.markerId, "mosslawn_sil_tuning_strip");
    assert.notEqual(groveLandmark(step.markerId)?.kind, "npc");
  });
});

describe("Grove engine contracts — Anima", () => {
  it("resolves every quest giver to a seeded entity", () => {
    assert.deepEqual(
      groveValidateGiversResolve(
        (giverId) =>
          HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
            giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
          ]
      ),
      []
    );
  });

  // AREA IS NOT ENOUGH — an area-only version of this check passed while
  // being wrong. Old Coop is also in `the_grove` but stands 139 blocks from
  // the fountain, which would have made the first tutorial a long round trip.
  it("keeps every giver within reach of where their quest opens", () => {
    assert.deepEqual(groveValidateGiverIsNearQuestOpening(giverPosition), []);
  });

  // Reassigning a quest is not an id swap: the objectives carry the giver's
  // own map marker. Updating the giver and leaving the marker behind produces
  // a quest one NPC offers while the arrow points at another.
  it("points every opening talk objective at its own giver", () => {
    assert.deepEqual(groveValidateTalkStepsPointAtTheirGiver(markerNpcId), []);
  });

  it("authors no ECS move anywhere in the catalog", () => {
    assert.deepEqual(groveValidateNoEcsMovesAuthored(), []);
  });
});

describe("Grove engine contracts — fast-suite discipline", () => {
  const FORBIDDEN_VALUE_IMPORTS = [
    "@/shared/bikkie/active",
    "@/shared/game/items",
    "@/server/",
    "@/client/",
    "@/shared/ecs/gen/",
  ];

  it("imports no server, client, ECS-gen or Bikkie-data module at value position", () => {
    const offenders: string[] = [];
    for (const file of fs.readdirSync(GROVE_DIR)) {
      if (!file.endsWith(".ts")) continue;
      for (const line of fs
        .readFileSync(path.join(GROVE_DIR, file), "utf8")
        .split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import ")) continue;
        if (trimmed.startsWith("import type ")) continue;
        for (const forbidden of FORBIDDEN_VALUE_IMPORTS) {
          if (trimmed.includes(forbidden))
            offenders.push(`${file}: ${trimmed}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("runs the whole contract aggregate clean", () => {
    assert.deepEqual(
      groveValidateEngineContracts({
        resolveGiver: (giverId) =>
          HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
            giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
          ],
        giverPosition,
        markerNpcId,
      }),
      []
    );
  });
});

describe("Grove end-to-end playthrough", () => {
  // Deterministic, so run once and assert over the report.
  const REPORT = groveRunFullPlaythrough();

  it("completes every authored quest with no errors", () => {
    assert.deepEqual(REPORT.errors, []);
    assert.deepEqual(
      REPORT.unreachableQuestIds,
      [],
      "these quests can never be offered under any legal conditions"
    );
    assert.equal(REPORT.completedQuestIds.length, GROVE_QUEST_CATALOG.length);
  });

  it("fires all 255 objective leaves exactly once", () => {
    assert.equal(REPORT.steps.length, 255);
    const keys = REPORT.steps.map((step) => `${step.questId}:${step.stepId}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("addresses every fired leaf by its real native step id", () => {
    for (const step of REPORT.steps) {
      assert.equal(
        step.nativeStepId,
        Number(groveNativeStepId(step.questId, step.stepIndex))
      );
      assert(Number.isSafeInteger(step.nativeStepId));
    }
  });

  it("never completes a quest before its prerequisite", () => {
    const order = new Map(
      REPORT.completedQuestIds.map((questId, index) => [questId, index])
    );
    for (const quest of GROVE_QUEST_CATALOG) {
      if (quest.start.kind !== "after") continue;
      const self = order.get(quest.id)!;
      const prerequisite = order.get(quest.start.questId)!;
      assert(
        prerequisite < self,
        `${quest.id} completed before ${quest.start.questId}`
      );
    }
  });

  // The worst possible onboarding bug: a graduation needing more lessons than
  // a new player can reach dead-ends every account at the fountain.
  it("keeps the graduation reachable from a brand-new account", () => {
    assert.deepEqual(groveGraduationReachabilityErrors(), []);
  });

  it("keeps fountain lesson bookkeeping consistent", () => {
    assert.deepEqual(groveFountainLessonCountErrors(), []);
  });

  it("has no quest whose giver does not exist", () => {
    assert.deepEqual(groveUnofferableQuestIds(new Set(npcAreaById.keys())), []);
  });

  it("produces a seedable predecessor set for any objective", () => {
    // The structural payoff: a browser checkpoint is two integers per leaf,
    // because progress lives in native TriggerState.
    const target = REPORT.steps[120];
    const cut = REPORT.steps.findIndex(
      (step) => step.questId === target.questId && step.stepId === target.stepId
    );
    const payload = REPORT.steps
      .slice(0, cut)
      .map((step) => [step.nativeChallengeId, step.nativeStepId]);
    assert(payload.length > 0);
    for (const [challengeId, stepId] of payload) {
      assert(Number.isSafeInteger(challengeId));
      assert(Number.isSafeInteger(stepId));
    }
  });
});

describe("Grove exact objective requirements", () => {
  // These used to live in four tables keyed by `${questId}:${objectiveIndex}` —
  // a FOURTH positional index outside the quest type. Collapsing
  // objectives/triggers/markers fixed three of four dimensions and left this
  // one, which is the same coupling wearing a different hat.
  it("carries every exact requirement on the step itself", () => {
    assert.deepEqual(groveValidateStepRequirements(), []);
  });

  it("preserves the authored requirement counts", () => {
    // Measured against the retired tables at fold time. A drift here means the
    // conversion lost or invented a requirement.
    let requiredCount = 0;
    let targeted = 0;
    let craft = 0;
    let inventory = 0;
    for (const quest of GROVE_QUEST_CATALOG) {
      for (const step of quest.steps) {
        if (step.requiredCount !== undefined) requiredCount += 1;
        if (step.targetMarkerIds !== undefined) targeted += 1;
        if (step.craft) craft += 1;
        if (step.inventory) inventory += 1;
      }
    }
    assert.equal(requiredCount, 6, "requiredCount overrides");
    // 4, matching the retired override table exactly. An earlier run of this
    // assertion expected 12 — that number was measuring a BUG: the giver
    // retarget was applied to `markerId` but not to the folded target list, so
    // eight single-target steps looked "explicit" purely because the two
    // disagreed. Once the retarget covered both, only the genuinely
    // multi-target objectives remain.
    assert.equal(targeted, 4, "explicit target lists");
    assert.equal(craft, 2, "exact craft requirements");
    assert.equal(inventory, 9, "inventory requirements");
  });

  it("keeps the four multi-target objectives multi-target", () => {
    const rows = groveMultiTargetSteps();
    assert.equal(rows.length, 4);
    for (const row of rows) {
      // Each must require ALL of its markers — completing on the first of
      // three moss patches is the failure this guards.
      assert.equal(
        row.required,
        row.targets.length,
        `${row.questId}/${row.stepId} requires ${row.required} of ` +
          `${row.targets.length}`
      );
    }
  });

  // requiredCount means a QUANTITY on a single-target step and a MARKER COUNT
  // on a multi-target one. An earlier contract asserted
  // `requiredCount <= targets.length` and flagged both quantity objectives as
  // unsatisfiable, which is why the distinction is pinned here.
  it("allows a quantity larger than the marker count on single-target steps", () => {
    const quantity = groveQuest("fountain_first_recipe_torch")!.steps[1];
    assert.equal(quantity.requiredCount, 2);
    assert.equal(groveStepTargetMarkerIds(quantity).length, 1);
    assert.deepEqual(groveValidateStepRequirements(), []);
  });

  it("routes the legacy accessors at the step, not a table", () => {
    // The retired tables are gone; these accessors kept their signatures so
    // callers did not move, but they must now read the step.
    const torch = groveQuest("fountain_first_recipe_torch")!;
    const legacyQuest = {
      id: torch.id,
      objectives: torch.steps.map(() => ""),
      markerIds: torch.steps.map((s) => s.markerId),
    };
    assert.equal(snapshotGroveObjectiveRequiredCount(legacyQuest as any, 1), 2);
    const moss = groveQuest("moss_that_went_quiet")!;
    const legacyMoss = {
      id: moss.id,
      markerIds: moss.steps.map((s) => s.markerId),
    };
    assert.deepEqual(
      [...snapshotGroveObjectiveTargetMarkerIds(legacyMoss as any, 2)],
      [...groveStepTargetMarkerIds(moss.steps[2])]
    );
  });
});
