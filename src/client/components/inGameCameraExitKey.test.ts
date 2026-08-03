import { shouldInGameCameraHudHandleExitKey } from "@/client/components/inGameCameraExitKey";
import type { HotBarSelection } from "@/client/game/resources/inventory";
import assert from "assert";

const cameraSelection: HotBarSelection = {
  kind: "camera",
  ref: { kind: "hotbar", idx: 0 },
  mode: { kind: "fps", label: "First Person", modeType: "normal" },
};

describe("InGameCameraHUD camera exit key ownership", () => {
  it("owns physical X and the legacy Delete fallback only during camera mode", () => {
    assert.equal(
      shouldInGameCameraHudHandleExitKey(
        { code: "KeyX", repeat: false, inInputElement: false },
        cameraSelection
      ),
      true
    );
    assert.equal(
      shouldInGameCameraHudHandleExitKey(
        { code: "Delete", repeat: false, inInputElement: false },
        cameraSelection
      ),
      true
    );
    assert.equal(
      shouldInGameCameraHudHandleExitKey(
        { code: "KeyX", repeat: false, inInputElement: false },
        { kind: "hotbar", idx: 0 }
      ),
      false
    );
  });

  it("does not steal repeats, typing, or the camera flip key", () => {
    assert.equal(
      shouldInGameCameraHudHandleExitKey(
        { code: "KeyX", repeat: true, inInputElement: false },
        cameraSelection
      ),
      false
    );
    assert.equal(
      shouldInGameCameraHudHandleExitKey(
        { code: "KeyX", repeat: false, inInputElement: true },
        cameraSelection
      ),
      false
    );
    assert.equal(
      shouldInGameCameraHudHandleExitKey(
        { code: "KeyF", repeat: false, inInputElement: false },
        cameraSelection
      ),
      false
    );
  });
});
