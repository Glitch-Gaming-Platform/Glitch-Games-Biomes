import assert from "assert";

import { harthmereBusinessCustomerFaceSeedV1 } from "../businessMiniGameFacesV1";

describe("business mini-game customer faces", () => {
  it("uses the stable customer identity instead of per-ticket randomness", () => {
    const first = harthmereBusinessCustomerFaceSeedV1({
      npcId: "customer_wen_auster",
      displayName: "Wen Auster",
    });
    const second = harthmereBusinessCustomerFaceSeedV1({
      npcId: "customer_wen_auster",
      displayName: "Wen Auster",
    });
    const other = harthmereBusinessCustomerFaceSeedV1({
      npcId: "customer_pella_snow",
      displayName: "Pella Snow",
    });

    assert.equal(first, second);
    assert.notEqual(first, other);
  });
});
