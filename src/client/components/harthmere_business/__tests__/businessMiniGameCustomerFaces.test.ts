import assert from "assert";

import { BikkieIds } from "@/shared/bikkie/ids";
import { HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1 } from "@/shared/harthmere/business_customer_simulator_v1";
import {
  harthmereBusinessCustomerFaceSeedV1,
  harthmereBusinessCustomerPlayerMeshAvatarV1,
} from "../businessMiniGameFacesV1";

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

  it("constructs mini-game customer portraits as player mesh avatar inputs", () => {
    const customer = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.find(
      (npc) => npc.npcId === "customer_wen_auster"
    );
    assert.ok(customer);

    const avatar = harthmereBusinessCustomerPlayerMeshAvatarV1({
      npcId: customer.npcId,
      displayName: customer.displayName,
      appearance: customer.appearance,
    });
    const second = harthmereBusinessCustomerPlayerMeshAvatarV1({
      npcId: customer.npcId,
      displayName: customer.displayName,
      appearance: customer.appearance,
    });

    assert.deepEqual(avatar.appearance, second.appearance);
    assert.equal(avatar.appearance.head_id, BikkieIds.androgenous);
    assert.ok(avatar.appearance.skin_color_id.startsWith("skin_color_"));
    assert.ok(avatar.appearance.eye_color_id.startsWith("eye_color_"));
    assert.ok(avatar.appearance.hair_color_id.startsWith("hair_color_"));
    assert.ok(avatar.wearableOverrides.get(BikkieIds.hair));
    assert.equal(avatar.meshVersionKey, second.meshVersionKey);
  });
});
