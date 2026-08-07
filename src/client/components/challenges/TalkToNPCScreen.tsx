import type { QuestStepBundle } from "@/client/components/challenges/helpers";
import {
  shouldCloseDialog,
  useRelevantStepsForEntity,
} from "@/client/components/challenges/helpers";
import {
  TalkToNpc,
  TalkToNpcQuestView,
} from "@/client/components/challenges/TalkDialogModal";
import { TalkToNpcDefaultDialog } from "@/client/components/challenges/TalkToNPCDefaultDialog";
import { useSnapshotGroveNpcDialog } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest } from "@/client/components/challenges/snapshotGroveNpcDialogPriority";

import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { DialogButton } from "@/client/components/system/DialogButton";

import { becomeTheNPC } from "@/client/game/scripts/become_npc";
import { useWithUnseenEmptyTransition } from "@/client/util/hooks";

import { TalkToNPCMultiQuestSelector } from "@/client/components/challenges/TalkToNPCMultiQuestSelector";
import { JACKIE_ID } from "@/client/util/nux/state_machines";
import { completeHarthmereDailyTaskSoon } from "@/client/components/challenges/harthmereDailyTasks";
import { useLocalDevHarthmereDialog } from "@/client/components/challenges/LocalDevHarthmereQuests";
import {
  CHAPTER1_OBJECTIVE_INTERACT_EVENT,
  readChapter1ObjectiveWorldProjection,
} from "@/client/components/challenges/Chapter1ObjectiveWorldState";
import { HarthmereBusinessCustomerTalkDialog } from "@/client/components/harthmere_business/HarthmereBusinessCustomerTalkDialog";
import { useHarthmereBusinessCustomerTalkTarget } from "@/client/components/harthmere_business/harthmereBusinessCustomerTalkState";
import { HarthmereRequestBoardLiveContainer } from "@/client/components/harthmere_request_board/HarthmereRequestBoardLiveContainer";
import { AdminDeleteEvent, AdminIceEvent } from "@/shared/ecs/gen/events";
import { reportFunnelStage } from "@/shared/funnel";
import {
  ch1ObjectiveDelegatesToNpcTrade,
  ch1ObjectiveOwnsNpcInteraction,
} from "@/shared/harthmere/ch1_interaction_surfaces";
import { isHarthmereRequestBoardEntityId } from "@/shared/harthmere/native_request_boards";
import type { BiomesId } from "@/shared/ids";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import { fireAndForget } from "@/shared/util/async";
import { useEffect, useMemo, useRef, useState } from "react";

export const AdminNPCButtons: React.FunctionComponent<{
  npcId: BiomesId;
}> = ({ npcId }) => {
  const deps = useClientContext();
  const { reactResources, events, userId } = deps;

  const [npcMetadata, label] = reactResources.useAll(
    ["/ecs/c/npc_metadata", npcId],
    ["/ecs/c/label", npcId]
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "1vmin",
        right: "1vmin",
        gap: ".75vmin",
        display: "flex",
        zIndex: 1,
      }}
    >
      <DialogButton
        extraClassNames="btn-inline"
        onClick={() => {
          reactResources.set("/game_modal", {
            kind: "empty",
          });
          void becomeTheNPC(deps, npcId);
        }}
      >
        Become {label?.text ?? "NPC"}
      </DialogButton>
      <DialogButton
        extraClassNames="btn-inline"
        onClick={() => {
          reactResources.set("/game_modal", {
            kind: "empty",
          });

          if (!npcMetadata) return;

          fireAndForget(
            events.publish(
              new (npcMetadata.spawn_event_id
                ? AdminDeleteEvent
                : AdminIceEvent)({
                id: userId,
                entity_id: npcId,
              })
            )
          );
        }}
      >
        Remove NPC from World
      </DialogButton>
    </div>
  );
};

const Chapter1SupplierTalkDialog: React.FunctionComponent<{
  talkingToNPCId: BiomesId;
  supplierLabel: string;
  onClose: () => void;
}> = ({ talkingToNPCId, supplierLabel, onClose }) => {
  const vendorDialog = useLocalDevHarthmereDialog(talkingToNPCId, "");
  const browseGoods = vendorDialog?.actions.find(
    (action) => action.name === "Browse goods"
  );
  const tradeAction = browseGoods
    ? {
        ...browseGoods,
        name: `Trade with ${supplierLabel}`,
        type: "primary" as const,
        tooltip:
          "Buy or sell at least one item. Chapter 1 will then mark the next Grove supplier.",
        closeAfterPerformed: true,
      }
    : undefined;

  return (
    <TalkToNpc
      talkingToNpcId={talkingToNPCId}
      id={`chapter1-supplier-${talkingToNPCId}`}
      dialogText={`<text>For Chapter 1, trade with ${supplierLabel}. Choose the trade button and complete one real purchase or sale. Your objective and map marker will then move to the next supplier.</text>`}
      advanceText="Close"
      completeStep={onClose}
      buttonLayout="vertical"
      additionalActions={tradeAction ? [tradeAction] : []}
    />
  );
};

