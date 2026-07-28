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
import { VoiceChat } from "@/client/components/system/VoiceChat";
import { Chapter1ContainmentTriage } from "@/client/components/challenges/Chapter1ContainmentTriage";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";
import { requestCutsceneById } from "@/client/game/cutscene/cutscene_service";
import { ch1AmbientTriggersOfKind } from "@/shared/harthmere/ch1_fragment_triggers";
import { ch1VoiceActorForSpeaker } from "@/shared/harthmere/ch1_voice";
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
  introCutsceneId?: string;
  cutsceneId?: string;
  dialogue?: Chapter1DialogueSequence;
  completionDialogue?: Chapter1DialogueSequence;
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
  pages: Array<{ speaker: string; text: string }>;
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
  const { reactResources } = useClientContext();
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
  const autoCompletedKey = useRef<string>();
  const introCutsceneRequested = useRef<string>();
  const busyRef = useRef(false);
  const modalOpenRef = useRef(false);
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
        setState(next);
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
              !requestCutsceneById(next.cutsceneId, { preempt: true })
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
    [refresh, state]
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
        setState(next);
        setError(next.ok ? undefined : next.reason);
        if (next.ok) setChoiceOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [state]
  );

  useEffect(() => {
    setChoiceOpen(false);
    setDialogue(undefined);
    setDialoguePageIndex(0);
    setContainmentOpen(false);
  }, [state?.challengeId, state?.stepId]);

  useEffect(() => {
    const modalOpen = choiceOpen || Boolean(dialogue) || containmentOpen;
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
  }, [choiceOpen, containmentOpen, dialogue, pointerLockManager]);

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
    if (!requestCutsceneById(id, { preempt: true })) {
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
      !(state.preparedChoice && (state.experience?.aliveEnemies ?? 0) > 0) &&
      !choiceOpen &&
      !containmentOpen &&
      !dialogue &&
      !cutscene.active
        ? {
            id: `chapter1-native-objective:${objectiveKey(state)}`,
            priority: WORLD_INTERACTION_PRIORITY.chapter1Story,
            disabled: busy,
            // The central dispatcher owns repeat/modifier/editable-target
            // guards and consumes the winning key. Registering here avoids a
            // second window listener racing native ECS/container prompts.
            onInteract: () => {
              if (state.dialogue) {
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
      choiceOpen,
      complete,
      containmentOpen,
      cutscene.active,
      dialogue,
      state,
    ]
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
  const activeDialoguePage = dialogue?.sequence.pages[dialoguePageIndex];
  const activeDialogueVoice = ch1VoiceActorForSpeaker(
    activeDialoguePage?.speaker
  );
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
          <div className="text-red-200 mt-1 text-xs">
            {error ?? state.reason}
          </div>
        )}
      </div>
      {dialogue && activeDialoguePage && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={dialogue.sequence.title}
          data-chapter1-dialogue-objective={state.authoredStepId}
          data-chapter1-dialogue-mode={dialogue.mode}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              (
                event.currentTarget.querySelector(
                  "[data-chapter1-dialogue-next]"
                ) as HTMLButtonElement | null
              )?.click();
            }
          }}
        >
          <div className="border-amber-200/40 rounded-xl bg-slate-950/95 w-full max-w-xl border p-5 text-white shadow-2xl">
            <div className="text-amber-200 text-xs font-bold uppercase tracking-[0.18em]">
              {dialogue.sequence.title}
            </div>
            <div
              className="mt-4"
              data-chapter1-dialogue-page={dialoguePageIndex + 1}
            >
              {activeDialogueVoice && (
                <VoiceChat
                  text={activeDialoguePage.text}
                  voice={activeDialogueVoice.profile.voiceParameterId}
                  language="en-US"
                  playbackKey={`${state.authoredStepId}:${dialogue.mode}:${dialoguePageIndex}`}
                />
              )}
              <div className="text-white/65 text-sm font-semibold">
                {activeDialoguePage.speaker}
              </div>
              <p className="text-base mt-2 leading-relaxed text-white/95">
                {activeDialoguePage.text}
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-white/45 text-xs">
                {dialoguePageIndex + 1} / {dialogue.sequence.pages.length}
              </span>
              <button
                type="button"
                autoFocus
                disabled={busy}
                data-chapter1-dialogue-next
                data-chapter1-dialogue-final={
                  dialoguePageIndex >= dialogue.sequence.pages.length - 1
                    ? "true"
                    : "false"
                }
                className="border-amber-100/40 bg-amber-100/10 hover:border-amber-100/80 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                onClick={() => {
                  const finalPage =
                    dialoguePageIndex >= dialogue.sequence.pages.length - 1;
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
                    !requestCutsceneById(dialogue.cutsceneId, { preempt: true })
                  ) {
                    setError(
                      `Could not start story scene ${dialogue.cutsceneId}.`
                    );
                  }
                  window.setTimeout(() => void refresh(), 650);
                }}
              >
                {dialoguePageIndex >= dialogue.sequence.pages.length - 1
                  ? dialogue.sequence.completionLabel ??
                    (dialogue.mode === "objective" && state.choice
                      ? "Choose"
                      : "Continue")
                  : "Next"}
              </button>
            </div>
            {error && <div className="text-red-200 mt-3 text-sm">{error}</div>}
          </div>
        </div>
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
          <div className="border-amber-200/40 rounded-xl bg-slate-950/95 w-full max-w-xl border p-5 text-white shadow-2xl">
            <div className="text-amber-200 text-xs font-bold uppercase tracking-[0.18em]">
              {state.choice.title}
            </div>
            <p className="text-base mt-3 leading-relaxed text-white/90">
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
