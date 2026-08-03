// HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14) — React layer
// for the bible quest catalog.
//
// Three surfaces, all backed by the pure adapter (bibleQuestLiveAdapter.ts)
// and the server-authoritative live_mode operations:
//
//   1. `useHarthmereBibleQuestDialog(npcId)` — composed into the NPC talk
//      dialog: quest offers, current-objective actions, and turn-ins for the
//      19 catalog givers. This is the surface that was entirely missing —
//      the audit found the Q1–Q12 main arc could not be started by any
//      player action.
//   2. `HarthmereBibleQuestRuntimeController` — mounted once in the unified
//      HUD. Polls the quest snapshot, auto-accepts hidden world-trigger
//      quests on proximity, and renders the Thaedryn encounter panel while
//      Q12 is active near the arena.
//   3. The Thaedryn encounter panel — chain anchors / fallen bell / path
//      commitment / resolution, each a server boss event. Attacks flow
//      through the normal combat path (the boss is a live combat entity).

import {
  HARTHMERE_BIBLE_QUEST_EVENT,
  bibleQuestTrackableQuestsForBiomesUI,
  harthmereBibleDialogModelForGiver,
  harthmereBibleGiverIdForNpcLabel,
  harthmereBibleHiddenQuestToTrigger,
  harthmereBibleQuestInteractionModel,
  harthmereBibleOperationPayloadForAction,
  harthmereThaedrynEncounterModel,
  readHarthmereBibleQuestSnapshot,
  submitHarthmereBibleQuestOperation,
  type HarthmereBibleQuestClientSnapshot,
} from "@/client/components/challenges/bibleQuestLiveAdapter";
import { playerFacingQuestActionErrorMessage } from "@/client/components/challenges/questActionError";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { addToast } from "@/client/components/toast/helpers";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function textBlock(text: string) {
  return `<text>${text}</text>`;
}

