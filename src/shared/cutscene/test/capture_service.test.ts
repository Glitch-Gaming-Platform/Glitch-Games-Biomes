import {
  deliverCutsceneCapture,
  failCutsceneCapture,
  requestCutsceneScreenshot,
} from "@/client/game/cutscene/capture_service";
import { cutsceneVideoOutputSize } from "@/client/game/cutscene/video_capture_service";
import {
  drainCutsceneRequests,
  resetCutsceneService,
  runCutsceneCommitOnce,
} from "@/client/game/cutscene/cutscene_service";
import assert from "assert";

describe("cutscene capture service", () => {
  afterEach(() => resetCutsceneService());

  it("sanitizes promotional captures into client-only, non-committing scenes", async () => {
    const promise = requestCutsceneScreenshot(
      {
        id: "promo",
        name: "Promo",
        settings: { mode: "serverShared" },
        cast: [{ role: "player", binding: { kind: "player" } }],
        shots: [
          {
            id: "hero",
            duration: 2,
            camera: {
              kind: "static",
              position: [0, 4, 8],
              orientation: [0, 0],
            },
          },
        ],
        onEnd: {
          placements: [{ role: "player", position: [99, 99, 99] }],
          commits: [{ hook: "grant.reward" }],
        },
      },
      {
        shotId: "hero",
        at: 1,
        width: 2048,
        height: 2048,
        settleFrames: 5,
      }
    );
    const requests = drainCutsceneRequests();
    assert.strictEqual(requests.length, 1);
    const def = requests[0].def;
    assert.strictEqual(def.settings.mode, "clientPuppet");
    assert.deepStrictEqual(def.settings.commitOn, []);
    assert.deepStrictEqual(def.onEnd.placements, []);
    assert.deepStrictEqual(def.onEnd.commits, []);
    const capture = def.shots[0].actions.find(
      (action) => action.kind === "capture"
    );
    assert.ok(capture?.kind === "capture");
    assert.strictEqual(capture.width, 2048);
    assert.strictEqual(capture.height, 2048);
    assert.strictEqual(capture.settleFrames, 5);
    failCutsceneCapture(capture.captureId, "test complete");
    await assert.rejects(promise, /test complete/);
  });

  it("marks commit tokens only after successful work", async () => {
    await assert.rejects(
      runCutsceneCommitOnce("retryable", async () => {
        throw new Error("transient");
      }),
      /transient/
    );
    assert.strictEqual(
      await runCutsceneCommitOnce("retryable", async () => {}),
      true
    );
    assert.strictEqual(
      await runCutsceneCommitOnce("retryable", async () => {
        throw new Error("must not run");
      }),
      false
    );
  });

  it("reports the source definition id instead of the generated sandbox id", async () => {
    const promise = requestCutsceneScreenshot({
      id: "source-scene",
      name: "Source Scene",
      cast: [{ role: "player", binding: { kind: "player" } }],
      shots: [
        {
          id: "hero",
          duration: 1,
          camera: {
            kind: "static",
            position: [0, 2, 4],
            orientation: [0, 0],
          },
        },
      ],
    });
    const [request] = drainCutsceneRequests();
    const capture = request.def.shots[0].actions.find(
      (action) => action.kind === "capture"
    );
    assert.ok(capture?.kind === "capture");
    deliverCutsceneCapture({
      captureId: capture.captureId,
      defId: request.def.id,
      width: capture.width,
      height: capture.height,
      format: capture.format,
      filename: "source.png",
      dataUri: "data:image/png;base64,AA==",
      cameraPosition: [0, 2, 4],
      cameraOrientation: [0, 0],
      capturedAt: 1,
    });
    assert.strictEqual((await promise).defId, "source-scene");
  });

  it("preserves the unique capture suffix for maximum-length scene ids", async () => {
    const sourceId = "s".repeat(128);
    const makeRequest = () =>
      requestCutsceneScreenshot({
        id: sourceId,
        name: "Long ID",
        cast: [{ role: "player", binding: { kind: "player" } }],
        shots: [
          {
            id: "hero",
            duration: 1,
            camera: {
              kind: "static",
              position: [0, 2, 4],
              orientation: [0, 0],
            },
          },
        ],
      });
    const first = makeRequest();
    const second = makeRequest();
    const requests = drainCutsceneRequests();
    assert.strictEqual(requests.length, 2);
    assert.notStrictEqual(requests[0].def.id, requests[1].def.id);
    assert.ok(requests.every((request) => request.def.id.length <= 128));
    for (const request of requests) {
      const capture = request.def.shots[0].actions.find(
        (action) => action.kind === "capture"
      );
      assert.ok(capture?.kind === "capture");
      failCutsceneCapture(capture.captureId, "test complete");
    }
    await assert.rejects(first, /test complete/);
    await assert.rejects(second, /test complete/);
  });

  it("rejects non-finite capture timeouts instead of scheduling immediately", async () => {
    await assert.rejects(
      requestCutsceneScreenshot(
        {
          id: "bad-timeout",
          name: "Bad Timeout",
          cast: [{ role: "player", binding: { kind: "player" } }],
          shots: [
            {
              id: "hero",
              duration: 1,
              camera: {
                kind: "static",
                position: [0, 2, 4],
                orientation: [0, 0],
              },
            },
          ],
        },
        { timeoutMs: Number.POSITIVE_INFINITY }
      ),
      /finite positive/
    );
    assert.strictEqual(drainCutsceneRequests().length, 0);
  });
});

describe("cutscene video capture sizing", () => {
  it("uses displayed resolution instead of a low-scale WebGL backing store", () => {
    assert.deepStrictEqual(
      cutsceneVideoOutputSize({
        width: 360,
        height: 225,
        clientWidth: 1440,
        clientHeight: 900,
      }),
      { width: 1280, height: 800 }
    );
  });

  it("always returns codec-safe even dimensions", () => {
    assert.deepStrictEqual(
      cutsceneVideoOutputSize({
        width: 853,
        height: 479,
        clientWidth: 0,
        clientHeight: 0,
      }),
      { width: 854, height: 480 }
    );
  });
});
