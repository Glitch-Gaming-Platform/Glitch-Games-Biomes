import {
  HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID,
  harthmereMovementActionShowcaseCutscene,
} from "@/shared/cutscene/movement_action_showcase";
import { PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES } from "@/shared/game/movement_actions";
import assert from "assert";

describe("Harthmere movement-action cutscene showcase", () => {
  it("renders every dodge, evade, and double-jump animation through a mutation-free client puppet", () => {
    const scene = harthmereMovementActionShowcaseCutscene();
    assert.equal(scene.id, HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID);
    assert.equal(scene.settings.mode, "clientPuppet");
    assert.deepEqual(scene.settings.commitOn, []);
    assert.deepEqual(scene.onEnd, { placements: [], commits: [] });
    assert.equal(
      scene.shots.length,
      PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.length + 1
    );

    const rendered = scene.shots
      .slice(0, PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.length)
      .flatMap((shot) =>
        shot.actions.flatMap((action) =>
          action.kind === "emote" ? [action.emote] : []
        )
      );
    assert.deepEqual(rendered, [...PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES]);
    const evadeAttack = scene.shots.at(-1)!;
    assert.equal(evadeAttack.id, "movement-action-evade-attack");
    assert.deepEqual(
      evadeAttack.actions.flatMap((action) =>
        action.kind === "emote" ? [[action.at, action.emote]] : []
      ),
      [
        [0.3, "evade"],
        [0.9, "attack1"],
      ],
      "attack starts exactly 0.60s after evade, at the recovery cancel window"
    );
    const subject = scene.cast.find(
      ({ role }) => role === "movement-action-subject"
    );
    assert.equal(
      subject?.binding.kind,
      "player",
      "the showcase must render the authenticated player's loaded mesh"
    );
    for (const shot of scene.shots) {
      assert.ok(
        shot.actions.some(
          (action) => action.kind === "emote" && action.at === 0.3
        ),
        `${shot.id} must leave a readable neutral lead-in before the action`
      );
      assert.ok(
        !shot.actions.some((action) => action.kind === "teleport"),
        `${shot.id} must not move the authoritative player`
      );
      assert.equal(shot.camera.kind, "trackRole");
      if (shot.camera.kind === "trackRole") {
        assert.equal(shot.camera.role, "movement-action-subject");
        assert.deepEqual(shot.camera.offset, [3.5, 1.85, 6.5]);
      }
    }
  });
});
