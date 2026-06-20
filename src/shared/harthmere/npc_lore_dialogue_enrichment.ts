export const HARTHMERE_NPC_LORE_DIALOGUE_ENRICHMENT_VERSION =
  "harthmere-npc-lore-dialogue-enrichment" as const;

export interface HarthmereNpcLoreLike {
  id: string;
  name?: string;
  displayName?: string;
  role?: string;
  faction?: string;
  district?: string;
  homeArea?: string;
  category?: string;
  kind?: string;
  bibleBackstory?: string;
  background?: string;
  dialogue?: Record<string, string>;
  line?: string;
  extraLines?: readonly string[];
}

export function harthmereNpcLoreTextIsPlaceholder(text: unknown): boolean {
  if (typeof text !== "string") return true;
  const value = text.trim();
  return (
    value.length < 24 ||
    /^(?:that's all for now|thats all for now|i'?m busy|whats up|what's up|hello|hi|hey|okay|ok|bye|goodbye)[.!?]*$/i.test(value) ||
    /\b(?:todo|tbd|lorem ipsum|placeholder|test placeholder|dev\/test|meta placeholder|production-ready hook|testable gameplay reason|Where the bible defined only)\b/i.test(value)
  );
}

function npcName(npc: HarthmereNpcLoreLike) {
  return npc.name ?? npc.displayName ?? npc.id;
}

function shortRole(npc: HarthmereNpcLoreLike) {
  return String(npc.role ?? npc.category ?? npc.kind ?? "resident").replaceAll("_", " ");
}

export function buildHarthmereBackstory(npc: HarthmereNpcLoreLike): string {
  const name = npcName(npc);
  const role = shortRole(npc);
  const district = npc.district ?? "Harthmere";
  const faction = npc.faction ?? "the town";
  if (npc.kind === "animal" || /wolf|boar|bear|deer|duck|cow|sheep|horse|rabbit|stag|goose|cat|dog/i.test(`${npc.id} ${role}`)) {
    return `${name} is part of the working edge around ${district}, where farms, roads, hunters, and hungry wilds all press against Harthmere law. Their presence matters because hides, meat, warning signs, and damaged fences all feed the town's fragile balance between food, safety, and debt.`;
  }
  if (/undead|risen|wraith|dead|bell|wyrm|root|muck|spider|treant|monster/i.test(`${npc.id} ${role} ${faction}`)) {
    return `${name} is tied to the old Harthmere wound: bells under stone, wet grave paths, and the things the town buried instead of solving. People in ${district} speak of them carefully because every encounter carries a little of the town's history back into the present.`;
  }
  if (/bandit|smuggler|outlaw|thief|fence|knife/i.test(`${npc.id} ${role} ${faction}`)) {
    return `${name} survives in the illegal economy around ${district}, where road tolls, river crates, debt, and fear make honest work harder to keep. They are not random trouble; they are what happens when Harthmere's laws, hunger, and opportunity stop lining up.`;
  }
  return `${name} works as a ${role} in ${district}, bound to ${faction} and to the daily pressure of Harthmere's markets, chapel, roads, docks, and old bell secrets. Their story belongs to the town's lore: duty, debt, rumor, and survival all meet in the work they do.`;
}

export function buildBiomesEconomyBackstory(npc: HarthmereNpcLoreLike): string {
  const name = npcName(npc);
  const role = shortRole(npc);
  const area = npc.homeArea ?? npc.district ?? "the Grove";
  return `${name} keeps a place in ${area}'s player economy as a ${role}, where food, repairs, courier work, gathering, safety, and fair trade decide whether new players can stand on their own. Their backstory follows Biomes economy law: useful work creates demand, demand creates jobs, and jobs give players a reason to return with goods instead of empty pockets.`;
}

export function buildNaturalNpcDialogue(
  npc: HarthmereNpcLoreLike,
  loreKind: "harthmere" | "biomes_economy",
): Record<string, string> {
  const name = npcName(npc);
  const role = shortRole(npc);
  if (loreKind === "harthmere") {
    return {
      greeting: `You need something, traveler? I am ${name}. Keep your voice steady; ${role} work hears more than people think.`,
      service: `If this is about work, say what you can carry, fix, prove, or protect. Harthmere has no patience for pretty promises today.`,
      rumor: `Prices, prayers, and patrols all feel tighter lately. When those three change at once, someone is hiding the reason.`,
      questOffer: `I can point you toward a useful job, but do it cleanly. Around here a careless favor becomes tomorrow's trouble.`,
      farewell: `Go with your eyes open. The town remembers who helps and who only makes noise.`,
    };
  }
  return {
    greeting: `Hey, good timing. I am ${name}; I keep the ${role} work moving around here.`,
    service: `If you have goods, tools, food, or a little time, there is probably a fair trade to make.`,
    rumor: `The quickest way to learn this place is to watch what people run out of first.`,
    questOffer: `I have a practical job if you want it. Nothing fancy, just useful work that pays and keeps the route alive.`,
    farewell: `Come back if your pack gets heavy. A working economy likes useful hands.`,
  };
}

export function enrichNpcLoreDialogue<T extends HarthmereNpcLoreLike>(
  npc: T,
  loreKind: "harthmere" | "biomes_economy",
): T {
  const backstory =
    loreKind === "harthmere"
      ? buildHarthmereBackstory(npc)
      : buildBiomesEconomyBackstory(npc);
  const dialogue = buildNaturalNpcDialogue(npc, loreKind);
  const next: any = { ...npc };
  if ("bibleBackstory" in next && harthmereNpcLoreTextIsPlaceholder(next.bibleBackstory)) {
    next.bibleBackstory = backstory;
  }
  if ("background" in next && harthmereNpcLoreTextIsPlaceholder(next.background)) {
    next.background = backstory;
  }
  if (!next.dialogue || Object.values(next.dialogue).some(harthmereNpcLoreTextIsPlaceholder)) {
    next.dialogue = { ...dialogue, ...(next.dialogue ?? {}) };
    for (const [key, value] of Object.entries(next.dialogue)) {
      if (harthmereNpcLoreTextIsPlaceholder(value)) {
        next.dialogue[key] = dialogue[key] ?? dialogue.greeting;
      }
    }
  }
  if (!next.line || harthmereNpcLoreTextIsPlaceholder(next.line)) {
    next.line = dialogue.greeting;
  }
  return next as T;
}
