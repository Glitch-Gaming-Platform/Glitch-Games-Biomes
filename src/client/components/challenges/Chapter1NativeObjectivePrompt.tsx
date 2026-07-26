// CHAPTER_1_NATIVE_OBJECTIVE_PROMPT
//
// The native Chapter 1 biscuits are normal Biomes challenges, but their
// authored objectives include story interactions (dialogue choices, gates,
// escorts, reconstructions) that do not map one-to-one to stock firehose
// events. This prompt is the production front door for those objectives. The
// browser never decides progression: it asks the authenticated server route,
// which verifies the exact active leaf and player distance before publishing a
// short-lived signed ECS event.

import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Chapter1ObjectiveState {
  ok: boolean;
  status: "disabled" | "idle" | "active" | "completed" | "rejected";
  reason?: string;
  questId?: string;
  questTitle?: string;
  challengeId?: number;
  stepId?: number;
  authoredStepId?: string;
  objective?: string;
  targetLabel?: string;
  targetPosition?: [number, number, number];
  trigger?: string;
  actionLabel?: string;
  interactionRadius?: number;
  distance?: number;
  withinRange?: boolean;
  choice?: {
    title: string;
    prompt: string;
    cancellable: boolean;
    options: Array<{ id: string; label: string; description?: string }>;
  };
}

async function requestChapter1Objective(
  body:
    | { action: "state" }
    | {
        action: "complete";
        challengeId: number;
        stepId: number;
        choice?: string;
      }
): Promise<Chapter1ObjectiveState> {
  const response = await fetch("/api/harthmere/chapter1_progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Chapter 1 objective request failed (${response.status})`);
  }
  return response.json();
}

function objectiveKey(state: Chapter1ObjectiveState | undefined): string {
  return `${state?.challengeId ?? "none"}:${state?.stepId ?? "none"}`;
}

