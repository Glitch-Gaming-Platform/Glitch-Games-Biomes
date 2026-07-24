// HARTHMERE_CUTSCENE_VIDEO_CAPTURE
//
// Records the actual game canvas while the normal director plays a registered
// cutscene. Browsers reliably emit WebM; the checked-in FFmpeg helper converts
// that file to H.264 MP4 for distribution without introducing another renderer.

import type { AudioManager } from "@/client/game/context_managers/audio_manager";
import { getActiveRendererController } from "@/client/game/renderers/capture_bridge";
import type { ClientResources } from "@/client/game/resources/types";
import {
  cutsceneLibrary,
  requestCutsceneById,
} from "@/client/game/cutscene/cutscene_service";
import {
  subscribeCutscenePlayback,
  type CutscenePlaybackEvent,
} from "@/client/game/cutscene/playback_events";
import type { CutsceneFinishReason } from "@/shared/cutscene/director_core";
import { sleep } from "@/shared/util/async";

export interface CutsceneVideoCaptureResult {
  defId: string;
  mimeType: string;
  filename: string;
  dataUri: string;
  width: number;
  height: number;
  frameRate: number;
  durationSeconds: number;
  finishReason: CutsceneFinishReason;
  hasAudio: boolean;
}

export interface CutsceneVideoCaptureOptions {
  frameRate?: number;
  videoBitsPerSecond?: number;
  filename?: string;
  preempt?: boolean;
  timeoutMs?: number;
}

function recordingMimeType(): string | undefined {
  for (const candidate of [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function gameCanvas(): HTMLCanvasElement | undefined {
  return [...document.querySelectorAll("canvas")]
    .filter((canvas) => canvas.width > 0 && canvas.height > 0)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

interface PlaybackEventWaiter<K extends CutscenePlaybackEvent["kind"]> {
  promise: Promise<Extract<CutscenePlaybackEvent, { kind: K }>>;
  cancel: () => void;
}

function waitForPlaybackEvent<K extends CutscenePlaybackEvent["kind"]>(
  defId: string,
  kind: K,
  timeoutMs: number
): PlaybackEventWaiter<K> {
  let settled = false;
  let timeout: number | undefined;
  let unsubscribe = () => {};
  const promise = new Promise<Extract<CutscenePlaybackEvent, { kind: K }>>(
    (resolve, reject) => {
      timeout = window.setTimeout(() => {
        settled = true;
        unsubscribe();
        reject(new Error(`cutscene video timed out waiting for ${kind}`));
      }, timeoutMs);
      unsubscribe = subscribeCutscenePlayback((event) => {
        if (event.defId !== defId || event.kind !== kind) {
          return;
        }
        settled = true;
        if (timeout !== undefined) {
          window.clearTimeout(timeout);
        }
        unsubscribe();
        resolve(event as Extract<CutscenePlaybackEvent, { kind: K }>);
      });
    }
  );
  return {
    promise,
    cancel: () => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
      unsubscribe();
    },
  };
}

function blobDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("video read failed"));
    reader.readAsDataURL(blob);
  });
}

