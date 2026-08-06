import type { QuestStepBundle } from "@/client/components/challenges/helpers";
import {
  claimRewardsStepMatchesEntity,
  playerVoiceContextForNpcChat,
  questVoiceContextForStepBundle,
  unslugNpcDescription,
} from "@/client/components/challenges/helpers";
import { ItemBagDisplay } from "@/client/components/challenges/QuestViews";
import type {
  ButtonLayout,
  TalkDialogInfo,
  TalkDialogStepAction,
  TalkDialogVoiceInput,
} from "@/client/components/challenges/TalkDialogModalStep";
import { TalkDialogModalStep } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { getOwnedItems } from "@/client/components/inventory/helpers";
import { ChromelessModal } from "@/client/components/modals/ChromelessModal";
import type { ClientContextSubset } from "@/client/game/context";
import {
  AcceptChallengeEvent,
  CompleteQuestStepAtEntityEvent,
} from "@/shared/ecs/gen/events";
import { determineTakePattern } from "@/shared/game/inventory";
import type { ItemBag } from "@/shared/game/types";
import type { BiomesId } from "@/shared/ids";
import { isHarthmereRequestBoardEntityId } from "@/shared/harthmere/native_request_boards";
import { log } from "@/shared/logging";
import { fireAndForget } from "@/shared/util/async";
import { jsonPost } from "@/shared/util/fetch_helpers";
import type {
  GeneratedChatRequest,
  GeneratedChatResponse,
} from "@/pages/api/npcs/generated_chat";
import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const talkToItemDisplayContainerClasses = "flex justify-center gap-0.6";
const talkToItemDisplayCellClasses = "bg-tooltip-bg w-10 h-10";

export const TalkDialogModal: React.FunctionComponent<
  PropsWithChildren<{
    entityId: BiomesId;
    focusCamera?: boolean;
    extraClassNames?: string;
  }>
