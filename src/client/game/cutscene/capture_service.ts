// HARTHMERE_CUTSCENE_CAPTURE_SERVICE
//
// Promotional still capture built on the same declarative cinematic scene as
// playback. Capture scenes are sanitized into a client-only sandbox: they can
// never stream ECS movement, apply onEnd placements, or run story commits.

import {
  cutsceneLibrary,
  requestCutscene,
} from "@/client/game/cutscene/cutscene_service";
import type { CutsceneDef } from "@/shared/cutscene/schema";
import { validateCutsceneDef } from "@/shared/cutscene/schema";
import { uniqueId } from "lodash";

export interface CutsceneCaptureResult {
  captureId: string;
  defId: string;
  width: number;
  height: number;
  format: "image/png" | "image/jpeg";
  filename: string;
  dataUri: string;
  cameraPosition: [number, number, number];
  cameraOrientation: [number, number];
  capturedAt: number;
}

export interface RequestCutsceneScreenshotOptions {
  shotId?: string;
  at?: number;
  width?: number;
  height?: number;
  format?: "image/png" | "image/jpeg";
  filename?: string;
  preempt?: boolean;
  timeoutMs?: number;
}

interface PendingCapture {
  sourceDefId: string;
  captureDefId: string;
  resolve: (result: CutsceneCaptureResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingCaptures = new Map<string, PendingCapture>();

function sanitizedCaptureDef(
  def: CutsceneDef,
  captureId: string,
  options: RequestCutsceneScreenshotOptions
): CutsceneDef {
  const shotIndex = options.shotId
    ? def.shots.findIndex((shot) => shot.id === options.shotId)
    : def.shots.length - 1;
  if (shotIndex < 0) {
    throw new Error(`unknown cutscene shot "${options.shotId}"`);
  }
  const selected = def.shots[shotIndex];
  const budget = selected.until?.maxDuration ?? selected.duration;
  const at = options.at ?? Math.min(selected.duration, budget);
  if (!Number.isFinite(at) || at < 0 || at > budget) {
    throw new Error(
      `capture time ${at}s is outside shot "${selected.id}" budget ${budget}s`
    );
  }

  const captureAction = {
    kind: "capture" as const,
    at,
    captureId,
    width: options.width ?? 3840,
    height: options.height ?? 2160,
    format: options.format ?? "image/png",
    filename: options.filename,
  };
  const shots = def.shots.map((shot, index) =>
    index === shotIndex
      ? { ...shot, actions: [...shot.actions, captureAction] }
      : shot
  );

  const captureSuffix = `-capture-${captureId}`;
  const captureDefId = `${def.id.slice(
    0,
    128 - captureSuffix.length
  )}${captureSuffix}`;

  const raw = {
    ...def,
    id: captureDefId,
    name: `${def.name} Capture`,
    settings: {
      ...def.settings,
      mode: "clientPuppet" as const,
      skippable: false,
      skipAfterSeconds: def.settings.maxSceneDurationSeconds,
      commitOn: [],
      hideHud: true,
      letterbox: false,
    },
    shots,
    onEnd: { placements: [], commits: [] },
  };
  const parsed = validateCutsceneDef(raw);
  if (!parsed.ok) {
    throw new Error(
      `invalid capture scene: ${parsed.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return parsed.def;
}

/**
 * Play a scene in a non-authoritative sandbox and resolve with a high-resolution
 * engine capture at an exact shot time.
 */
export function requestCutsceneScreenshot(
  raw: unknown,
  options: RequestCutsceneScreenshotOptions = {}
): Promise<CutsceneCaptureResult> {
  const parsed = validateCutsceneDef(raw);
  if (!parsed.ok) {
    return Promise.reject(
      new Error(
        `invalid cutscene: ${parsed.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`
      )
    );
  }
  const captureId = uniqueId("capture-");
  let captureDef: CutsceneDef;
  try {
    captureDef = sanitizedCaptureDef(parsed.def, captureId, options);
  } catch (error) {
    return Promise.reject(error);
  }

  const requestedTimeoutMs = options.timeoutMs ?? 90_000;
  if (!Number.isFinite(requestedTimeoutMs) || requestedTimeoutMs <= 0) {
    return Promise.reject(
      new Error("capture timeout must be a finite positive value")
    );
  }

  return new Promise<CutsceneCaptureResult>((resolve, reject) => {
    const timeoutMs = Math.min(
      15 * 60_000,
      Math.max(1_000, requestedTimeoutMs)
    );
    const timeout = setTimeout(() => {
      pendingCaptures.delete(captureId);
      reject(new Error(`cutscene capture "${captureId}" timed out`));
    }, timeoutMs);
    pendingCaptures.set(captureId, {
      sourceDefId: parsed.def.id,
      captureDefId: captureDef.id,
      resolve,
      reject,
      timeout,
    });
    if (!requestCutscene(captureDef, { preempt: options.preempt })) {
      clearTimeout(timeout);
      pendingCaptures.delete(captureId);
      reject(new Error("capture cutscene request was rejected"));
    }
  });
}

export function requestCutsceneScreenshotById(
  id: string,
  options: RequestCutsceneScreenshotOptions = {}
): Promise<CutsceneCaptureResult> {
  const def = cutsceneLibrary.get(id);
  if (!def) {
    return Promise.reject(new Error(`unknown cutscene "${id}"`));
  }
  return requestCutsceneScreenshot(def, options);
}

export function deliverCutsceneCapture(result: CutsceneCaptureResult): boolean {
  const pending = pendingCaptures.get(result.captureId);
  if (!pending) {
    return false;
  }
  clearTimeout(pending.timeout);
  pendingCaptures.delete(result.captureId);
  pending.resolve({ ...result, defId: pending.sourceDefId });
  return true;
}

export function failCutsceneCapture(
  captureId: string,
  reason: string
): boolean {
  const pending = pendingCaptures.get(captureId);
  if (!pending) {
    return false;
  }
  clearTimeout(pending.timeout);
  pendingCaptures.delete(captureId);
  pending.reject(new Error(reason));
  return true;
}

export function failCutsceneCapturesForDef(
  defId: string,
  reason: string
): void {
  for (const [captureId, pending] of pendingCaptures) {
    if (pending.captureDefId !== defId) {
      continue;
    }
    clearTimeout(pending.timeout);
    pendingCaptures.delete(captureId);
    pending.reject(new Error(reason));
  }
}

export function downloadCutsceneCapture(result: CutsceneCaptureResult): void {
  if (typeof document === "undefined") {
    return;
  }
  const link = document.createElement("a");
  link.href = result.dataUri;
  link.download = result.filename;
  link.rel = "noopener";
  link.click();
}
