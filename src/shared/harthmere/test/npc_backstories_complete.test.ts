import assert from "assert";
import { GROVE_ECONOMY_STARTER_NPCS } from "../grove_economy_starter";
import { HARTHMERE_NAMED_NPCS } from "../npc_compendium";
import { HARTHMERE_ALL_NPCS } from "../npc_compendium";
import { SNAPSHOT_GROVE_NPCS } from "../snapshot_grove_content";
import { SNAPSHOT_LIVE_NPC_LORE } from "../snapshot_live_npc_bible";
import {
  enrichNpcLoreDialogue,
  harthmereNpcLoreTextIsPlaceholder,
} from "../npc_lore_dialogue_enrichment";

type NpcBackstorySource = {
  source: string;
  id: string;
  name: string;
  backstory: unknown;
};

function npcName(npc: any): string {
  return String(npc.name ?? npc.displayName ?? npc.id);
}

function backstoryRecords(): NpcBackstorySource[] {
  return [
    ...SNAPSHOT_GROVE_NPCS.map((raw) => {
      const npc = enrichNpcLoreDialogue(raw, "biomes_economy");
      return {
      source: "SNAPSHOT_GROVE_NPCS.background",
      id: npc.id,
      name: npc.displayName,
      backstory: npc.background,
    }; }),
    ...GROVE_ECONOMY_STARTER_NPCS.map((raw) => {
      const npc = enrichNpcLoreDialogue(raw, "biomes_economy");
      return {
      source: "GROVE_ECONOMY_STARTER_NPCS.background",
      id: npc.id,
      name: npc.displayName,
      backstory: npc.background,
    }; }),
    ...SNAPSHOT_LIVE_NPC_LORE.map((raw) => {
      const npc = enrichNpcLoreDialogue(raw, "biomes_economy");
      return {
      source: "SNAPSHOT_LIVE_NPC_LORE.background",
      id: npc.id,
      name: npc.displayName,
      backstory: npc.background,
    }; }),
    ...HARTHMERE_NAMED_NPCS.map((raw) => {
      const npc = enrichNpcLoreDialogue(raw, "harthmere");
      return {
      source: "HARTHMERE_NAMED_NPCS.bibleBackstory",
      id: npc.id,
      name: npcName(npc),
      backstory: (npc as any).bibleBackstory,
    }; }),
    ...HARTHMERE_ALL_NPCS.map((raw) => {
      const npc = enrichNpcLoreDialogue(raw, "harthmere");
      return {
      source: "HARTHMERE_ALL_NPCS.bibleBackstory",
      id: npc.id,
      name: npcName(npc),
      backstory: (npc as any).bibleBackstory,
    }; }),
  ];
}

describe("NPC backstories complete", () => {
  it("gives every authored game NPC a non-placeholder backstory", () => {
    const records = backstoryRecords();
    const missing = records.filter((record) => {
      return harthmereNpcLoreTextIsPlaceholder(record.backstory);
    });

    assert.ok(records.length > 200);
    assert.deepEqual(
      missing.map((record) => `${record.source}:${record.id}:${record.name}`),
      [],
    );
  });

  it("gives every authored NPC natural dialogue without debug/template wording", () => {
    const records = [
      ...SNAPSHOT_GROVE_NPCS.map((npc) => enrichNpcLoreDialogue(npc, "biomes_economy")),
      ...GROVE_ECONOMY_STARTER_NPCS.map((npc) => enrichNpcLoreDialogue(npc, "biomes_economy")),
      ...SNAPSHOT_LIVE_NPC_LORE.map((npc) => enrichNpcLoreDialogue(npc, "biomes_economy")),
      ...HARTHMERE_NAMED_NPCS.map((npc) => enrichNpcLoreDialogue(npc, "harthmere")),
      ...HARTHMERE_ALL_NPCS.map((npc) => enrichNpcLoreDialogue(npc, "harthmere")),
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
      return lines.length < 1 || lines.some(harthmereNpcLoreTextIsPlaceholder);
    });

    assert.deepEqual(bad.map((npc: any) => `${npc.id}:${npc.name ?? npc.displayName}`), []);
  });
});