> = ({
  entityId,
  focusCamera: requestedFocusCamera = true,
  extraClassNames,
  children,
}) => {
  const { resources } = useClientContext();
  // Request boards are dialogue/quest authorities, not camera targets. Their
  // dedicated renderer suppresses the original NPC body, and the Harthmere
  // quay board intentionally has no subscribed ECS body. Preserve the native
  // talk modal while keeping the gameplay camera on the player for every
  // request-board entry path.
  const focusCamera =
    requestedFocusCamera && !isHarthmereRequestBoardEntityId(entityId);
  useEffect(() => {
    resources.update("/scene/local_player", (localPlayer) => {
      localPlayer.talkingToNpc = entityId;
      localPlayer.talkingToNpcCameraDisabled = !focusCamera;
    });
    return () => {
      resources.update("/scene/local_player", (localPlayer) => {
        if (localPlayer.talkingToNpc === entityId) {
          localPlayer.talkingToNpc = undefined;
          localPlayer.talkingToNpcCameraDisabled = false;
        }
      });
    };
  }, [entityId, focusCamera, resources]);

  return (
    <ChromelessModal
      extraClassNames={`npc-quest-view ${extraClassNames ?? ""}`.trim()}
    >
      <div
        style={{
          cursor: "pointer",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {children}
    </ChromelessModal>
  );
};

export const TalkToNpcQuestView: React.FunctionComponent<{
  talkingToNPCId: BiomesId;
  onStepComplete: (stepId: BiomesId, questId: BiomesId) => unknown;
  onClose: () => void;
  stepBundle: QuestStepBundle;
}> = ({ talkingToNPCId, stepBundle, onClose, onStepComplete }) => {
  const { userId, events, reactResources, resources } = useClientContext();
  const [voiceDialogText, setVoiceDialogText] = useState<string | undefined>();
  const [voiceQuerying, setVoiceQuerying] = useState(false);
  const voiceMessageContext = useRef<string | undefined>(undefined);

  const questId = stepBundle.questBundle.biscuit.id;
  const stepId = stepBundle.step.id;

  useEffect(() => {
    voiceMessageContext.current = undefined;
    setVoiceDialogText(undefined);
    setVoiceQuerying(false);
  }, [talkingToNPCId, questId, stepId]);

  const acceptQuest = useCallback((challengeId: BiomesId) => {
    if (stepBundle.stepCompleted) {
      onClose();
      return;
    }

    fireAndForget(
      (async () => {
        await events.publish(
          new AcceptChallengeEvent({
            id: userId,
            challenge_id: challengeId,
            npc_id: talkingToNPCId,
          })
        );
        onStepComplete(stepId, challengeId);
      })()
    );
  }, []);

  const completeStep = async (chosenRewardIndex?: number) => {
    if (stepBundle.stepCompleted) {
      onClose();
      return;
    }

    // ------------------------------------------------------------------
    // Client-side guard against spurious quest progression.
    //
    // Defends against the "I just clicked Talk and a quest changed"
    // bug: the React `stepBundle` can become stale (e.g. mid-chain in
    // `shouldCloseDialog`, or after the quest log refreshed but before
    // the dialog modal closed), and firing the firehose event with a
    // stale step would cause the server to advance a quest the player
    // didn't intend to advance.
    //
    // The step must (a) belong to a real claim leaf (NPC talk-step or
    // my-robot talk-step) and (b) actually be a step for the entity in
    // front of us. The server re-validates all of this — this is the
    // first line of defense so we don't even submit a doomed claim.
    // ------------------------------------------------------------------
    const payload = stepBundle.step.payload;
    if (
      payload.kind !== "challengeClaimRewards" &&
      payload.kind !== "completeQuestStepAtMyRobot"
    ) {
      // Not a talk/turn-in step. Treat the press as "close the dialog";
      // do NOT submit a completion event.
      onClose();
      return;
    }
    if (payload.kind === "challengeClaimRewards") {
      const expected = payload.returnQuestGiverId;
      // Tolerate two ways the bundle may identify the right NPC: as the
      // specific entity id, or as the quest's quest-giver biscuit id (the
      // type id). The server's validator handles authoritative type-id
      // matching against `claimFromEntity.npcMetadata().type_id`.
      if (
        expected !== undefined &&
        !claimRewardsStepMatchesEntity(resources, talkingToNPCId, expected) &&
        stepBundle.questBundle.biscuit.questGiver !== talkingToNPCId
      ) {
        onClose();
        return;
      }
    }

    if (stepBundle.isFirstStep) {
      acceptQuest(questId);
    }

    await events.publish(
      new CompleteQuestStepAtEntityEvent({
        id: userId,
        challenge_id: questId,
        entity_id: talkingToNPCId,
        chosen_reward_index: chosenRewardIndex,
        step_id: stepId,
      })
    );

    onStepComplete(stepId, questId);
  };

  const additionalActions = stepBundle.canDecline
    ? [getDeclineAction(onClose, stepBundle.declineText || "No, Thanks")]
    : [];
  const activeQuestContext =
    stepBundle.questBundle.state === "in_progress" && !stepBundle.stepCompleted
      ? questVoiceContextForStepBundle(stepBundle)
      : undefined;
  const handleVoiceTranscript = useCallback(
    async (message: string) => {
      setVoiceQuerying(true);
      try {
        const res = await jsonPost<GeneratedChatResponse, GeneratedChatRequest>(
          "/api/npcs/generated_chat",
          {
            entityId: talkingToNPCId,
            messageContext: voiceMessageContext.current,
            userResponse: message,
            questContext: activeQuestContext,
            userContext: playerVoiceContextForNpcChat({
              reactResources,
              userId,
            }),
          }
        );
        voiceMessageContext.current = res.messageContext;
        setVoiceDialogText(res.nextDialog.message);
      } catch (error) {
        log.warn("Quest NPC voice response unavailable", {
          error,
          talkingToNPCId,
          questId: stepBundle.questBundle.biscuit.id,
        });
      } finally {
        setVoiceQuerying(false);
      }
    },
    [
      activeQuestContext,
      reactResources,
      stepBundle.questBundle.biscuit.id,
      talkingToNPCId,
      userId,
    ]
  );
  const questVoiceInput: TalkDialogVoiceInput = {
    disabled: voiceQuerying,
    onTranscript: handleVoiceTranscript,
  };
  const dialogText = voiceQuerying
    ? "<text>[listens closely...]</text>"
    : (voiceDialogText ?? stepBundle.dialogText);

  if (stepBundle.rewardsList?.length) {
    return (
      <TalkToNpcWithRewards
        talkingToNpcId={talkingToNPCId}
        id={stepId}
        dialogText={dialogText}
        completeStep={completeStep}
        advanceText={stepBundle.acceptText}
        rewards={stepBundle.rewardsList}
        additionalActions={additionalActions}
        voiceInput={questVoiceInput}
      />
    );
  } else if (stepBundle.itemsToTake?.size) {
    return (
      <TalkToNpcWithTakeItems
        talkingToNpcId={talkingToNPCId}
        id={stepId}
        dialogText={dialogText}
        itemsToTake={stepBundle.itemsToTake}
        completeStep={completeStep}
        advanceText={stepBundle.acceptText}
        onClose={onClose}
        additionalActions={additionalActions}
        voiceInput={questVoiceInput}
      />
    );
  } else {
    return (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={stepId}
        dialogText={dialogText}
        completeStep={completeStep}
        advanceText={stepBundle.acceptText}
        additionalActions={additionalActions}
        voiceInput={questVoiceInput}
      />
    );
  }
};

export const textAndFinalStepToDialog = ({
  clientContext,
  text,
  actions,
  children,
}: {
  clientContext: ClientContextSubset<"reactResources">;
  text: string;
  actions?: TalkDialogStepAction[];
  children?: React.ReactNode;
}): TalkDialogInfo[] => {
  const parsedText = unslugNpcDescription(clientContext, text);

  return parsedText.map((text, index) => {
    const isLastStep = index === parsedText.length - 1;
    if (isLastStep) {
      return {
        text,
        actions,
        children,
      };
    } else {
      return {
        text,
      };
    }
  });
};

const getDeclineAction = (
  onClose: () => void,
  declineText?: string
): TalkDialogStepAction => ({
  name: declineText ?? "No, Thanks",
  type: "normal",
  onPerformed: onClose,
});

export const TalkToNpc: React.FunctionComponent<{
  id: BiomesId | number | string;
  talkingToNpcId: BiomesId;
  focusCamera?: boolean;
  completeStep: () => unknown;
  dialogText: string;
  advanceText?: string;
  children?: React.ReactNode;
  buttonLayout?: ButtonLayout;
  additionalActions?: TalkDialogStepAction[];
  voiceInput?: TalkDialogVoiceInput;
  revealActionsImmediately?: boolean;
}> = ({
  id,
  talkingToNpcId,
  focusCamera,
  dialogText,
  completeStep,
  advanceText,
  children,
  buttonLayout,
  additionalActions,
  voiceInput,
  revealActionsImmediately,
}) => {
  const clientContext = useClientContext();
  return (
    <TalkDialogModal entityId={talkingToNpcId} focusCamera={focusCamera}>
      <TalkDialogModalStep
        id={id}
        entityId={talkingToNpcId}
        buttonLayout={buttonLayout}
        voiceInput={voiceInput}
        revealActionsImmediately={revealActionsImmediately}
        dialog={textAndFinalStepToDialog({
          clientContext,
          text: dialogText,
          actions: [
            ...(additionalActions ?? []),
            {
              name: advanceText || "Continue",
              type: "primary",
              disabled: false,
              onPerformed: completeStep,
            },
          ],
          children,
        })}
      />
    </TalkDialogModal>
  );
};

export const TalkToItemDisplay: React.FunctionComponent<{
  containerClassName?: string;
  cellClassName?: string;
  items: ItemBag[];
  chosenItemIndex?: number;
  setChosenItemIndex?: (i: number) => void;
}> = ({
  containerClassName,
  cellClassName,
  items,
  chosenItemIndex,
  setChosenItemIndex,
}) => {
  return (
    <div className={containerClassName}>
      {items.map((item, index) => (
        <ItemBagDisplay
          cellClassName={cellClassName}
          bag={item}
          drawBorder={chosenItemIndex === index && items.length > 1}
          onClick={
            items.length > 1 && setChosenItemIndex
              ? () => setChosenItemIndex(index)
              : undefined
          }
          key={index}
        />
      ))}
    </div>
  );
};

const TalkToNpcWithRewards: React.FunctionComponent<{
  id: BiomesId;
  talkingToNpcId: BiomesId;
  dialogText: string;
  completeStep: (chosenRewardIndex: number) => unknown;
  advanceText?: string;
  rewards: ItemBag[];
  additionalActions?: TalkDialogStepAction[];
  voiceInput?: TalkDialogVoiceInput;
}> = ({
  id,
  talkingToNpcId,
  dialogText,
  completeStep,
  advanceText,
  rewards,
  additionalActions,
  voiceInput,
}) => {
  const clientContext = useClientContext();

  const defaultRewardIndex = rewards.length > 1 ? undefined : 0;
  const [chosenRewardIndex, setChosenRewardIndex] = useState<
    number | undefined
  >(defaultRewardIndex);

  useEffect(() => {
    setChosenRewardIndex(defaultRewardIndex);
  }, [id]);

  const disabled = chosenRewardIndex === undefined;

  const action: TalkDialogStepAction = {
    name: advanceText || "Claim Reward",
    tooltip: disabled ? "Choose a reward to continue" : undefined,
    type: "primary" as const,
    disabled: disabled,
    onPerformed: () => {
      if (disabled) {
        return;
      }
      return completeStep(chosenRewardIndex);
    },
  };

  return (
    <TalkDialogModal entityId={talkingToNpcId}>
      <TalkDialogModalStep
        id={id}
        entityId={talkingToNpcId}
        voiceInput={voiceInput}
        dialog={textAndFinalStepToDialog({
          clientContext,
          text: dialogText,
          actions: [...(additionalActions ?? []), action],
          children: (
            <TalkToItemDisplay
              containerClassName={talkToItemDisplayContainerClasses}
              cellClassName={talkToItemDisplayCellClasses}
              items={rewards}
              chosenItemIndex={chosenRewardIndex}
              setChosenItemIndex={(i) => {
                if (i === chosenRewardIndex) {
                  setChosenRewardIndex(undefined);
                } else {
                  setChosenRewardIndex(i);
                }
              }}
            />
          ),
        })}
      />
    </TalkDialogModal>
  );
};

const TalkToNpcWithTakeItems: React.FunctionComponent<{
  id: BiomesId;
  talkingToNpcId: BiomesId;
  dialogText: string;
  itemsToTake: ItemBag;
  completeStep: () => unknown;
  advanceText?: string;
  onClose: () => unknown;
  additionalActions?: TalkDialogStepAction[];
  voiceInput?: TalkDialogVoiceInput;
}> = ({
  id,
  talkingToNpcId,
  dialogText,
  itemsToTake,
  completeStep,
  advanceText,
  onClose,
  additionalActions,
  voiceInput,
}) => {
  const clientContext = useClientContext();
  const resources = clientContext.resources;
  const ownedItems = getOwnedItems(resources, clientContext.userId);

  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    setErrorMessage(undefined);
  }, []);

  const validateTakeItems = (itemsToTake?: ItemBag): string | undefined => {
    if (!itemsToTake) {
      return undefined;
    }

    const takePattern = determineTakePattern(ownedItems, itemsToTake, {
      respectPayload: false,
    });
    if (!takePattern) {
      return "Hmmm... seems like you don't have all the items I need. Come back when you've got them!";
    }
  };

  const action = {
    name: errorMessage ? "Close" : advanceText || "Turn in Items",
    type: "primary" as const,
    disabled: false,
    onPerformed: () => {
      if (errorMessage) {
        onClose();
        return;
      }

      const takeItemsError = validateTakeItems(itemsToTake);
      if (takeItemsError) {
        setErrorMessage(takeItemsError);
        return;
      }

      return completeStep();
    },
  };

  const text = errorMessage ? errorMessage : dialogText;

  return (
    <TalkDialogModal entityId={talkingToNpcId}>
      <TalkDialogModalStep
        id={`${id}-${text.length}`}
        entityId={talkingToNpcId}
        voiceInput={voiceInput}
        dialog={textAndFinalStepToDialog({
          clientContext,
          text,
          actions: [...(additionalActions ?? []), action],
          children: (
            <TalkToItemDisplay
              containerClassName={talkToItemDisplayContainerClasses}
              cellClassName={talkToItemDisplayCellClasses}
              items={[itemsToTake]}
            />
          ),
        })}
      />
    </TalkDialogModal>
  );
};
