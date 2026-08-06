import assert from "assert";
import { makeWakeUpScreenshot } from "@/client/game/util/report";

describe("wake-up screenshot reporting", () => {
  it("does not capture or upload the disabled wake-up payload", async () => {
    let captured = false;
    const result = await makeWakeUpScreenshot(
      {
        rendererController: {
          captureScreenshot: () => {
            captured = true;
            throw new Error("disabled wake-up reporting must not capture");
          },
        } as any,
      },
      { clientCvals: { oversized: true } }
    );
    assert.equal(captured, false);
    assert.deepEqual(result, {
      ok: true,
      skipped: true,
      local_assets_noop: true,
    });
  });
});
