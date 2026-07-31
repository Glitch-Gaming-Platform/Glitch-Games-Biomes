import {
  HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID,
  harthmereMovementActionShowcaseCutscene,
} from "@/shared/cutscene/movement_action_showcase";
import { PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES } from "@/shared/game/movement_actions";
import assert from "assert";

describe("Harthmere movement-action cutscene showcase", () => {
  it("renders every desktop dodge/evade animation through a mutation-free client puppet", () => {
    const scene = harthmereMovementActionShowcaseCutscene();
    assert.equal(scene.id, HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID);
    assert.equal(scene.settings.mode, "clientPuppet");
    assert.deepEqual(scene.settings.commitOn, []);
    assert.deepEqual(scene.onEnd, { placements: [], commits: [] });
    assert.equal(
      scene.shots.length,
      PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.length
    );

    const rendered = scene.shots.flatMap((shot) =>
      shot.actions.flatMap((action) =>
        action.kind === "emote" ? [action.emote] : []
      )
    );
    assert.deepEqual(rendered, [...PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES]);
    for (const shot of scene.shots) {
      assert.ok(shot.actions.some((action) => action.kind === "face"));
      assert.ok(shot.actions.some((action) => action.kind === "teleport"));
    }
  });
});
