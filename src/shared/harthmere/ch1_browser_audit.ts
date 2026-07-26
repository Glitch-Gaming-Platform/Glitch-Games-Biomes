// CHAPTER_1_BROWSER_AUDIT
//
// A serializable, production-bundle audit used by the live browser E2E gate.
// This is intentionally not a replacement for native ECS interaction tests:
// it proves that the exact Chapter 1 state machine shipped to the browser can
// complete every authored quest, dungeon lifecycle, fragment/skill grant, and
// ending without directly setting progression flags. The browser runner pairs
// this contract proof with live renderer, cutscene, ECS NPC, and terrain checks.

import { CH1_SCENE_FACTORIES } from "@/shared/cutscene/ch1_scenes";
import { CH1_TESTIMONIES } from "@/shared/harthmere/ch1_cast";
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
} from "@/shared/harthmere/ch1_chapter";
import { CH1_DUNGEONS, ch1Dungeon } from "@/shared/harthmere/ch1_dungeons";
import {
  CH1_PROVISIONING,
  ch1Gate,
} from "@/shared/harthmere/ch1_fracture_gates";
import {
  ch1FragmentDeliveryEnabled,
  ch1RecoverFragment,
} from "@/shared/harthmere/ch1_fragment_ledger";
import { CH1_ENDINGS, CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_LATENT_SKILL_IDS,
  ch1EmptyLatentSkills,
  ch1UnlockLatentSkill,
  type Ch1LatentSkillId,
} from "@/shared/harthmere/ch1_latent_skills";
import {
  CH1_QUESTS,
  ch1Quest,
  ch1QuestsForAct,
} from "@/shared/harthmere/ch1_quests";

export interface Ch1BrowserAuditResult {
  ok: boolean;
  errors: string[];
  currentAct: number;
  chapterComplete: boolean;
  questsCompleted: string[];
  fragmentsRecovered: string[];
  skillsUnlocked: string[];
  cutscenesReferenced: string[];
  dungeonRuns: Array<{
    gateId: string;
    dungeonId: string;
    arrival: readonly [number, number, number];
    groveElapsedMs: number;
    carriedOut: string[];
  }>;
  endingsResolved: string[];
  itemsHeld: string[];
  groveTimeMs: number;
}

interface AuditLog {
  questsCompleted: string[];
  fragmentsRecovered: string[];
  skillsUnlocked: string[];
  cutscenesReferenced: string[];
  dungeonRuns: Ch1BrowserAuditResult["dungeonRuns"];
  itemsHeld: Set<string>;
  groveTimeMs: number;
}

/**
 * Minimal player harness shared by the production-browser audit. Every state
 * transition below is the same public transition used by Chapter 1 runtime
 * code. `require()` records all failures instead of failing fast so one warm
 * browser campaign returns the complete repair list.
 */
class BrowserAuditPlaythrough {
  state: Ch1PlayerState = ch1InitialPlayerState();
  readonly errors: string[] = [];
  readonly log: AuditLog = {
    questsCompleted: [],
    fragmentsRecovered: [],
    skillsUnlocked: [],
    cutscenesReferenced: ["ch1-ignition"],
    dungeonRuns: [],
    itemsHeld: new Set<string>(),
    groveTimeMs: 0,
  };
  private clockMs = 0;

  constructor() {
    this.state.latentSkills = ch1EmptyLatentSkills();
    // Completing Muck vs. Machine is the legitimate Chapter 1 ignition. The
    // prerequisite quest itself has retained browser evidence and is excluded
    // from this campaign, so only its authored hand-off flag is applied here.
    this.state = ch1SetFlag(this.state, CH1_FLAGS.started);
  }

  require(condition: unknown, message: string): condition is true {
    if (!condition) {
      this.errors.push(message);
      return false;
    }
    return true;
  }

