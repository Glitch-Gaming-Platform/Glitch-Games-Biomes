import {
  activeQuestVoiceContextForNpc,
  defaultDialogForNpc,
  playerVoiceContextForNpcChat,
  useRelevantStepsForEntity,
} from "@/client/components/challenges/helpers";
import {
  isHarthmereCombatCreatureNpcType,
  isHarthmereNonLivingDialogueObjectLabel,
} from "@/client/components/challenges/dialogueObjectSemantics";
import { TalkToNpc } from "@/client/components/challenges/TalkDialogModal";
import {
  contextForLiveEntityHelperQuest,
  useLiveEntityHelperQuestDialog,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import { useLocalDevHarthmereDialog } from "@/client/components/challenges/LocalDevHarthmereQuests";
import { useHarthmereBibleQuestDialog } from "@/client/components/challenges/LocalDevHarthmereBibleQuests";
import { useSnapshotMissionDialog } from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  snapshotGroveNpcIdForDialogLabel,
  useSnapshotGroveNpcDialog,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { useSnapshotLiveNpcLoreDialog } from "@/client/components/challenges/LocalDevSnapshotLiveNpcLoreRuntime";
import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";
import { submitHarthmereDialogueLiveModeChoice } from "@/client/components/challenges/dialogueLiveModeReputation";
import {
  harthmereFallbackNpcDialogText,
  harthmereFallbackNpcOptions,
  isHarthmerePlaceholderNpcDialog,
} from "@/shared/harthmere/npc_dialog_fallback";
import { getLiveEntityHelperQuestForEntity } from "@/shared/harthmere/live_entity_helper_quests";
import { isPlayer } from "@/shared/game/players";
import { snapshotLiveNpcLoreForDialog } from "@/shared/harthmere/snapshot_live_npc_bible";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { ClientContextSubset } from "@/client/game/context";
import type {
  GeneratedChatRequest,
  GeneratedChatResponse,
} from "@/pages/api/npcs/generated_chat";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import {
  maybeIdToNpcType,
  relevantBiscuitForEntityId,
} from "@/shared/npc/bikkie";
import { jsonPost } from "@/shared/util/fetch_helpers";
import { useCallback, useEffect, useRef, useState } from "react";

export function useCanTalkToNpc(
  deps: ClientContextSubset<"resources" | "reactResources">,
  entityId: BiomesId
) {
  const [
    label,
    defaultDialog,
    entityDescription,
    questGiver,
    position,
    robotComponent,
    appearanceComponent,
    npcMetadata,
    playerStatus,
  ] = deps.reactResources.useAll(
    ["/ecs/c/label", entityId],
    ["/ecs/c/default_dialog", entityId],
    ["/ecs/c/entity_description", entityId],
    ["/ecs/c/quest_giver", entityId],
    ["/ecs/c/position", entityId],
    ["/ecs/c/robot_component", entityId],
    ["/ecs/c/appearance_component", entityId],
    ["/ecs/c/npc_metadata", entityId],
    ["/ecs/c/player_status", entityId]
  );
  const remoteConnection = deps.reactResources.use(
    "/ecs/c/remote_connection",
    entityId
  );
  const iced = deps.reactResources.use("/ecs/c/iced", entityId);
  // HARTHMERE_NO_TALK_TO_REAL_PLAYERS: a real remote player carries a
  // `remote_connection` component (NPCs never do). Player-like NPC appearance +
  // player_status otherwise satisfy the helper-quest / dialogue classifiers
  // below, so another human player would wrongly show a "Talk" prompt and open
  // NPC/quest dialogue. Talking to real players must instead open the player
  // view + chat, so short-circuit here and never treat a player as an NPC.
  if (remoteConnection) {
    return false;
  }
  // current: parity with `canTalkToNpc` — read the biscuit so biscuit-only
  // signals (isRobot, isPlayerLikeAppearance, npcDefaultDialog, isMount)
  // feed the helper-quest classifier the same way they feed the talk
  // gate. Without this, an entity that the talk overlay accepts via its
  // biscuit could fail the helper-quest classifier from this hook and the
  // "Help with…" option would silently disappear.
  let relevantBiscuit:
    | ReturnType<typeof relevantBiscuitForEntityId>
    | undefined;
  try {
    relevantBiscuit = relevantBiscuitForEntityId(deps.resources, entityId);
  } catch {
    relevantBiscuit = undefined;
  }
  const liveEntityHelperQuest = getLiveEntityHelperQuestForEntity(
    contextForLiveEntityHelperQuest({
      entityId,
      label: label?.text,
      position: position?.v,
      defaultDialog: defaultDialog?.text,
      entityDescription: entityDescription?.text,
      questGiver,
      robotComponent,
      appearanceComponent,
      npcMetadata,
      playerStatus,
      relevantBiscuit,
      iced,
    })
  );
  // Muckers / hexers / huntable wildlife are combat creatures, never talkable.
  if (isHarthmereCombatCreatureNpcType(npcMetadata?.type_id)) {
    return false;
  }
  if (
    isHarthmereNonLivingDialogueObjectLabel({
      label: label?.text,
      entityDescription: entityDescription?.text,
    })
  ) {
    return false;
  }
  return (
    canTalkToNpc(deps, entityId) ||
    Boolean(liveEntityHelperQuest) ||
    Boolean(
      snapshotGroveNpcIdForDialogLabel({
        label: label?.text,
        entityDescriptionText: entityDescription?.text,
      })
    ) ||
    Boolean(
      snapshotLiveNpcLoreForDialog({
        label: label?.text,
        entityDescriptionText: entityDescription?.text,
      })
    )
  );
}

export function canTalkToNpc(
  deps: ClientContextSubset<"resources">,
  entityId: BiomesId
) {
  let item: ReturnType<typeof relevantBiscuitForEntityId> | undefined;
  try {
    item = relevantBiscuitForEntityId(deps.resources, entityId);
  } catch {
    item = undefined;
  }
  const entity = deps.resources.get("/ecs/entity", entityId);
  // HARTHMERE_NO_TALK_TO_REAL_PLAYERS: real remote players (remote_connection)
  // are never NPCs; talking to them opens the player view + chat, not dialogue.
  if (isPlayer(entity)) {
    return false;
  }
  const npcType = entity?.npc_metadata
    ? maybeIdToNpcType(entity.npc_metadata.type_id)
    : undefined;
  const entityDescription = deps.resources.get(
    "/ecs/c/entity_description",
    entityId
  );
  const defaultDialog = deps.resources.get("/ecs/c/default_dialog", entityId);
  const questGiver = deps.resources.get("/ecs/c/quest_giver", entityId);
  const label = deps.resources.get("/ecs/c/label", entityId);
  // Muckers / hexers / huntable wildlife are combat creatures, never talkable —
  // even though they carry an entity_description that the gate below would
  // otherwise accept as a "talk" signal.
  if (isHarthmereCombatCreatureNpcType(entity?.npc_metadata?.type_id)) {
    return false;
  }
  if (
    isHarthmereNonLivingDialogueObjectLabel({
      label: label?.text,
      entityDescription: entityDescription?.text,
    })
  ) {
    return false;
  }
  const hasDefaultDialog =
    typeof item?.npcDefaultDialog === "string" ||
    typeof npcType?.npcDefaultDialog === "string" ||
    Boolean(defaultDialog?.text);
  const liveEntityHelperQuest = getLiveEntityHelperQuestForEntity(
    contextForLiveEntityHelperQuest({
      entityId,
      label: label?.text,
      position: entity?.position?.v,
      defaultDialog: defaultDialog?.text,
      entityDescription: entityDescription?.text,
      questGiver,
      robotComponent: entity?.robot_component,
      appearanceComponent: entity?.appearance_component,
      npcMetadata: entity?.npc_metadata,
      playerStatus: entity?.player_status,
      relevantBiscuit: item,
      iced: entity?.iced,
    })
  );
  if ((Boolean(questGiver) || entityDescription?.text) && entityId) {
    return true;
  } else if (hasDefaultDialog && entityId) {
    return true;
  } else if (npcType?.isPlayerLikeAppearance && entityId) {
    return true;
  } else if (item?.isMount) {
    return true;
  } else if (liveEntityHelperQuest) {
    return true;
  }

  return false;
}

function liveEntityHelperConversationActions(
  displayName: string | undefined
): TalkDialogStepAction[] {
  const name = displayName?.trim() || "this traveler";
  return [
    {
      name: "Ask what happened here",
      followUpText:
        "The Biome edge is unstable. The Muck is pushing harder than it should, and anyone out here needs supplies, Exotic Matter, or a serious threat cleared before the damage spreads.",
      onPerformed() {},
    },
    {
      name: `Thank ${name} for the warning`,
      followUpText:
        "They nod and keep watching the boundary. Out here, a useful warning can be worth more than a long speech.",
      onPerformed() {},
    },
  ];
}

export const TalkToNpcDefaultDialog: React.FunctionComponent<{
  talkingToNPCId: BiomesId;
  onClose: () => unknown;
}> = ({ talkingToNPCId, onClose }) => {
  const clientContext = useClientContext();
  const { resources, reactResources, userId } = clientContext;
  const initialDefaultDialog = defaultDialogForNpc(resources, talkingToNPCId);
  const label = resources.get("/ecs/c/label", talkingToNPCId)?.text;
  const entityDescription = resources.get(
    "/ecs/c/entity_description",
    talkingToNPCId
  )?.text;
  const snapshotMissionDialog = useSnapshotMissionDialog(
    talkingToNPCId,
    initialDefaultDialog
  );
  const snapshotGroveNpcDialog = useSnapshotGroveNpcDialog(
    talkingToNPCId,
    initialDefaultDialog
  );
  const snapshotLiveNpcLoreDialog = useSnapshotLiveNpcLoreDialog(
    talkingToNPCId,
    initialDefaultDialog
  );
  const localDevHarthmereDialog = useLocalDevHarthmereDialog(
    talkingToNPCId,
    initialDefaultDialog
  );
  const liveEntityHelperDialog = useLiveEntityHelperQuestDialog(talkingToNPCId);
  // HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): offers,
  // objective advancement, and turn-ins for the 85-quest bible catalog —
  // previously unreachable from any player surface (2026-07-14 audit, Q-1).
  const bibleQuestDialog = useHarthmereBibleQuestDialog(talkingToNPCId);
  const relevantQuestSteps = useRelevantStepsForEntity(talkingToNPCId);
  const [id, setId] = useState(0);
  const fallbackDialogText = harthmereFallbackNpcDialogText({
    name: label,
    description: entityDescription ?? initialDefaultDialog,
  });
  const applyDialogueReputationChoice = useCallback(
    (message: string, likeabilityDelta: number) => {
      if (likeabilityDelta === 0) {
        return;
      }
      applyHarthmereReputationChange({
        label: message,
        detail: `Player chose "${message}" when talking to NPC ${talkingToNPCId}.`,
        npcOffset: Number(talkingToNPCId),
        harthmere: {
          likeability: likeabilityDelta > 0 ? 1 : likeabilityDelta < 0 ? -1 : 0,
        },
        personal: { likeability: likeabilityDelta },
      });
      void submitHarthmereDialogueLiveModeChoice({
        entityId: talkingToNPCId,
        label,
        message,
        likeabilityDelta,
      }).catch((error) => {
        log.warn("Failed to persist NPC dialogue reputation to live mode", {
          error,
          talkingToNPCId,
          dialogueMessage: message,
          likeabilityDelta,
        });
      });
    },
    [label, talkingToNPCId]
  );
  const shouldUseFallbackDialog =
    isHarthmerePlaceholderNpcDialog(initialDefaultDialog);
  const [currentDialog, setCurrentDialog] = useState(
    shouldUseFallbackDialog ? fallbackDialogText : initialDefaultDialog
  );
  let relevantBiscuit:
    | ReturnType<typeof relevantBiscuitForEntityId>
    | undefined;
  try {
    relevantBiscuit = relevantBiscuitForEntityId(
      clientContext.resources,
      talkingToNPCId
    );
  } catch {
    relevantBiscuit = undefined;
  }
  const makeFallbackActions = useCallback((): TalkDialogStepAction[] => {
    return harthmereFallbackNpcOptions({
      name: label,
      description: entityDescription ?? currentDialog,
    }).map((option) => ({
      name: option.name,
      type: option.type,
      followUpText: option.followUpText,
      onPerformed() {
        applyDialogueReputationChoice(option.name, option.likeability);
      },
    }));
  }, [
    applyDialogueReputationChoice,
    currentDialog,
    entityDescription,
    label,
    talkingToNPCId,
  ]);
  const [additionalActions, setAdditionalActions] = useState<
    TalkDialogStepAction[]
  >(() => {
    if (shouldUseFallbackDialog) {
      return makeFallbackActions();
    }
    if (!resources.get("/ecs/c/entity_description", talkingToNPCId)?.text) {
      if (relevantBiscuit && relevantBiscuit.isMount) {
        return [
          {
            name: "Sing Song",
            onPerformed() {
              void respondWith(undefined);
            },
          },
        ];
      }
      return makeFallbackActions();
    }

    return [
      {
        name: "Chit Chat",
        onPerformed() {
          void respondWith(undefined);
        },
      },
      ...makeFallbackActions(),
    ];
  });
  const [querying, setQuerying] = useState(false);
  const [voiceConversationActive, setVoiceConversationActive] = useState(false);

  const lastMessageContext = useRef<string | undefined>(undefined);
  const lastVoiceQuestContext = useRef<string | undefined>(undefined);
  useEffect(() => {
    lastMessageContext.current = undefined;
    lastVoiceQuestContext.current = undefined;
    setVoiceConversationActive(false);
    setQuerying(false);
  }, [talkingToNPCId]);
  const withLiveEntityHelperDialogText = useCallback(
    (dialogText: string) => {
      // HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): bible
      // quest dialogue (offer/objective/turn-in flavor) is prepended the same
      // way helper-quest dialogue is, so both can coexist on one NPC.
      const withBible = bibleQuestDialog?.dialogText
        ? `${bibleQuestDialog.dialogText}{break}${dialogText}`
        : dialogText;
      return liveEntityHelperDialog?.dialogText
        ? `${liveEntityHelperDialog.dialogText}{break}${withBible}`
        : withBible;
    },
    [liveEntityHelperDialog?.dialogText, bibleQuestDialog?.dialogText]
  );
  const withLiveEntityHelperActions = useCallback(
    (actions: TalkDialogStepAction[]) => [
      // Bible quest actions first: starting/advancing the main story is the
      // highest-signal thing a giver NPC can offer (bible-wiring fix,
      // 2026-07-14).
      ...(bibleQuestDialog?.actions ?? []),
      ...(liveEntityHelperDialog?.actions ?? []),
      ...actions,
    ],
    [liveEntityHelperDialog?.actions, bibleQuestDialog?.actions]
  );

  const respondWith = useCallback(
    async (message: string | undefined, questContext?: string) => {
      setQuerying(true);
      try {
        const res = await jsonPost<GeneratedChatResponse, GeneratedChatRequest>(
          "/api/npcs/generated_chat",
          {
            entityId: talkingToNPCId,
            messageContext: lastMessageContext.current,
            userResponse: message,
            questContext,
            userContext: playerVoiceContextForNpcChat({
              reactResources,
              userId,
            }),
          }
        );
        setCurrentDialog(res.nextDialog.message);
        setId((old) => old + 1);
        lastMessageContext.current = res.messageContext;

        // Apply the likeability change for the option the player just chose.
        // likeabilityDelta is undefined on the opening message (no choice yet).
        if (res.nextDialog.likeabilityDelta !== undefined && message) {
          applyDialogueReputationChoice(
            message,
            res.nextDialog.likeabilityDelta
          );
        }

        // Build button actions, annotating each with its expected likeability
        // consequence so the client can show a preview hint (e.g. red tint on
        // destructive options, green tint on friendly ones).
        const buttonLikeability = res.nextDialog.buttonLikeability ?? {};
        setAdditionalActions(
          res.nextDialog.buttons.map((e): TalkDialogStepAction => {
            const delta = buttonLikeability[e];
            return {
              name: e,
              type:
                delta !== undefined && delta < 0 ? "destructive" : undefined,
              tooltip:
                delta !== undefined && delta !== 0
                  ? delta > 0
                    ? `+${delta} relationship with this NPC`
                    : `${delta} relationship with this NPC`
                  : undefined,
              onPerformed: () => {
                void respondWith(e, lastVoiceQuestContext.current);
              },
            };
          })
        );
      } catch (error: any) {
        log.error("Error querying for generated chat", { error });
        const fallbackActions = makeFallbackActions();
        const matchedAction = message
          ? fallbackActions.find((action) => action.name === message)
          : undefined;
        matchedAction?.onPerformed();
        setCurrentDialog(matchedAction?.followUpText ?? fallbackDialogText);
        setAdditionalActions(fallbackActions);
      } finally {
        setQuerying(false);
      }
    },
    [
      applyDialogueReputationChoice,
      fallbackDialogText,
      makeFallbackActions,
      reactResources,
      talkingToNPCId,
      userId,
    ]
  );
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const questContext = activeQuestVoiceContextForNpc(relevantQuestSteps);
      lastVoiceQuestContext.current = questContext;
      setVoiceConversationActive(true);
      void respondWith(text, questContext);
    },
    [relevantQuestSteps, respondWith]
  );
  const voiceInput = {
    disabled: querying,
    onTranscript: handleVoiceTranscript,
  };

  if (!voiceConversationActive && liveEntityHelperDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={liveEntityHelperDialog.id}
        dialogText={liveEntityHelperDialog.dialogText}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={[
          ...liveEntityHelperDialog.actions,
          ...liveEntityHelperConversationActions(label),
        ].map((e) => ({
          ...e,
          disabled: querying || e.disabled,
        }))}
        voiceInput={voiceInput}
      />
    );
  }

  // GROVE_FOUNTAIN_TUTORIALS:
  // Grove bible/tutorial dialogue must win before the Road Ahead runtime bridge.
  // Otherwise Jackie always shows only the bridge and the fountain lessons
  // assigned to Jackie/Rosalyn/Taye/Nia are technically present but invisible.
  if (!voiceConversationActive && snapshotGroveNpcDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={snapshotGroveNpcDialog.id}
        dialogText={withLiveEntityHelperDialogText(
          snapshotGroveNpcDialog.dialogText
        )}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={withLiveEntityHelperActions(
          snapshotGroveNpcDialog.actions
        )}
        voiceInput={voiceInput}
      />
    );
  }

  if (!voiceConversationActive && snapshotMissionDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={snapshotMissionDialog.id}
        dialogText={withLiveEntityHelperDialogText(
          snapshotMissionDialog.dialogText
        )}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={withLiveEntityHelperActions(
          snapshotMissionDialog.actions
        )}
        voiceInput={voiceInput}
      />
    );
  }

  if (!voiceConversationActive && snapshotLiveNpcLoreDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={snapshotLiveNpcLoreDialog.id}
        dialogText={withLiveEntityHelperDialogText(
          snapshotLiveNpcLoreDialog.dialogText
        )}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={withLiveEntityHelperActions(
          snapshotLiveNpcLoreDialog.actions
        )}
        voiceInput={voiceInput}
      />
    );
  }

  if (!voiceConversationActive && localDevHarthmereDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={localDevHarthmereDialog.id}
        dialogText={withLiveEntityHelperDialogText(
          localDevHarthmereDialog.dialogText
        )}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={withLiveEntityHelperActions(
          localDevHarthmereDialog.actions
        )}
        voiceInput={voiceInput}
      />
    );
  }

  return (
    <TalkToNpc
      talkingToNpcId={talkingToNPCId}
      id={id}
      dialogText={
        querying
          ? "<text>[looks deep in thought...]</text>"
          : withLiveEntityHelperDialogText(currentDialog)
      }
      completeStep={onClose}
      advanceText="Close"
      buttonLayout="vertical"
      additionalActions={withLiveEntityHelperActions(additionalActions).map(
        (e) => ({
          ...e,
          disabled: querying || e.disabled,
        })
      )}
      voiceInput={voiceInput}
    />
  );
};
