import assert from "assert";
import { GROVE_ECONOMY_STARTER_NPCS_V1 } from "../grove_economy_starter_v1";
import { HARTHMERE_NAMED_NPCS_V44 } from "../npc_compendium_v44";
import { HARTHMERE_ALL_NPCS_V45 } from "../npc_compendium_v45";
import { SNAPSHOT_GROVE_NPCS_V75 } from "../snapshot_grove_content_v75";
import { SNAPSHOT_LIVE_NPC_LORE_V79 } from "../snapshot_live_npc_bible_v79";
import {
  enrichNpcLoreDialogueV1,
  harthmereNpcLoreTextIsPlaceholderV1,
} from "../npc_lore_dialogue_enrichment_v1";

type NpcBackstorySourceV1 = {
  source: string;
  id: string;
  name: string;
  backstory: unknown;
};

function npcNameV1(npc: any): string {
  return String(npc.name ?? npc.displayName ?? npc.id);
}

function backstoryRecordsV1(): NpcBackstorySourceV1[] {
  return [
    ...SNAPSHOT_GROVE_NPCS_V75.map((raw) => {
      const npc = enrichNpcLoreDialogueV1(raw, "biomes_economy");
      return {
      source: "SNAPSHOT_GROVE_NPCS_V75.background",
      id: npc.id,
      name: npc.displayName,
      backstory: npc.background,
    }; }),
    ...GROVE_ECONOMY_STARTER_NPCS_V1.map((raw) => {
      const npc = enrichNpcLoreDialogueV1(raw, "biomes_economy");
      return {
      source: "GROVE_ECONOMY_STARTER_NPCS_V1.background",
      id: npc.id,
      name: npc.displayName,
      backstory: npc.background,
    }; }),
    ...SNAPSHOT_LIVE_NPC_LORE_V79.map((raw) => {
      const npc = enrichNpcLoreDialogueV1(raw, "biomes_economy");
      return {
      source: "SNAPSHOT_LIVE_NPC_LORE_V79.background",
      id: npc.id,
      name: npc.displayName,
      backstory: npc.background,
    }; }),
    ...HARTHMERE_NAMED_NPCS_V44.map((raw) => {
      const npc = enrichNpcLoreDialogueV1(raw, "harthmere");
      return {
      source: "HARTHMERE_NAMED_NPCS_V44.bibleBackstory",
      id: npc.id,
      name: npcNameV1(npc),
      backstory: (npc as any).bibleBackstory,
    }; }),
    ...HARTHMERE_ALL_NPCS_V45.map((raw) => {
      const npc = enrichNpcLoreDialogueV1(raw, "harthmere");
      return {
      source: "HARTHMERE_ALL_NPCS_V45.bibleBackstory",
      id: npc.id,
      name: npcNameV1(npc),
      backstory: (npc as any).bibleBackstory,
    }; }),
  ];
}

describe("NPC backstories complete", () => {
  it("gives every authored game NPC a non-placeholder backstory", () => {
    const records = backstoryRecordsV1();
    const missing = records.filter((record) => {
      return harthmereNpcLoreTextIsPlaceholderV1(record.backstory);
    });

    assert.ok(records.length > 200);
    assert.deepEqual(
      missing.map((record) => `${record.source}:${record.id}:${record.name}`),
      [],
    );
  });

  it("gives every authored NPC natural dialogue without debug/template wording", () => {
    const records = [
      ...SNAPSHOT_GROVE_NPCS_V75.map((npc) => enrichNpcLoreDialogueV1(npc, "biomes_economy")),
      ...GROVE_ECONOMY_STARTER_NPCS_V1.map((npc) => enrichNpcLoreDialogueV1(npc, "biomes_economy")),
      ...SNAPSHOT_LIVE_NPC_LORE_V79.map((npc) => enrichNpcLoreDialogueV1(npc, "biomes_economy")),
      ...HARTHMERE_NAMED_NPCS_V44.map((npc) => enrichNpcLoreDialogueV1(npc, "harthmere")),
      ...HARTHMERE_ALL_NPCS_V45.map((npc) => enrichNpcLoreDialogueV1(npc, "harthmere")),
    ];
    const bad = records.filter((npc: any) => {
      const dialogue = npc.dialogue ?? {};
      const lines = [
        dialogue.greeting,
        dialogue.service,
        dialogue.rumor,
        dialogue.questOffer,
        dialogue.farewell,
        npc.line,
      ].filter(Boolean);
      return lines.length < 1 || lines.some(harthmereNpcLoreTextIsPlaceholderV1);
    });

    assert.deepEqual(bad.map((npc: any) => `${npc.id}:${npc.name ?? npc.displayName}`), []);
  });
});
