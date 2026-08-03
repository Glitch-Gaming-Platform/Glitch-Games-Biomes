import { biomesUITabForKeyboardCodeForTest } from "@/client/components/biomes_ui/shortcuts/BiomesUIKeyRouting";
import { shouldHandlePlayerVoiceToggle } from "@/client/components/system/PlayerVoiceChat";
import { PLAYER_INVITE_HOTKEY_CODE } from "@/client/game/invites/player_invites";
import {
  PLAYER_VOICE_TOGGLE_CODE,
  playerVoiceControlAvailable,
} from "@/client/game/voice/player_voice_chat";
import { HARTHMERE_HUD_KEY_BINDINGS } from "@/shared/harthmere/harthmere_hud_key_bindings";
import assert from "assert";

describe("player communication HUD shortcuts", () => {
  it("uses dedicated voice and invite keys that are not owned by another HUD option", () => {
    assert.equal(PLAYER_VOICE_TOGGLE_CODE, "F8");
    assert.equal(PLAYER_INVITE_HOTKEY_CODE, "Digit0");
    assert.equal(biomesUITabForKeyboardCodeForTest("F8"), undefined);
    assert.equal(biomesUITabForKeyboardCodeForTest("Digit0"), undefined);
    const reserved = new Set(
      HARTHMERE_HUD_KEY_BINDINGS.map(({ code }) => code)
    );
    assert.equal(reserved.has("F8"), false);
    assert.equal(reserved.has("Digit0"), false);
  });

  it("shows voice only on a secure, capable desktop control surface", () => {
    const capable = {
      showVirtualJoystick: false,
      isSecureContext: true,
      hasGetUserMedia: true,
      hasRTCPeerConnection: true,
    };
    assert.equal(playerVoiceControlAvailable(capable), true);
    assert.equal(
      playerVoiceControlAvailable({ ...capable, showVirtualJoystick: true }),
      false
    );
    assert.equal(
      playerVoiceControlAvailable({ ...capable, hasGetUserMedia: false }),
      false
    );
    assert.equal(
      playerVoiceControlAvailable({ ...capable, isSecureContext: false }),
      false
    );
  });

  it("does not toggle the microphone for repeats, modifiers, or text entry", () => {
    assert.equal(shouldHandlePlayerVoiceToggle({ code: "F8" }), true);
    assert.equal(
      shouldHandlePlayerVoiceToggle({ code: "F8", repeat: true }),
      false
    );
    assert.equal(
      shouldHandlePlayerVoiceToggle({ code: "F8", ctrlKey: true }),
      false
    );
    assert.equal(
      shouldHandlePlayerVoiceToggle({ code: "F8", targetTagName: "input" }),
      false
    );
    assert.equal(
      shouldHandlePlayerVoiceToggle({
        code: "F8",
        targetContentEditable: true,
      }),
      false
    );
    assert.equal(shouldHandlePlayerVoiceToggle({ code: "KeyV" }), false);
  });
});
