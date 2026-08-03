import { TalkToNpc } from "@/client/components/challenges/TalkDialogModal";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { createHarthmereBusinessMiniGameDecisionForOffer } from "@/shared/harthmere/business_customer_simulator";
import type { BiomesId } from "@/shared/ids";
import * as React from "react";
import { useHarthmereBusinessCustomerTalkTarget } from "./harthmereBusinessCustomerTalkState";

export function HarthmereBusinessCustomerTalkDialog({
  talkingToNPCId,
  onClose,
}: {
  talkingToNPCId: BiomesId;
  onClose: () => void;
}) {
  const target = useHarthmereBusinessCustomerTalkTarget(talkingToNPCId);
  const [pendingOfferId, setPendingOfferId] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  const serve = React.useCallback(
    async (offerId: string) => {
      if (!target?.ready || pendingOfferId) return;
      setPendingOfferId(offerId);
      setError(undefined);
      try {
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
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setPendingOfferId(undefined);
      }
    },
    [onClose, pendingOfferId, target]
  );

  if (!target) return null;

  const serviceActions: TalkDialogStepAction[] = target.ready
    ? target.offers.map((offer) => ({
        name: offer.label,
        // The request line is the puzzle. Never highlight the authoritative
        // requestedOfferId in the UI or the minigame answers itself.
        type: "normal",
        disabled: Boolean(pendingOfferId),
        onPerformed: () => void serve(offer.offerId),
      }))
    : [];
  const status = target.ready
    ? `${target.patienceRemaining}s remaining`
    : target.phase === "queued"
      ? "They are waiting in the spatial queue."
      : target.phase === "approaching_counter"
        ? "They are walking to the service point."
        : "They are still entering through the real door.";
  const dialogText = target.ready
    ? `${target.askLine}{break}${status}${
        error ? `{break}<text>${error}</text>` : ""
      }`
    : `${status}{break}Stay behind the counter and let them reach the service point.`;

  return (
    <div
      data-harthmere-business-customer-talk="true"
      data-business-customer-ready={target.ready ? "true" : "false"}
      data-business-customer-ticket={target.ticketId}
    >
      <TalkToNpc
        talkingToNpcId={talkingToNPCId}
        id={`business-customer:${target.ticketId}`}
        dialogText={dialogText}
        completeStep={onClose}
        advanceText={target.ready ? "Leave customer waiting" : "Close"}
        buttonLayout="vertical"
        additionalActions={serviceActions}
      />
    </div>
  );
}