/** Record one registered scene from its post-prewarm begin through finish. */
export async function requestCutsceneVideoById(
  resources: ClientResources,
  audioManager: AudioManager,
  defId: string,
  options: CutsceneVideoCaptureOptions = {}
): Promise<CutsceneVideoCaptureResult> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is unavailable in this browser");
  }
  const def = cutsceneLibrary.get(defId);
  if (!def) {
    throw new Error(`unknown cutscene "${defId}"`);
  }
  const sourceCanvas = gameCanvas();
  if (!sourceCanvas) {
    throw new Error("the game canvas cannot provide a recording stream");
  }
  const frameRate = Math.min(60, Math.max(12, options.frameRate ?? 30));
  const mimeType = recordingMimeType();
  if (!mimeType) {
    throw new Error("this browser has no supported WebM recording codec");
  }

  // Mirror the WebGL surface into a 2D canvas immediately after every engine
  // render. Chromium may expose a WebGL captureStream track that records only
  // its first frame; a 2D staging canvas produces reliable MediaRecorder frames
  // while still containing pixels rendered entirely by the game engine.
  const recordingCanvas = document.createElement("canvas");
  const outputScale = Math.min(1, 1_280 / sourceCanvas.width);
  recordingCanvas.width = Math.max(
    2,
    Math.round(sourceCanvas.width * outputScale)
  );
  recordingCanvas.height = Math.max(
    2,
    Math.round(sourceCanvas.height * outputScale)
  );
  const recordingContext = recordingCanvas.getContext("2d");
  if (
    !recordingContext ||
    typeof recordingCanvas.captureStream !== "function"
  ) {
    throw new Error("a 2D game-frame recording canvas is unavailable");
  }
  const videoStream = recordingCanvas.captureStream(frameRate);
  const canvasVideoTrack = videoStream.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  let frameRequestTimer: number | undefined;
  let frameCaptureInFlight = false;
  let nextFrameCaptureAt = 0;
  const rendererController = getActiveRendererController();
  const copyRenderedGameFrame = () => {
    const now = performance.now();
    // Eight fresh engine captures per second are visually smooth once the
    // MediaRecorder duplicates them onto a 30fps track, and avoid screenshot
    // readback slowing the gameplay timeline itself on software WebGL.
    const captureRate = Math.min(8, frameRate);
    if (frameCaptureInFlight || now < nextFrameCaptureAt) {
      return;
    }
    nextFrameCaptureAt = now + 1_000 / captureRate;
    const screenshot = rendererController?.captureScreenshot({
      width: recordingCanvas.width,
      height: recordingCanvas.height,
      format: "image/jpeg",
      deltaSeconds: 0,
    });
    if (!screenshot) {
      // This branch is only a startup fallback before the active controller is
      // installed. The production path above captures the postprocessed game.
      recordingContext.drawImage(
        sourceCanvas,
        0,
        0,
        recordingCanvas.width,
        recordingCanvas.height
      );
      canvasVideoTrack?.requestFrame?.();
      return;
    }
    frameCaptureInFlight = true;
    const image = new Image();
    image.onload = () => {
      recordingContext.drawImage(
        image,
        0,
        0,
        recordingCanvas.width,
        recordingCanvas.height
      );
      canvasVideoTrack?.requestFrame?.();
      frameCaptureInFlight = false;
    };
    image.onerror = () => {
      frameCaptureInFlight = false;
    };
    image.src = screenshot.screenshotDataUri;
  };
  rendererController?.emitter.on("render", copyRenderedGameFrame);
  copyRenderedGameFrame();
  // Audio is best-effort: unattended browsers may block AudioContext resume,
  // and the first music bootstrap can spend several seconds loading tracks.
  // Never hold the visual recording hostage to that optional audio path.
  await Promise.race([
    audioManager.resumeAudio().catch(() => undefined),
    sleep(1_500),
  ]);
  const audioRecording = audioManager.isRunning()
    ? audioManager.createRecordingStream()
    : undefined;
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...(audioRecording?.stream.getAudioTracks() ?? []),
  ]);
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: Math.max(
      1_000_000,
      options.videoBitsPerSecond ?? 8_000_000
    ),
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const timeoutMs = Math.min(
    15 * 60_000,
    Math.max(30_000, options.timeoutMs ?? 180_000)
  );
  const started = waitForPlaybackEvent(defId, "started", timeoutMs);
  const finished = waitForPlaybackEvent(defId, "finished", timeoutMs);
  if (!requestCutsceneById(defId, { preempt: options.preempt ?? true })) {
    started.cancel();
    finished.cancel();
    audioRecording?.dispose();
    combinedStream.getTracks().forEach((track) => track.stop());
    throw new Error(`cutscene "${defId}" could not be requested for video`);
  }

  try {
    // Binding/prewarm can cancel a scene before it ever reports "started".
    // Race both lifecycle signals so a missing required actor fails promptly
    // instead of making automation wait for the full video timeout.
    const firstLifecycleEvent = await Promise.race([
      started.promise.then((event) => ({ phase: "started" as const, event })),
      finished.promise.then((event) => ({ phase: "finished" as const, event })),
    ]);
    if (firstLifecycleEvent.phase === "finished") {
      throw new Error(
        `cutscene "${defId}" finished before recording started (${firstLifecycleEvent.event.reason})`
      );
    }
    started.cancel();
    const startedAt = performance.now();
    recorder.start(500);
    // Explicitly request frames as well as using captureStream(frameRate).
    // Software WebGL/background tabs can otherwise expose a live canvas track
    // that MediaRecorder accepts but never receives encoded video frames from.
    if (canvasVideoTrack?.requestFrame) {
      copyRenderedGameFrame();
      frameRequestTimer = window.setInterval(
        () => canvasVideoTrack.requestFrame?.(),
        1_000 / frameRate
      );
    }
    const finishEvent = await finished.promise;
    // Preserve the final rendered pose before stopping the MediaRecorder.
    await sleep(120);
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () =>
        reject(new Error("cutscene video recorder failed"));
    });
    // Some Chromium builds do not flush a short capture's last GOP until an
    // explicit data request. Give that event a beat before stopping so the
    // final WebM cannot become an empty container.
    if (recorder.state === "recording") {
      recorder.requestData();
      await sleep(80);
    }
    if (frameRequestTimer !== undefined) {
      window.clearInterval(frameRequestTimer);
      frameRequestTimer = undefined;
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: mimeType });
    const durationSeconds = (performance.now() - startedAt) / 1000;
    if (blob.size === 0) {
      throw new Error(
        `cutscene video recorder produced an empty file after ${durationSeconds.toFixed(
          2
        )}s (${
          finishEvent.kind === "finished" ? finishEvent.reason : "aborted"
        })`
      );
    }
    return {
      defId,
      mimeType,
      filename: options.filename ?? `${defId}.webm`,
      dataUri: await blobDataUri(blob),
      width: recordingCanvas.width,
      height: recordingCanvas.height,
      frameRate,
      durationSeconds,
      finishReason:
        finishEvent.kind === "finished" ? finishEvent.reason : "aborted",
      hasAudio: Boolean(audioRecording?.stream.getAudioTracks().length),
    };
  } finally {
    started.cancel();
    finished.cancel();
    rendererController?.emitter.off("render", copyRenderedGameFrame);
    if (frameRequestTimer !== undefined) {
      window.clearInterval(frameRequestTimer);
    }
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    audioRecording?.dispose();
    combinedStream.getTracks().forEach((track) => track.stop());
  }
}
