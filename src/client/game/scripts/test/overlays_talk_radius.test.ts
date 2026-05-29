import assert from "assert";
import {
  HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS_V140,
  HARTHMERE_NPC_TALK_FALLBACK_RADIUS_V140,
  harthmereNpcTalkCandidateScoreForTest,
} from "../overlays";

describe("Harthmere NPC talk fallback radius", () => {
  it("keeps a moving NPC talkable inside the fallback radius without requiring an exact ray hit", () => {
    const playerPosition: [number, number, number] = [0, 70, 0];
    const cameraView: [number, number, number] = [0, 0, -1];

    const farScore = harthmereNpcTalkCandidateScoreForTest({
      playerPosition,
      cameraView,
      npcPosition: [0, 70, -HARTHMERE_NPC_TALK_FALLBACK_RADIUS_V140 - 0.1],
    });
    const movingNearScore = harthmereNpcTalkCandidateScoreForTest({
      playerPosition,
      cameraView,
      npcPosition: [2.8, 70, -5.4],
    });

    assert.equal(farScore, undefined);
    assert.equal(typeof movingNearScore, "number");
  });

  it("allows very close side-angle conversations but rejects distant NPCs behind the player", () => {
    const playerPosition: [number, number, number] = [0, 70, 0];
    const cameraView: [number, number, number] = [0, 0, -1];

    const closeSideScore = harthmereNpcTalkCandidateScoreForTest({
      playerPosition,
      cameraView,
      npcPosition: [HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS_V140 - 0.25, 70, 0.1],
    });
    const behindScore = harthmereNpcTalkCandidateScoreForTest({
      playerPosition,
      cameraView,
      npcPosition: [0, 70, 5],
    });

    assert.equal(typeof closeSideScore, "number");
    assert.equal(behindScore, undefined);
  });

  it("scores the centered nearby NPC ahead of a farther side candidate", () => {
    const playerPosition: [number, number, number] = [0, 70, 0];
    const cameraView: [number, number, number] = [0, 0, -1];
    const centered = harthmereNpcTalkCandidateScoreForTest({
      playerPosition,
      cameraView,
      npcPosition: [0, 70, -3],
    });
    const side = harthmereNpcTalkCandidateScoreForTest({
      playerPosition,
      cameraView,
      npcPosition: [4, 70, -3],
    });

    assert.equal(typeof centered, "number");
    assert.equal(typeof side, "number");
    assert.ok(centered! < side!);
  });
});
