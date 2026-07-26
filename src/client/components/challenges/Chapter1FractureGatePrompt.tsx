// CHAPTER_1_FRACTURE_GATE_PROMPT
//
// Production interaction seam for the animated Fracture Gate renderer. The
// prompt owns F only when the authenticated server says the native player is
// close enough. The client never chooses a destination and never advances a
// dungeon run locally; it only mirrors active gate/run ids into the renderer
// and asks the server to perform enter/exit.

import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";
import {
  setCh1ActiveDungeonRunId,
  setCh1ActiveGateIds,
} from "@/client/game/renderers/ch1_fracture_gate";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Chapter1GateState {
  ok: boolean;
  reason?: string;
  activeGateIds: string[];
  activeDungeonRunId?: string;
  interaction: "none" | "enter" | "exit";
  gateId?: string;
  gateName?: string;
  dungeonName?: string;
  targetPosition?: [number, number, number];
  distance?: number;
  withinRange?: boolean;
  actionLabel?: string;
  warpPosition?: [number, number, number];
  survival?: {
    resourceKey: "water" | "fuel";
    resourceInitial: number;
    resourceRemaining: number;
    lightInitial: number;
    lightRemaining: number;
    lastOutcome?: string;
  };
}

function gateApiUrl() {
  if (typeof window === "undefined") return "/api/harthmere/chapter1_gate";
  const e2e = new URLSearchParams(window.location.search).get(
    "harthmere_native_ecs_e2e"
  );
  return `/api/harthmere/chapter1_gate${e2e === "1" ? "?e2e=1" : ""}`;
}

async function requestGate(
  body:
    | { action: "state" }
    | { action: "enter"; gateId: string }
    | { action: "exit" }
): Promise<Chapter1GateState> {
  const response = await fetch(gateApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Fracture Gate request failed (${response.status})`);
  }
  return response.json();
}

export const Chapter1FractureGatePrompt: React.FunctionComponent = () => {
  const { reactResources } = useClientContext();
  const cutscene = reactResources.use("/scene/cutscene");
  const [state, setState] = useState<Chapter1GateState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef<Promise<void>>();
  const busyRef = useRef(false);

  const applyState = useCallback((next: Chapter1GateState) => {
    setState(next);
    setCh1ActiveGateIds(next.activeGateIds);
    setCh1ActiveDungeonRunId(next.activeDungeonRunId);
  }, []);

  const refresh = useCallback(() => {
    // Keep polling single-flight. Renderer readiness routinely precedes live
    // player readiness in the local stack; overlapping retries make that warm
    // window longer and reproduce the exact test-stack failure this component
    // is meant to avoid.
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      try {
        const next = await requestGate({ action: "state" });
        applyState(next);
        setError(undefined);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    inFlight.current = task;
    void task.finally(() => {
      if (inFlight.current === task) inFlight.current = undefined;
    });
    return task;
  }, [applyState]);

  useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busyRef.current) {
        void refresh();
      }
    }, 750);
    return () => {
      window.clearInterval(timer);
      setCh1ActiveGateIds(undefined);
      setCh1ActiveDungeonRunId(undefined);
    };
  }, [refresh]);

  const interact = useCallback(async () => {
    if (
      busyRef.current ||
      !state?.withinRange ||
      state.interaction === "none"
    ) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await requestGate(
        state.interaction === "enter"
          ? { action: "enter", gateId: state.gateId! }
          : { action: "exit" }
      );
      applyState(next);
      setError(next.ok ? undefined : next.reason);
      // WarpHomeEvent is asynchronous. Poll after the local player consumes it
      // instead of assuming the response itself proves the avatar moved.
      window.setTimeout(() => void refresh(), 350);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [applyState, refresh, state]);

  const candidate = useMemo(
    () =>
      state?.withinRange && state.interaction !== "none" && !cutscene.active
        ? {
            id: `chapter1-fracture-gate:${state.interaction}:${state.gateId}`,
            priority: WORLD_INTERACTION_PRIORITY.chapter1Story,
            disabled: busy,
            onInteract: () => void interact(),
          }
        : undefined,
    [busy, cutscene.active, interact, state]
  );
  const ownsInteraction = useWorldInteractionCandidate(candidate);

  if (!nativeBiomesEcsAuthorityEnabled()) return null;

  return (
    <>
      <span
        className="hidden"
        data-chapter1-gate-sync="ready"
        data-active-gates={state?.activeGateIds.join(",") ?? ""}
        data-active-dungeon={state?.activeDungeonRunId ?? ""}
      />
      {state?.withinRange &&
        state.interaction !== "none" &&
        ownsInteraction && (
          <div
            className="rounded-lg border-cyan-200/50 bg-slate-950/90 pointer-events-none fixed bottom-[9.5rem] left-1/2 z-[76] w-[min(34rem,88vw)] -translate-x-1/2 border px-4 py-3 text-center text-white shadow-[0_0_30px_rgba(34,211,238,0.24)] backdrop-blur"
            role="status"
            aria-live="polite"
            data-chapter1-fracture-gate={state.gateId}
            data-gate-interaction={state.interaction}
          >
            <div className="text-cyan-200 text-[11px] font-semibold uppercase tracking-[0.2em]">
              Fracture Gate ·{" "}
              {state.interaction === "enter" ? "Mouth" : "Far Anchor"}
            </div>
            <div className="mt-0.5 text-base font-bold">
              {state.dungeonName ?? state.gateName}
            </div>
            <div className="text-cyan-100 mt-1 text-sm font-bold">
              {busy
                ? "The aperture is taking hold…"
                : `F — ${state.actionLabel}`}
            </div>
            {(error || (!state.ok && state.reason)) && (
              <div className="text-red-200 mt-1 text-xs">
                {error ?? state.reason}
              </div>
            )}
          </div>
        )}
      {state?.activeDungeonRunId && state.survival && (
        <div
          className="border-cyan-200/35 bg-slate-950/90 pointer-events-none fixed right-4 top-24 z-[74] w-[min(19rem,44vw)] rounded-lg border px-3 py-2 text-white shadow-[0_0_24px_rgba(34,211,238,0.16)] backdrop-blur"
          role="status"
          aria-live="polite"
          data-chapter1-dungeon-survival={state.activeDungeonRunId}
          data-resource-key={state.survival.resourceKey}
          data-resource-remaining={state.survival.resourceRemaining}
          data-light-remaining={state.survival.lightRemaining}
        >
          <div className="text-cyan-200 text-[10px] font-bold uppercase tracking-[0.18em]">
            Elsewhen survival
          </div>
          <div className="mt-1 flex items-center justify-between text-sm font-semibold">
            <span className="capitalize">{state.survival.resourceKey}</span>
            <span>
              {state.survival.resourceRemaining.toFixed(0)} /{" "}
              {state.survival.resourceInitial.toFixed(0)}
            </span>
          </div>
          {state.survival.lightInitial > 0 && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-white/75">
              <span>Light</span>
              <span>
                {state.survival.lightRemaining.toFixed(0)} /{" "}
                {state.survival.lightInitial.toFixed(0)}
              </span>
            </div>
          )}
          {state.survival.lastOutcome && (
            <div className="mt-1.5 text-[11px] leading-snug text-white/65">
              {state.survival.lastOutcome}
            </div>
          )}
        </div>
      )}
    </>
  );
};
