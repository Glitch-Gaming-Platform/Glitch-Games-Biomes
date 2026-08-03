import { switchCameraModes } from "@/client/components/inventory/cameraModeActions";
import type { CameraItemMode } from "@/shared/bikkie/schema/types";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("camera mode event actions", () => {
  it("uses a direct resource read instead of invoking React hooks from input handlers", () => {
    const playerId = 1234 as BiomesId;
    const sets: Array<{ path: string; value: unknown }> = [];
    const published: unknown[] = [];
    const reactResources = {
      use() {
        throw new Error("React resource hooks are invalid in an event handler");
      },
      get(path: string) {
        assert.equal(path, "/scene/local_player");
        return { id: playerId };
      },
      set(path: string, value: unknown) {
        sets.push({ path, value });
      },
    };
    const events = {
      publish(event: unknown) {
        published.push(event);
        return Promise.resolve();
      },
    };
    const mode: CameraItemMode = {
      kind: "selfie",
      label: "Selfie",
      modeType: "selfie",
    };

    switchCameraModes(reactResources as never, events as never, mode);

    assert.deepEqual(sets, [
      { path: "/hotbar/camera_mode", value: { value: mode } },
    ]);
    assert.equal(published.length, 1);
    assert.equal((published[0] as { id: BiomesId }).id, playerId);
    assert.equal((published[0] as { mode: string }).mode, "selfie");
  });
});
