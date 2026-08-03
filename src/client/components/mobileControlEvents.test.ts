/// <reference types="mocha" />

import {
  containMobileControlEvent,
  preventMobileBrowserNavigationGesture,
} from "@/client/components/mobileControlEvents";
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

  it("prevents a cancelable mobile browser history gesture", () => {
    let prevented = false;
    preventMobileBrowserNavigationGesture({
      cancelable: true,
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(prevented, true);
  });

  it("does not call preventDefault after the browser commits a gesture", () => {
    let prevented = false;
    preventMobileBrowserNavigationGesture({
      cancelable: false,
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(prevented, false);
  });
});
