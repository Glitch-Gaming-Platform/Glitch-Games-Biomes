/// <reference types="mocha" />

import assert from "assert";
import { harthmereJobsBoardOpenContextFromInput } from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";

describe("Harthmere Unified HUD jobs-board open context", () => {
  it("keeps object marker identity from jobs-board open events", () => {
    const context = harthmereJobsBoardOpenContextFromInput({
      detail: {
        objectId: "jobs_board_marker:harthmere_market_posting_board",
        playerPosition: { x: 501.9, y: 70, z: -132.1 },
      },
    });

    assert.equal(
      context?.interactionTargetId,
      "jobs_board_marker:harthmere_market_posting_board"
    );
    assert.deepEqual(context?.playerPosition, {
      x: 501.9,
      y: 70,
      z: -132.1,
    });
  });
});
