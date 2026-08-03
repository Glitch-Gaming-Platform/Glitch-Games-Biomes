import assert from "assert";
import {
  HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS,
  HARTHMERE_NPC_TALK_FALLBACK_RADIUS,
  harthmereNpcTalkCandidatePassesInspectDepthForTest,
  harthmereNpcTalkCandidateScoreForTest,
} from "../overlays";
import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import { CH1_TESTIMONY_NPC_SEEDS } from "@/shared/harthmere/ch1_testimony_npcs";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveGroundedPosition,
} from "@/shared/harthmere/snapshot_grove_content";

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

function assertAimedActorOwnsTalk(
  actors: Readonly<Record<string, readonly [number, number, number]>>
) {
  const offsets = [
    [1.75, 1.75],
    [1.75, 0],
    [-1.75, 0],
    [0, 1.75],
    [0, -1.75],
    [-1.75, -1.75],
  ] as const;

  for (const [targetName, target] of Object.entries(actors)) {
    for (const offset of offsets) {
      const player: TestVec3 = [
        target[0] + offset[0],
        target[1],
        target[2] + offset[1],
      ];
      const facing: TestVec3 = [
        target[0] - player[0],
        0,
        target[2] - player[2],
      ];
      const targetScore = harthmereNpcTalkCandidateScoreForTest({
        playerPosition: player,
        facingView: facing,
        npcPosition: target,
      });
      assertTalkable(targetScore);
      for (const [otherName, other] of Object.entries(actors)) {
        if (otherName === targetName) continue;
        const otherScore = harthmereNpcTalkCandidateScoreForTest({
          playerPosition: player,
          facingView: facing,
          npcPosition: other,
        });
        assert.ok(
          otherScore === undefined || targetScore! < otherScore,
          `${targetName} should own Talk ahead of ${otherName} from ${offset}`
        );
      }
    }
  }
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
      score([HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS - 0.25, 70, -0.1])
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

  it("lets only a projected NPC at the aimed terrain depth recover Talk", () => {
    assert.equal(
      harthmereNpcTalkCandidatePassesInspectDepthForTest({
        playerPosition: PLAYER_POSITION,
        npcPosition: [0, 70, -2.5],
        maxDistance: 3,
        projectedOnly: true,
        projected: true,
      }),
      true
    );
    assert.equal(
      harthmereNpcTalkCandidatePassesInspectDepthForTest({
        playerPosition: PLAYER_POSITION,
        npcPosition: [0, 70, -3.01],
        maxDistance: 3,
        projectedOnly: true,
        projected: true,
      }),
      false
    );
    assert.equal(
      harthmereNpcTalkCandidatePassesInspectDepthForTest({
        playerPosition: PLAYER_POSITION,
        npcPosition: [0, 70, -2.5],
        maxDistance: 3,
        projectedOnly: true,
        projected: false,
      }),
      false
    );
  });

  it("keeps the aimed watch-house actor ahead of the other staged NPCs", () => {
    assertAimedActorOwnsTalk({
      holt: CH1_ANCHORS.grove_watch_house_holt_post,
      teak: CH1_ANCHORS.grove_watch_house_teak_post,
      jackie: CH1_ANCHORS.grove_watch_house_jackie_post,
    });
  });

  it("keeps Greenlamp and Returnstone story actors on deterministic Talk posts", () => {
    assertAimedActorOwnsTalk({
      lou: CH1_ANCHORS.greenlamp_lou_post,
      nadia: CH1_ANCHORS.greenlamp_nadia_post,
    });
    assertAimedActorOwnsTalk({
      cressa: CH1_ANCHORS.returnstone_cressa_post,
      lou: CH1_ANCHORS.returnstone_lou_post,
    });
  });

  it("keeps Jackie and Rook independently talkable at the Old Wood aperture", () => {
    assertAimedActorOwnsTalk({
      jackie: CH1_ANCHORS.gate_desert_jackie_post,
      rook: CH1_ANCHORS.gate_desert_rook_post,
    });
  });

  it("keeps rescued Lovely Locks actors outside resident Talk overlap", () => {
    const emily = CH1_TESTIMONY_NPC_SEEDS.find(
      (npc) => npc.displayName === "Emily"
    )!.position;
    const alexis = snapshotGroveGroundedPosition(
      SNAPSHOT_GROVE_NPCS.find((npc) => npc.displayName === "Alexis")!
        .authoredPosition
    );
    for (const actor of [
      CH1_ANCHORS.lovely_locks_iris_post,
      CH1_ANCHORS.lovely_locks_marrow_post,
    ]) {
      for (const resident of [emily, alexis]) {
        assert.ok(
          Math.hypot(actor[0] - resident[0], actor[2] - resident[2]) >
            HARTHMERE_NPC_TALK_FALLBACK_RADIUS * 2
        );
      }
    }
    assertAimedActorOwnsTalk({
      iris: CH1_ANCHORS.lovely_locks_iris_post,
      marrow: CH1_ANCHORS.lovely_locks_marrow_post,
    });
  });
});
