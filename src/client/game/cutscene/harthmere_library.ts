// HARTHMERE_CUTSCENE_LIBRARY_BOOTSTRAP
//
// Registers authored scenes once the client exists and provides an explicit
// query-driven preview path. New scenes only need a shared factory plus one
// entry here; no temporary component or one-off console script is required.

import {
  registerCutscene,
  registerCutsceneHook,
  requestCutsceneById,
} from "@/client/game/cutscene/cutscene_service";
import { subscribeCutscenePlayback } from "@/client/game/cutscene/playback_events";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { requestCutsceneVideoById } from "@/client/game/cutscene/video_capture_service";
import type { ClientContext } from "@/client/game/context";
import {
  JACKIE_VS_MUCKERS_CUTSCENE_ID,
  jackieVsMuckersCutscene,
} from "@/shared/cutscene/harthmere_scenes";
import {
  HARTHMERE_EXPRESSION_SHOWCASE_ID,
  harthmereExpressionShowcaseCutscene,
} from "@/shared/cutscene/expression_showcase";
import {
  HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID,
  harthmereMovementActionShowcaseCutscene,
} from "@/shared/cutscene/movement_action_showcase";
import { CH1_SCENE_FACTORIES } from "@/shared/cutscene/ch1_scenes";
import { log } from "@/shared/logging";
import { sleep } from "@/shared/util/async";
import { useEffect, useRef } from "react";

const HARTHMERE_SCENE_FACTORIES = new Map<string, () => unknown>([
  [JACKIE_VS_MUCKERS_CUTSCENE_ID, jackieVsMuckersCutscene],
  [HARTHMERE_EXPRESSION_SHOWCASE_ID, harthmereExpressionShowcaseCutscene],
  [
    HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID,
    harthmereMovementActionShowcaseCutscene,
  ],
  // Chapter 1 ("Identity"). Every flashback, overlay, reconstruction, and the
  // Act 6 consolidation revision sequence. Preview any of them with
  // ?cutscenePreview=<id>, e.g. cutscenePreview=ch1-recon-corridor.
  ...CH1_SCENE_FACTORIES,
]);

let chapter1HooksRegistered = false;

async function syncChapter1StoryState(): Promise<void> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/chapter1_story",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    }
  );
  if (!response.ok) {
    throw new Error(`Chapter 1 story sync failed (${response.status})`);
  }
  window.dispatchEvent(new CustomEvent("chapter1-story-updated"));
}

/**
 * Chapter 1 cutscenes declare durable hooks in shared data. Objective
 * completion remains server-authoritative and applies the mutation before its
 * signed ECS progress event; these hooks refresh presentation and make the
 * director's end-state commit contract real instead of logging "unknown hook".
 */
function registerChapter1CutsceneHooks(): void {
  if (chapter1HooksRegistered) return;
  chapter1HooksRegistered = true;
  for (const name of [
    "ch1.begin",
    "ch1.unlockLedger",
    "ch1.recoverFragment",
    "ch1.applyConsolidation",
  ]) {
    registerCutsceneHook(name, syncChapter1StoryState);
  }
  registerCutsceneHook("ch1.reviseLedgerEntry", (payload) => {
    window.dispatchEvent(
      new CustomEvent("chapter1-ledger-revision", { detail: payload })
    );
  });
  registerCutsceneHook("ch1.renameCard", (payload) => {
    window.dispatchEvent(
      new CustomEvent("chapter1-card-renamed", { detail: payload })
    );
  });
}

type CutscenePreviewStatus =
  | { status: "pending"; id: string }
  | { status: "requested"; id: string }
  | { status: "started"; id: string }
  | { status: "finished"; id: string; reason: string }
  | { status: "error"; id: string; error: string };

type CutsceneVideoStatus =
  | { status: "pending"; id: string }
  | {
      status: "complete";
      id: string;
      dataUri: string;
      filename: string;
      mimeType: string;
      width: number;
      height: number;
      frameRate: number;
      durationSeconds: number;
      hasAudio: boolean;
    }
  | { status: "error"; id: string; error: string };

declare global {
  interface Window {
    __biomesCaptureReady?: boolean;
    __biomesCutscenePreview?: CutscenePreviewStatus;
    __biomesCutsceneVideo?: CutsceneVideoStatus;
    __biomesPersistedCutsceneVideoKey?: string;
  }
}

async function persistLocalCutsceneVideo(
  state: Extract<CutsceneVideoStatus, { status: "complete" }>
): Promise<void> {
  if (!/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return;
  }
  // Avoid retaining a second copy of the full data URI merely for deduping.
  const key = `${state.id}:${state.filename}:${
    state.dataUri.length
  }:${state.dataUri.slice(-24)}`;
  if (window.__biomesPersistedCutsceneVideoKey === key) {
    return;
  }
  const response = await defaultHarthmereLiveFetch("/api/dev/cutscene_video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: state.id,
      filename: state.filename,
      dataUri: state.dataUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`local cutscene video save failed (${response.status})`);
  }
  window.__biomesPersistedCutsceneVideoKey = key;
}

// HMR evaluates this module even when React preserves the mounted Game tree.
// Persist an already-completed capture immediately so adding/fixing the local
// sink does not require another expensive scene recording.
if (typeof window !== "undefined") {
  queueMicrotask(() => {
    const state = window.__biomesCutsceneVideo;
    if (state?.status === "complete") {
      void persistLocalCutsceneVideo(state).catch((error) => {
        log.error("Failed to persist hot-reloaded cutscene video", { error });
      });
    }
  });
}

