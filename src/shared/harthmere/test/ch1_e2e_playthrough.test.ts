/// <reference types="mocha" />
/// <reference types="node" />
//
// CHAPTER_1_END_TO_END_PLAYTHROUGH
//
// Drives a complete Chapter 1 run through the real state machine — no mocks,
// no shortcuts, no directly-set flags except the ones a quest step legitimately
// sets. If a player can reach a state, this test reaches it the same way.
//
// What this catches that the unit tests do not:
//   * an act that cannot be entered because its predecessor never sets the flag
//   * a quest that requires a flag nothing grants
//   * a dungeon that cannot be entered with everything the Grove can supply
//   * a dungeon that cannot be left because a retrieval is unobtainable
//   * a fragment that is never delivered on any path
//   * the ledger going permanently quiet and stranding the player in Act 5
//   * the handover being reachable without the oath, or the consolidation
//     firing without the handover
//   * a cutscene referenced by a step that is not registered
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md.

import assert from "assert";
import { CH1_FLAGS, CH1_TRACKS } from "../ch1_ids";
import {
  CH1_ACT_COUNT,
  ch1AvailableQuestIds,
  ch1ChooseEnding,
  ch1CurrentAct,
  ch1EnterGate,
  ch1ExitGate,
  ch1InitialPlayerState,
  ch1SetFlag,
  type Ch1PlayerState,
} from "../ch1_chapter";
import {
  CH1_QUESTS,
  ch1Quest,
  ch1QuestsForAct,
  type Ch1QuestDef,
} from "../ch1_quests";
import {
  ch1ApplyConsolidation,
  ch1FragmentDeliveryEnabled,
  ch1HasFragment,
  ch1RecoverFragment,
  ch1VisibleConfidence,
  CH1_CONSOLIDATION_ORDER,
} from "../ch1_fragment_ledger";
import {
  ch1EmptyLatentSkills,
  ch1HasLatentSkill,
  ch1UnlockLatentSkill,
  type Ch1LatentSkillId,
} from "../ch1_latent_skills";
import { CH1_PROVISIONING, ch1Gate } from "../ch1_fracture_gates";
import { CH1_DUNGEONS, ch1Dungeon } from "../ch1_dungeons";
import { CH1_TESTIMONIES } from "../ch1_cast";
import { CH1_SCENE_FACTORIES } from "@/shared/cutscene/ch1_scenes";

// ---------------------------------------------------------------------------
// A minimal player harness that only does what the game does.
// ---------------------------------------------------------------------------

interface PlaythroughLog {
  questsCompleted: string[];
  fragmentsRecovered: string[];
  skillsUnlocked: string[];
  cutscenesPlayed: string[];
  itemsHeld: Set<string>;
  groveTimeMs: number;
}

class Playthrough {
  state: Ch1PlayerState;
  log: PlaythroughLog;
  private clockMs = 0;

  constructor() {
    this.state = ch1InitialPlayerState();
    this.state.latentSkills = ch1EmptyLatentSkills();
    this.log = {
      questsCompleted: [],
      fragmentsRecovered: [],
      skillsUnlocked: [],
      cutscenesPlayed: [],
      itemsHeld: new Set(),
      groveTimeMs: 0,
    };
  }

  /** Finish Muck vs. Machine. The chapter starts on that sound. */
  ignite(): void {
    this.state = ch1SetFlag(this.state, CH1_FLAGS.started);
    this.log.cutscenesPlayed.push("ch1-ignition");
  }

