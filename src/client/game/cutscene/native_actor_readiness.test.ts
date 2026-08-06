/// <reference types="mocha" />
import assert from "assert";
import {
  markNativeCutsceneActorFailed,
  markNativeCutsceneActorLoaded,
  markNativeCutsceneActorLoading,
  nativeCutsceneActorReadiness,
  resetNativeCutsceneActorReadinessForTest,
  waitForNativeCutsceneActors,
} from "@/client/game/cutscene/native_actor_readiness";

describe("native cutscene actor readiness", () => {
  beforeEach(() => resetNativeCutsceneActorReadinessForTest());

  it("waits for every required synthetic actor to load", async () => {
    markNativeCutsceneActorLoading({ id: -1, asset: "boss-a.glb", label: "A" });
    markNativeCutsceneActorLoading({ id: -2, asset: "boss-b.glb", label: "B" });
    const waiting = waitForNativeCutsceneActors([-1, -2], 1_000);
    markNativeCutsceneActorLoaded(-1);
    markNativeCutsceneActorLoaded(-2);
    await waiting;
    assert.equal(nativeCutsceneActorReadiness(-1)?.state, "loaded");
  });

  it("fails capture readiness when the renderer reports an actor load error", async () => {
    markNativeCutsceneActorLoading({
      id: -3,
      asset: "missing.glb",
      label: "Missing Boss",
    });
    markNativeCutsceneActorFailed(-3, new Error("HTTP 404"));
    await assert.rejects(
      waitForNativeCutsceneActors([-3], 1_000),
      /Missing Boss.*HTTP 404/
    );
  });

  it("times out when the renderer never observes the staged actor", async () => {
    await assert.rejects(
      waitForNativeCutsceneActors([-4], 5),
      /-4:not-observed-by-renderer/
    );
  });
});
