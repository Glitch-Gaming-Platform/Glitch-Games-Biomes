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
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { Chapter1ContainmentTriage } from "@/client/components/challenges/Chapter1ContainmentTriage";
import { publishChapter1ObjectiveWorldProjection } from "@/client/components/challenges/Chapter1ObjectiveWorldState";
import { TalkDialogModal } from "@/client/components/challenges/TalkDialogModal";
import { GenericTalkDialogModalStep } from "@/client/components/challenges/TalkDialogModalStep";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";
import { requestChapter1CutsceneById } from "@/client/game/cutscene/ch1_playback";
import { ch1AmbientTriggersOfKind } from "@/shared/harthmere/ch1_fragment_triggers";
import { ch1VoiceActorForSpeaker } from "@/shared/harthmere/ch1_voice";
import {
  clearHarthmereNpcDialogueExpression,
  publishHarthmereNpcDialogueExpression,
  resolveHarthmereNpcDialogueActor,
} from "@/shared/harthmere/npc_dialogue_expressions";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import type { HarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import type { BiomesId } from "@/shared/ids";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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
  targetEntityId?: number;
  trigger?: string;
  actionLabel?: string;
  interactionRadius?: number;
  distance?: number;
  withinRange?: boolean;
  showNavigationAid?: boolean;
  requirement?: {
    ready: boolean;
    current: number;
    total: number;
    reason?: string;
    blocksChapterInteraction: boolean;
    autoCompleteWhenReady: boolean;
  };
  introCutsceneId?: string;
  cutsceneId?: string;
  dialogue?: Chapter1DialogueSequence;
  completionDialogue?: Chapter1DialogueSequence;
  exitGuidance?: string;
  choice?: {
    title: string;
    prompt: string;
    cancellable: boolean;
    options: Array<{ id: string; label: string; description?: string }>;
    textInput?: {
      label: string;
      placeholder: string;
      submitLabel: string;
      maxLength: number;
    };
  };
  preparedChoice?: string;
  experience?: {
    kind: "combat" | "sound_hunt" | "boss" | "sandstorm" | "thin_ice";
    title: string;
    phase: string;
    detail: string;
    hp?: number;
    maxHp?: number;
    timerMs?: number;
    loopCount?: number;
    carryWeight?: number;
    carryLimit?: number;
    aliveEnemies?: number;
  };
}

interface Chapter1DialogueSequence {
  title: string;
  completionLabel?: string;
  pages: Array<{
    speaker: string;
    text: string;
    expression?: HarthmereCinematicExpression;
  }>;
}

interface OpenChapter1Dialogue {
  sequence: Chapter1DialogueSequence;
  mode: "objective" | "completion";
  cutsceneId?: string;
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
    | {
        action: "prepare";
        challengeId: number;
        stepId: number;
        choice: string;
      }
): Promise<Chapter1ObjectiveState> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/chapter1_progress",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(`Chapter 1 objective request failed (${response.status})`);
  }
  return response.json();
}

function objectiveKey(state: Chapter1ObjectiveState | undefined): string {
  return `${state?.challengeId ?? "none"}:${state?.stepId ?? "none"}`;
}

/**
 * The sleep memory channel. Fire-and-forget: a refusal is the normal case (the
 * ledger is deliberately silent for the back half of Act 4) and must never be
 * surfaced to the player as an error.
 */
async function reportChapter1SleepTriggers() {
  for (const trigger of ch1AmbientTriggersOfKind("sleep")) {
    try {
      const response = await defaultHarthmereLiveFetch(
        "/api/harthmere/chapter1_story",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trigger",
            fragmentId: trigger.fragmentId,
            kind: "sleep",
          }),
          cache: "no-store",
        }
      );
      if (response.ok) {
        window.dispatchEvent(new CustomEvent("chapter1-story-updated"));
      }
    } catch {
      // Ignored on purpose.
    }
  }
}

