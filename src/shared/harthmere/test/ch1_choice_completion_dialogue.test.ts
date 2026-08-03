/// <reference types="mocha" />

// CHAPTER_1_CHOICE_COMPLETION_AND_LABEL_HONESTY
//
// Gate for the 2026-08-03 production audit findings B1, B2, B3, B6 and B7.
//
// The bug class this file exists to stop is not a crash. It is the game
// accepting a deliberate player commitment and saying nothing back, or telling
// the player an objective is one thing while the server gates it on another.
// Both are invisible to every other suite: the quest completes, the trigger
// fires, the tests are green, and the scene the writers' journal describes
// simply does not happen.
//
// Pure data and pure functions only, so this runs under .mocharc.fast.json
// with no server or Bikkie bootstrap (see docs/harthmere/TESTING_FASTER.md).

import assert from "assert";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import {
  CH1_DUNGEON_ESCORT_NPCS,
  ch1RequiredEscortNpcsForObjective,
} from "@/shared/harthmere/ch1_dungeon_encounters";
import { ch1DungeonMechanicForObjective } from "@/shared/harthmere/ch1_dungeon_mechanics";
import {
  CH1_FRAGMENT_IDS,
  CH1_LINK_RECIPES,
  ch1Fragment,
} from "@/shared/harthmere/ch1_fragment_ledger";
import { CH1_AMBIENT_FRAGMENT_TRIGGERS } from "@/shared/harthmere/ch1_fragment_triggers";
import { ch1ObjectiveChoiceSpec } from "@/shared/harthmere/ch1_live_story";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { CH1_QUESTS, type Ch1QuestStep } from "@/shared/harthmere/ch1_quests";
import { ch1VoiceActorForSpeaker } from "@/shared/harthmere/ch1_voice";
import { ch1AllScenes } from "@/shared/cutscene/ch1_scenes";
import {
  ch1ObjectiveCompletionDialogue,
  ch1ObjectiveDialogue,
} from "@/server/harthmere/ch1_dialogue";
import { isHarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";

/**
 * The ONLY choices allowed to complete without a spoken reply, and the reason
 * each one is allowed. Every entry is verified below — an exclusion may not
 * survive merely by being listed here.
 *
 *   cutscene — the step plays a linear scene that already carries the reply.
 *              Both cases are authored so that every option means the same
 *              thing, so a per-choice line would contradict the design.
 *   refused  — `acceptedChoice` rejects the option, so completion is
 *              unreachable and the player-facing text is the refusal message.
 */
const ALLOWED_SILENT_CHOICES: Readonly<
  Record<string, Readonly<Record<string, "cutscene" | "refused">>>
> = Object.freeze({
  confront: {
    what_is_it: "cutscene",
    why_the_tea: "cutscene",
    why_trust_you: "cutscene",
  },
  watch_him_go: {
    dont_know: "cutscene",
    there_wasnt_one: "cutscene",
    not_yours: "cutscene",
    i_would_have_failed: "cutscene",
  },
  give_the_ledger: { not_yet: "refused" },
});

function allSteps(): { questId: string; step: Ch1QuestStep }[] {
  return CH1_QUESTS.flatMap((quest) =>
    quest.steps.map((step) => ({ questId: quest.id, step }))
  );
}

function choiceSteps() {
  return allSteps().flatMap(({ questId, step }) => {
    const spec = ch1ObjectiveChoiceSpec(step);
    return spec ? [{ questId, step, spec }] : [];
  });
}

describe("Chapter 1 — every player choice gets an answer", () => {
  it("has a completion reply for every accepted choice option", () => {
    const silent: string[] = [];
    for (const { step, spec } of choiceSteps()) {
      for (const option of spec.options) {
        if (ch1ObjectiveCompletionDialogue(step.id, option.id)) continue;
        if (ALLOWED_SILENT_CHOICES[step.id]?.[option.id]) continue;
        silent.push(`${step.id}/${option.id}`);
      }
    }
    assert.deepEqual(
      silent,
      [],
      `these choices complete without the world reacting:\n  ${silent.join(
        "\n  "
      )}\nAdd a CH1_COMPLETION_DIALOGUE entry, or justify it in ALLOWED_SILENT_CHOICES.`
    );
  });

  it("justifies every silent choice, and lets no stale exclusion survive", () => {
    const sceneIds = new Set(ch1AllScenes().map((scene) => scene.id));
    for (const [stepId, byChoice] of Object.entries(ALLOWED_SILENT_CHOICES)) {
      const found = choiceSteps().find((entry) => entry.step.id === stepId);
      assert.ok(found, `${stepId}: exclusion names a step with no choice spec`);
      for (const [choiceId, reason] of Object.entries(byChoice)) {
        assert.ok(
          found!.spec.options.some((option) => option.id === choiceId),
          `${stepId}/${choiceId}: exclusion names an option that no longer exists`
        );
        // An exclusion must not quietly become the way a real gap hides.
        assert.ok(
          !ch1ObjectiveCompletionDialogue(stepId, choiceId),
          `${stepId}/${choiceId}: now HAS completion dialogue — drop the exclusion`
        );
        if (reason === "cutscene") {
          assert.ok(
            found!.step.cutsceneId && sceneIds.has(found!.step.cutsceneId),
            `${stepId}: excluded as cutscene-covered, but no registered scene`
          );
        }
      }
    }
  });

  it("keeps `not_yet` unreachable rather than merely unwritten", () => {
    // The Act 6 handover must be refusable forever with no timer. That refusal
    // is why it has no completion line, so the two facts have to stay linked.
    const spec = choiceSteps().find(
      (entry) => entry.step.id === "give_the_ledger"
    )!.spec;
    assert.ok(spec.options.some((option) => option.id === "not_yet"));
    assert.ok(spec.cancellable, "the handover prompt must stay cancellable");
  });

  it("writes real dialogue, not filler", () => {
    const speakers = new Set<string>();
    for (const { step, spec } of choiceSteps()) {
      for (const option of spec.options) {
        const dialogue = ch1ObjectiveCompletionDialogue(step.id, option.id);
        if (!dialogue) continue;
        const where = `${step.id}/${option.id}`;
        assert.ok(dialogue.title.length >= 3, `${where}: title too short`);
        assert.ok(dialogue.pages.length >= 1, `${where}: no pages`);
        for (const page of dialogue.pages) {
          speakers.add(page.speaker);
          assert.ok(page.speaker.length > 0, `${where}: page with no speaker`);
          assert.ok(
            page.text.trim().length > 0,
            `${where}: page with empty text`
          );
          assert.ok(
            !/\b(TODO|TBD|FIXME|placeholder|lorem)\b/i.test(page.text),
            `${where}: placeholder text shipped`
          );
          if (page.expression !== undefined) {
            assert.ok(
              isHarthmereCinematicExpression(page.expression),
              `${where}: unregistered expression "${page.expression}"`
            );
          }
        }
      }
    }
    // Guards against a typo'd speaker silently losing its voice and portrait.
    // "You" and unvoiced scene-narration speakers are legitimate.
    const NARRATION = new Set([
      "You",
      "Your hands",
      "The fjord",
      "The fence line",
    ]);
    for (const speaker of speakers) {
      if (NARRATION.has(speaker)) continue;
      assert.ok(
        CH1_NEW_CAST.some((member) => member.displayName === speaker) ||
          ch1VoiceActorForSpeaker(speaker),
        `completion dialogue speaker "${speaker}" is neither cast nor voiced — likely a typo`
      );
    }
  });

  it("answers the beats the writers' journal calls the point of the scene", () => {
    // Named explicitly so a future refactor that drops one of these fails
    // loudly instead of quietly reverting the chapter's best moments.
    const LOAD_BEARING: readonly [string, string][] = [
      ["not_this_small", "not_this_small"],
      ["how_did_you_do_that", "dont_know"],
      ["tell_sil_why", "bedrock"],
      ["call_the_collapse", "seventeen_seconds"],
      ["d2_the_oath", "swear_oath"],
      ["did_he_take_it", "yes"],
      ["give_the_ledger", "give"],
      ["say_the_sentence", "biomes_make_gates"],
      ["choose_a_name", "keep_name"],
    ];
    for (const [stepId, choiceId] of LOAD_BEARING) {
      assert.ok(
        ch1ObjectiveCompletionDialogue(stepId, choiceId),
        `${stepId}/${choiceId} is a load-bearing beat and must have a reply`
      );
    }
  });

  it("speaks the chapter's signature lines rather than leaving them in a note", () => {
    const line = (stepId: string, choiceId: string) =>
      (ch1ObjectiveCompletionDialogue(stepId, choiceId)?.pages ?? [])
        .map((page) => page.text)
        .join(" ");
    assert.match(line("not_this_small", "not_this_small"), /Not this small/);
    assert.match(
      line("call_the_collapse", "seventeen_seconds"),
      /clever devils/
    );
    assert.match(line("choose_a_name", "keep_name"), /growing into it/);
  });
});

describe("Chapter 1 — objectives describe what the server actually checks", () => {
  it("never labels a step `escort` unless an escort is genuinely required", () => {
    // `come_out` used to read "Get Sorrel across the fjord" under an `escort`
    // trigger while requiring no escort at all. Requiring her there would have
    // been an unrecoverable soft-lock, because the escort scheduler cancels her
    // follow at `d2_the_breaking_year`; the honest fix was the trigger.
    for (const { step } of allSteps()) {
      if (step.trigger !== "escort") continue;
      assert.ok(
        ch1RequiredEscortNpcsForObjective(step.id).length > 0,
        `${step.id}: trigger is "escort" but no escort NPC is required — ` +
          `either gate on the companion or use a truthful trigger`
      );
    }
  });

  it("gates the winter companion on the leg where she is actually following", () => {
    const required = ch1RequiredEscortNpcsForObjective("d2_the_breaking_year");
    assert.equal(required.length, 1);
    assert.match(required[0].displayName, /Sorrel/);
    assert.deepEqual(
      ch1RequiredEscortNpcsForObjective("come_out"),
      [],
      "come_out must not gate on Sorrel; she is no longer following by then"
    );
  });

  it("makes come_out an arrival beat that matches its Act 3 twin", () => {
    const comeOut = allSteps().find((entry) => entry.step.id === "come_out")!;
    const comeBackOut = allSteps().find(
      (entry) => entry.step.id === "come_back_out"
    )!;
    assert.equal(comeOut.step.trigger, comeBackOut.step.trigger);
    assert.equal(comeOut.step.trigger, "near_location");
    assert.ok(
      !/get sorrel|bring sorrel/i.test(comeOut.step.objective),
      "come_out must not promise an escort check it does not perform"
    );
    // Same reachability as before the retrigger.
    assert.equal(
      ch1ObjectiveTarget(comeOut.questId, "come_out")?.interactionRadius,
      ch1ObjectiveTarget(comeBackOut.questId, "come_back_out")
        ?.interactionRadius
    );
  });

  it("keeps Marrow optional so a stuck dog can never strand the desert exit", () => {
    const marrow = CH1_DUNGEON_ESCORT_NPCS.find((npc) =>
      /marrow/i.test(npc.displayName)
    );
    assert.ok(marrow);
    for (const { step } of allSteps()) {
      assert.ok(
        !ch1RequiredEscortNpcsForObjective(step.id).some(
          (npc) => npc.entityId === marrow!.entityId
        ),
        `${step.id}: Marrow must never be a completion gate`
      );
    }
  });
});

describe("Chapter 1 — the action label tells the truth", () => {
  it("only promises a challenge where a challenge exists", () => {
    for (const { questId, step } of allSteps()) {
      if (step.trigger !== "minigame") continue;
      const label = ch1ObjectiveTarget(questId, step.id)?.actionLabel;
      const mechanic = ch1DungeonMechanicForObjective(step.id);
      if (step.id === "the_procedure") {
        // The one step with real minigame UI (Chapter1ContainmentTriage).
        assert.equal(label, "Complete challenge");
      } else if (mechanic?.requiredChoice) {
        assert.equal(label, "Choose route", `${step.id}`);
      } else {
        assert.equal(label, "Make the crossing", `${step.id}`);
        assert.ok(
          mechanic,
          `${step.id}: a bare minigame step must at least charge a survival interval`
        );
      }
    }
  });

  it("keeps the minigame trigger on dungeon crossings so survival costs commit", () => {
    // The trigger is load-bearing: a proximity trigger completes in native ECS
    // without ever spending water/fuel/light or applying the consequence.
    for (const stepId of [
      "d1_dune_threshold",
      "d1_cistern_stair",
      "ch1_a3_d1_hall_of_weights",
      "d2_ice_shelf",
      "d2_longhouse",
      "d2_hanged_wood",
      "d2_whale_road",
    ]) {
      const found = allSteps().find((entry) => entry.step.id === stepId);
      assert.ok(found, `${stepId} missing`);
      assert.equal(
        found!.step.trigger,
        "minigame",
        `${stepId}: must not become a proximity trigger`
      );
      assert.ok(
        ch1DungeonMechanicForObjective(stepId),
        `${stepId}: has no survival mechanic to charge`
      );
    }
  });

  it("gives every objective an action label", () => {
    for (const { questId, step } of allSteps()) {
      const label = ch1ObjectiveTarget(questId, step.id)?.actionLabel;
      assert.ok(
        label && label.length > 0,
        `${step.id}: no action label for trigger "${step.trigger}"`
      );
    }
  });
});

describe("Chapter 1 — every recovered fragment has a live route", () => {
  it("can deliver all thirty fragments through a real player action", () => {
    const questAwarded = new Set<string>();
    for (const { step } of allSteps()) {
      if (step.fragmentId) questAwarded.add(step.fragmentId);
    }
    const ambient = new Set(
      CH1_AMBIENT_FRAGMENT_TRIGGERS.map((trigger) => trigger.fragmentId)
    );
    const derived = new Set(CH1_LINK_RECIPES.map((recipe) => recipe.derives));
    // Seeded into availablePlaybackIds when the ledger opens (see
    // ch1ApplyLiveObjectiveEffects, step `open_the_tab`).
    const seededPlayback = new Set(["frag_a2_play_the_ninth_signature"]);

    const unreachable = CH1_FRAGMENT_IDS.filter(
      (fragmentId) =>
        !questAwarded.has(fragmentId) &&
        !ambient.has(fragmentId) &&
        !derived.has(fragmentId) &&
        !seededPlayback.has(fragmentId)
    );
    assert.deepEqual(
      unreachable,
      [],
      `no player action delivers:\n  ${unreachable.join("\n  ")}`
    );
  });

  it("builds every derived fragment from sources the player can already hold", () => {
    const obtainable = new Set<string>([
      ...allSteps().flatMap(({ step }) =>
        step.fragmentId ? [step.fragmentId] : []
      ),
      ...CH1_AMBIENT_FRAGMENT_TRIGGERS.map((trigger) => trigger.fragmentId),
      "frag_a2_play_the_ninth_signature",
    ]);
    for (const recipe of CH1_LINK_RECIPES) {
      assert.ok(recipe.sources.length > 0, `${recipe.derives}: no sources`);
      for (const source of recipe.sources) {
        assert.ok(
          obtainable.has(source),
          `${recipe.derives}: source ${source} cannot be obtained, so the ` +
            `derived fragment is unreachable`
        );
      }
      assert.ok(
        ch1Fragment(recipe.derives),
        `${recipe.derives}: recipe derives an unregistered fragment`
      );
    }
  });
});

describe("Chapter 1 — voice coverage", () => {
  it("voices every speaking cast member", () => {
    for (const member of CH1_NEW_CAST) {
      if (member.voice === "—") continue;
      assert.ok(
        ch1VoiceActorForSpeaker(member.displayName),
        `${member.displayName}: speaking cast member with no voice actor`
      );
    }
  });

  it("keeps Marrow deliberately unvoiced instead of accidentally uncast", () => {
    // Recurring false positive in voice-coverage audits. Marrow is a dog.
    const marrow = CH1_NEW_CAST.find((member) => member.key === "marrow");
    assert.ok(marrow);
    assert.equal(marrow!.voice, "—", "the em-dash IS the non-speaking marker");
    assert.equal(marrow!.sampleLine, "—");
    assert.equal(ch1VoiceActorForSpeaker("Marrow"), undefined);
    // And nothing may hand her a line.
    for (const { questId, step } of allSteps()) {
      const pages = [
        ...(ch1ObjectiveDialogue(step.id, { questId })?.pages ?? []),
        ...(ch1ObjectiveChoiceSpec(step)?.options ?? []).flatMap(
          (option) =>
            ch1ObjectiveCompletionDialogue(step.id, option.id)?.pages ?? []
        ),
      ];
      for (const page of pages) {
        assert.notEqual(
          page.speaker,
          "Marrow",
          `${step.id}: Marrow does not speak`
        );
      }
    }
  });
});
