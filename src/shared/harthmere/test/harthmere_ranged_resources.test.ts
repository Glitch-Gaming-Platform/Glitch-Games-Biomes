import { Inventory, TriggerState } from "@/shared/ecs/gen/components";
import { anItem } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import {
  HARTHMERE_ARROW_DAMAGE,
  HARTHMERE_ARROW_ITEM_ID,
  HARTHMERE_BOW_ATTACK_TIMING,
  HARTHMERE_BOW_COOLDOWN_MS,
  consumeHarthmereRangedResourceReceipt,
  findHarthmereBackpackArrow,
  harthmereBackpackArrowCount,
  harthmereMagicManaCost,
  harthmereRangedResourceCooldownMs,
  harthmereRangedResourceKind,
  harthmereRangedResourceReceiptMatches,
  readHarthmereRangedResourceReceipt,
  writeHarthmereRangedResourceReceipt,
} from "@/shared/harthmere/harthmere_ranged_resources";
import { ensureHarthmereProductionCraftingCatalogue } from "@/shared/harthmere/mmo_crafting_catalogue";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("Harthmere ranged resources", () => {
  before(() => ensureHarthmereProductionCraftingCatalogue());

  it("counts arrows only in backpack cells, never in the hotbar", () => {
    const arrowId = harthmereNativeBiomesIdForItemId(HARTHMERE_ARROW_ITEM_ID)!;
    const inventory = Inventory.create({
      items: [undefined, countOf(arrowId, 7n), countOf(arrowId, 4n)],
      hotbar: [countOf(arrowId, 99n)],
    });

    assert.equal(harthmereBackpackArrowCount(inventory), 11n);
    assert.deepEqual(findHarthmereBackpackArrow(inventory)?.ref, {
      kind: "item",
      idx: 1,
    });
  });

  it("classifies bows as half-second arrow attacks and spells as mana attacks", () => {
    const bow = anItem(harthmereNativeBiomesIdForItemId("hunter_bow")!);
    const focus = anItem(harthmereNativeBiomesIdForItemId("crystal_focus")!);

    assert.equal(harthmereRangedResourceKind(bow), "arrow");
    assert.equal(
      harthmereRangedResourceCooldownMs(bow),
      HARTHMERE_BOW_COOLDOWN_MS
    );
    assert.equal(HARTHMERE_ARROW_DAMAGE, 5);
    assert.equal(
      HARTHMERE_BOW_ATTACK_TIMING.impactMs +
        HARTHMERE_BOW_ATTACK_TIMING.recoveryMs,
      HARTHMERE_BOW_COOLDOWN_MS
    );

    assert.equal(harthmereRangedResourceKind(focus), "mana");
    assert.ok(harthmereMagicManaCost(focus) > 0);
  });

  it("matches one short-lived exact receipt and rejects it after consumption", () => {
    const state = TriggerState.create();
    const bowId = harthmereNativeBiomesIdForItemId("hunter_bow")!;
    const targetId = 91_002 as BiomesId;
    writeHarthmereRangedResourceReceipt(state, {
      attackTimeMs: 100_250,
      authorizedAtMs: 100_300,
      lastResourceAttackAtMs: 100_300,
      itemId: bowId,
      targetId,
      kind: "arrow",
      used: false,
    });

    assert.equal(
      harthmereRangedResourceReceiptMatches(state, {
        attackTime: 100.25,
        itemId: bowId,
        targetId,
        nowMs: 100_700,
      }),
      true
    );
    assert.equal(
      harthmereRangedResourceReceiptMatches(state, {
        attackTime: 100.25,
        itemId: bowId,
        targetId: 91_003 as BiomesId,
        nowMs: 100_700,
      }),
      false
    );

    consumeHarthmereRangedResourceReceipt(state);
    assert.equal(readHarthmereRangedResourceReceipt(state).used, true);
    assert.equal(
      harthmereRangedResourceReceiptMatches(state, {
        attackTime: 100.25,
        itemId: bowId,
        targetId,
        nowMs: 100_800,
      }),
      false
    );
  });
});