export const Chapter1NativeObjectivePrompt: React.FunctionComponent = () => {
  const { reactResources } = useClientContext();
  const pointerLockManager = usePointerLockManager();
  const cutscene = reactResources.use("/scene/cutscene");
  const [state, setState] = useState<Chapter1ObjectiveState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [choiceOpen, setChoiceOpen] = useState(false);
  const autoCompletedKey = useRef<string>();
  const busyRef = useRef(false);
  const refreshInFlight = useRef<Promise<void>>();
  const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRef>({
    current: false,
  });

  const refresh = useCallback(() => {
    // The local production stack can take several seconds to answer while it
    // is generating player meshes. Never stack one-second poll requests on
    // top of an unfinished poll: they can consume every browser connection
    // and leave the player's higher-value `complete` request queued locally.
    if (refreshInFlight.current) return refreshInFlight.current;
    const task = (async () => {
      try {
        const next = await requestChapter1Objective({ action: "state" });
        setState(next);
        setError(undefined);
        if (objectiveKey(next) !== autoCompletedKey.current) {
          autoCompletedKey.current = undefined;
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    refreshInFlight.current = task;
    void task.finally(() => {
      if (refreshInFlight.current === task) refreshInFlight.current = undefined;
    });
    return task;
  }, []);

  const complete = useCallback(async (choice?: string) => {
    if (
      busyRef.current ||
      state?.status !== "active" ||
      !state.withinRange ||
      state.challengeId === undefined ||
      state.stepId === undefined
    ) {
      return;
    }
    // Ref first: React may defer the visual busy render, but keyboard/timer
    // callbacks in the same frame must already see completion as exclusive.
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await requestChapter1Objective({
        action: "complete",
        challengeId: state.challengeId,
        stepId: state.stepId,
        choice,
      });
      setState(next);
      setError(next.ok ? undefined : next.reason);
      if (next.ok) setChoiceOpen(false);
      window.setTimeout(() => void refresh(), 650);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [refresh, state]);

  useEffect(() => {
    setChoiceOpen(false);
  }, [state?.challengeId, state?.stepId]);

  useEffect(() => {
    if (!choiceOpen) {
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
      return;
    }
    openPointerLockUnlockWhileOpen(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () =>
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
  }, [choiceOpen, pointerLockManager]);

  useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busyRef.current) {
        void refresh();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (
      state?.status !== "active" ||
      state.trigger !== "near_location" ||
      !state.withinRange ||
      busy
    ) {
      return;
    }
    const key = objectiveKey(state);
    if (autoCompletedKey.current === key) return;
    autoCompletedKey.current = key;
    void complete();
  }, [busy, complete, state]);

  const worldCandidate = useMemo(
    () =>
      state?.status === "active" &&
      state.withinRange &&
      state.trigger !== "near_location" &&
      !choiceOpen &&
      !cutscene.active
        ? {
            id: `chapter1-native-objective:${objectiveKey(state)}`,
            priority: WORLD_INTERACTION_PRIORITY.chapter1Story,
            disabled: busy,
            // The central dispatcher owns repeat/modifier/editable-target
            // guards and consumes the winning key. Registering here avoids a
            // second window listener racing native ECS/container prompts.
            onInteract: () => {
              if (state.choice) setChoiceOpen(true);
              else void complete();
            },
          }
        : undefined,
    [busy, choiceOpen, complete, cutscene.active, state]
  );
  const ownsInteraction = useWorldInteractionCandidate(worldCandidate);

  if (
    !nativeBiomesEcsAuthorityEnabled() ||
    cutscene.active ||
    !state ||
    state.status === "disabled" ||
    state.status === "idle"
  ) {
    return null;
  }

  const distance = Math.max(0, Math.round(state.distance ?? 0));
  return (
    <>
      <div
      className="rounded-lg border-amber-200/40 bg-black/85 pointer-events-none fixed bottom-[9.5rem] left-1/2 z-[75] w-[min(34rem,88vw)] -translate-x-1/2 border px-3 py-2 text-center text-white shadow-xl backdrop-blur"
      role="status"
      aria-live="polite"
      data-chapter1-native-objective={state.authoredStepId}
    >
      <div className="text-amber-200 text-[11px] font-semibold uppercase tracking-[0.16em]">
        {state.questTitle}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{state.objective}</div>
      <div className="mt-1 text-xs text-white/70">
        {state.targetLabel}
        {state.withinRange ? "" : ` · ${distance}m away`}
      </div>
      {state.withinRange &&
        state.trigger !== "near_location" &&
        ownsInteraction && (
        <div className="text-amber-100 mt-1 text-sm font-bold">
          {busy ? "Confirming…" : `F — ${state.actionLabel ?? "Continue"}`}
        </div>
      )}
      {(error || state.reason) && (
        <div className="text-red-200 mt-1 text-xs">{error ?? state.reason}</div>
      )}
      </div>
      {choiceOpen && state.choice && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={state.choice.title}
          // Stable authored ids let the production browser gate distinguish
          // story choices without depending on prose or CSS. This is also the
          // regression hook for "Not yet": closing it must not fire progress.
          data-chapter1-choice-objective={state.authoredStepId}
          onKeyDown={(event) => {
            if (event.key === "Escape" && state.choice?.cancellable) {
              setChoiceOpen(false);
            }
          }}
        >
          <div className="border-amber-200/40 w-full max-w-xl rounded-xl border bg-slate-950/95 p-5 text-white shadow-2xl">
            <div className="text-amber-200 text-xs font-bold uppercase tracking-[0.18em]">
              {state.choice.title}
            </div>
            <p className="mt-3 text-base leading-relaxed text-white/90">
              {state.choice.prompt}
            </p>
            <div className="mt-5 grid gap-2">
              {state.choice.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  data-chapter1-choice={option.id}
                  className="border-amber-100/30 hover:border-amber-100/70 hover:bg-amber-100/10 rounded-lg border px-4 py-3 text-left transition disabled:opacity-50"
                  onClick={() => {
                    if (option.id === "not_yet") {
                      setChoiceOpen(false);
                      return;
                    }
                    void complete(option.id);
                  }}
                >
                  <span className="block font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="mt-1 block text-xs text-white/65">
                      {option.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {state.choice.cancellable && (
              <button
                type="button"
                className="mt-4 text-sm text-white/60 underline underline-offset-4 hover:text-white"
                onClick={() => setChoiceOpen(false)}
              >
                Close
              </button>
            )}
            {error && <div className="text-red-200 mt-3 text-sm">{error}</div>}
          </div>
        </div>
      )}
    </>
  );
};
