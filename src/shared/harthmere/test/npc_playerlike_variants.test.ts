import assert from "assert";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  HARTHMERE_PLAYER_LIKE_NPC_VARIANT_VERSION,
  harthmerePlayerLikeNpcVariant,
  harthmerePlayerLikeNpcVariantSignature,
} from "@/shared/harthmere/npc_playerlike_variants";
import type { BiomesId } from "@/shared/ids";

describe("player-like NPC cosmetic variants", () => {
  it("assigns every authored human NPC a distinct complete player-mesh variant", () => {
    const starterBase = 8_810_000_000_010_000;
    const ids = [
      ...Array.from(
        { length: 70 },
        (_, index) => (starterBase + index + 1) as BiomesId
      ),
      ...SNAPSHOT_GROVE_NPCS.filter(
        (npc) => npc.seedServerNpc && !npc.snapshotAsset
      ).map((npc) => snapshotGroveNpcEntityId(npc)),
      ...HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((seed) => seed.entityId),
      ...HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) => seed.entityId),
      ...Object.values(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST).map(
        (giver) => giver.entityId
      ),
      8_810_000_000_030_123 as BiomesId,
    ];
    const uniqueIds = [...new Set(ids)];
    const signatures = uniqueIds.map(harthmerePlayerLikeNpcVariantSignature);

    assert.equal(
      new Set(signatures).size,
      uniqueIds.length,
      "authored humanoids must not collapse to the same hair/face/outfit signature"
    );
  });

  it("fills every face, hair, clothing, and accessory selection index", () => {
    const variant = harthmerePlayerLikeNpcVariant(
      8_810_000_000_019_320 as BiomesId
    );
    assert.equal(
      HARTHMERE_PLAYER_LIKE_NPC_VARIANT_VERSION,
      "harthmere-player-like-npc-mixed-radix-variants"
    );
    assert.ok(variant.skin >= 0 && variant.skin < 12);
    assert.ok(variant.eyes >= 0 && variant.eyes < 5);
    assert.ok(variant.hairColor >= 0 && variant.hairColor < 9);
    assert.ok(variant.top >= 0 && variant.top < 4);
    assert.ok(variant.bottoms >= 0 && variant.bottoms < 4);
    assert.ok(variant.hair >= 0 && variant.hair < 9);
    assert.ok(variant.face >= 0 && variant.face < 8);
    assert.ok(variant.ears >= 0 && variant.ears < 6);
    assert.ok(variant.neck >= 0 && variant.neck < 5);
    assert.ok(variant.hands >= 0 && variant.hands < 5);
    assert.ok(variant.hat >= 0 && variant.hat < 4);
    assert.ok(variant.outerwear >= 0 && variant.outerwear < 2);
  });
});