export const TalkToNPCScreen: React.FunctionComponent<{
  talkingToNPCId: BiomesId;
  onClose: () => void;
}> = ({ talkingToNPCId, onClose }) => {
  const clientContext = useClientContext();
  const { resources, gardenHose, authManager } = clientContext;
  const isAdmin = authManager.currentUser.hasSpecialRole("admin");
  const liveBusinessCustomerTalk =
    useHarthmereBusinessCustomerTalkTarget(talkingToNPCId);
  const retainedBusinessCustomerTalk = useRef<{
    entityId: BiomesId;
    target: NonNullable<typeof liveBusinessCustomerTalk>;
  }>();
  if (liveBusinessCustomerTalk) {
    retainedBusinessCustomerTalk.current = {
      entityId: talkingToNPCId,
      target: liveBusinessCustomerTalk,
    };
  }
  const businessCustomerTalk =
    liveBusinessCustomerTalk ??
    (retainedBusinessCustomerTalk.current?.entityId === talkingToNPCId
      ? retainedBusinessCustomerTalk.current.target
      : undefined);
  const nativeNpcState = clientContext.reactResources.use(
    "/ecs/c/npc_state",
    talkingToNPCId
  );
  const nativeBusinessCustomer = useMemo(
    () =>
      nativeNpcState?.data
        ? deserializeNpcCustomState(nativeNpcState.data).businessCustomer
        : undefined,
    [nativeNpcState?.data]
  );
  const requestBoard = isHarthmereRequestBoardEntityId(talkingToNPCId);
  const chapter1Objective = readChapter1ObjectiveWorldProjection();
  const chapter1OwnsThisNpc = ch1ObjectiveOwnsNpcInteraction(
    chapter1Objective,
    Number(talkingToNPCId)
  );
  const chapter1SupplierTrade = ch1ObjectiveDelegatesToNpcTrade(
    chapter1Objective,
    Number(talkingToNPCId)
  );
  const trueRelevantSteps = useRelevantStepsForEntity(talkingToNPCId);
  const snapshotGroveNpcDialog = useSnapshotGroveNpcDialog(
    talkingToNPCId,
    ""
  );
  const [queryingStep, setQueryingStep] = useState(false);
  const [trackedQuest] = clientContext.mapManager.react.useTrackedQuestId();
  const [currentStep, setCurrentStep] = useState<QuestStepBundle | undefined>();
  // Only show stepCompleted steps if they are tracked
  const relevantSteps = useWithUnseenEmptyTransition(
    trueRelevantSteps,
    trueRelevantSteps.length === 0,
    1000
  ).filter((stepBundle) => {
    return !stepBundle.stepCompleted || stepBundle.step.id === trackedQuest;
  });

  useEffect(() => {
    if (talkingToNPCId) {
      if (chapter1OwnsThisNpc) {
        // Mouse/overlay Talk can still open the stock NPC modal before the
        // central F-key dispatcher sees it. Route that alternate entry point
        // back into the exact authenticated Chapter 1 objective and never let
        // an unrelated accepted Grove quest masquerade as story dialogue.
        onClose();
        window.dispatchEvent(
          new CustomEvent(CHAPTER1_OBJECTIVE_INTERACT_EVENT)
        );
        return;
      }
      gardenHose.publish({
        kind: "talk_npc",
        npcId: talkingToNPCId,
      });
      completeHarthmereDailyTaskSoon("talk_neighbor");
    }
  }, [chapter1OwnsThisNpc, gardenHose, onClose, talkingToNPCId]);

  useEffect(() => {
    if (talkingToNPCId === JACKIE_ID) {
      reportFunnelStage("talkToJackie");
    }
  }, [talkingToNPCId]);

  const onStepComplete = async (stepId: BiomesId, challengeId: BiomesId) => {
    const alreadyOpenQuests = new Set(
      [...trueRelevantSteps].map((e) => e.questBundle.biscuit.id)
    );
    setQueryingStep(true);
    try {
      const closeDialogInfo = await shouldCloseDialog(
        resources,
        talkingToNPCId,
        // Chain to the next quest if it wasn't open at the time of initiating talk to npc
        (newStepId, newChallengeId) =>
          newStepId !== stepId &&
          (challengeId === newChallengeId ||
            !alreadyOpenQuests.has(newChallengeId))
      );

      if (closeDialogInfo.closeDialog) {
        onClose();
      } else {
        setCurrentStep(closeDialogInfo.newStep);
      }
    } finally {
      setQueryingStep(false);
    }
  };

  let dialogContent: JSX.Element;
  if (chapter1OwnsThisNpc) {
    dialogContent = (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id="chapter1-story-routing"
        dialogText=""
        completeStep={() => {}}
      />
    );
  } else if (chapter1SupplierTrade) {
    dialogContent = (
      <Chapter1SupplierTalkDialog
        talkingToNPCId={talkingToNPCId}
        supplierLabel={chapter1Objective?.label ?? "this Grove supplier"}
        onClose={onClose}
      />
    );
  } else if (requestBoard) {
    dialogContent = (
      <HarthmereRequestBoardLiveContainer
        boardEntityId={talkingToNPCId}
        onClose={onClose}
      />
    );
  } else if (businessCustomerTalk) {
    // Session-only business customers are a distinct in-world minigame role.
    // Talking to one must present the authoritative service offers, never the
    // ambient Chit Chat / Ask about this place / reputation options. The
    // screenshot+HAR production defect showed start_business_customer_session
    // succeeded but opening the customer took this ordinary dialogue branch,
    // so no serve_business_customer mutation was ever emitted.
    dialogContent = (
      <HarthmereBusinessCustomerTalkDialog
        talkingToNPCId={talkingToNPCId}
        onClose={onClose}
        retainedTarget={businessCustomerTalk}
      />
    );
  } else if (
    nativeBusinessCustomer &&
    nativeBusinessCustomer.phase !== "patron_wandering"
  ) {
    dialogContent = (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id="business-customer-in-use"
        dialogText="<text>This customer is already part of an active business shift. If this is your shift, return behind the counter and try again in a moment. Otherwise, wait until the current shift ends.</text>"
        advanceText="Close"
        completeStep={onClose}
      />
    );
  } else if (queryingStep) {
    dialogContent = (
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={0}
        dialogText=""
        completeStep={() => {}}
      />
    );
  } else if (currentStep) {
    // Some state (like completing a previous quest) continued.
    dialogContent = (
      <TalkToNpcQuestView
        talkingToNPCId={talkingToNPCId}
        stepBundle={currentStep}
        onClose={onClose}
        onStepComplete={onStepComplete}
      />
    );
  } else if (
    shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest({
      hasSnapshotGroveDialog: Boolean(snapshotGroveNpcDialog),
      nativeRelevantStepCount: relevantSteps.length,
      chapter1OwnsThisNpc,
      chapter1SupplierTrade,
    })
  ) {
    // Grove onboarding and Road Ahead can both belong to Jackie. The native
    // quest selector used to intercept first, making every Grove Start action
    // unreachable even though TalkToNpcDefaultDialog explicitly gives Grove
    // prose/actions precedence. Route through that composed dialog before the
    // native single/multi-step branches; Road Ahead compatibility actions are
    // still merged by the default dialog.
    dialogContent = (
      <TalkToNpcDefaultDialog
        talkingToNPCId={talkingToNPCId}
        onClose={onClose}
      />
    );
  } else if (relevantSteps.length === 1) {
    // Exactly 1 quest to talk about. Talk about it directly.
    dialogContent = (
      <TalkToNpcQuestView
        talkingToNPCId={talkingToNPCId}
        stepBundle={relevantSteps[0]}
        onClose={onClose}
        onStepComplete={onStepComplete}
      />
    );
  } else if (relevantSteps.length > 1) {
    // Multiple quests.
    dialogContent = (
      <TalkToNPCMultiQuestSelector
        npcId={talkingToNPCId}
        onClose={onClose}
        onStepComplete={onStepComplete}
      />
    );
  } else {
    dialogContent = (
      <TalkToNpcDefaultDialog
        talkingToNPCId={talkingToNPCId}
        onClose={onClose}
      />
    );
  }

  return (
    <div>
      {isAdmin && <AdminNPCButtons npcId={talkingToNPCId} />}
      {dialogContent}
    </div>
  );
};
