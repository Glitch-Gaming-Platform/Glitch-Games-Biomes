import { defaultDialogForNpc } from "@/client/components/challenges/helpers";
import { TalkToNpc } from "@/client/components/challenges/TalkDialogModal";
import {
  contextForLiveEntityHelperQuestV1,
  useLiveEntityHelperQuestDialogV1,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import { useLocalDevHarthmereDialog } from "@/client/components/challenges/LocalDevHarthmereQuests";
import { useSnapshotMissionDialogV71 } from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  snapshotGroveNpcIdForDialogLabelV103,
  useSnapshotGroveNpcDialogV75,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { useSnapshotLiveNpcLoreDialogV79 } from "@/client/components/challenges/LocalDevSnapshotLiveNpcLoreRuntimeV79";
import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";
import {
  harthmereFallbackNpcDialogTextV143,
  harthmereFallbackNpcOptionsV143,
  isHarthmerePlaceholderNpcDialogV143,
} from "@/shared/harthmere/npc_dialog_fallback_v143";
import { getLiveEntityHelperQuestForEntityV1 } from "@/shared/harthmere/live_entity_helper_quests_v1";
import { snapshotLiveNpcLoreForDialogV79 } from "@/shared/harthmere/snapshot_live_npc_bible_v79";
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
import { useCallback, useRef, useState } from "react";

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
  const iced = deps.reactResources.use("/ecs/c/iced", entityId);
  // V148: parity with `canTalkToNpc` — read the biscuit so biscuit-only
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
  const liveEntityHelperQuest = getLiveEntityHelperQuestForEntityV1(
    contextForLiveEntityHelperQuestV1({
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
  return (
    canTalkToNpc(deps, entityId) ||
    Boolean(liveEntityHelperQuest) ||
    Boolean(
      snapshotGroveNpcIdForDialogLabelV103({
        label: label?.text,
        entityDescriptionText: entityDescription?.text,
      })
    ) ||
    Boolean(
      snapshotLiveNpcLoreForDialogV79({
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
  const hasDefaultDialog =
    typeof item?.npcDefaultDialog === "string" ||
    typeof npcType?.npcDefaultDialog === "string" ||
    Boolean(defaultDialog?.text);
  const liveEntityHelperQuest = getLiveEntityHelperQuestForEntityV1(
    contextForLiveEntityHelperQuestV1({
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

function liveEntityHelperConversationActionsV1(
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
  const { resources } = clientContext;
  const initialDefaultDialog = defaultDialogForNpc(resources, talkingToNPCId);
  const label = resources.get("/ecs/c/label", talkingToNPCId)?.text;
  const entityDescription = resources.get(
    "/ecs/c/entity_description",
    talkingToNPCId
  )?.text;
  const snapshotMissionDialog = useSnapshotMissionDialogV71(
    talkingToNPCId,
    initialDefaultDialog
  );
  const snapshotGroveNpcDialog = useSnapshotGroveNpcDialogV75(
    talkingToNPCId,
    initialDefaultDialog
  );
  const snapshotLiveNpcLoreDialog = useSnapshotLiveNpcLoreDialogV79(
    talkingToNPCId,
    initialDefaultDialog
  );
  const localDevHarthmereDialog = useLocalDevHarthmereDialog(
    talkingToNPCId,
    initialDefaultDialog
  );
  const liveEntityHelperDialog =
    useLiveEntityHelperQuestDialogV1(talkingToNPCId);
  const [id, setId] = useState(0);
  const fallbackDialogText = harthmereFallbackNpcDialogTextV143({
    name: label,
    description: entityDescription ?? initialDefaultDialog,
  });
  const shouldUseFallbackDialog =
    isHarthmerePlaceholderNpcDialogV143(initialDefaultDialog);
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
    return harthmereFallbackNpcOptionsV143({
      name: label,
      description: entityDescription ?? currentDialog,
    }).map((option) => ({
      name: option.name,
      type: option.type,
      followUpText: option.followUpText,
      onPerformed() {
        applyHarthmereReputationChange({
          label: `Talked with ${label ?? "a townsperson"}`,
          detail: option.name,
          scope: "personal",
          npcOffset: Number(talkingToNPCId),
          harthmere: { likeability: option.likeability > 0 ? 1 : -1 },
          personal: { likeability: option.likeability },
        });
      },
    }));
  }, [currentDialog, entityDescription, label, talkingToNPCId]);
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

  const lastMessageContext = useRef<string | undefined>(undefined);
  const withLiveEntityHelperDialogText = useCallback(
    (dialogText: string) =>
      liveEntityHelperDialog?.dialogText
        ? `${liveEntityHelperDialog.dialogText}{break}${dialogText}`
        : dialogText,
    [liveEntityHelperDialog?.dialogText]
  );
  const withLiveEntityHelperActions = useCallback(
    (actions: TalkDialogStepAction[]) => [
      ...(liveEntityHelperDialog?.actions ?? []),
      ...actions,
    ],
    [liveEntityHelperDialog?.actions]
  );

  const respondWith = useCallback(
    async (message: string | undefined) => {
      setQuerying(true);
      try {
        const res = await jsonPost<GeneratedChatResponse, GeneratedChatRequest>(
          "/api/npcs/generated_chat",
          {
            entityId: talkingToNPCId,
            messageContext: lastMessageContext.current,
            userResponse: message,
          }
        );
        setCurrentDialog(res.nextDialog.message);
        setId((old) => old + 1);
        lastMessageContext.current = res.messageContext;

        // Apply the likeability change for the option the player just chose.
        // likeabilityDelta is undefined on the opening message (no choice yet).
        if (res.nextDialog.likeabilityDelta !== undefined && message) {
          applyHarthmereReputationChange({
            label: message,
            detail: `Player chose "${message}" when talking to NPC ${talkingToNPCId}.`,
            npcOffset: Number(talkingToNPCId),
            personal: { likeability: res.nextDialog.likeabilityDelta },
          });
        }

        // Build button actions, annotating each with its expected likeability
        // consequence so the client can show a preview hint (e.g. red tint on
        // destructive options, green tint on friendly ones).
        const buttonLikeability = res.nextDialog.buttonLikeability ?? {};
        setAdditionalActions(
          res.nextDialog.buttons.map(
            (e): TalkDialogStepAction => {
              const delta = buttonLikeability[e];
              return {
                name: e,
                type: delta !== undefined && delta < 0 ? "destructive" : undefined,
                tooltip: delta !== undefined && delta !== 0
                  ? delta > 0
                    ? `+${delta} relationship with this NPC`
                    : `${delta} relationship with this NPC`
                  : undefined,
                onPerformed: () => {
                  void respondWith(e);
                },
              };
            }
          )
        );
      } catch (error: any) {
        log.error("Error querying for generated chat", { error });
        const fallbackActions = makeFallbackActions();
        const matchedAction = message
          ? fallbackActions.find((action) => action.name === message)
          : undefined;
        setCurrentDialog(matchedAction?.followUpText ?? fallbackDialogText);
        setAdditionalActions(fallbackActions);
      } finally {
        setQuerying(false);
      }
    },
    [fallbackDialogText, makeFallbackActions, talkingToNPCId]
  );

  if (liveEntityHelperDialog) {
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
          ...liveEntityHelperConversationActionsV1(label),
        ].map((e) => ({
          ...e,
          disabled: querying || e.disabled,
        }))}
      />
    );
  }

  // GROVE_FOUNTAIN_TUTORIALS_V101:
  // Grove bible/tutorial dialogue must win before the legacy Road Ahead bridge.
  // Otherwise Jackie always shows only the old bridge and the fountain lessons
  // assigned to Jackie/Rosalyn/Taye/Nia are technically present but invisible.
  if (snapshotGroveNpcDialog) {
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
      />
    );
  }

  if (snapshotMissionDialog) {
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
      />
    );
  }

  if (snapshotLiveNpcLoreDialog) {
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
      />
    );
  }

  if (localDevHarthmereDialog) {
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
    />
  );
};