export const Chapter1NativeObjectivePrompt: React.FunctionComponent = () => {
  const { reactResources, mapManager, table } = useClientContext();
  const pointerLockManager = usePointerLockManager();
  const cutscene = reactResources.use("/scene/cutscene");
  const [state, setState] = useState<Chapter1ObjectiveState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [customChoiceText, setCustomChoiceText] = useState("");
  const [dialogue, setDialogue] = useState<OpenChapter1Dialogue>();
  const [dialoguePageIndex, setDialoguePageIndex] = useState(0);
  const [containmentOpen, setContainmentOpen] = useState(false);
  const [sleepTransition, setSleepTransition] = useState(false);
  const autoCompletedKey = useRef<string>(undefined);
  const introCutsceneRequested = useRef<string>(undefined);
  const busyRef = useRef(false);
  const modalOpenRef = useRef(false);
  const refreshInFlight = useRef<Promise<void>>(undefined);
  const lastStateSignature = useRef<string>(undefined);
  const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRef>({
    current: false,
  });

  const commitState = useCallback((next: Chapter1ObjectiveState) => {
    lastStateSignature.current = JSON.stringify(next);
    setState(next);
  }, []);

  const refresh = useCallback(() => {
    // The local production stack can take several seconds to answer while it
    // is generating player meshes. Never stack one-second poll requests on
    // top of an unfinished poll: they can consume every browser connection
    // and leave the player's higher-value `complete` request queued locally.
    if (refreshInFlight.current) return refreshInFlight.current;
    const task = (async () => {
      try {
        const next = await requestChapter1Objective({ action: "state" });
        const signature = JSON.stringify(next);
        if (signature !== lastStateSignature.current) {
          lastStateSignature.current = signature;
          setState(next);
        }
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

  const complete = useCallback(
    async (choice?: string) => {
      if (
        busyRef.current ||
        state?.status !== "active" ||
        state.challengeId === undefined ||
        state.stepId === undefined
      ) {
        return;
      }
      // Ref first: React may defer the visual busy render, but keyboard/timer
      // callbacks in the same frame must already see completion as exclusive.
      const completedTrigger = state.trigger;
      busyRef.current = true;
      setBusy(true);
      try {
        const next = await requestChapter1Objective({
          action: "complete",
          challengeId: state.challengeId,
          stepId: state.stepId,
          choice,
        });
        commitState(next);
        setError(next.ok ? undefined : next.reason);
        if (next.ok) {
          setChoiceOpen(false);
          setCustomChoiceText("");
          // Sleep is the chapter's one SCHEDULED memory channel and the client
          // is the only place that knows the player actually slept. Report it;
          // the server still re-checks flags, position, and the Act 4 silence
          // before delivering anything.
          if (completedTrigger === "sleep") {
            void reportChapter1SleepTriggers();
          }
          if (next.completionDialogue) {
            setDialogue({
              sequence: next.completionDialogue,
              mode: "completion",
              cutsceneId: next.cutsceneId,
            });
            setDialoguePageIndex(0);
          } else {
            if (
              next.cutsceneId &&
              !requestChapter1CutsceneById(next.cutsceneId, { preempt: true })
            ) {
              setError(`Could not start story scene ${next.cutsceneId}.`);
            }
            window.setTimeout(() => void refresh(), 650);
          }
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commitState, refresh, state]
  );

  const prepareEncounter = useCallback(
    async (choice: string) => {
      if (
        busyRef.current ||
        state?.status !== "active" ||
        state.challengeId === undefined ||
        state.stepId === undefined
      ) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      try {
        const next = await requestChapter1Objective({
          action: "prepare",
          challengeId: state.challengeId,
          stepId: state.stepId,
          choice,
        });
        commitState(next);
        setError(next.ok ? undefined : next.reason);
        if (next.ok) setChoiceOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commitState, state]
  );

  const beginSleepTransition = useCallback(async () => {
    if (sleepTransition || busyRef.current) return;
    setSleepTransition(true);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 900);
    });
    await complete();
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 350);
    });
    setSleepTransition(false);
  }, [complete, sleepTransition]);

  useEffect(() => {
    setChoiceOpen(false);
    setDialogue(undefined);
    setDialoguePageIndex(0);
    setContainmentOpen(false);
  }, [state?.challengeId, state?.stepId]);

  useEffect(() => {
    const modalOpen =
      choiceOpen || Boolean(dialogue) || containmentOpen || sleepTransition;
    modalOpenRef.current = modalOpen;
    if (!modalOpen) {
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
  }, [
    choiceOpen,
    containmentOpen,
    dialogue,
    pointerLockManager,
    sleepTransition,
  ]);

  useEffect(() => {
    if (
      state?.status !== "active" ||
      !state.showNavigationAid ||
      !state.targetPosition ||
      state.challengeId === undefined ||
      state.stepId === undefined
    ) {
      return;
    }
    const aidId = mapManager.addNavigationAid(
      {
        kind: "quest",
        autoremoveWhenNear: false,
        challengeId: state.challengeId as BiomesId,
        triggerId: state.stepId as BiomesId,
        target: state.targetEntityId
          ? {
              kind: "entity",
              id: state.targetEntityId as BiomesId,
            }
          : {
              kind: "position",
              position: [...state.targetPosition],
            },
      },
      state.stepId
    );
    return () => mapManager.removeNavigationAid(aidId);
  }, [
    mapManager,
    state?.challengeId,
    state?.showNavigationAid,
    state?.stepId,
    state?.targetPosition?.[0],
    state?.targetPosition?.[1],
    state?.targetPosition?.[2],
    state?.targetEntityId,
    state?.status,
  ]);

  useEffect(() => {
    if (
      state?.status !== "active" ||
      !state.targetPosition ||
      !state.authoredStepId
    ) {
      publishChapter1ObjectiveWorldProjection(undefined);
      return;
    }
    publishChapter1ObjectiveWorldProjection({
      key: objectiveKey(state),
      label: state.targetLabel || state.objective || "Chapter 1 objective",
      position: [...state.targetPosition],
      trigger: state.trigger || "interact",
      targetEntityId: state.targetEntityId,
    });
    return () => publishChapter1ObjectiveWorldProjection(undefined);
  }, [
    state?.authoredStepId,
    state?.challengeId,
    state?.objective,
    state?.status,
    state?.stepId,
    state?.targetEntityId,
    state?.targetLabel,
    state?.targetPosition?.[0],
    state?.targetPosition?.[1],
    state?.targetPosition?.[2],
    state?.trigger,
  ]);

  useEffect(() => {
    const id = state?.introCutsceneId;
    if (!id || cutscene.active || introCutsceneRequested.current === id) {
      return;
    }
    try {
      if (window.sessionStorage.getItem(`biomes.chapter1.cutscene.${id}`)) {
        introCutsceneRequested.current = id;
        return;
      }
    } catch {
      // Presentation still works when storage is unavailable.
    }
    if (!requestChapter1CutsceneById(id, { preempt: true })) {
      return;
    }
    introCutsceneRequested.current = id;
    try {
      window.sessionStorage.setItem(`biomes.chapter1.cutscene.${id}`, "1");
    } catch {
      // Session dedupe is best effort; progression remains server-authoritative.
    }
  }, [cutscene.active, state?.introCutsceneId]);

  useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !busyRef.current &&
        !modalOpenRef.current
      ) {
        void refresh();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (
      state?.status !== "active" ||
      !(
        (state.trigger === "near_location" && state.withinRange) ||
        (state.requirement?.autoCompleteWhenReady && state.requirement.ready)
      ) ||
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
      !state.requirement?.blocksChapterInteraction &&
      !(state.preparedChoice && (state.experience?.aliveEnemies ?? 0) > 0) &&
      !choiceOpen &&
      !containmentOpen &&
      !dialogue &&
      !cutscene.active
        ? {
            id: `chapter1-native-objective:${objectiveKey(state)}`,
            priority: WORLD_INTERACTION_PRIORITY.chapter1Story,
            disabled: busy || sleepTransition,
            // The central dispatcher owns repeat/modifier/editable-target
            // guards and consumes the winning key. Registering here avoids a
            // second window listener racing native ECS/container prompts.
            onInteract: () => {
              if (state.authoredStepId === "sleep_alone") {
                void beginSleepTransition();
              } else if (state.dialogue) {
                setDialogue({ sequence: state.dialogue, mode: "objective" });
                setDialoguePageIndex(0);
              } else if (state.authoredStepId === "the_procedure") {
                setContainmentOpen(true);
              } else if (state.choice && !state.preparedChoice) {
                setChoiceOpen(true);
              } else if (state.preparedChoice) {
                void complete(state.preparedChoice);
              } else {
                void complete();
              }
            },
          }
        : undefined,
    [
      busy,
      beginSleepTransition,
      choiceOpen,
      complete,
      containmentOpen,
      cutscene.active,
      dialogue,
      sleepTransition,
      state,
    ]
  );
  const ownsInteraction = useWorldInteractionCandidate(worldCandidate);

  const activeDialoguePage = dialogue?.sequence.pages[dialoguePageIndex];
  const activeDialogueVoice = ch1VoiceActorForSpeaker(
    activeDialoguePage?.speaker
  );
  const activeDialogueActorId = useMemo(() => {
    if (
      !activeDialoguePage?.expression ||
      !activeDialogueVoice ||
      activeDialogueVoice.kind !== "human"
    ) {
      return undefined;
    }
    return resolveHarthmereNpcDialogueActor({
      speaker: activeDialoguePage.speaker,
      aliases: activeDialogueVoice.aliases,
      preferredActorId: activeDialogueVoice.entityId,
      targetPosition: state?.targetPosition,
      candidates: [...table.scan(NpcMetadataSelector.query.all())].map(
        (entity) => ({
          id: Number(entity.id),
          label: entity.label?.text,
          position: entity.position?.v,
        })
      ),
    });
  }, [
    activeDialoguePage?.expression,
    activeDialoguePage?.speaker,
    activeDialogueVoice,
    state?.targetPosition,
    table,
  ]);
  const activeDialogueExpressionNonce =
    activeDialogueActorId !== undefined && activeDialoguePage?.expression
      ? `${state?.authoredStepId ?? "chapter1"}:${dialogue?.mode ?? "closed"}:${
          dialoguePageIndex + 1
        }:${activeDialogueActorId}:${activeDialoguePage.expression}`
      : undefined;

  useEffect(() => {
    if (
      cutscene.active ||
      activeDialogueActorId === undefined ||
      !activeDialoguePage?.expression ||
      !activeDialogueExpressionNonce
    ) {
      return;
    }
    publishHarthmereNpcDialogueExpression({
      actorId: activeDialogueActorId,
      expression: activeDialoguePage.expression,
      nonce: activeDialogueExpressionNonce,
    });
    return () =>
      clearHarthmereNpcDialogueExpression(activeDialogueExpressionNonce);
  }, [
    activeDialogueActorId,
    activeDialogueExpressionNonce,
    activeDialoguePage?.expression,
    cutscene.active,
  ]);

  if (
    !nativeBiomesEcsAuthorityEnabled() ||
    cutscene.active ||
    !state ||
    state.status === "disabled" ||
    state.status === "idle"
  ) {
    return null;
  }

  const activeDialogueEntityId = (activeDialogueActorId ??
    activeDialogueVoice?.entityId ??
    state.targetEntityId ??
    state.challengeId ??
    state.stepId) as BiomesId;
  const advanceDialogue = () => {
    if (!dialogue) return;
    const finalPage = dialoguePageIndex >= dialogue.sequence.pages.length - 1;
    if (!finalPage) {
      setDialoguePageIndex((index) => index + 1);
      return;
    }
    setDialogue(undefined);
    setDialoguePageIndex(0);
    if (dialogue.mode === "objective") {
      if (state.choice) setChoiceOpen(true);
      else void complete();
      return;
    }
    if (
      dialogue.cutsceneId &&
      !requestChapter1CutsceneById(dialogue.cutsceneId, { preempt: true })
    ) {
      setError(`Could not start story scene ${dialogue.cutsceneId}.`);
    }
    window.setTimeout(() => void refresh(), 650);
  };
  return (
    <>
      {containmentOpen && state.authoredStepId === "the_procedure" && (
        <Chapter1ContainmentTriage
          mode="objective"
          onComplete={({ automatic }) => {
            setContainmentOpen(false);
            void complete(automatic ? "hands_finish" : "stabilized");
          }}
        />
      )}
      {sleepTransition && (
        <div
          className="pointer-events-auto fixed inset-0 z-[1300] flex items-center justify-center bg-black text-white transition-opacity duration-700"
          role="status"
          aria-live="polite"
          data-chapter1-sleep-transition="active"
        >
          <div className="text-white/65 text-sm uppercase tracking-[0.22em]">
            The road-house goes quiet
          </div>
        </div>
      )}
      {state.experience?.kind === "sandstorm" && (
        <div
          className="pointer-events-none fixed inset-0 z-[70] bg-[radial-gradient(circle_at_center,transparent_18%,rgba(180,83,9,0.18)_62%,rgba(69,26,3,0.52)_100%)]"
          data-chapter1-sandstorm-pursuit="active"
          aria-hidden="true"
        />
      )}
      {state.experience?.kind === "thin_ice" &&
        state.experience.phase === "cracking" && (
          <div
            className="border-cyan-100/20 pointer-events-none fixed inset-0 z-[70] border-[10px] bg-[radial-gradient(circle_at_center,transparent_25%,rgba(125,211,252,0.12)_70%,rgba(8,47,73,0.36)_100%)]"
            data-chapter1-thin-ice="cracking"
            aria-hidden="true"
          />
        )}
      {state.experience && (
        <div
          className="rounded-lg bg-slate-950/90 pointer-events-none fixed left-4 top-24 z-[76] w-[min(22rem,46vw)] border border-white/20 px-3 py-2 text-white shadow-xl backdrop-blur"
          data-chapter1-dungeon-experience={state.experience.kind}
          data-chapter1-experience-phase={state.experience.phase}
        >
          <div className="text-cyan-200 text-[10px] font-bold uppercase tracking-[0.18em]">
            {state.experience.title} ·{" "}
            {state.experience.phase.replace(/_/g, " ")}
          </div>
          {state.experience.maxHp !== undefined &&
            state.experience.hp !== undefined &&
            state.experience.maxHp > 0 && (
              <div className="bg-white/15 mt-2 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-rose-400 h-full transition-[width] duration-300"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        (state.experience.hp / state.experience.maxHp) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            )}
          {state.experience.timerMs !== undefined && (
            <div className="text-amber-100 mt-1 text-sm font-semibold">
              Arena resets in{" "}
              {Math.max(0, Math.ceil(state.experience.timerMs / 1000))}s
              {(state.experience.loopCount ?? 0) > 0
                ? ` · loop ${state.experience.loopCount}`
                : ""}
            </div>
          )}
          {state.experience.carryWeight !== undefined &&
            state.experience.carryLimit !== undefined && (
              <div className="text-cyan-100 mt-1 text-sm font-semibold">
                Load {state.experience.carryWeight.toFixed(1)} /{" "}
                {state.experience.carryLimit} lb
              </div>
            )}
          <div className="mt-1 text-[11px] leading-snug text-white/70">
            {state.experience.detail}
          </div>
        </div>
      )}
      {/*
        CHAPTER_1_OBJECTIVE_PROMPT_SCOPE
        This used to be a permanent banner that printed the quest title, the
        objective text and a live metre count for as long as a Chapter 1 step
        was active. That duplicated the standard objective tray (which already
        shows the quest and the active step) and it was a second, inconsistent
        wayfinding system: every other quest in the game — Road Ahead, Busted,
        Get the Muck Out, Muck vs. Machine — routes distance and direction
        through the map, minimap and beam. Chapter 1 now publishes the current
        server-resolved target into that same MapManager path, including the
        next witness or supplier, so the banner's job is done elsewhere.

        What remains is only what the map cannot express: the in-range
        interaction affordance, and a server refusal reason. Both appear only
        when the player is actually at the objective, which is how every other
        world interaction in the game behaves.
      */}
      {state.withinRange &&
        state.trigger !== "near_location" &&
        ownsInteraction && (
          <div
            className="rounded-lg border-amber-200/40 bg-black/85 pointer-events-none fixed bottom-[9.5rem] left-1/2 z-[75] -translate-x-1/2 border px-3 py-2 text-center text-white shadow-xl backdrop-blur"
            role="status"
            aria-live="polite"
            data-chapter1-native-objective={state.authoredStepId}
          >
            <div className="text-amber-100 text-sm font-bold">
              {busy
                ? "Confirming…"
                : state.requirement && !state.requirement.ready
                  ? "Required item missing"
                  : `F — ${state.actionLabel ?? "Continue"}`}
            </div>
            <div className="mt-0.5 text-xs text-white/70">
              {state.targetLabel}
            </div>
            {state.requirement && !state.requirement.ready && (
              <div className="text-amber-100/80 mt-1 max-w-sm text-xs">
                {state.requirement.reason ??
                  `${state.requirement.current}/${state.requirement.total}`}
              </div>
            )}
          </div>
        )}
      {(error || state.reason) && state.withinRange && (
        <div
          className="rounded-lg border-red-300/40 bg-black/85 py-1.5 text-red-200 pointer-events-none fixed bottom-[8rem] left-1/2 z-[75] w-[min(28rem,88vw)] -translate-x-1/2 border px-3 text-center text-xs shadow-xl backdrop-blur"
          role="status"
          aria-live="polite"
          data-chapter1-objective-error={state.authoredStepId}
        >
          {error ?? state.reason}
        </div>
      )}
      {dialogue &&
        activeDialoguePage &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="chapter1-dialogue-portal fixed inset-0 z-[1200]"
            data-chapter1-dialogue-objective={state.authoredStepId}
            data-chapter1-dialogue-mode={dialogue.mode}
            data-chapter1-dialogue-page={dialoguePageIndex + 1}
            data-chapter1-dialogue-expression={
              activeDialoguePage.expression ?? "none"
            }
            data-chapter1-dialogue-actor-id={activeDialogueActorId ?? "none"}
            data-chapter1-dialogue-final={
              dialoguePageIndex >= dialogue.sequence.pages.length - 1
                ? "true"
                : "false"
            }
          >
            <TalkDialogModal
              entityId={activeDialogueEntityId}
              focusCamera={false}
              extraClassNames="chapter1-story-dialogue"
            >
              <GenericTalkDialogModalStep
                id={`${state.authoredStepId}:${dialogue.mode}:${dialoguePageIndex}`}
                entityId={activeDialogueEntityId}
                title={activeDialoguePage.speaker}
                dialog={[{ text: activeDialoguePage.text }]}
                onClose={advanceDialogue}
                voiceOverride={
                  activeDialogueVoice
                    ? { voice: activeDialogueVoice.profile.voiceParameterId }
                    : undefined
                }
              />
            </TalkDialogModal>
          </div>,
          document.body
        )}
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
          <div className="chapter1-choice-dialog border-amber-200/40 rounded-xl bg-slate-950/95 w-full max-w-xl border p-5 text-white shadow-2xl">
            <div className="text-amber-200 text-xs font-bold uppercase tracking-[0.18em]">
              {state.choice.title}
            </div>
            <p className="text-base mt-3 leading-relaxed text-white/90">
              {state.choice.prompt}
            </p>
            {state.exitGuidance && (
              <div className="chapter1-choice-next" data-chapter1-choice-next>
                <strong>After this</strong>
                <span>{state.exitGuidance}</span>
              </div>
            )}
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
                    if (
                      [
                        "fight_open",
                        "break_horns",
                        "fight_through",
                        "feed_hearth",
                        "fight_dark",
                      ].includes(option.id)
                    ) {
                      void prepareEncounter(option.id);
                      return;
                    }
                    void complete(option.id);
                  }}
                >
                  <span className="block font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="text-white/65 mt-1 block text-xs">
                      {option.description}
                    </span>
                  )}
                </button>
              ))}
              {state.choice.textInput && (
                <form
                  className="border-white/15 mt-2 border-t pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = customChoiceText.trim();
                    if (value.length >= 2) void complete(`name:${value}`);
                  }}
                >
                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/75">
                    {state.choice.textInput.label}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={customChoiceText}
                      maxLength={state.choice.textInput.maxLength}
                      placeholder={state.choice.textInput.placeholder}
                      disabled={busy}
                      data-chapter1-name-input
                      className="rounded-lg focus:border-amber-200/70 min-w-0 flex-1 border border-white/25 bg-black/30 px-3 py-2 text-white outline-none"
                      onChange={(event) =>
                        setCustomChoiceText(event.target.value)
                      }
                    />
                    <button
                      type="submit"
                      disabled={busy || customChoiceText.trim().length < 2}
                      data-chapter1-name-submit
                      className="bg-amber-200 text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      {state.choice.textInput.submitLabel}
                    </button>
                  </div>
                </form>
              )}
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