  completeQuest(questId: string): void {
    const quest = ch1Quest(questId);
    if (!this.require(quest, `missing quest definition: ${questId}`)) {
      return;
    }
    const available = ch1AvailableQuestIds(this.state.flags);
    if (
      !this.require(
        available.includes(questId),
        `quest ${questId} is unavailable in act ${ch1CurrentAct(
          this.state.flags
        )}; available=${available.join(",") || "none"}`
      )
    ) {
      return;
    }

    for (const step of quest.steps) {
      this.clockMs += 60_000;
      if (step.cutsceneId) {
        this.require(
          CH1_SCENE_FACTORIES.has(step.cutsceneId),
          `${questId}/${step.id} references unregistered cutscene ${step.cutsceneId}`
        );
        this.log.cutscenesReferenced.push(step.cutsceneId);
      }
      for (const item of step.grants ?? []) {
        this.log.itemsHeld.add(item);
      }
      if (
        step.fragmentId &&
        ch1FragmentDeliveryEnabled(this.state.flags)
      ) {
        this.state.ledger = ch1RecoverFragment(
          this.state.ledger,
          step.fragmentId,
          this.clockMs
        );
        this.log.fragmentsRecovered.push(step.fragmentId);
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

    for (const flag of quest.setsFlags ?? []) {
      this.state = ch1SetFlag(this.state, flag);
    }
    for (const delta of quest.trackDeltas ?? []) {
      const current = this.state.tracks[delta.track] ?? 0;
      this.state.tracks[delta.track] = Math.max(
        0,
        Math.min(100, current + delta.delta)
      );
    }
    this.log.questsCompleted.push(questId);
  }

  playSimpleAct(act: number): void {
    const quests = ch1QuestsForAct(act);
    const closer = quests.find((quest) => quest.actClose);
    for (const quest of quests.filter((candidate) => !candidate.actClose)) {
      this.completeQuest(quest.id);
    }
    if (this.require(closer, `act ${act} has no closing quest`)) {
      this.completeQuest(closer.id);
    }
  }

  private provisionFor(gateId: string): Record<string, number> {
    const check = CH1_PROVISIONING.find((candidate) => candidate.gateId === gateId);
    if (!this.require(check, `missing provisioning contract for ${gateId}`)) {
      return {};
    }
    return Object.fromEntries(
      check.requirements.map((requirement) => [
        requirement.key,
        requirement.quantity,
      ])
    );
  }

  runDungeon(gateId: string): void {
    const gate = ch1Gate(gateId);
    if (!this.require(gate?.dungeonId, `${gateId} has no dungeon`)) {
      return;
    }
    const dungeon = ch1Dungeon(gate.dungeonId);
    if (!this.require(dungeon, `missing dungeon ${gate.dungeonId}`)) {
      return;
    }
    const entry = ch1EnterGate({
      state: this.state,
      gateId,
      carried: this.provisionFor(gateId),
    });
    // Narrow the discriminated union directly. `require(entry.ok, ...)` is a
    // predicate on the BOOLEAN, so it cannot narrow `entry` itself — the
    // ok-branch fields (arrival) stay invisible to the compiler. Keep the
    // failure collected in this.errors so a batch run still reports every
    // problem instead of stopping at the first.
    if (!entry.ok) {
      this.errors.push(`${gateId} entry failed: ${entry.reason}`);
      return;
    }

    this.state.activeDungeonRunId = dungeon.id;
    this.state.activeRunStartedMs = this.clockMs;
    this.clockMs += dungeon.targetMinutes * 60_000;
    const carriedOut = dungeon.retrievals
      .filter((retrieval) => retrieval.required)
      .map((retrieval) => retrieval.id);
    for (const item of carriedOut) {
      this.log.itemsHeld.add(item);
    }
    const exit = ch1ExitGate({
      state: this.state,
      carriedOut,
      nowMs: this.clockMs,
    });
    if (!exit.ok) {
      this.errors.push(`${gateId} exit failed: ${exit.reason}`);
      return;
    }
    for (const flag of exit.completionFlags) {
      this.state = ch1SetFlag(this.state, flag);
    }
    this.log.groveTimeMs += exit.groveElapsedMs;
    this.log.dungeonRuns.push({
      gateId,
      dungeonId: dungeon.id,
      arrival: entry.arrival,
      groveElapsedMs: exit.groveElapsedMs,
      carriedOut,
    });
    this.state.activeDungeonRunId = undefined;
    this.state.activeRunStartedMs = undefined;
  }

  playDungeonAct(act: 3 | 5, gateId: string, marker: "_d1_" | "_d2_") {
    const quests = ch1QuestsForAct(act);
    for (const quest of quests.filter(
      (candidate) => !candidate.actClose && !candidate.id.includes(marker)
    )) {
      this.completeQuest(quest.id);
    }
    this.runDungeon(gateId);
    const dungeonQuest = quests.find((quest) => quest.id.includes(marker));
    if (this.require(dungeonQuest, `act ${act} has no ${marker} dungeon quest`)) {
      this.completeQuest(dungeonQuest.id);
    }
    const closer = quests.find((quest) => quest.actClose);
    if (this.require(closer, `act ${act} has no closing quest`)) {
      this.completeQuest(closer.id);
    }
  }
}

/** Run the complete authored Chapter 1 progression inside the real browser bundle. */
export function ch1RunBrowserAudit(): Ch1BrowserAuditResult {
  const run = new BrowserAuditPlaythrough();
  run.playSimpleAct(1);
  run.state.testimonies = CH1_TESTIMONIES.map((testimony) => testimony.id);
  run.playSimpleAct(2);
  run.playDungeonAct(3, "ch1_gate_desert", "_d1_");
  run.playSimpleAct(4);
  run.playDungeonAct(5, "ch1_gate_winter", "_d2_");
  run.playSimpleAct(6);

  const completed = new Set(run.log.questsCompleted);
  for (const quest of CH1_QUESTS) {
    run.require(completed.has(quest.id), `unreachable quest: ${quest.id}`);
  }
  run.require(
    completed.size === run.log.questsCompleted.length,
    "a Chapter 1 quest completed more than once"
  );
  for (const skill of CH1_LATENT_SKILL_IDS) {
    run.require(
      run.log.skillsUnlocked.includes(skill),
      `latent skill never unlocked: ${skill}`
    );
  }
  for (const dungeon of CH1_DUNGEONS) {
    run.require(
      run.log.dungeonRuns.some((candidate) => candidate.dungeonId === dungeon.id),
      `dungeon never completed: ${dungeon.id}`
    );
  }
  run.require(
    run.state.flags.includes(CH1_FLAGS.complete),
    "chapter completion flag was never reached"
  );
  run.require(
    ch1CurrentAct(run.state.flags) === CH1_ACT_COUNT,
    `chapter stopped in act ${ch1CurrentAct(run.state.flags)}`
  );

  const endingsResolved = CH1_ENDINGS.filter(
    (ending) => ch1ChooseEnding(run.state, ending).ending === ending
  );
  run.require(
    endingsResolved.length === CH1_ENDINGS.length,
    `only ${endingsResolved.length}/${CH1_ENDINGS.length} endings resolve`
  );

  return {
    ok: run.errors.length === 0,
    errors: run.errors,
    currentAct: ch1CurrentAct(run.state.flags),
    chapterComplete: run.state.flags.includes(CH1_FLAGS.complete),
    questsCompleted: run.log.questsCompleted,
    fragmentsRecovered: run.log.fragmentsRecovered,
    skillsUnlocked: [...new Set(run.log.skillsUnlocked)],
    cutscenesReferenced: [...new Set(run.log.cutscenesReferenced)],
    dungeonRuns: run.log.dungeonRuns,
    endingsResolved,
    itemsHeld: [...run.log.itemsHeld],
    groveTimeMs: run.log.groveTimeMs,
  };
}
