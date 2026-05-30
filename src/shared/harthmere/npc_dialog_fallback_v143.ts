export const HARTHMERE_PLACEHOLDER_DIALOG_PATTERNS_V143 = [
  /i['’]?m\s+(a\s+little\s+)?busy\s+right\s+now/i,
  /try talking to someone else/i,
  /that'?s all( for now| folks)?[.!]?$/i,
  /^what['’]?s up[.!?]?$/i,
  /^i['’]?m busy[.!?]?$/i,
  /^close$/i,
] as const;

export function isHarthmerePlaceholderNpcDialogV143(text: string | undefined) {
  const normalized = String(text ?? "").replace(/<[^>]*>/g, " ").trim();
  if (!normalized) {
    return true;
  }
  return HARTHMERE_PLACEHOLDER_DIALOG_PATTERNS_V143.some((pattern) =>
    pattern.test(normalized),
  );
}

export function harthmereFallbackNpcDialogTextV143(input: {
  name?: string;
  description?: string;
}) {
  const name = input.name?.trim() || "I";
  const context = [input.name, input.description].join(" ").toLowerCase();
  const variants = /grove|harthmere|muck|fountain|guild|road/.test(context)
    ? [
        `${name === "I" ? "I keep" : `${name} keeps`} one eye on the road and one on the Grove. Around here, a kind word, a clean trade, and a repaired path all change how people remember you.`,
        `${name === "I" ? "I am" : `${name} is`} watching the Grove markers today. If a sign, lamp, or path looks wrong, someone local probably already has a story about why.`,
        `${name === "I" ? "I know" : `${name} knows`} the Grove's safe paths by habit: fountain first, board second, then the road once your bag and courage are both in order.`,
        `${name === "I" ? "I listen" : `${name} listens`} for small trouble before it becomes a quest. The Grove rewards people who notice loose stones, quiet lanterns, and missing supplies.`,
      ]
    : [
        `${name === "I" ? "I work" : `${name} works`} by a simple town rule: count what you take, name what you owe, and leave the next traveler with a fair chance.`,
        `${name === "I" ? "I keep" : `${name} keeps`} a practical ledger of favors, warnings, and work. Most problems here start small enough for one helpful person to change them.`,
        `${name === "I" ? "I have" : `${name} has`} learned that Harthmere trusts deeds faster than speeches. Help cleanly, trade plainly, and people remember the difference.`,
        `${name === "I" ? "I point" : `${name} points`} newcomers toward work that proves they are paying attention: check the board, ask nearby, and do not ignore the quiet warnings.`,
      ];
  const seed = [...`${input.name ?? ""}:${input.description ?? ""}`].reduce(
    (acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0,
    5381,
  );
  return variants[seed % variants.length];
}

export function harthmereFallbackNpcOptionsV143(input: {
  name?: string;
  description?: string;
}) {
  const context = [input.name, input.description].join(" ").toLowerCase();
  const worldLine = /grove|harthmere|muck|fountain|guild|road/.test(context)
    ? "The Grove stays alive through small habits: check the boards, share food before exhaustion wins, and tell Jackie when the roads start acting strange."
    : "The economy law is simple in public and hard in practice: record the work, respect closed shops, and never pretend a found thing has no owner.";
  return [
    {
      name: "Ask about this place",
      followUpText: worldLine,
      likeability: 2,
    },
    {
      name: "Offer a hand",
      followUpText:
        "They take the offer seriously. 'Start small. Gather clean, report danger, and help someone before the board has to ask twice.'",
      likeability: 4,
    },
  ];
}
