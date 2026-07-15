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
    /\b(?:todo|tbd|lorem ipsum|placeholder|test placeholder|dev\/test|meta placeholder|production-ready hook|testable gameplay reason|Where the bible defined only)\b/i.test(value) ||
    // (dialogue fix D-2, 2026-07-14): also treat the dev/scaffolding creature
    // notes and the two dominant name-swapped skeletons as placeholders so a
    // regeneration pass rewrites them instead of preserving the clones.
    /production bark|encounter readability|spawn conditions|loot\/state reactions|silhouette, threat type|no dev\/test\/meta/i.test(
      value
    ) ||
    /looking for simple answers in harthmere, you came to the wrong gate|roads, records, and rivers all remember more than people think|there is a task tied to my route and my people|my work has a place in this town/i.test(
      value
    )
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

// (dialogue fix D-1/D-3/D-4, 2026-07-14): stable per-NPC hash so each NPC draws
// a DISTINCT combination from the pools below instead of every enriched NPC
// getting the same fixed 5-line block (which collapsed 183/185 NPCs to a few
// skeletons). Salted so independent fields don't all move together.
function enrichmentHash(text: string, salt: string): number {
  return [...`${salt}:${text}`].reduce(
    (acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0,
    5381
  );
}

function enrichmentPick<T>(pool: readonly T[], text: string, salt: string): T {
  return pool[enrichmentHash(text, salt) % pool.length];
}

function isHostileLoreNpc(npc: HarthmereNpcLoreLike): boolean {
  // Prefer the explicit kind/role signal; fall back to strong creature tokens.
  // Excludes location-ish words ("grave"/Gravewood, bare "muck"/The Muck) so
  // ordinary residents in those districts are not treated as monsters.
  if (/hostile|monster/i.test(`${npc.kind ?? ""} ${npc.role ?? ""}`)) {
    return true;
  }
  return /undead|risen|wight|wraith|corpse|ghoul|skeleton|bone crawler|bell-?woken|wyrm|dragon|mucker|muckling|muckwad|hexer|treant/i.test(
    `${npc.id} ${npc.role ?? ""} ${npc.kind ?? ""} ${npc.faction ?? ""}`
  );
}

export function buildNaturalNpcDialogue(
  npc: HarthmereNpcLoreLike,
  loreKind: "harthmere" | "biomes_economy",
): Record<string, string> {
  const name = npcName(npc);
  const role = shortRole(npc);
  const here = npc.district ?? npc.homeArea ?? "Harthmere";
  const key = `${npc.id}:${name}:${role}`;

  // Hostile creatures get wordless, in-world tells — never an "I am ..." line.
  if (isHostileLoreNpc(npc)) {
    const greetings = [
      `${name} offers no greeting — only breath, a scrape of movement, and the far echo of a bell.`,
      `Something is wrong with the air around ${name}: too still, too cold, too watchful.`,
      `${name} notices you before you see it move. Bells, roots, and old violence hang about it.`,
    ];
    const tells = [
      `Read ${name} before it reads you: silhouette, gait, and where it lingers are your only warning.`,
      `${name} gives one heartbeat of stillness before it strikes. Do not waste it.`,
      `Whatever ${name} was, ${here} buried it instead of solving it. Now it is your problem.`,
    ];
    return {
      greeting: enrichmentPick(greetings, key, "h_greet"),
      service: enrichmentPick(tells, key, "h_serv"),
      rumor: `Folk trade quiet warnings about ${name} around ${here} long before anyone sees it.`,
      questOffer: `${name} is the reason more than one ${here} task ends in danger — something to put down or drive back.`,
      farewell: `${name} will not be reasoned with. It ends when it is put down, scattered, or driven back into the dark.`,
    };
  }

  const openers = [
    `I am ${name}.`,
    `Name's ${name}.`,
    `They call me ${name}.`,
    `${name}, if you need it — you're new to ${here}, aren't you?`,
  ];
  const services = [
    `If this is about work, say what you can carry, fix, prove, or protect; ${here} has no patience for pretty promises.`,
    `Bring goods, tools, food, or a little time and there's a fair trade to make around ${here}.`,
    `${role} work is how I keep my place in ${here}. Tell me what you actually need.`,
    `Honest work first, favors second — that's how things hold together in ${here}.`,
  ];
  const rumors = [
    `Prices, prayers, and patrols all feel tighter in ${here} lately; when those move at once, someone's hiding the reason.`,
    `Quickest way to learn ${here} is to watch what people run out of first.`,
    `${here} remembers who repairs a path and who only steps over the broken part.`,
    `Loose stones and quiet lanterns are how a bad day announces itself in ${here}.`,
  ];
  const quests = [
    `I can point you toward useful work, but do it cleanly — a careless favor in ${here} becomes tomorrow's trouble.`,
    `There's a practical job if you want it. Nothing fancy, just work that pays and keeps ${here} alive.`,
    `Prove you're paying attention: check the board, ask nearby, and don't ignore the quiet warnings.`,
  ];
  const farewells = [
    `Go with your eyes open. ${here} remembers who helps and who only makes noise.`,
    `Come back if your pack gets heavy. A working town likes useful hands.`,
    `Keep your promises small and your voice steady; both travel far here.`,
  ];

  if (loreKind === "harthmere") {
    return {
      greeting: enrichmentPick(openers, key, "greet"),
      service: enrichmentPick(services, key, "serv"),
      rumor: enrichmentPick(rumors, key, "rumor"),
      questOffer: enrichmentPick(quests, key, "quest"),
      farewell: enrichmentPick(farewells, key, "fare"),
    };
  }
  return {
    greeting: `${enrichmentPick(openers, key, "b_greet")} I keep the ${role} work moving around ${here}.`,
    service: enrichmentPick(services, key, "b_serv"),
    rumor: enrichmentPick(rumors, key, "b_rumor"),
    questOffer: enrichmentPick(quests, key, "b_quest"),
    farewell: enrichmentPick(farewells, key, "b_fare"),
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
