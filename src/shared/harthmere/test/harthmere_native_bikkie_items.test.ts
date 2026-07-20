import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import { conformsWith } from "@/shared/bikkie/core";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { bikkie } from "@/shared/bikkie/schema/biomes";
import { HARTHMERE_GATHERING_AUTHORITY_NODES } from "@/shared/harthmere/gathering_node_authority";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereNativeBiomesIdForItemId,
  withHarthmereNativeBikkieItems,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import assert from "assert";

function tray(contents: ReadonlyMap<number, Biscuit> = new Map()) {
  return {
    id: 1,
    contents: new Map(contents),
    hashes: new Map(),
  } as BakedBiscuitTray;
}

describe("Harthmere exact native Bikkie overlay", () => {
  it("covers every authored gathering node and all 79 exact yield identities", () => {
    const definitions = new Map(
      ensureHarthmereNativeItemCatalogue().map((definition) => [
        definition.itemId,
        definition,
      ])
    );
    const yieldIds = new Set(
      HARTHMERE_GATHERING_AUTHORITY_NODES.flatMap((node) =>
        [...node.baseYield, ...node.rareYield].map((row) => row.itemId)
      )
    );

    assert.equal(HARTHMERE_GATHERING_AUTHORITY_NODES.length, 29);
    assert.equal(yieldIds.size, 79);
    for (const node of HARTHMERE_GATHERING_AUTHORITY_NODES) {
      for (const row of [...node.baseYield, ...node.rareYield]) {
        assert.ok(
          definitions.has(row.itemId),
          `${node.id} is missing ${row.itemId}`
        );
      }
    }

    const exactIds = [...yieldIds].map((itemId) => {
      const id = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(id, `${itemId} needs an exact native id`);
      assert.ok(Number.isSafeInteger(id));
      assert.ok(id >= 8_650_000_000_000_000 && id < 8_690_000_000_000_000);
      return id;
    });
    assert.equal(new Set(exactIds).size, yieldIds.size);

    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const id of exactIds) {
      const biscuit = augmented.contents.get(id);
      assert.ok(biscuit, `tray is missing native item ${id}`);
      assert.equal(
        conformsWith(bikkie.schema.items.schema, biscuit),
        true,
        `${biscuit.displayName} must be discoverable through /items`
      );
    }
  });

  it("keeps semantically different items distinct", () => {
    assert.notEqual(
      harthmereNativeBiomesIdForItemId("iron_ore"),
      BikkieIds.goldOre
    );
    assert.notEqual(
      harthmereNativeBiomesIdForItemId("iron_ore"),
      harthmereNativeBiomesIdForItemId("gold_ore")
    );
    assert.notEqual(
      harthmereNativeBiomesIdForItemId("woodsman_axe"),
      harthmereNativeBiomesIdForItemId("repair_mallet")
    );
  });

  it("copies only presentation assets while preserving exact wearable ids", () => {
    const visualTop = {
      id: BikkieIds.grassyTop,
      name: "grassyTop",
      displayName: "Grassy Top",
      stackable: 1n,
      isDroppable: true,
      isWearable: true,
      wearAsTop: true,
      galoisPath: "wearables/grassy_top",
      paletteColor: "color_palettes/item_materials:green",
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[BikkieIds.grassyTop, visualTop]]))
    );
    const apronId = harthmereNativeBiomesIdForItemId("baker_apron")!;
    const apron = augmented.contents.get(apronId);

    assert.ok(apron);
    assert.equal(apron.id, apronId);
    assert.notEqual(apron.id, BikkieIds.grassyTop);
    assert.equal(apron.displayName, "Dawn Loaf Apron");
    assert.equal(apron.wearAsTop, true);
    assert.equal(apron.isWearable, true);
    assert.equal(apron.galoisPath, visualTop.galoisPath);
    assert.equal(apron.paletteColor, visualTop.paletteColor);
  });

  it("preserves explicitly numeric snapshot item ids", () => {
    const exact = {
      id: BikkieIds.pickaxe,
      name: "pickaxe",
      displayName: "Pickaxe",
      stackable: 1n,
      isDroppable: true,
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[BikkieIds.pickaxe, exact]]))
    );
    assert.strictEqual(augmented.contents.get(BikkieIds.pickaxe), exact);
  });

  it("can reapply the overlay to an unchanged prior tray", () => {
    const first = withHarthmereNativeBikkieItems(tray());
    const second = withHarthmereNativeBikkieItems(first);
    const ironId = harthmereNativeBiomesIdForItemId("iron_ore")!;
    // Other suites register isolated catalogue fixtures at process scope, so
    // this restart invariant intentionally compares the prior tray rather than
    // assuming a display label that a test fixture may have replaced.
    assert.equal(
      second.contents.get(ironId)?.displayName,
      first.contents.get(ironId)?.displayName
    );
    assert.equal(second.hashes.get(ironId), first.hashes.get(ironId));
  });
});
