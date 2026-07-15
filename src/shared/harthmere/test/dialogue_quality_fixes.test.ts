import assert from "assert";
import {
  isHarthmerePlaceholderNpcDialog,
  harthmereFallbackNpcDialogText,
} from "../npc_dialog_fallback";
import {
  buildNaturalNpcDialogue,
  harthmereNpcLoreTextIsPlaceholder,
} from "../npc_lore_dialogue_enrichment";

describe("dialogue quality fixes (D-1/D-2/D-3/D-4/D-5)", () => {
  // D-2: dev/scaffolding language and the dominant templated skeletons are now
  // recognized as placeholders (so the runtime routes them to the fallback).
  describe("D-2: placeholder filter catches dev language + skeletons", () => {
    const devLines = [
      "Thaedryn the Bellbound has hostile production barks: silence, breath, scrape, or broken words tied to bells, graves, roots, and old violence.",
      "Bone Crawler serves encounter readability: silhouette, threat type, spawn conditions, and loot/state reactions are explicit.",
      "“I am Yenna Holt. If you are looking for simple answers in Harthmere, you came to the wrong gate.”",
      "Go carefully. Roads, records, and rivers all remember more than people think.",
      "There is a task tied to my route and my people, and I would rather hand it to someone careful.",
    ];
    it("flags dev language and skeletons (runtime filter)", () => {
      for (const line of devLines) {
        assert.equal(
          isHarthmerePlaceholderNpcDialog(line),
          true,
          `runtime filter should flag: ${line}`
        );
      }
    });
    it("flags dev language and skeletons (enrichment filter)", () => {
      for (const line of devLines) {
        assert.equal(
          harthmereNpcLoreTextIsPlaceholder(line),
          true,
          `enrichment filter should flag: ${line}`
        );
      }
    });
    it("does not flag genuine authored bible dialogue", () => {
      const good =
        "Bram Holt keeps the North Gate ledger and will not lie about a toll, but he will remember exactly what you paid.";
      assert.equal(isHarthmerePlaceholderNpcDialog(good), false);
      assert.equal(harthmereNpcLoreTextIsPlaceholder(good), false);
    });
  });

  // D-1/D-3/D-4/D-5: the fallback generator is per-NPC varied and grounds by
  // district, instead of a 4-way name-swapped repeat.
  describe("D-1/D-3: fallback generator variety and grounding", () => {
    it("produces distinct lines across many NPCs (no collapse to a few skeletons)", () => {
      const names = Array.from({ length: 60 }, (_, i) => `Villager ${i} Holt`);
      const lines = new Set(
        names.map((name) =>
          harthmereFallbackNpcDialogText({
            name,
            description: "a market trader in Copper Kettle",
          })
        )
      );
      // With 8x8x8 structural combinations, 60 NPCs should yield many distinct
      // lines — far above the old 4-variant ceiling.
      assert.ok(
        lines.size >= 30,
        `expected high variety, got ${lines.size} distinct lines`
      );
    });

    it("names the NPC's actual district when it is known", () => {
      const line = harthmereFallbackNpcDialogText({
        name: "Toll Clerk Evin",
        description: "keeps the ledger at the River Docks",
      });
      assert.ok(
        line.includes("River Docks"),
        `expected district grounding, got: ${line}`
      );
    });

    it("gives hostile creatures an in-world bark, not a person's greeting", () => {
      const line = harthmereFallbackNpcDialogText({
        name: "Grave-Caked Walker",
        description: "an undead risen thing in Gravewood",
      });
      assert.ok(!/\bI am\b/.test(line), `monster should not say 'I am': ${line}`);
      assert.ok(
        !/production bark|encounter readability/i.test(line),
        `monster line must be in-world: ${line}`
      );
      assert.ok(line.includes("Grave-Caked Walker"));
    });
  });

  // D-1: enrichment builder no longer emits a single fixed block for everyone.
  describe("D-1: enrichment builder variety", () => {
    it("varies output across NPCs and grounds by district", () => {
      const a = buildNaturalNpcDialogue(
        {
          id: "npc_a",
          name: "Tanner Vessa",
          role: "tanner",
          district: "Mudden Ward",
        },
        "harthmere"
      );
      const b = buildNaturalNpcDialogue(
        {
          id: "npc_b",
          name: "Baker Osric",
          role: "baker",
          district: "Copper Kettle",
        },
        "harthmere"
      );
      assert.notDeepEqual(a, b, "two NPCs should not get identical dialogue");
      assert.ok(
        Object.values(a).some((line) => line.includes("Mudden Ward")),
        "should ground NPC A by district"
      );
      assert.ok(
        Object.values(b).some((line) => line.includes("Copper Kettle")),
        "should ground NPC B by district"
      );
    });

    it("gives hostile lore NPCs wordless tells", () => {
      const monster = buildNaturalNpcDialogue(
        {
          id: "undead_walker_01",
          name: "Bell-Woken Dead",
          role: "monster",
          kind: "hostile",
          district: "Gravewood",
        },
        "harthmere"
      );
      assert.ok(!/\bI am\b/.test(monster.greeting));
      assert.ok(monster.greeting.includes("Bell-Woken Dead"));
    });
  });
});
