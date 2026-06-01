export const HARTHMERE_PLACEHOLDER_DIALOG_PATTERNS_V143 = [
  /i['’]?m\s+(a\s+little\s+)?busy\s+right\s+now/i,
  /try talking to someone else/i,
  /that'?s all( for now| folks)?[.!]?$/i,
  /^what['’]?s up[.!?]?$/i,
  /^i['’]?m busy[.!?]?$/i,
  /^close$/i,
] as const;

export function isHarthmerePlaceholderNpcDialogV143(text: string | undefined) {
  const normalized = String(text ?? "")
    .replace(/<[^>]*>/g, " ")
    .trim();
  if (!normalized) {
    return true;
  }
  return HARTHMERE_PLACEHOLDER_DIALOG_PATTERNS_V143.some((pattern) =>
    pattern.test(normalized)
  );
}

export interface HarthmereFallbackNpcOptionV143 {
  name: string;
  followUpText: string;
  likeability: number;
  type?: "primary" | "destructive";
}

export function harthmereFallbackNpcDialogTextV143(input: {
  name?: string;
  description?: string;
}) {
  const context = [input.name, input.description].join(" ").toLowerCase();
  const variants = /grove|harthmere|muck|fountain|guild|road/.test(context)
    ? [
        "I keep one eye on the road and one on the Grove. Around here, a kind word, a clean trade, and a repaired path all change how people remember you.",
        "I am watching the Grove markers today. If a sign, lamp, or path looks wrong, someone local probably already has a story about why.",
        "I know the Grove's safe paths by habit: fountain first, board second, then the road once your bag and courage are both in order.",
        "I listen for small trouble before it becomes a quest. The Grove rewards people who notice loose stones, quiet lanterns, and missing supplies.",
      ]
    : [
        "I work by a simple town rule: count what you take, name what you owe, and leave the next traveler with a fair chance.",
        "I keep a practical ledger of favors, warnings, and work. Most problems here start small enough for one helpful person to change them.",
        "I have learned that Harthmere trusts deeds faster than speeches. Help cleanly, trade plainly, and people remember the difference.",
        "I point newcomers toward work that proves they are paying attention: check the board, ask nearby, and do not ignore the quiet warnings.",
      ];
  const seed = [...`${input.name ?? ""}:${input.description ?? ""}`].reduce(
    (acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0,
    5381
  );
  return variants[seed % variants.length];
}

export function harthmereFallbackNpcOptionsV143(input: {
  name?: string;
  description?: string;
}): HarthmereFallbackNpcOptionV143[] {
  const displayName = input.name?.trim() || "this local";
  const context = [input.name, input.description].join(" ").toLowerCase();
  const role = fallbackNpcRelationshipRoleV144(displayName, context);
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

function fallbackNpcRelationshipRoleV144(name: string, context: string) {
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
