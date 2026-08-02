/// <reference types="mocha" />

import type { ResolvedActor } from "@/shared/cutscene/binding";
import {
  HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS,
  HARTHMERE_CINEMATIC_EXPRESSION_CLIPS,
  HARTHMERE_CINEMATIC_EXPRESSIONS,
  harthmereCinematicExpressionPlaybackTransition,
  harthmereCinematicExpressionSpec,
  parseHarthmereCinematicExpression,
} from "@/shared/cutscene/cinematic_expressions";
import {
  cutsceneExpressionSequence,
  pairedCutsceneExpressionActions,
} from "@/shared/cutscene/expression_actions";
import {
  HARTHMERE_EXPRESSION_SHOWCASE_CAMERA_ROLE,
  harthmereExpressionShowcaseCutscene,
} from "@/shared/cutscene/expression_showcase";
import { createCutsceneRuntime } from "@/shared/cutscene/director_core";
import { validateCutsceneDef } from "@/shared/cutscene/schema";
import { zEmoteType } from "@/shared/ecs/gen/types";
import { HARTHMERE_FACIAL_EXPRESSIONS } from "@/shared/harthmere/voxel_faces";
import assert from "assert";

describe("Harthmere cinematic gameplay expressions", () => {
  it("keeps one canonical catalog for ECS, animation, face, and chat parsing", () => {
    assert.strictEqual(HARTHMERE_CINEMATIC_EXPRESSIONS.length, 71);
    assert.strictEqual(HARTHMERE_CINEMATIC_EXPRESSION_CLIPS.length, 70);

    for (const expression of HARTHMERE_CINEMATIC_EXPRESSIONS) {
      const spec = harthmereCinematicExpressionSpec(expression);
      assert.ok(spec.clip.startsWith("Cinematic"));
      assert.ok(spec.durationSeconds > 0);
      assert.ok(spec.fallbacks.length > 0);
      assert.ok(zEmoteType.safeParse(expression).success, expression);
      assert.ok(HARTHMERE_FACIAL_EXPRESSIONS.includes(spec.face), spec.face);
      assert.strictEqual(
        HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS[expression].fileAnimationName,
        spec.clip
      );
    }

    assert.strictEqual(
      parseHarthmereCinematicExpression("HIGH-FIVE"),
      "highFive"
    );
    assert.strictEqual(
      parseHarthmereCinematicExpression("thumbs_up"),
      "thumbsUp"
    );
    assert.strictEqual(
      parseHarthmereCinematicExpression("come here"),
      "comeHere"
    );
    assert.strictEqual(
      parseHarthmereCinematicExpression("not-an-emote"),
      undefined
    );
  });

  it("orders expression cues and rejects ambiguous same-actor timestamps", () => {
    const actions = cutsceneExpressionSequence([
      { role: "b", expression: "surprise", at: 1 },
      { role: "a", expression: "thinking", at: 0.5 },
      { role: "a", expression: "relief", at: 2 },
    ]);
    assert.deepStrictEqual(
      actions
        .filter((action) => action.kind === "emote")
        .map((action) => action.emote),
      ["thinking", "surprise", "relief"]
    );
    assert.throws(
      () =>
        cutsceneExpressionSequence([
          { role: "a", expression: "thinking", at: 1 },
          { role: "a", expression: "confusion", at: 1 },
        ]),
      /two expressions/
    );
  });

  it("detects face starts, ends, and same-expression timeline restarts", () => {
    const first = harthmereCinematicExpressionPlaybackTransition(
      undefined,
      "crying",
      0
    );
    assert.strictEqual(first.started, true);
    assert.strictEqual(first.ended, false);

    const continued = harthmereCinematicExpressionPlaybackTransition(
      first,
      "crying",
      0.5
    );
    assert.strictEqual(continued.started, false);
    assert.strictEqual(continued.ended, false);

    const restarted = harthmereCinematicExpressionPlaybackTransition(
      continued,
      "crying",
      0
    );
    assert.strictEqual(restarted.started, true);

    const replaced = harthmereCinematicExpressionPlaybackTransition(
      restarted,
      "relief",
      Number.NaN
    );
    assert.strictEqual(replaced.expression, "relief");
    assert.strictEqual(replaced.time, 0);
    assert.strictEqual(replaced.started, true);
    assert.strictEqual(replaced.ended, false);

    const ended = harthmereCinematicExpressionPlaybackTransition(
      replaced,
      "idle",
      1
    );
    assert.strictEqual(ended.expression, undefined);
    assert.strictEqual(ended.started, false);
    assert.strictEqual(ended.ended, true);
  });

  it("stages paired gestures without making both actors chase each other", () => {
    const actions = pairedCutsceneExpressionActions({
      firstRole: "left",
      secondRole: "right",
      expression: "handshake",
      at: 2,
      approach: true,
    });
    assert.strictEqual(
      actions.filter((action) => action.kind === "moveTo").length,
      1
    );
    assert.strictEqual(
      actions.filter((action) => action.kind === "face").length,
      2
    );
    assert.strictEqual(
      actions.filter((action) => action.kind === "emote").length,
      2
    );
    assert.throws(
      () =>
        pairedCutsceneExpressionActions({
          firstRole: "same",
          secondRole: "same",
          expression: "hug",
          at: 0,
        }),
      /different roles/
    );
  });

  it("generates a valid preview scene and runs every expression through the runtime", () => {
    const def = harthmereExpressionShowcaseCutscene();
    const validation = validateCutsceneDef(def);
    assert.ok(
      validation.ok,
      JSON.stringify(!validation.ok && validation.issues)
    );

    const authoredExpressions = new Set(
      def.shots.flatMap((shot) =>
        shot.actions.flatMap((action) =>
          action.kind === "emote" ? [action.emote] : []
        )
      )
    );
    assert.deepStrictEqual(
      [...HARTHMERE_CINEMATIC_EXPRESSIONS].filter(
        (expression) => !authoredExpressions.has(expression)
      ),
      []
    );
    assert.strictEqual(
      def.shots
        .flatMap((shot) => shot.actions)
        .filter(
          (action) =>
            action.kind === "face" &&
            !Array.isArray(action.towards) &&
            action.towards.role === HARTHMERE_EXPRESSION_SHOWCASE_CAMERA_ROLE
        ).length,
      HARTHMERE_CINEMATIC_EXPRESSIONS.filter(
        (expression) =>
          harthmereCinematicExpressionSpec(expression).interaction !== "paired"
      ).length
    );
    for (const member of def.cast) {
      if (member.binding.kind === "ghost") {
        assert.strictEqual(member.binding.asset, "snapshot/player_mesh");
      }
    }

    const actors = new Map<string, ResolvedActor>();
    def.cast.forEach((member, index) => {
      if (member.binding.kind === "ghost") {
        actors.set(member.role, {
          kind: "ghost",
          role: member.role,
          ghostId: -10_000 - index,
          asset: member.binding.asset,
          family: member.binding.family,
          spawnAt: member.binding.spawnAt!,
          height: member.binding.height,
        });
      } else if (member.binding.kind === "anchor") {
        actors.set(member.role, {
          kind: "anchor",
          role: member.role,
          position: member.binding.position,
          height: member.binding.height,
          label: member.binding.label,
        });
      } else {
        assert.fail(`Unexpected showcase binding ${member.binding.kind}`);
      }
    });

    const runtime = createCutsceneRuntime({
      def,
      actors,
      instanceNonce: "expression-test",
    });
    const emitted = new Set<string>();
    for (let step = 0; step < 5_000 && !runtime.finished; step += 1) {
      for (const effect of runtime.tick(0.05, {
        livePositionOf: (actor) =>
          actor.kind === "ghost" ? actor.spawnAt : undefined,
        liveOrientationOf: () => [0, 0],
        playerAlive: () => true,
        worldReadyAt: () => true,
        advanceRequested: () => false,
      })) {
        if (effect.kind === "actorAnimation") {
          emitted.add(effect.animation);
        }
      }
    }

    assert.ok(runtime.finished);
    assert.deepStrictEqual(
      [...HARTHMERE_CINEMATIC_EXPRESSIONS].filter(
        (expression) => !emitted.has(expression)
      ),
      []
    );
  });
});
