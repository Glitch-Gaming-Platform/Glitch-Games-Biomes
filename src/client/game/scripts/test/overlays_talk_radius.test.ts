import assert from "assert";
import {
  HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS,
  HARTHMERE_NPC_TALK_FALLBACK_RADIUS,
  harthmereNpcTalkCandidateScoreForTest,
} from "../overlays";

type TestVec3 = [number, number, number];

const PLAYER_POSITION: TestVec3 = [0, 70, 0];
const FACING_FORWARD: TestVec3 = [0, 0, -1];

function score(
  npcPosition: TestVec3,
  options: {
    facingView?: TestVec3;
    radius?: number;
    closeRadius?: number;
    minViewDot?: number;
  } = {}
) {
  return harthmereNpcTalkCandidateScoreForTest({
    playerPosition: PLAYER_POSITION,
    facingView: options.facingView ?? FACING_FORWARD,
    npcPosition,
    radius: options.radius,
    closeRadius: options.closeRadius,
    minViewDot: options.minViewDot,
  });
}

function assertTalkable(value: number | undefined) {
  assert.equal(typeof value, "number");
  assert.ok(Number.isFinite(value));
}

describe("Harthmere NPC talk fallback radius", () => {
  it("keeps nearby front-facing NPCs talkable without requiring an exact ray hit", () => {
    assertTalkable(score([0, 70, -3]));
    // Front-facing, side-angled, and within the tightened 4.5m talk radius.
    assertTalkable(score([2.0, 70, -3.5]));
    assertTalkable(score([0, 70, 0]));
  });

  it("enforces the fallback radius inclusively at the edge", () => {
    assertTalkable(score([0, 70, -HARTHMERE_NPC_TALK_FALLBACK_RADIUS]));
    assert.equal(
      score([0, 70, -HARTHMERE_NPC_TALK_FALLBACK_RADIUS - 0.001]),
      undefined
    );
  });

  it("allows very close side-angle conversations while the NPC remains in the front half-plane", () => {
    assertTalkable(
      score([
        HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS - 0.25,
        70,
        -0.1,
      ])
    );
    assertTalkable(
      score([HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS - 0.25, 70, 0])
    );
  });

  it("rejects close, far, direct, and side-angle NPCs behind the player", () => {
    assert.equal(score([0, 70, 1]), undefined);
    assert.equal(score([0, 70, 5]), undefined);
    assert.equal(
      score([HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS - 0.25, 70, 0.01]),
      undefined
    );
    assert.equal(score([3, 70, 0.5]), undefined);
  });

  it("scores the centered nearby NPC ahead of a farther side candidate", () => {
    const centered = score([0, 70, -3]);
    const side = score([3, 70, -3]);

    assertTalkable(centered);
    assertTalkable(side);
    assert.ok(centered! < side!);
  });

  it("honors stricter front-cone thresholds without making close side interactions fail", () => {
    assertTalkable(
      score([HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS - 0.25, 70, 0], {
        minViewDot: 0.75,
      })
    );
    assert.equal(score([3, 70, -2], { minViewDot: 0.9 }), undefined);
    assert.equal(score([0, 70, 1], { minViewDot: -0.25 }), undefined);
  });

  it("rejects invalid positions and missing horizontal facing vectors", () => {
    assert.equal(score([Number.NaN, 70, -1]), undefined);
    assert.equal(score([0, 70, -1], { facingView: [0, 1, 0] }), undefined);
    assert.equal(
      score([0, 70, -1], { facingView: [Number.NaN, 0, 0] }),
      undefined
    );
  });
});
