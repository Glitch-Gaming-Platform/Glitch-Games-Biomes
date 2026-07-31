/// <reference types="mocha" />

import assert from "assert";
import {
  chapter1CutscenePlaybackIds,
  requestChapter1CutsceneById,
} from "@/client/game/cutscene/ch1_playback";
import { publishCutscenePlayback } from "@/client/game/cutscene/playback_events";
import {
  drainCutsceneRequests,
  registerCutscene,
  resetCutsceneService,
} from "@/client/game/cutscene/cutscene_service";
import {
  CH1_CONSOLIDATION_PLAYBACK_SEQUENCE,
  CH1_SCENE_FACTORIES,
  CH1_SCENE_IDS,
} from "@/shared/cutscene/ch1_scenes";

describe("Chapter 1 cutscene playback sequences", () => {
  beforeEach(() => {
    resetCutsceneService();
    for (const id of CH1_CONSOLIDATION_PLAYBACK_SEQUENCE) {
      registerCutscene(CH1_SCENE_FACTORIES.get(id)!());
    }
  });

  afterEach(() => resetCutsceneService());

  it("plays consolidation, the revised corridor, and intake in order", () => {
    assert.deepEqual(
      chapter1CutscenePlaybackIds(CH1_SCENE_IDS.consolidationRevision),
      CH1_CONSOLIDATION_PLAYBACK_SEQUENCE
    );
    assert.equal(
      requestChapter1CutsceneById(CH1_SCENE_IDS.consolidationRevision, {
        preempt: true,
      }),
      true
    );
    for (const id of CH1_CONSOLIDATION_PLAYBACK_SEQUENCE) {
      const requests = drainCutsceneRequests();
      assert.deepEqual(
        requests.map((request) => request.def.id),
        [id]
      );
      publishCutscenePlayback({
        kind: "finished",
        defId: id,
        reason: "completed",
        atMs: 1,
      });
    }
    assert.deepEqual(drainCutsceneRequests(), []);
  });

  it("stops the remaining sequence when the player skips", () => {
    requestChapter1CutsceneById(CH1_SCENE_IDS.consolidationRevision, {
      preempt: true,
    });
    const first = drainCutsceneRequests()[0];
    publishCutscenePlayback({
      kind: "finished",
      defId: first.def.id,
      reason: "skipped",
      atMs: 1,
    });
    assert.deepEqual(drainCutsceneRequests(), []);
  });
});