function publishCutsceneVideoStatus(state: CutsceneVideoStatus): void {
  window.__biomesCutsceneVideo = state;
  let output = document.getElementById("biomes-cutscene-video-output");
  if (!output) {
    output = document.createElement("script");
    output.id = "biomes-cutscene-video-output";
    output.setAttribute("type", "application/json");
    document.documentElement.append(output);
  }
  output.textContent = JSON.stringify(state);
  if (state.status === "complete") {
    // Local capture pages save their engine WebM without routing a multi-MB
    // base64 string through browser-control output. Distribution still uses
    // the explicit FFmpeg helper so the browser remains codec-independent.
    void persistLocalCutsceneVideo(state).catch((error) => {
      log.error("Failed to persist local cutscene video", { error });
    });
  }
}

function publishCutscenePreviewStatus(state: CutscenePreviewStatus): void {
  window.__biomesCutscenePreview = state;
  let output = document.getElementById("biomes-cutscene-preview-output");
  if (!output) {
    output = document.createElement("script");
    output.id = "biomes-cutscene-preview-output";
    output.setAttribute("type", "application/json");
    document.documentElement.append(output);
  }
  output.textContent = JSON.stringify(state);
}

async function waitForCutscenePreviewReady(timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  let stableCanvasAt: number | undefined;
  while (true) {
    if (window.__biomesCaptureReady) {
      return;
    }
    // Renderer-controller reattachment can clear the window readiness marker
    // even though the replacement canvas is already drawing. A connected,
    // non-empty game canvas that remains stable for a second is an equivalent
    // local readiness signal and prevents preview/recording jobs from idling
    // until their two-minute timeout.
    const canvas = [...document.querySelectorAll("canvas")]
      .filter(
        (candidate) =>
          candidate.isConnected &&
          candidate.width > 0 &&
          candidate.height > 0 &&
          candidate.clientWidth > 0 &&
          candidate.clientHeight > 0
      )
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (canvas) {
      stableCanvasAt ??= performance.now();
      if (performance.now() - stableCanvasAt >= 1_000) {
        return;
      }
    } else {
      stableCanvasAt = undefined;
    }
    if (performance.now() >= deadline) {
      throw new Error("game renderer did not become cutscene-preview ready");
    }
    await sleep(100);
  }
}

/** Register production scenes and optionally autoplay/record a query target. */
export function useHarthmereCutsceneLibrary(
  context: Pick<ClientContext, "resources" | "audioManager"> | null
): void {
  const previewStarted = useRef(false);
  useEffect(() => {
    if (!context || typeof window === "undefined") {
      return;
    }
    registerChapter1CutsceneHooks();
    for (const factory of HARTHMERE_SCENE_FACTORIES.values()) {
      registerCutscene(factory());
    }

    // Fast Refresh preserves the completed capture on window. Re-persist it
    // after this local sink is introduced or updated, without re-recording.
    if (window.__biomesCutsceneVideo?.status === "complete") {
      void persistLocalCutsceneVideo(window.__biomesCutsceneVideo).catch(
        (error) => {
          log.error("Failed to persist existing cutscene video", { error });
        }
      );
    }

    const params = new URLSearchParams(window.location.search);
    const videoId = params.get("cutsceneVideo");
    if (videoId && !previewStarted.current) {
      previewStarted.current = true;
      publishCutsceneVideoStatus({ status: "pending", id: videoId });
      void (async () => {
        try {
          await waitForCutscenePreviewReady(120_000);
          await sleep(1_000);
          const frameRateParam = params.get("videoFps");
          const requestedFrameRate =
            frameRateParam === null || frameRateParam.trim() === ""
              ? undefined
              : Number(frameRateParam);
          const frameRate =
            requestedFrameRate !== undefined &&
            Number.isFinite(requestedFrameRate)
              ? requestedFrameRate
              : 30;
          const result = await requestCutsceneVideoById(
            context.resources,
            context.audioManager,
            videoId,
            {
              frameRate,
              filename: `${videoId}.webm`,
              preempt: true,
              timeoutMs: 240_000,
            }
          );
          publishCutsceneVideoStatus({
            status: "complete",
            id: videoId,
            dataUri: result.dataUri,
            filename: result.filename,
            mimeType: result.mimeType,
            width: result.width,
            height: result.height,
            frameRate: result.frameRate,
            durationSeconds: result.durationSeconds,
            hasAudio: result.hasAudio,
          });
        } catch (error) {
          publishCutsceneVideoStatus({
            status: "error",
            id: videoId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return;
    }

    const previewId = params.get("cutscenePreview");
    if (!previewId || previewStarted.current) {
      return;
    }
    previewStarted.current = true;
    publishCutscenePreviewStatus({ status: "pending", id: previewId });
    void (async () => {
      try {
        await waitForCutscenePreviewReady(120_000);
        // Let the live-creature bridge and archived actor assets publish at
        // least once before binding the cast. This makes direct preview URLs
        // reliable instead of racing the first ECS/render bridge tick.
        await sleep(1_000);
        // A successful queue request may still cancel during cast binding.
        // Publish the actual lifecycle so preview/video automation cannot
        // mistake an empty staged camera for a completed cinematic.
        const unsubscribe = subscribeCutscenePlayback((event) => {
          if (event.defId !== previewId) {
            return;
          }
          if (event.kind === "started") {
            publishCutscenePreviewStatus({ status: "started", id: previewId });
            return;
          }
          publishCutscenePreviewStatus({
            status: "finished",
            id: previewId,
            reason: event.reason,
          });
          unsubscribe();
        });
        if (!requestCutsceneById(previewId, { preempt: true })) {
          unsubscribe();
          throw new Error(
            `unknown or rejected cutscene preview "${previewId}"`
          );
        }
        publishCutscenePreviewStatus({ status: "requested", id: previewId });
      } catch (error) {
        publishCutscenePreviewStatus({
          status: "error",
          id: previewId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, [context]);
}
