import assert from "assert";
import {
  HarthmereQuestActionError,
  formatHarthmereQuestActionError,
  harthmereQuestRejectionWarningsFromResponse,
  playerFacingQuestActionErrorMessage,
} from "./questActionError";

describe("quest action player errors", () => {
  it("turns Bible level gates into player-readable acceptance errors", () => {
    assert.equal(
      formatHarthmereQuestActionError(
        ["bible_quest_rejected:player_level_below_minimum"],
        {
          action: "accept",
          questTitle: "The Doorway That Wasn’t",
          minimumLevel: 6,
        }
      ),
      "Reach level 6 before accepting “The Doorway That Wasn’t”."
    );
  });

  it("never exposes internal rejection tokens as the Error message", () => {
    const error = new HarthmereQuestActionError(
      ["jobs_board_rejected:seeker_active_job_limit"],
      { action: "accept" }
    );
    assert.equal(
      error.message,
      "Finish or cancel an active job before accepting another one."
    );
    assert.equal(playerFacingQuestActionErrorMessage(error), error.message);
    assert.ok(!error.message.includes("jobs_board_rejected"));
  });

  it("explains the separate three-job Chapter 1 allowance", () => {
    const error = new HarthmereQuestActionError(
      ["jobs_board_rejected:chapter1_active_job_limit"],
      { action: "accept", questTitle: "Clear the Muckwad Patch" }
    );
    assert.match(error.message, /all three Chapter 1 Grove jobs/i);
    assert.doesNotMatch(error.message, /chapter1_active_job_limit/);
  });

  it("collects quest rejections from successful HTTP response bodies", () => {
    assert.deepEqual(
      harthmereQuestRejectionWarningsFromResponse({
        ok: true,
        backendMutation: {
          warnings: [
            "native_ecs_materialized:created:1:existing:0",
            "quest_invite_response_rejected:not_found",
          ],
        },
      }),
      ["quest_invite_response_rejected:not_found"]
    );
  });
});
