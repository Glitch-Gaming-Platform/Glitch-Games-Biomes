import { TalkToNpc } from "@/client/components/challenges/TalkDialogModal";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { createHarthmereBusinessMiniGameDecisionForOffer } from "@/shared/harthmere/business_customer_simulator";
import type { BiomesId } from "@/shared/ids";
import * as React from "react";
import { formatHarthmereBusinessPlayerWarning } from "./businessInterfaceLiveAdapter";
import {
  createHarthmereBusinessCustomerServiceFeedback,
  type HarthmereBusinessCustomerServiceFeedback,
} from "./harthmereBusinessCustomerServiceFeedback";
import {
  useHarthmereBusinessCustomerTalkTarget,
  type HarthmereBusinessCustomerTalkTarget,
} from "./harthmereBusinessCustomerTalkState";

export const HARTHMERE_BUSINESS_RESULT_DISPLAY_MS = 3_000;

export function HarthmereBusinessCustomerTalkDialog({
  talkingToNPCId,
  onClose,
  retainedTarget,
}: {
  talkingToNPCId: BiomesId;
  onClose: () => void;
  retainedTarget?: HarthmereBusinessCustomerTalkTarget;
}) {
  const liveTarget = useHarthmereBusinessCustomerTalkTarget(talkingToNPCId);
  // The world-card countdown legitimately refreshes every two seconds, but an
  // open conversation is one player decision. Freezing that decision target
  // prevents each polling response from replacing dialogText and restarting
  // the shared NPC typewriter mid-sentence.
  const frozenTarget = React.useRef<HarthmereBusinessCustomerTalkTarget>();
  frozenTarget.current ??= liveTarget ?? retainedTarget;
  const target = frozenTarget.current;
  const [pendingOfferId, setPendingOfferId] = React.useState<string>();
  const [feedback, setFeedback] =
    React.useState<HarthmereBusinessCustomerServiceFeedback>();
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(
      () => onCloseRef.current(),
      HARTHMERE_BUSINESS_RESULT_DISPLAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const serve = React.useCallback(
    async (offerId: string) => {
      if (!target?.ready || pendingOfferId) return;
      setPendingOfferId(offerId);
      try {
        const beforeState = target.adapter.getState();
        const beforeSession =
          beforeState?.businessSystems.customerSessions?.[target.sessionId];
        const beforeStats =
          beforeState?.businessSystems.customerStats?.[target.businessId];
        if (!beforeSession) {
          throw new Error("business_customer_session_not_found");
        }
        await target.adapter.serveCustomer(
          target.businessId,
          offerId,
          target.sessionId,
          target.ticketId,
          createHarthmereBusinessMiniGameDecisionForOffer(
            target.businessType,
            offerId
          )
        );
        const afterState = target.adapter.getState();
        const afterSession =
          afterState?.businessSystems.customerSessions?.[target.sessionId];
        if (!afterSession) {
          throw new Error("business_customer_session_not_found");
        }
        const selectedOffer = target.offers.find(
          (offer) => offer.offerId === offerId
        );
        const expectedOffer = target.offers.find(
          (offer) => offer.offerId === target.requestedOfferId
        );
        const nextFeedback = createHarthmereBusinessCustomerServiceFeedback({
          customerName: target.customerName,
          ticketId: target.ticketId,
          selectedOfferLabel: selectedOffer?.label ?? "that service",
          expectedOfferLabel: expectedOffer?.label ?? "another service",
          beforeSession,
          afterSession,
          beforeStats,
          afterStats:
            afterState?.businessSystems.customerStats?.[target.businessId],
        });
        setFeedback(nextFeedback);
        return nextFeedback;
      } catch (cause) {
        return {
          message: formatHarthmereBusinessPlayerWarning(
            cause instanceof Error ? cause.message : String(cause)
          ),
        };
      } finally {
        setPendingOfferId(undefined);
      }
    },
    [pendingOfferId, target]
  );

  if (!target) return null;

  const serviceActions: TalkDialogStepAction[] = target.ready
    ? target.offers.map((offer) => {
        const action: TalkDialogStepAction = {
          name: offer.label,
          // The request line is the puzzle. Never highlight the authoritative
          // requestedOfferId in the UI or the minigame answers itself.
          type: "normal",
          disabled: Boolean(pendingOfferId),
          followUpText: "Checking your answer…",
          onPerformed: async () => {
            const result = await serve(offer.offerId);
            // Successful and incorrect authoritative outcomes switch the whole
            // dialog to the dedicated result surface below. Only transport or
            // validation errors remain in this action's retryable follow-up.
            if (result && !("correct" in result)) {
              action.followUpText = result.message;
            }
          },
        };
        return action;
      })
    : [];
  const status = target.ready
    ? `${target.patienceRemaining}s remaining`
    : target.phase === "queued"
      ? "They are waiting in the spatial queue."
      : target.phase === "approaching_counter"
        ? "They are walking to the service point."
        : "They are still entering through the real door.";
  const dialogText = target.ready
    ? `<text>${target.askLine} ${status}</text>`
    : `${target.askLine}{break}${status}{break}They will be ready when they reach the service point.`;

  return (
    <div
      data-harthmere-business-customer-talk="true"
      data-business-customer-ready={target.ready ? "true" : "false"}
      data-business-customer-ticket={target.ticketId}
      data-business-customer-target-source={liveTarget ? "live" : "retained"}
      data-business-customer-result={
        feedback ? (feedback.correct ? "correct" : "incorrect") : "pending"
      }
      data-business-customer-gold-earned={feedback?.goldEarned}
      data-business-customer-progress-earned={feedback?.progressPointsEarned}
      data-business-customer-result-message={feedback?.message}
    >
      {feedback ? (
        <span className="sr-only" role="status" aria-live="polite">
          {feedback.message}
        </span>
      ) : null}
      {feedback ? (
        <TalkToNpc
          key="business-customer-result"
          talkingToNpcId={talkingToNPCId}
          focusCamera={false}
          id={`business-customer-result:${target.ticketId}`}
          dialogText={`<text>${feedback.message} Next customer in 3 seconds.</text>`}
          completeStep={onClose}
          advanceText="Continue to next customer"
          buttonLayout="vertical"
          revealActionsImmediately={true}
        />
      ) : (
        <TalkToNpc
          key="business-customer-question"
          talkingToNpcId={talkingToNPCId}
          focusCamera={false}
          id={`business-customer:${target.ticketId}`}
          dialogText={dialogText}
          completeStep={onClose}
          advanceText={target.ready ? "Leave customer waiting" : "Close"}
          buttonLayout="vertical"
          additionalActions={serviceActions}
          revealActionsImmediately={target.ready}
        />
      )}
    </div>
  );
}
