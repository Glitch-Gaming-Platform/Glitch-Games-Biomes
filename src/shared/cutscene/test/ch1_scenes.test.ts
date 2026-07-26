/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  CH1_MEMORY_STAGE,
  CH1_SCENE_FACTORIES,
  CH1_SCENE_IDS,
  ch1AllScenes,
  ch1CorridorCutscene,
  ch1ConsolidationRevisionCutscene,
  ch1IgnitionCutscene,
} from "../ch1_scenes";
import { validateCutsceneDef } from "../schema";
import {
  CH1_CONSOLIDATION_ENTRY_SECONDS,
  CH1_CONSOLIDATION_ORDER,
} from "@/shared/harthmere/ch1_fragment_ledger";

describe("ch1 cutscenes - validity", () => {
  it("every authored scene validates", () => {
    for (const [id, factory] of CH1_SCENE_FACTORIES) {
      const def = factory();
      const result = validateCutsceneDef(def);
      assert.ok(
        result.ok,
        `${id} failed validation: ${
          result.ok
            ? ""
            : result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")
        }`
      );
    }
  });

  it("scene ids are unique and match their registry key", () => {
    for (const [id, factory] of CH1_SCENE_FACTORIES) {
      assert.equal(
        factory().id,
        id,
        `registry key ${id} disagrees with def id`
      );
    }
    const ids = ch1AllScenes().map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("no scene can hang: every shot is finitely bounded", () => {
    for (const scene of ch1AllScenes()) {
      for (const shot of scene.shots) {
        assert.ok(shot.duration > 0, `${scene.id}/${shot.id} has no duration`);
        if (shot.until) {
          assert.ok(
            shot.until.maxDuration >= shot.duration,
            `${scene.id}/${shot.id}: maxDuration must cap duration`
          );
        }
      }
    }
  });

  it("every scene remains skippable for accessibility", () => {
    for (const scene of ch1AllScenes()) {
      assert.ok(
        scene.settings.skipAfterSeconds <= 10,
        `${scene.id}: a player must always be able to skip within 10s`
      );
    }
  });

  it("stages every player-POV flashback before sampling its first camera", () => {
    for (const id of [
      CH1_SCENE_IDS.overlayIveGotYou,
      CH1_SCENE_IDS.reconCorridor,
      `${CH1_SCENE_IDS.reconCorridor}-revised`,
      CH1_SCENE_IDS.reconIntake,
    ]) {
      const scene = CH1_SCENE_FACTORIES.get(id)?.();
      assert.ok(scene, `${id}: missing scene`);
      const teleport = scene.shots[0].actions.find(
        (action) => action.kind === "teleport" && action.role === "player"
      );
      assert.ok(teleport?.kind === "teleport", `${id}: player is not staged`);
      assert.deepStrictEqual(teleport.to, CH1_MEMORY_STAGE, id);
    }
  });
});

// ---------------------------------------------------------------------------
// THE REVISION PROMISE
// ---------------------------------------------------------------------------

describe("ch1 cutscenes - the revision promise", () => {
  // Journal §10.1, rule 2: "A revised Reconstruction may only re-render what
  // was already on screen. It may not add a shot, a line, or an angle."
  //
  // If this test fails, we have cheated the player.

  const original = ch1CorridorCutscene({ revised: false });
  const revised = ch1CorridorCutscene({ revised: true });

  it("has an identical shot list", () => {
    assert.equal(
      revised.shots.length,
      original.shots.length,
      "the revision must not add or remove a shot"
    );
    assert.deepEqual(
      revised.shots.map((s) => s.id),
      original.shots.map((s) => s.id),
      "shot ids must be identical"
    );
  });

  it("has identical timing", () => {
    for (const [i, shot] of original.shots.entries()) {
      assert.equal(
        revised.shots[i].duration,
        shot.duration,
        `${shot.id}: duration changed between renderings`
      );
      assert.deepEqual(
        revised.shots[i].until,
        shot.until,
        `${shot.id}: until condition changed`
      );
      assert.equal(
        revised.shots[i].transitionIn,
        shot.transitionIn,
        `${shot.id}: transition changed`
      );
      assert.equal(revised.shots[i].blendSeconds, shot.blendSeconds);
    }
  });

  it("has identical camera work — not one new angle", () => {
    for (const [i, shot] of original.shots.entries()) {
      assert.deepEqual(
        revised.shots[i].camera,
        shot.camera,
        `${shot.id}: the camera moved between renderings. This is the exact ` +
          `thing the fair-play contract forbids.`
      );
    }
  });

  it("has the same number of beats in the same order", () => {
    for (const [i, shot] of original.shots.entries()) {
      const a = shot.actions.map((x) => `${x.kind}@${x.at}`);
      const b = revised.shots[i].actions.map((x) => `${x.kind}@${x.at}`);
      assert.deepEqual(
        b,
        a,
        `${shot.id}: action kinds/timings changed between renderings`
      );
    }
  });

  it("changes only who the woman is and what she is holding", () => {
    const originalWoman = original.cast.find((c) => c.role === "woman");
    const revisedWoman = revised.cast.find((c) => c.role === "woman");
    assert.ok(originalWoman && revisedWoman);
    assert.equal(originalWoman.binding.kind, "ghost");
    assert.equal(revisedWoman.binding.kind, "ghost");
    // Same staging position: she stood exactly where she stood.
    if (
      originalWoman.binding.kind === "ghost" &&
      revisedWoman.binding.kind === "ghost"
    ) {
      assert.deepEqual(
        revisedWoman.binding.spawnAt,
        originalWoman.binding.spawnAt,
        "the woman must occupy the same position in both renderings"
      );
    }
  });

  it("the revised rendering commits nothing (the Act 3 recovery already happened)", () => {
    assert.equal(original.onEnd.commits.length, 1);
    assert.equal(revised.onEnd.commits.length, 0);
  });

  it("names Ardan only in the revised rendering", () => {
    const text = (def: typeof original) =>
      def.shots
        .flatMap((s) => s.actions)
        .filter((a) => a.kind === "dialogue")
        .map(
          (a) =>
            `${(a as { speaker?: string }).speaker ?? ""} ${
              (a as { text: string }).text
            }`
        )
        .join(" ")
        .toLowerCase();
    assert.ok(!text(original).includes("ardan"), "Act 3 must not name him");
    assert.ok(text(revised).includes("ardan"), "Act 6 must name him");
    assert.ok(!text(original).includes("jackie"), "Act 3 must not name her");
    assert.ok(text(revised).includes("jackie"), "Act 6 must name her");
  });
});

// ---------------------------------------------------------------------------

describe("ch1 cutscenes - the consolidation sequence", () => {
  const def = ch1ConsolidationRevisionCutscene();

  it("revises all six ledger entries in order", () => {
    const revisionShots = def.shots.filter((s) => s.id.startsWith("revision-"));
    assert.equal(revisionShots.length, CH1_CONSOLIDATION_ORDER.length);
    for (const [i, fragmentId] of CH1_CONSOLIDATION_ORDER.entries()) {
      assert.ok(
        revisionShots[i].id.endsWith(fragmentId),
        `revision ${i} should be ${fragmentId}`
      );
      assert.equal(revisionShots[i].duration, CH1_CONSOLIDATION_ENTRY_SECONDS);
    }
  });

  it("accepts no input during the revisions", () => {
    for (const shot of def.shots.filter((s) => s.id.startsWith("revision-"))) {
      assert.equal(
        shot.until,
        undefined,
        "revision shots must not wait on player input"
      );
    }
    assert.equal(def.settings.skippable, false);
  });

  it("renames the Card and applies consolidation on completion", () => {
    const hooks = def.onEnd.commits.map((c) => c.hook);
    assert.ok(hooks.includes("ch1.applyConsolidation"));
    const customHooks = def.shots
      .flatMap((s) => s.actions)
      .filter((a) => a.kind === "custom")
      .map((a) => (a as { hook: string }).hook);
    assert.ok(customHooks.includes("ch1.renameCard"));
    assert.ok(customHooks.includes("ch1.reviseLedgerEntry"));
  });

  it("is bounded", () => {
    const total = def.shots.reduce((n, s) => n + s.duration, 0);
    assert.ok(total < def.settings.maxSceneDurationSeconds);
    assert.ok(total > 20 && total < 90, `sequence is ${total}s`);
  });
});

// ---------------------------------------------------------------------------

describe("ch1 cutscenes - the ignition", () => {
  it("fires the player's own voice out of the robot", () => {
    const def = ch1IgnitionCutscene();
    assert.equal(def.id, CH1_SCENE_IDS.ignition);
    const lines = def.shots
      .flatMap((s) => s.actions)
      .filter((a) => a.kind === "dialogue")
      .map((a) => (a as { text: string }).text);
    assert.ok(lines.some((l) => l.includes("custodian recognized")));
    assert.ok(
      lines.some((l) => l.includes("I was right")),
      "the chapter starts on the player's own recorded voice"
    );
  });

  it("opens the ledger", () => {
    const hooks = ch1IgnitionCutscene().onEnd.commits.map((c) => c.hook);
    assert.ok(hooks.includes("ch1.begin"));
    assert.ok(hooks.includes("ch1.unlockLedger"));
  });
});