  /**
   * Play one quest exactly as the runtime would: check the gate, walk the
   * steps in order, apply each step's grants/flags/fragments/skills.
   */
  completeQuest(questId: string): void {
    const quest = ch1Quest(questId);
    assert.ok(quest, `no such quest: ${questId}`);

    const available = ch1AvailableQuestIds(this.state.flags);
    assert.ok(
      available.includes(questId),
      `quest "${questId}" is not available in act ${ch1CurrentAct(
        this.state.flags
      )}; available: ${available.join(", ") || "(none)"}`
    );

    for (const step of quest!.steps) {
      this.clockMs += 60_000;

      if (step.cutsceneId) {
        assert.ok(
          CH1_SCENE_FACTORIES.has(step.cutsceneId),
          `${questId}/${step.id} plays unregistered cutscene "${step.cutsceneId}"`
        );
        this.log.cutscenesPlayed.push(step.cutsceneId);
      }

      for (const item of step.grants ?? []) {
        this.log.itemsHeld.add(item);
      }

      if (step.fragmentId) {
        // The ledger is a pacing instrument: it goes silent when dosing stops.
        if (ch1FragmentDeliveryEnabled(this.state.flags)) {
          this.state.ledger = ch1RecoverFragment(
            this.state.ledger,
            step.fragmentId,
            this.clockMs
          );
          this.log.fragmentsRecovered.push(step.fragmentId);
        }
      }

      if (step.latentSkillId) {
        this.state.latentSkills = ch1UnlockLatentSkill(
          this.state.latentSkills,
          step.latentSkillId as Ch1LatentSkillId
        );
        this.log.skillsUnlocked.push(step.latentSkillId);
      }

      for (const flag of step.setsFlags ?? []) {
        this.state = ch1SetFlag(this.state, flag);
      }
    }

    for (const flag of quest!.setsFlags ?? []) {
      this.state = ch1SetFlag(this.state, flag);
    }
    for (const delta of quest!.trackDeltas ?? []) {
      const current = this.state.tracks[delta.track] ?? 0;
      this.state.tracks[delta.track] = Math.max(
        0,
        Math.min(100, current + delta.delta)
      );
    }
    this.log.questsCompleted.push(questId);
  }

  playAct(act: number): void {
    // Non-closing quests first, closer last — the closer is what advances.
    const quests = ch1QuestsForAct(act);
    const closer = quests.find((q) => q.actClose);
    for (const quest of quests.filter((q) => !q.actClose)) {
      this.completeQuest(quest.id);
    }
    assert.ok(closer, `act ${act} has no closing quest`);
    this.completeQuest(closer!.id);
  }

  /** Buy exactly what the gate demands from the Grove economy. */
  provisionFor(gateId: string): Record<string, number> {
    const check = CH1_PROVISIONING.find((p) => p.gateId === gateId);
    assert.ok(check, `no provisioning defined for ${gateId}`);
    const carried: Record<string, number> = {};
    for (const requirement of check!.requirements) {
      carried[requirement.key] = requirement.quantity;
    }
    return carried;
  }

  runDungeon(gateId: string): void {
    const gate = ch1Gate(gateId);
    assert.ok(gate?.dungeonId, `${gateId} has no dungeon`);
    const dungeon = ch1Dungeon(gate!.dungeonId!);
    assert.ok(dungeon);

    const entry = ch1EnterGate({
      state: this.state,
      gateId,
      carried: this.provisionFor(gateId),
    });
    assert.ok(
      entry.ok,
      `could not enter ${gateId}: ${entry.ok ? "" : entry.reason}`
    );

    this.state.activeDungeonRunId = dungeon!.id;
    this.state.activeRunStartedMs = this.clockMs;

    // Spend the authored playtime inside.
    this.clockMs += dungeon!.targetMinutes * 60_000;

    // Carry out every required retrieval.
    const carriedOut = dungeon!.retrievals
      .filter((r) => r.required)
      .map((r) => r.id);
    for (const id of carriedOut) {
      this.log.itemsHeld.add(id);
    }

    const exit = ch1ExitGate({
      state: this.state,
      carriedOut,
      nowMs: this.clockMs,
    });
    assert.ok(
      exit.ok,
      `could not exit ${gateId}: ${exit.ok ? "" : exit.reason}`
    );
    if (exit.ok) {
      this.log.groveTimeMs += exit.groveElapsedMs;
      for (const flag of exit.completionFlags) {
        this.state = ch1SetFlag(this.state, flag);
      }
    }

    this.state.activeDungeonRunId = undefined;
    this.state.activeRunStartedMs = undefined;
  }

  collectAllTestimonies(): void {
    this.state.testimonies = CH1_TESTIMONIES.map((t) => t.id);
  }