/** Shared snapshot poll: one fetch per event/interval, all consumers reuse. */
function useHarthmereBibleQuestSnapshot(pollMs = 15_000) {
  const [snapshot, setSnapshot] = useState<
    HarthmereBibleQuestClientSnapshot | undefined
  >(undefined);
  const [refreshToken, setRefreshToken] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setRefreshToken((old) => old + 1);
    window.addEventListener(HARTHMERE_BIBLE_QUEST_EVENT, refresh);
    const interval = window.setInterval(refresh, pollMs);
    return () => {
      window.removeEventListener(HARTHMERE_BIBLE_QUEST_EVENT, refresh);
      window.clearInterval(interval);
    };
  }, [pollMs]);
  useEffect(() => {
    let cancelled = false;
    readHarthmereBibleQuestSnapshot()
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((error) => {
        // Read failures are non-fatal (offline/glitch sessions): the dialog
        // simply shows no bible content until the next successful poll.
        log.warn("bible quest snapshot read failed", { error });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);
  return snapshot;
}

/**
 * Talk-dialog hook for bible quest givers. Returns undefined for NPCs that
 * give no bible quests, so TalkToNPCDefaultDialog can compose it exactly like
 * the live-entity-helper dialog (prepend text + actions when present).
 */
export function useHarthmereBibleQuestDialog(talkingToNPCId: BiomesId):
  | {
      dialogText?: string;
      actions: TalkDialogStepAction[];
    }
  | undefined {
  const { reactResources } = useClientContext();
  const label = reactResources.use("/ecs/c/label", talkingToNPCId)?.text;
  const snapshot = useHarthmereBibleQuestSnapshot();
  const [busy, setBusy] = useState(false);
  const [followUp, setFollowUp] = useState<string | undefined>(undefined);

  const giverId = useMemo(
    () => harthmereBibleGiverIdForNpcLabel(label),
    [label]
  );

  const model = useMemo(() => {
    if (!giverId || !snapshot) return undefined;
    return harthmereBibleDialogModelForGiver({
      giverId,
      snapshot,
      actorId: snapshot.actorId,
      playerLevel: snapshot.playerLevel,
      nowMs: snapshot.serverNowMs,
    });
  }, [giverId, snapshot]);

  const perform = useCallback(
    async (payload: Record<string, unknown>, followUpText: string) => {
      setFollowUp(undefined);
      setBusy(true);
      try {
        await submitHarthmereBibleQuestOperation(payload);
        setFollowUp(followUpText);
      } catch (error) {
        log.warn("bible quest operation rejected", { error, payload });
        throw error;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (!giverId || !model || (!model.actions.length && !model.introText)) {
    return undefined;
  }
  return {
    dialogText: followUp
      ? textBlock(followUp)
      : model.introText
      ? textBlock(model.introText)
      : undefined,
    actions: model.actions.map((action) => ({
      name: action.name,
      type: action.kind === "turn_in" ? "primary" : undefined,
      tooltip: action.tooltip,
      disabled: busy,
      followUpText: textBlock(action.followUpText),
      onPerformed: () =>
        perform(
          harthmereBibleOperationPayloadForAction(action),
          action.followUpText
        ),
    })),
  };
}

/** Journal adapter passthrough (used by mapLiveAdapter.getTrackableQuests). */
export { bibleQuestTrackableQuestsForBiomesUI };

// ---------------------------------------------------------------------------
// Runtime controller: hidden world triggers + Thaedryn encounter panel.
// ---------------------------------------------------------------------------
export const HarthmereBibleQuestRuntimeController: React.FunctionComponent<{}> =
  () => {
    const { reactResources, resources } = useClientContext();
    const localPlayer = reactResources.use("/scene/local_player");
    const snapshot = useHarthmereBibleQuestSnapshot();
    const [busyActionId, setBusyActionId] = useState<string | undefined>();
    // Hidden-trigger dedupe: never re-post the same auto-accept in a session
    // even if the server rejects it (e.g. storm-gated quest in clear weather).
    const attemptedHiddenTriggers = useRef<Set<string>>(new Set());

    const playerPosition = localPlayer?.player?.position as
      | [number, number, number]
      | undefined;

    // Hidden world-trigger quests: standing on the trigger accepts the quest
    // (subject to server-side weather/time activation rules).
    useEffect(() => {
      if (!snapshot || !playerPosition) return;
      const questId = harthmereBibleHiddenQuestToTrigger({
        playerPosition,
        snapshot,
      });
      if (!questId || attemptedHiddenTriggers.current.has(questId)) return;
      attemptedHiddenTriggers.current.add(questId);
      submitHarthmereBibleQuestOperation({
        operation: "bible_quest_accept",
        questId,
        // Use the exact weather context projected by the server so hidden
        // discovery and mutation validation cannot disagree.
        weather: snapshot.weatherClaim,
      }).catch((error) => {
        const playerMessage = playerFacingQuestActionErrorMessage(error);
        if (playerMessage) {
          addToast(resources, {
            kind: "interaction_error",
            id: `hidden-bible-quest-rejected:${questId}`,
            error: {
              kind: "message",
              message: playerMessage,
              time: Date.now(),
            },
          });
        }
        log.info("hidden bible quest trigger not accepted", {
          questId,
          error,
        });
      });
    }, [resources, snapshot, playerPosition?.[0], playerPosition?.[2]]);

    const encounter = useMemo(
      () =>
        snapshot
          ? harthmereThaedrynEncounterModel({ snapshot, playerPosition })
          : undefined,
      [snapshot, playerPosition?.[0], playerPosition?.[2]]
    );
    const questInteraction = useMemo(
      () =>
        snapshot
          ? harthmereBibleQuestInteractionModel({
              snapshot,
              playerPosition,
            })
          : undefined,
      [snapshot, playerPosition?.[0], playerPosition?.[2]]
    );

    const performBossAction = useCallback(
      (id: string, payload: Record<string, unknown>) => {
        setBusyActionId(id);
        submitHarthmereBibleQuestOperation(payload)
          .catch((error) =>
            log.warn("thaedryn boss action rejected", { error, payload })
          )
          .finally(() => setBusyActionId(undefined));
      },
      []
    );

    const performContextualAction = useCallback(
      (action: NonNullable<typeof questInteraction>["action"]) => {
        if (!action) return;
        setBusyActionId(
          `contextual:${action.questId}:${action.objectiveId ?? action.kind}`
        );
        submitHarthmereBibleQuestOperation(
          harthmereBibleOperationPayloadForAction(action)
        )
          .catch((error) =>
            log.warn("contextual bible quest action rejected", {
              error,
              action,
            })
          )
          .finally(() => setBusyActionId(undefined));
      },
      [questInteraction]
    );

    if (questInteraction?.action) {
      const action = questInteraction.action;
      return (
        <div
          style={{
            position: "fixed",
            right: 16,
            top: "30%",
            width: 300,
            zIndex: 40,
            background: "rgba(12, 10, 18, 0.9)",
            border: "1px solid rgba(190, 242, 100, 0.5)",
            borderRadius: 8,
            padding: 12,
            color: "#f4f7e8",
            fontSize: 12,
            pointerEvents: "auto",
          }}
          data-testid={`bible-quest-objective-panel-${questInteraction.questId}`}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {questInteraction.title}
          </div>
          <div style={{ opacity: 0.85, marginBottom: 8 }}>
            {questInteraction.objective ??
              "The discovery is ready to finish."}
          </div>
          <button
            disabled={
              !questInteraction.nearObjective || busyActionId !== undefined
            }
            title={
              questInteraction.nearObjective
                ? action.tooltip
                : "Follow the quest marker and stand near the objective."
            }
            onClick={() => performContextualAction(action)}
            style={{
              width: "100%",
              padding: "7px 9px",
              background: questInteraction.nearObjective
                ? "rgba(190, 242, 100, 0.25)"
                : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 6,
              color: "inherit",
              cursor: questInteraction.nearObjective
                ? "pointer"
                : "not-allowed",
              opacity: questInteraction.nearObjective ? 1 : 0.55,
            }}
          >
            {questInteraction.nearObjective
              ? action.name
              : "Move closer to the marked objective"}
          </button>
        </div>
      );
    }

    if (!encounter?.active || !encounter.nearArena) {
      return null;
    }
    // Minimal, dependency-free panel (matches the LocalDev debug-surface
    // styling conventions): phase + health + chains, then the boss actions.
    return (
      <div
        style={{
          position: "fixed",
          right: 16,
          top: "30%",
          width: 280,
          zIndex: 40,
          background: "rgba(12, 10, 18, 0.88)",
          border: "1px solid rgba(255, 205, 120, 0.5)",
          borderRadius: 8,
          padding: 12,
          color: "#f4e8d0",
          fontSize: 12,
          pointerEvents: "auto",
        }}
        data-testid="thaedryn-encounter-panel"
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          Thaedryn the Bellbound
        </div>
        <div style={{ opacity: 0.85, marginBottom: 8 }}>
          Phase: {encounter.phaseId?.replace(/_/g, " ")} · Health:{" "}
          {Math.round(encounter.healthPct ?? 0)}% · Chains:{" "}
          {encounter.chainsRemaining}
          {encounter.chosenPath ? ` · Path: ${encounter.chosenPath}` : ""}
        </div>
        {encounter.actions.map((action) => (
          <button
            key={action.id}
            title={action.tooltip}
            disabled={action.disabled || busyActionId === action.id}
            onClick={() => performBossAction(action.id, action.payload)}
            style={{
              display: "block",
              width: "100%",
              marginBottom: 6,
              padding: "6px 8px",
              background:
                action.id === "resolve"
                  ? "rgba(255, 205, 120, 0.25)"
                  : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 6,
              color: "inherit",
              cursor: action.disabled ? "not-allowed" : "pointer",
              opacity: action.disabled ? 0.45 : 1,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };
