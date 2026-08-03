/// <reference types="mocha" />

import assert from "assert";
import { harthmereGatheringNodeRespawnAtMsFromResponse } from "@/client/components/challenges/harthmereGatheringLiveAuthority";

describe("Harthmere gathering-node visual respawn contract", () => {
  it("uses the authoritative native drop expiry for the matching gathering node", () => {
    const respawnAtMs = Date.now() + 90_000;
    assert.equal(
      harthmereGatheringNodeRespawnAtMsFromResponse(
        {
          backendMutation: {
            nativeEcsMaterializationPlans: [
              {
                kind: "drop",
                sourceKind: "harthmere_gathering_node",
                materializationKey: "gathering:harthmere_orchard_softwood:req",
                expiresAtMs: respawnAtMs,
              },
            ],
          },
        },
        "harthmere_orchard_softwood"
      ),
      respawnAtMs
    );
  });

  it("does not animate from unrelated, expired, or non-gathering plans", () => {
    const nowMs = Date.now();
    for (const plan of [
      {
        kind: "drop",
        sourceKind: "harthmere_gathering_node",
        materializationKey: "gathering:another_node:req",
        expiresAtMs: nowMs + 90_000,
      },
      {
        kind: "drop",
        sourceKind: "harthmere_gathering_node",
        materializationKey: "gathering:harthmere_orchard_softwood:req",
        expiresAtMs: nowMs - 1,
      },
      {
        kind: "drop",
        sourceKind: "unrelated_drop",
        materializationKey: "gathering:harthmere_orchard_softwood:req",
        expiresAtMs: nowMs + 90_000,
      },
    ]) {
      assert.equal(
        harthmereGatheringNodeRespawnAtMsFromResponse(
          {
            backendMutation: { nativeEcsMaterializationPlans: [plan] },
          },
          "harthmere_orchard_softwood"
        ),
        undefined
      );
    }
  });
});