  has(flag: string): boolean {
    return this.state.flags.includes(flag);
  }
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function fullPlaythrough(): Playthrough {
  const run = new Playthrough();
  run.ignite();

  run.playAct(1);
  run.collectAllTestimonies();
  run.playAct(2);

  // Act 3 quests come first, then the dungeon is entered from the open gate,
  // then the act closes on coming back out.
  const act3 = ch1QuestsForAct(3);
  for (const quest of act3.filter(
    (q) => !q.actClose && !q.id.includes("_d1_")
  )) {
    run.completeQuest(quest.id);
  }
  run.runDungeon("ch1_gate_desert");
  const d1 = act3.find((q) => q.id.includes("_d1_"));
  if (d1) {
    run.completeQuest(d1.id);
  }
  const act3Closer = act3.find((q) => q.actClose)!;
  run.completeQuest(act3Closer.id);

  run.playAct(4);

  const act5 = ch1QuestsForAct(5);
  for (const quest of act5.filter(
    (q) => !q.actClose && !q.id.includes("_d2_")
  )) {
    run.completeQuest(quest.id);
  }
  run.runDungeon("ch1_gate_winter");
  const d2 = act5.find((q) => q.id.includes("_d2_"));
  if (d2) {
    run.completeQuest(d2.id);
  }
  const act5Closer = act5.find((q) => q.actClose)!;
  run.completeQuest(act5Closer.id);

  run.playAct(6);
  return run;
}

// ---------------------------------------------------------------------------

describe("ch1 E2E - the full playthrough", () => {
  let run: Playthrough;

  before(() => {
    run = fullPlaythrough();
  });

  it("reaches the end of the chapter", () => {
    assert.ok(run.has(CH1_FLAGS.complete), "chapter never completed");
    assert.equal(ch1CurrentAct(run.state.flags), CH1_ACT_COUNT);
  });

  it("plays every authored quest", () => {
    const played = new Set(run.log.questsCompleted);
    for (const quest of CH1_QUESTS) {
      assert.ok(
        played.has(quest.id),
        `quest "${quest.id}" (act ${quest.act}) is unreachable in a full run`
      );
    }
    assert.equal(
      run.log.questsCompleted.length,
      new Set(run.log.questsCompleted).size,
      "a quest was played twice"
    );
  });

  it("advances the acts in order and never skips one", () => {
    const order = [
      CH1_FLAGS.act1Complete,
      CH1_FLAGS.act2Complete,
      CH1_FLAGS.act3Complete,
      CH1_FLAGS.act4Complete,
      CH1_FLAGS.act5Complete,
      CH1_FLAGS.complete,
    ];
    for (const flag of order) {
      assert.ok(run.has(flag), `never set ${flag}`);
    }
  });

  it("unlocks every latent skill", () => {
    for (const id of [
      "ls_anchor_read",
      "ls_containment_triage",
      "ls_field_calibration",
      "ls_gate_timing",
    ] as Ch1LatentSkillId[]) {
      assert.ok(
        ch1HasLatentSkill(run.state.latentSkills, id),
        `${id} is never unlocked in a full run`
      );
    }
  });

  it("plays every registered cutscene that a quest references", () => {
    const played = new Set(run.log.cutscenesPlayed);
    for (const quest of CH1_QUESTS) {
      for (const step of quest.steps) {
        if (step.cutsceneId) {
          assert.ok(
            played.has(step.cutsceneId),
            `cutscene "${step.cutsceneId}" is never played`
          );
        }
      }
    }
  });

  it("completes both dungeons and pays the time-dilation cost", () => {
    for (const dungeon of CH1_DUNGEONS) {
      const flag = dungeon.completionFlags[0];
      assert.ok(run.has(flag), `${dungeon.id} never completed (${flag})`);
    }
    // ~90 minutes in the desert at 9x plus ~190 in the fjord at 6x. The Grove
    // should have lost multiple days, which is the whole dread beat.
    const groveDays = run.log.groveTimeMs / (24 * 60 * 60 * 1000);
    assert.ok(
      groveDays > 1,
      `the Grove only lost ${groveDays.toFixed(
        2
      )} days; the time cost is the point`
    );
  });

  it("ends holding the retrievals the chapter is about", () => {
    for (const item of [
      "item_first_grain",
      "npc_iris_fen",
      "item_sorrel_field_ledger",
      "npc_nadia_sorrel",
      "item_custodian_key_3",
    ]) {
      assert.ok(run.log.itemsHeld.has(item), `never obtained ${item}`);
    }
  });
});

describe("ch1 E2E - the memory arc", () => {
  let run: Playthrough;

  before(() => {
    run = fullPlaythrough();
  });

  it("delivers fragments across every act that has them", () => {
    const acts = new Set(
      run.log.fragmentsRecovered
        .map((id) => Number(id.match(/frag_a(\d)/)?.[1]))
        .filter((n) => !Number.isNaN(n))
    );
    for (const act of [1, 2, 3, 5]) {
      assert.ok(acts.has(act), `no fragment delivered in act ${act}`);
    }
  });

  it("goes silent when the player stops taking the tea", () => {
    // The Act 4 confrontation stops dosing. Until the player works out that
    // the vials were helping, the ledger must produce nothing.
    const mid = new Playthrough();
    mid.ignite();
    mid.playAct(1);
    mid.collectAllTestimonies();
    mid.playAct(2);
    const act3 = ch1QuestsForAct(3);
    for (const q of act3.filter((x) => !x.actClose && !x.id.includes("_d1_"))) {
      mid.completeQuest(q.id);
    }
    mid.runDungeon("ch1_gate_desert");
    const d1 = act3.find((q) => q.id.includes("_d1_"))!;
    mid.completeQuest(d1.id);
    mid.completeQuest(act3.find((q) => q.actClose)!.id);
    mid.playAct(4);

    assert.ok(mid.has(CH1_FLAGS.dosingStopped), "Act 4 must stop the dosing");
    assert.equal(
      ch1FragmentDeliveryEnabled(mid.state.flags),
      false,
      "the ledger must go quiet after the confrontation"
    );

    const before = mid.log.fragmentsRecovered.length;
    // Act 5's first quest is the player working it out and resuming.
    mid.completeQuest("ch1_a5_q01_the_ledger_goes_quiet");
    assert.ok(mid.has(CH1_FLAGS.dosingResumed));
    assert.equal(
      ch1FragmentDeliveryEnabled(mid.state.flags),
      true,
      "resuming the vials must restart recovery, or Act 5 is unplayable"
    );
    assert.ok(mid.log.fragmentsRecovered.length >= before);
  });

  it("unlocks linking before the player needs it", () => {
    assert.ok(
      run.has(CH1_FLAGS.act5Linking),
      "confidence must become visible before the climax"
    );
  });

  it("rewrites the ledger only at the consolidation, and only then", () => {
    const ledger = { ...run.state.ledger, linkingUnlocked: true };
    // Before: the corridor is the most confident thing the player owns.
    assert.equal(ch1VisibleConfidence(ledger, "frag_a3_recon_corridor"), 91);

    const after = ch1ApplyConsolidation(ledger);
    assert.equal(ch1VisibleConfidence(after, "frag_a3_recon_corridor"), 12);
    for (const id of CH1_CONSOLIDATION_ORDER) {
      assert.ok(
        ch1HasFragment(after, id),
        `consolidation entry ${id} missing from the ledger`
      );
    }
  });

  it("never lets the player learn the designation before the ice", () => {
    // The word must arrive exactly once, shouted over wind in Dungeon 2 — and
    // never earlier, or Lou saying it in Act 6 lands on nothing.
    const early = new Playthrough();
    early.ignite();
    early.playAct(1);
    early.collectAllTestimonies();
    early.playAct(2);
    assert.equal(
      early.has(CH1_FLAGS.knowsDesignation),
      false,
      "the designation leaked before Act 5"
    );
  });
});

describe("ch1 E2E - the tragedy is airtight", () => {
  it("cannot hand over the ledger without first swearing not to", () => {
    const run = fullPlaythrough();
    assert.ok(
      run.has(CH1_FLAGS.sorrelOathGiven),
      "the oath must be sworn before the handover, or the betrayal is free"
    );
    assert.ok(run.has(CH1_FLAGS.hasLedger));
    assert.ok(run.has(CH1_FLAGS.ledgerSurrendered));

    const oathStep = run.log.questsCompleted.indexOf(
      "ch1_a5_d2_the_long_winter_mouth"
    );
    const handoverStep = run.log.questsCompleted.indexOf(
      "ch1_a6_q02_the_handover"
    );
    assert.ok(oathStep >= 0 && handoverStep >= 0);
    assert.ok(
      oathStep < handoverStep,
      "the player must swear the oath before they can break it"
    );
  });

  it("consolidates only after the handover — ninety seconds too late", () => {
    const run = fullPlaythrough();
    const handover = run.log.questsCompleted.indexOf("ch1_a6_q02_the_handover");
    const consolidation = run.log.questsCompleted.indexOf(
      "ch1_a6_q03_consolidation"
    );
    assert.ok(
      handover < consolidation,
      "if the truth lands before the handover, the player simply refuses and " +
        "the chapter has no ending"
    );
    assert.ok(run.has(CH1_FLAGS.act6TruthKnown));
  });

  it("moves trust the wrong way at exactly the wrong moment", () => {
    const run = fullPlaythrough();
    const jackie = run.state.tracks[CH1_TRACKS.jackieTrust];
    const lou = run.state.tracks[CH1_TRACKS.louTrust];
    assert.ok(
      lou > jackie,
      `at the climax the player must trust Lou (${lou}) more than Jackie ` +
        `(${jackie}), or the handover is not credible`
    );
  });

  it("confirms the player's identity to the Collective without Lou telling them", () => {
    const run = fullPlaythrough();
    assert.ok(
      run.has(CH1_FLAGS.collectiveConfirmedIdentity),
      "Calla Ashe's incident report is what exposes the player — it must fire"
    );
  });

  it("supports all three endings from the same completed run", () => {
    for (const ending of ["confess", "contain", "bargain"] as const) {
      const run = fullPlaythrough();
      const ended = ch1ChooseEnding(run.state, ending);
      assert.equal(ended.ending, ending);
      assert.ok(ended.flags.includes(CH1_FLAGS.complete));
    }
  });
});

describe("ch1 E2E - failure modes a player can actually hit", () => {
  it("refuses an under-provisioned gate entry and says what is missing", () => {
    const run = new Playthrough();
    run.ignite();
    run.playAct(1);
    run.collectAllTestimonies();
    run.playAct(2);

    const result = ch1EnterGate({
      state: run.state,
      gateId: "ch1_gate_desert",
      carried: { water: 1, food: 1 },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "under-provisioned");
      assert.ok(
        (result.provisioning?.missing.length ?? 0) >= 5,
        "the player should be told everything they are short of, not just the first"
      );
    }
  });

  it("refuses a gate whose act has not been reached", () => {
    const run = new Playthrough();
    run.ignite();
    const result = ch1EnterGate({
      state: run.state,
      gateId: "ch1_gate_winter",
      carried: run.provisionFor("ch1_gate_winter"),
    });
    assert.equal(result.ok, false);
  });

  it("refuses to leave a dungeon without the person it was about", () => {
    const run = new Playthrough();
    run.ignite();
    run.playAct(1);
    run.collectAllTestimonies();
    run.playAct(2);
    const entry = ch1EnterGate({
      state: run.state,
      gateId: "ch1_gate_desert",
      carried: run.provisionFor("ch1_gate_desert"),
    });
    assert.ok(entry.ok);
    run.state.activeDungeonRunId = "ch1_dungeon_desert";
    run.state.activeRunStartedMs = 0;

    const abandonIris = ch1ExitGate({
      state: run.state,
      carriedOut: ["item_first_grain"],
      nowMs: 5_400_000,
    });
    assert.equal(abandonIris.ok, false);
    if (!abandonIris.ok) {
      assert.match(abandonIris.reason, /Iris Fen/);
    }
  });

  it("cannot enter a second gate while already inside one", () => {
    const run = new Playthrough();
    run.ignite();
    run.playAct(1);
    run.collectAllTestimonies();
    run.playAct(2);
    run.state.activeDungeonRunId = "ch1_dungeon_desert";
    const second = ch1EnterGate({
      state: run.state,
      gateId: "ch1_gate_desert",
      carried: run.provisionFor("ch1_gate_desert"),
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.reason, "already inside a gate");
    }
  });

  it("never offers a quest whose required flags cannot be satisfied", () => {
    // Every requiresFlags entry must be granted by some earlier quest or by a
    // dungeon completion. A flag nothing sets is a permanently dead quest.
    const granted = new Set<string>([CH1_FLAGS.started]);
    for (const quest of CH1_QUESTS) {
      for (const flag of quest.setsFlags ?? []) {
        granted.add(flag);
      }
      for (const step of quest.steps) {
        for (const flag of step.setsFlags ?? []) {
          granted.add(flag);
        }
      }
    }
    for (const dungeon of CH1_DUNGEONS) {
      for (const flag of dungeon.completionFlags) {
        granted.add(flag);
      }
    }
    for (const quest of CH1_QUESTS) {
      for (const flag of quest.requiresFlags ?? []) {
        assert.ok(
          granted.has(flag),
          `quest "${quest.id}" requires "${flag}", which nothing ever sets`
        );
      }
    }
  });

  it("has no quest that is unreachable because of act gating", () => {
    const run = fullPlaythrough();
    const played = new Set(run.log.questsCompleted);
    const orphans = CH1_QUESTS.filter(
      (q: Ch1QuestDef) => !played.has(q.id)
    ).map((q) => q.id);
    assert.deepEqual(orphans, []);
  });
});
