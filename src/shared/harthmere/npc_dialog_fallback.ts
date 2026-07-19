export const HARTHMERE_PLACEHOLDER_DIALOG_PATTERNS = [
  /i['’]?m\s+(a\s+little\s+)?busy\s+right\s+now/i,
  /try talking to someone else/i,
  /that'?s all( for now| folks)?[.!]?$/i,
  /^what['’]?s up[.!?]?$/i,
  /^i['’]?m busy[.!?]?$/i,
  /^close$/i,
  // (dialogue fix D-2, 2026-07-14): dev/scaffolding language that leaked into
  // player-visible fields on ~38 monster/undead NPCs (and the LLM-prompt seed
  // on many more). These are design notes, not dialogue — treat them as
  // placeholders so the talk window falls through to the in-world fallback.
  /production bark/i,
  /encounter readability/i,
  /spawn conditions/i,
  /loot\/state reactions/i,
  /silhouette, threat type/i,
  /testable gameplay reason/i,
  /dev\/test\/meta placeholder/i,
  /no dev\/test\/meta/i,
  /where the bible defined only/i,
  // (dialogue fix D-1/D-3, 2026-07-14): the two dominant name-swapped skeletons
  // that collapsed 183/185 NPCs to a handful of scripts. Routing them to the
  // per-NPC fallback generator restores variety and district grounding.
  /looking for simple answers in harthmere, you came to the wrong gate/i,
  /roads, records, and rivers all remember more than people think/i,
  /there is a task tied to my route and my people/i,
  /my work has a place in this town/i,
] as const;

export function isHarthmerePlaceholderNpcDialog(text: string | undefined) {
  const normalized = String(text ?? "")
    .replace(/<[^>]*>/g, " ")
    .trim();
  if (!normalized) {
    return true;
  }
  return HARTHMERE_PLACEHOLDER_DIALOG_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
}

export interface HarthmereFallbackNpcOption {
  name: string;
  followUpText: string;
  likeability: number;
  type?: "primary" | "destructive";
}

// (dialogue fix D-3, 2026-07-14): the actual Harthmere districts, so a fallback
// line can name WHERE the NPC stands (Old Bridge, the docks, Gravewood) instead
// of the generic "Harthmere". Longer names are matched first so "Old Well /
// Underways" wins over a bare "well".
const HARTHMERE_KNOWN_DISTRICTS: readonly string[] = [
  "Old Well / Underways",
  "Watchtower Ridge",
  "Greenmere Edge",
  "Craftsman Row",
  "Residential District",
  "Deep Old Wood",
  "Old Hunter Track",
  "Player Services",
  "Last Watch Post",
  "Charcoal Camp",
  "Market Square",
  "River Docks",
  "Temple Green",
  "Mudden Ward",
  "Copper Kettle",
  "Orchard Lane",
  "Noble Rise",
  "Gate Fields",
  "North Gate",
  "Guard Yard",
  "Apothecary",
  "Mill Road",
  "Gravewood",
  "Briarfen",
];

// Simple, stable string hash (djb2). Exported streams are derived by salting the
// input so several INDEPENDENT choices can be made from one NPC without them all
// moving together — this is what gives per-NPC combinations rather than a single
// 4-way pick.
function harthmereDialogHash(text: string, salt = ""): number {
  return [...`${salt}:${text}`].reduce(
    (acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0,
    5381
  );
}

function pick<T>(pool: readonly T[], text: string, salt: string): T {
  return pool[harthmereDialogHash(text, salt) % pool.length];
}

function harthmereDistrictFromContext(context: string): string | undefined {
  const lower = context.toLowerCase();
  for (const district of HARTHMERE_KNOWN_DISTRICTS) {
    if (lower.includes(district.toLowerCase())) {
      return district;
    }
  }
  return undefined;
}

function harthmereFallbackIsHostileCreature(context: string): boolean {
  // Match only strong CREATURE tokens. Deliberately excludes location-ish words
  // that appear in ordinary residents' descriptions — bare "muck" (the place
  // "The Muck") and "grave" (the district "Gravewood") — so a merchant near The
  // Muck or a clerk in Gravewood is not mistaken for a monster.
  return /\b(monster|hostile|undead|risen|wight|wraith|corpse|ghoul|skeleton|bone crawler|bell-?woken|wyrm|dragon|mucker|muckling|muckwad|hexer|treant)\b/.test(
    context
  );
}

// Per-NPC threat lines for combat creatures (dialogue fix D-2/D-1): in-world,
// wordless, and district-aware — never the old "has hostile production barks"
// dev note, and never an "I am ..." greeting a monster would not give.
function harthmereHostileCreatureBark(input: {
  name: string;
  context: string;
  district?: string;
}): string {
  const where = input.district ? ` near ${input.district}` : " in the dark";
  const openers = [
    `${input.name} does not speak — there is only breath, a dry scrape of movement, and the far echo of a bell.`,
    `${input.name} turns toward you${where}, and every quiet instinct you have says leave.`,
    `Something is wrong with the air around ${input.name}: too still, too cold, too watchful.`,
    `${input.name} makes no greeting${where} — just the wet, patient sound of something that has waited a long time.`,
    `You feel ${input.name} notice you before you see it move. Bells, roots, and old violence hang around it.`,
  ];
  const tells = [
    "Watch its silhouette and how it moves; that is your only warning before it strikes.",
    "It gives one heartbeat of stillness before it lunges — do not waste it.",
    "Whatever it once was, Harthmere buried it instead of solving it. Now it is your problem.",
    "Keep the light between you and it, and keep your back to open ground.",
    "Strike true or step back. There is no talking your way past this one.",
  ];
  return `${pick(openers, input.name, "hostile_open")} ${pick(
    tells,
    input.context,
    "hostile_tell"
  )}`;
}

export function harthmereFallbackNpcDialogText(input: {
  name?: string;
  description?: string;
}) {
  const name = input.name?.trim() || "a local";
  const context = [input.name, input.description].join(" ");
  const district = harthmereDistrictFromContext(context);
  const key = `${input.name ?? ""}:${input.description ?? ""}`;

  // (dialogue fix D-2, 2026-07-14): combat creatures get an in-world threat bark
  // instead of a person's greeting or a design note.
  if (harthmereFallbackIsHostileCreature(context.toLowerCase())) {
    return harthmereHostileCreatureBark({ name, context, district });
  }

  // (dialogue fix D-1/D-3/D-4, 2026-07-14): build a per-NPC line from three
  // INDEPENDENT hash streams — an opener that names the NPC, a grounded
  // observation that names their district when known, and a closing bit of
  // voice. With 30 x 8 x 8 combinations (name/district substituted) nearby NPCs
  // no longer share a byte-for-byte script.
  const here = district ?? "Harthmere";
  const openers = [
    `I am ${name}.`,
    `Name's ${name}.`,
    `They call me ${name}.`,
    `${name}, if you need it.`,
    `You've found ${name}.`,
    `I'm ${name} — you're not from ${here}, are you?`,
    `${name}. New face.`,
    `I keep to my work here. ${name}.`,
    `You can call me ${name}.`,
    `Around ${here}, folks know me as ${name}.`,
    `If introductions matter, mine is ${name}.`,
    `Start with ${name}; we can sort the rest after.`,
    `The name is ${name}. What brings you through ${here}?`,
    `I answer to ${name}, especially when there is work to do.`,
    `You've got ${name}. Say what you need plainly.`,
    `Most days I am just ${name}, keeping ${here} moving.`,
    `Before you ask: ${name}.`,
    `New around ${here}? I'm ${name}.`,
    `People send questions my way. The name is ${name}.`,
    `${name} here. Keep it brief and honest.`,
    `If work brought you, ask for ${name}.`,
    `I was wondering when you'd find ${name}.`,
    `No ceremony needed — ${name}.`,
    `Take a breath. I'm ${name}.`,
    `You're speaking with ${name}, for better or worse.`,
    `Call me ${name}; everyone else in ${here} does.`,
    `I know these streets. I'm ${name}.`,
    `If trouble sent you, it found ${name}.`,
    `Let's save time: ${name}.`,
    `Names first. Mine is ${name}.`,
  ];
  const observations = [
    `${here} runs on small habits: count what you take, name what you owe, leave the next traveler a fair chance.`,
    `Most trouble in ${here} starts small enough for one paying-attention person to change it.`,
    `Around ${here} people trust deeds faster than speeches, so help cleanly and trade plainly.`,
    `Watch what folks in ${here} run out of first — that tells you more than any notice board.`,
    `${here} remembers who repairs a path and who only steps over the broken part.`,
    `I keep one eye on my work and one on ${here}; loose stones and quiet lanterns are how bad days announce themselves.`,
    `The safe way through ${here}: fountain first, board second, road once your bag and your courage are both in order.`,
    `Prices, prayers, and patrols have all felt tighter lately in ${here}. When those three move at once, someone's hiding the reason.`,
  ];
  const closers = [
    "Say what you can carry, fix, prove, or protect, and we'll get on.",
    "There's honest work if you want it — nothing fancy, just useful.",
    "Go carefully. The town remembers who helps and who only makes noise.",
    "Ask nearby before you wander off; the quiet warnings are the true ones.",
    "Come back if your pack gets heavy. A working town likes useful hands.",
    "Do a careless favor here and it becomes tomorrow's trouble — so do it right.",
    "Keep your voice steady and your promises small; both travel far here.",
    "If a sign, lamp, or path looks wrong, someone local already has the story.",
  ];

  return `${pick(openers, key, "open")} ${pick(
    observations,
    key,
    "obs"
  )} ${pick(closers, key, "close")}`;
}

export function harthmereFallbackNpcOptions(input: {
  name?: string;
  description?: string;
}): HarthmereFallbackNpcOption[] {
  const displayName = input.name?.trim() || "this local";
  const context = [input.name, input.description].join(" ").toLowerCase();
  const role = fallbackNpcRelationshipRole(displayName, context);
  const worldLine = /grove|harthmere|muck|fountain|guild|road/.test(context)
    ? "I trust small habits to keep the Grove alive: check the boards, share food before exhaustion wins, and tell Jackie when the roads start acting strange."
    : "I keep the economy law simple in public and hard in practice: record the work, respect closed shops, and never pretend a found thing has no owner.";
  return [
    {
      name: "Ask about this place",
      followUpText: worldLine,
      likeability: 0,
    },
    {
      name: role.positiveName,
      followUpText: role.positiveFollowUpText,
      likeability: 6,
      type: "primary" as const,
    },
    {
      name: role.negativeName,
      followUpText: role.negativeFollowUpText,
      likeability: -8,
      type: "destructive" as const,
    },
  ];
}

function fallbackNpcRelationshipRole(name: string, context: string) {
  const firstName = name.split(/[,\s]/).find(Boolean) ?? "local";
  const profiles = [
    {
      test: /bank|vault|ledger|lockbox|loan|storage/,
      positiveName: `Praise ${firstName}'s careful ledger work`,
      positiveFollowUpText:
        "I appreciate that. A careful ledger is not glamorous, but it keeps people from losing everything they trusted me to hold.",
      negativeName: `Call ${firstName}'s ledgers pointless fuss`,
      negativeFollowUpText:
        "I hear you. If ledgers look pointless to you, then I know exactly how far to trust you near other people's coin.",
    },
    {
      test: /guard|watch|gate|patrol|drill|bounty|sword|weapon/,
      positiveName: `Respect ${firstName}'s steady watch`,
      positiveFollowUpText:
        "I will remember that. Keeping watch is easier when someone notices the difference between order and bullying.",
      negativeName: `Mock ${firstName}'s badge and orders`,
      negativeFollowUpText:
        "I have heard sharper insults from people already in cuffs. Keep talking that way and I will remember your face for the wrong reason.",
    },
    {
      test: /forge|smith|anvil|iron|hinge|blade|repair/,
      positiveName: `Compliment ${firstName}'s honest craft`,
      positiveFollowUpText:
        "I respect that. Good work should outlast the person praising it, but it is still good to hear someone can tell the difference.",
      negativeName: `Call ${firstName}'s craft crude`,
      negativeFollowUpText:
        "If all you see is crude work, you can carry crude tools. I save my patience for people who know what keeps them alive.",
    },
    {
      test: /healer|chapel|temple|priest|medicine|mercy|salve|fever/,
      positiveName: `Thank ${firstName} for steady care`,
      positiveFollowUpText:
        "Thank you. Care is quiet work, and quiet work still costs strength. I am glad you can see that.",
      negativeName: `Dismiss ${firstName}'s mercy as weakness`,
      negativeFollowUpText:
        "Mercy is not weakness. It is restraint with work behind it, and I do not waste it on cruelty for long.",
    },
    {
      test: /dock|river|cargo|crate|ferry|harbor|barge/,
      positiveName: `Praise ${firstName}'s river sense`,
      positiveFollowUpText:
        "I will take that compliment. River work rewards people who notice weight, weather, rope, and silence before trouble starts.",
      negativeName: `Call ${firstName}'s dock work simple`,
      negativeFollowUpText:
        "Simple, is it? Then you can explain why one dry crate after three days of rain makes every honest worker nervous.",
    },
    {
      test: /farm|orchard|apple|chicken|bread|baker|oven|field|animal/,
      positiveName: `Compliment ${firstName}'s hard field work`,
      positiveFollowUpText:
        "I appreciate that. Food looks simple only after someone else has done the cold, muddy, early part.",
      negativeName: `Sneer at ${firstName}'s muddy chores`,
      negativeFollowUpText:
        "You can sneer at mud after you have eaten without it. Until then, I know what your respect is worth.",
    },
    {
      test: /thief|smuggler|mudden|drain|knots|shadow|fence|alley/,
      positiveName: `Respect ${firstName}'s street sense`,
      positiveFollowUpText:
        "Careful. Compliments like that can sound like bait. Still, I know the streets, and I notice when someone admits it.",
      negativeName: `Call ${firstName} alley trash`,
      negativeFollowUpText:
        "Say that again and you will learn how fast trash can disappear with something important in its pocket.",
    },
    {
      test: /guild|board|notice|posting|market board|jobs board/,
      positiveName: `Praise ${firstName}'s clear postings`,
      positiveFollowUpText:
        "I like clear work. A good notice saves three bad conversations and keeps the right hands moving.",
      negativeName: `Call ${firstName}'s notices clutter`,
      negativeFollowUpText:
        "Clutter is what happens when people refuse to read before complaining. The urgent work is marked plainly enough.",
    },
    {
      test: /magic|mage|book|candle|spell|arcane|wyrm/,
      positiveName: `Compliment ${firstName}'s careful study`,
      positiveFollowUpText:
        "That is wise of you to notice. Careless study makes noise; careful study leaves the room standing.",
      negativeName: `Call ${firstName}'s books nonsense`,
      negativeFollowUpText:
        "Nonsense is usually what people call a thing right before it proves they should have listened.",
    },
  ];
  const matched = profiles.find((profile) => profile.test.test(context));
  if (matched) {
    return matched;
  }
  const seed = [...`${name}:${context}`].reduce(
    (acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0,
    5381
  );
  const generic = [
    {
      positiveName: `Compliment ${firstName}'s steady eye`,
      positiveFollowUpText:
        "I appreciate that. Most people hurry through a conversation and miss the work happening right in front of them.",
      negativeName: `Call ${firstName} useless`,
      negativeFollowUpText:
        "Useless is a bold word from someone still asking locals for direction. I will remember you chose it.",
    },
    {
      positiveName: `Praise ${firstName}'s practical judgment`,
      positiveFollowUpText:
        "That lands well. Practical judgment is what keeps small problems from becoming everyone's problem.",
      negativeName: `Mock ${firstName}'s local advice`,
      negativeFollowUpText:
        "Ignore local advice if you like. Roads teach slowly, then all at once.",
    },
    {
      positiveName: `Respect ${firstName}'s patience`,
      positiveFollowUpText:
        "I value that. Patience is not silence; it is choosing the useful answer before the angry one.",
      negativeName: `Tell ${firstName} to stop wasting time`,
      negativeFollowUpText:
        "Then I will save us both some time: do not expect warmth after you spend yours insulting me.",
    },
  ];
  return generic[seed % generic.length];
}
