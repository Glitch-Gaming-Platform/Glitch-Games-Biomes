/// <reference types="mocha" />

import { containMobileControlEvent } from "@/client/components/mobileControlEvents";
import assert from "assert";

describe("mobile HUD pointer containment", () => {
  it("prevents the touch action from reaching canvas mouse bindings", () => {
    const calls: string[] = [];
    containMobileControlEvent({
      preventDefault: () => calls.push("preventDefault"),
      stopPropagation: () => calls.push("stopPropagation"),
      nativeEvent: {
        stopImmediatePropagation: () => calls.push("stopImmediatePropagation"),
      },
    });
    assert.deepEqual(calls, [
      "preventDefault",
      "stopPropagation",
      "stopImmediatePropagation",
    ]);
  });
});
