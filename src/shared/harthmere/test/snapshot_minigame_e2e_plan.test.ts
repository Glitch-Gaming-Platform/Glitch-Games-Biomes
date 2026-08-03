import {
  SNAPSHOT_MINIGAME_E2E_PLAN,
  snapshotMinigameE2EPlanForKinds,
} from "@/shared/harthmere/snapshot_minigame_e2e_plan";
import assert from "assert";

describe("snapshot minigame live E2E plan", () => {
  it("covers every original non-fishing game exactly once", () => {
    assert.equal(SNAPSHOT_MINIGAME_E2E_PLAN.length, 74);
    assert.equal(
      new Set(SNAPSHOT_MINIGAME_E2E_PLAN.map((row) => row.id)).size,
      74
    );
    assert.deepEqual(
      Object.fromEntries(
        ["simple_race", "spleef", "deathmatch"].map((kind) => [
          kind,
          SNAPSHOT_MINIGAME_E2E_PLAN.filter((row) => row.kind === kind).length,
        ])
      ),
      { simple_race: 47, spleef: 19, deathmatch: 8 }
    );
  });

  it("keeps every race on the full finish and physical-leaderboard path", () => {
    const races = snapshotMinigameE2EPlanForKinds(new Set(["simple_race"]));
    assert.equal(races.length, 47);
    assert.ok(
      races.every(
        (row) =>
          row.renderedBrowserSessions === 1 &&
          row.requiredParticipants === 1 &&
          row.phases.includes("race_start") &&
          row.phases.includes("race_checkpoints") &&
          row.phases.includes("race_finish") &&
          row.phases.includes("physical_leaderboard")
      )
    );
    assert.equal(races.filter((row) => row.questBound).length, 7);
    assert.ok(
      races
        .filter((row) => row.questBound)
        .every((row) => row.phases.includes("quest_finish_event"))
    );
  });

  it("renders two multiplayer sessions and preserves the historical 3-player arena", () => {
    const multiplayer = snapshotMinigameE2EPlanForKinds(
      new Set(["spleef", "deathmatch"])
    );
    assert.equal(multiplayer.length, 27);
    assert.ok(
      multiplayer.every(
        (row) =>
          row.renderedBrowserSessions === 2 &&
          row.phases.includes("multiplayer_join") &&
          row.phases.includes("round_playing") &&
          row.phases.includes("round_finish")
      )
    );
    const threePlayer = multiplayer.filter(
      (row) => row.requiredParticipants === 3
    );
    assert.deepEqual(
      threePlayer.map((row) => row.id),
      [5091744724459687]
    );
    assert.equal(threePlayer[0].additionalBrowserSessions, 1);
  });
});
