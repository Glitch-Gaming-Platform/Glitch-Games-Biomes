/// <reference types="mocha" />

import assert from "assert";
import {
  makeCh1WorldPhaseRenderer,
  setCh1AnchorReadUntilMs,
  setCh1WorldPhaseEffectIds,
} from "@/client/game/renderers/ch1_world_phase";

describe("Chapter 1 world-phase renderer", () => {
  it("skips the transient positionless frame during a warp", () => {
    setCh1WorldPhaseEffectIds(["collective_transport_parked"]);
    setCh1AnchorReadUntilMs(Date.now() + 10_000);
    const renderer = makeCh1WorldPhaseRenderer({
      get: () => ({ player: { position: undefined } }),
    } as any);

    assert.doesNotThrow(() => renderer.draw({} as any, 0));

    setCh1WorldPhaseEffectIds(undefined);
    setCh1AnchorReadUntilMs(0);
  });
});
