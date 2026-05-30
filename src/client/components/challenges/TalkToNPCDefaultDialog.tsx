import { defaultDialogForNpc } from "@/client/components/challenges/helpers";
import { TalkToNpc } from "@/client/components/challenges/TalkDialogModal";
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
import { maybeIdToNpcType, relevantBiscuitForEntityId } from "@/shared/npc/bikkie";
import { jsonPost } from "@/shared/util/fetch_helpers";
import { useCallback, useRef, useState } from "react";

export function useCanTalkToNpc(
  deps: ClientContextSubset<"resources" | "reactResources">,
  entityId: BiomesId
) {
  const [label, entityDescription] = deps.reactResources.useAll(
    ["/ecs/c/label", entityId],
    ["/ecs/c/entity_description", entityId],
    ["/ecs/c/quest_giver", entityId]
  );
  return (
    canTalkToNpc(deps, entityId) ||
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
  const questGiver = deps.resources.get("/ecs/c/quest_giver", entityId);
  const hasDefaultDialog =
    typeof item?.npcDefaultDialog === "string" ||
    typeof npcType?.npcDefaultDialog === "string";
  if ((Boolean(questGiver) || entityDescription?.text) && entityId) {
    return true;
  } else if (hasDefaultDialog && entityId) {
    return true;
  } else if (npcType?.isPlayerLikeAppearance && entityId) {
    return true;
  } else if (item?.isMount) {
    return true;
  }

  return false;
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
  let relevantBiscuit: ReturnType<typeof relevantBiscuitForEntityId> | undefined;
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
      followUpText: option.followUpText,
      onPerformed() {
        applyHarthmereReputationChange({
          label: `Talked with ${label ?? "a townsperson"}`,
          detail: option.name,
          scope: "personal",
          npcOffset: Number(talkingToNPCId),
          harthmere: { likeability: 1 },
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

  const respondWith = useCallback(async (message: string | undefined) => {
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
      setAdditionalActions(
        res.nextDialog.buttons.map(
          (e): TalkDialogStepAction => ({
            name: e,
            onPerformed: () => {
              void respondWith(e);
            },
          })
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
  }, [fallbackDialogText, makeFallbackActions, talkingToNPCId]);

  // GROVE_FOUNTAIN_TUTORIALS_V101:
  // Grove bible/tutorial dialogue must win before the legacy Road Ahead bridge.
  // Otherwise Jackie always shows only the old bridge and the fountain lessons
  // assigned to Jackie/Rosalyn/Taye/Nia are technically present but invisible.
  if (snapshotGroveNpcDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={snapshotGroveNpcDialog.id}
        dialogText={snapshotGroveNpcDialog.dialogText}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={snapshotGroveNpcDialog.actions}
      />
    );
  }

  if (snapshotMissionDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={snapshotMissionDialog.id}
        dialogText={snapshotMissionDialog.dialogText}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={snapshotMissionDialog.actions}
      />
    );
  }

  if (snapshotLiveNpcLoreDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={snapshotLiveNpcLoreDialog.id}
        dialogText={snapshotLiveNpcLoreDialog.dialogText}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={snapshotLiveNpcLoreDialog.actions}
      />
    );
  }

  if (localDevHarthmereDialog) {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={localDevHarthmereDialog.id}
        dialogText={localDevHarthmereDialog.dialogText}
        completeStep={onClose}
        advanceText="Close"
        buttonLayout="vertical"
        additionalActions={localDevHarthmereDialog.actions}
      />
    );
  }

  return (
    <TalkToNpc
      talkingToNpcId={talkingToNPCId}
      id={id}
      dialogText={
        querying ? "<text>[looks deep in thought...]</text>" : currentDialog
      }
      completeStep={onClose}
      advanceText="Close"
      buttonLayout="vertical"
      additionalActions={additionalActions.map((e) => ({
        ...e,
        disabled: querying,
      }))}
    />
  );
};
