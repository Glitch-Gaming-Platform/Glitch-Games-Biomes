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
  if (/grove|harthmere|muck|fountain|guild|road/.test(context)) {
    return `${name === "I" ? "I keep" : `${name} keeps`} one eye on the road and one on the Grove. Around here, a kind word, a clean trade, and a repaired path all change how people remember you.`;
  }
  return `${name === "I" ? "I work" : `${name} works`} under the Biomes economy law: take only what you can account for, trade cleanly, and leave enough for the next traveler.`;
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
