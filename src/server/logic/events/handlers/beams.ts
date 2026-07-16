import { makeEventHandler } from "@/server/logic/events/core";

export const removeMapBeamEventHandler = makeEventHandler(
  "removeMapBeamEvent",
  {
    // Suppress only duplicate removals of the same beam. Keying solely by the
    // player incorrectly dropped different quest-beam removals that happened
    // while another removal from that player was in flight.
    mergeKey: (event) => `${event.id}:${event.beam_client_id}`,
    involves: (event) => ({
      player: event.id,
    }),
    apply: ({ player }, event, context) => {
      context.publish({
        kind: "mapBeamRemove",
        entityId: player.id,
        clientBeamId: event.beam_client_id,
        entityLocation: [...(player.staleOk().position()?.v ?? [0, 0, 0])],
      });
    },
  }
);
