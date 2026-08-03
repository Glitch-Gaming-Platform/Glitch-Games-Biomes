import {
  formatPlayerInviteCode,
  normalizePlayerInviteCode,
  playerInviteCodeFromSearch,
  playerInviteErrorMessage,
} from "@/client/game/invites/player_invites";
import assert from "assert";

describe("player invite client helpers", () => {
  it("formats pasted codes and reads direct-launch invite query parameters", () => {
    assert.equal(normalizePlayerInviteCode("ab cd-ef 23"), "ABCDEF23");
    assert.equal(formatPlayerInviteCode("ab cd-ef 23"), "ABCD-EF23");
    assert.equal(
      playerInviteCodeFromSearch("?install_id=test&invite_code=abcd-ef23"),
      "ABCDEF23"
    );
    assert.equal(playerInviteCodeFromSearch("?invite_code=short"), undefined);
  });

  it("turns server edge cases into player-facing guidance", () => {
    assert.match(playerInviteErrorMessage("INVITE_EXPIRED"), /expired/i);
    assert.match(
      playerInviteErrorMessage("INVITE_DESTINATION_UNAVAILABLE"),
      /location/i
    );
    assert.match(
      playerInviteErrorMessage("INVITE_SERVICE_UNAVAILABLE"),
      /temporarily unavailable/i
    );
  });
});
