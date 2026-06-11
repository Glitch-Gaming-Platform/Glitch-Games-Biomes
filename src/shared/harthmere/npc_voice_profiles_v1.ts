// HARTHMERE_NPC_VOICE_PROFILES_V1
//
// Azure-only voice casting for Harthmere NPCs and living entities. The
// resulting `voiceParameterId` is safe to store in the ECS Voice component or a
// static recording manifest. It is intentionally deterministic: the same actor
// identity always resolves to the same Azure Speech voice and prosody.

import { harthmereSpeechDeliveryForActorV1 } from "@/shared/harthmere/npc_speech_delivery_v1";

export const HARTHMERE_NPC_VOICE_PROFILES_VERSION_V1 =
  "harthmere-npc-voice-profiles-v1" as const;

export type HarthmereVoiceGenderV1 = "female" | "male" | "neutral";
export type HarthmereVoiceActorKindV1 =
  | "humanoid"
  | "robot"
  | "creature"
  | "animal"
  | "undead";

export interface HarthmereVoiceActorInputV1 {
  source: string;
  id?: string;
  entityId?: number | string;
  displayName?: string;
  name?: string;
  role?: string;
  kind?: string;
  background?: string;
  voiceStyle?: string;
  sex?: string;
  gender?: string;
}

export interface HarthmereNpcVoiceProfileV1 {
  version: typeof HARTHMERE_NPC_VOICE_PROFILES_VERSION_V1;
  actorKey: string;
  displayName: string;
  inferredGender: HarthmereVoiceGenderV1;
  actorKind: HarthmereVoiceActorKindV1;
  azureVoiceName: string;
  style?: string;
  styleDegree?: string;
  rate: string;
  pitch: string;
  volume: string;
  sentenceBreakMs: number;
  voiceParameterId: string;
  assignmentRationale: string;
}

export interface ParsedHarthmereAzureVoiceV1 {
  provider: "azure-speech";
  voiceName: string;
  style?: string;
  styleDegree?: string;
  role?: string;
  rate: string;
  pitch: string;
  volume: string;
  sentenceBreakMs: number;
  actorKey?: string;
}

interface HarthmereAzureVoiceCandidateV1 {
  voiceName: string;
  styles?: readonly string[];
}

const FEMALE_AZURE_VOICES_V1 = [
  {
    voiceName: "en-US-LunaNeural",
    styles: ["conversation"],
  },
  {
    voiceName: "en-US-AriaNeural",
    styles: ["chat", "friendly", "empathetic", "hopeful", "cheerful"],
  },
  {
    voiceName: "en-US-JennyNeural",
    styles: ["chat", "friendly", "hopeful", "cheerful"],
  },
  {
    voiceName: "en-US-SerenaMultilingualNeural",
    styles: ["friendly", "empathetic", "serious", "relieved", "sad"],
  },
  {
    voiceName: "en-US-PhoebeMultilingualNeural",
    styles: ["empathetic", "serious", "sad"],
  },
  {
    voiceName: "en-US-NancyMultilingualNeural",
    styles: ["friendly", "relieved", "funny", "shy"],
  },
  {
    voiceName: "en-US-JaneNeural",
    styles: ["friendly", "hopeful", "cheerful", "sad"],
  },
  {
    voiceName: "en-US-SaraNeural",
    styles: ["friendly", "hopeful", "cheerful", "sad"],
  },
] as const satisfies readonly HarthmereAzureVoiceCandidateV1[];

const MALE_AZURE_VOICES_V1 = [
  {
    voiceName: "en-US-KaiNeural",
    styles: ["conversation"],
  },
  {
    voiceName: "en-US-DavisNeural",
    styles: ["chat", "friendly", "hopeful", "cheerful"],
  },
  {
    voiceName: "en-US-GuyNeural",
    styles: ["friendly", "hopeful", "cheerful", "sad"],
  },
  {
    voiceName: "en-US-AndrewMultilingualNeural",
    styles: ["empathetic", "relieved"],
  },
  {
    voiceName: "en-US-DavisMultilingualNeural",
    styles: ["empathetic", "relieved", "funny"],
  },
  {
    voiceName: "en-US-DerekMultilingualNeural",
    styles: ["empathetic", "relieved", "shy", "excited"],
  },
  {
    voiceName: "en-US-TonyNeural",
    styles: ["friendly", "hopeful", "cheerful", "sad"],
  },
  {
    voiceName: "en-GB-RyanNeural",
    styles: ["chat", "cheerful"],
  },
] as const satisfies readonly HarthmereAzureVoiceCandidateV1[];

const NEUTRAL_AZURE_VOICES_V1 = [
  {
    voiceName: "en-US-OnyxTurboMultilingualNeural",
  },
  {
    voiceName: "en-US-NovaTurboMultilingualNeural",
  },
  {
    voiceName: "en-US-AlloyTurboMultilingualNeural",
  },
  {
    voiceName: "en-US-FableTurboMultilingualNeural",
  },
  {
    voiceName: "en-US-GuyNeural",
    styles: ["whispering", "unfriendly", "sad"],
  },
  {
    voiceName: "en-US-DavisNeural",
    styles: ["whispering", "sad", "hopeful"],
  },
  {
    voiceName: "en-US-AriaNeural",
    styles: ["whispering", "empathetic", "sad"],
  },
] as const satisfies readonly HarthmereAzureVoiceCandidateV1[];

export const HARTHMERE_AZURE_VOICE_NAMES_V1 = [
  ...FEMALE_AZURE_VOICES_V1.map((voice) => voice.voiceName),
  ...MALE_AZURE_VOICES_V1.map((voice) => voice.voiceName),
  ...NEUTRAL_AZURE_VOICES_V1.map((voice) => voice.voiceName),
] as const;

function normalizeVoiceTextV1(text: string | undefined) {
  return (text ?? "").trim().replace(/\s+/g, " ");
}

function signedPercentV1(value: number) {
  return `${value >= 0 ? "+" : ""}${value}%`;
}

export function stableHarthmereVoiceHashV1(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickStableV1<T>(values: readonly T[], hash: number): T {
  return values[hash % values.length];
}

function actorKeyForVoiceInputV1(input: HarthmereVoiceActorInputV1) {
  return [input.source, input.id, input.entityId, input.displayName, input.name]
    .filter((value) => value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value).trim().toLowerCase())
    .join(":");
}

function displayNameForVoiceInputV1(input: HarthmereVoiceActorInputV1) {
  return normalizeVoiceTextV1(input.displayName ?? input.name) || "Unknown";
}

function inferActorKindV1(
  input: HarthmereVoiceActorInputV1
): HarthmereVoiceActorKindV1 {
  const text = [
    input.kind,
    input.role,
    input.displayName,
    input.name,
    input.background,
    input.voiceStyle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(robot|sentinel|automaton|construct)\b/.test(text)) {
    return "robot";
  }
  if (/\b(cow|sheep|rabbit|livestock|animal|wildlife)\b/.test(text)) {
    return "animal";
  }
  if (/\b(mucker|muckling|muckwad|hexer|monster|creature)\b/.test(text)) {
    return "creature";
  }
  if (/\b(undead|ghost|wraith|grave|pale|skeleton)\b/.test(text)) {
    return "undead";
  }
  return "humanoid";
}

function inferGenderV1(
  input: HarthmereVoiceActorInputV1,
  actorKind: HarthmereVoiceActorKindV1
): HarthmereVoiceGenderV1 {
  if (actorKind !== "humanoid") {
    return "neutral";
  }

  const explicit = `${input.sex ?? ""} ${input.gender ?? ""}`.toLowerCase();
  if (/\b(f|female|woman|girl)\b/.test(explicit)) {
    return "female";
  }
  if (/\b(m|male|man|boy)\b/.test(explicit)) {
    return "male";
  }

  const text = [
    input.displayName,
    input.name,
    input.role,
    input.background,
    input.voiceStyle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(mother|daughter|sister|wife|widow|lady|madam|matron|aunt|girl|woman|her|she|priestess|forewoman|nurse|seamstress)\b/.test(
      text
    )
  ) {
    return "female";
  }
  if (
    /\b(father|son|brother|husband|lord|sir|sergeant|captain|foreman|smith|boy|man|his|he|watchman|bargeman|ferryman)\b/.test(
      text
    )
  ) {
    return "male";
  }

  const firstName = displayNameForVoiceInputV1(input)
    .split(/\s+/)[0]
    .toLowerCase();
  if (
    [
      "ada",
      "avelina",
      "bree",
      "calla",
      "coralie",
      "elowen",
      "greta",
      "hana",
      "helsa",
      "iselle",
      "iva",
      "jane",
      "jackie",
      "lune",
      "mara",
      "mira",
      "nia",
      "odette",
      "rinna",
      "rosalyn",
      "saff",
      "sera",
      "tamsin",
      "veska",
      "yenna",
    ].includes(firstName)
  ) {
    return "female";
  }
  if (
    [
      "alen",
      "bram",
      "bramwell",
      "bren",
      "cael",
      "carlo",
      "corvin",
      "doran",
      "dov",
      "eli",
      "goran",
      "gus",
      "hadrin",
      "harlo",
      "marl",
      "nilo",
      "orren",
      "osric",
      "pell",
      "rolf",
      "selwyn",
      "taye",
    ].includes(firstName)
  ) {
    return "male";
  }

  return stableHarthmereVoiceHashV1(text) % 2 === 0 ? "female" : "male";
}

function voicePoolForProfileV1(
  gender: HarthmereVoiceGenderV1,
  actorKind: HarthmereVoiceActorKindV1
): readonly HarthmereAzureVoiceCandidateV1[] {
  if (
    actorKind === "robot" ||
    actorKind === "creature" ||
    actorKind === "animal"
  ) {
    return NEUTRAL_AZURE_VOICES_V1;
  }
  if (gender === "female") {
    return FEMALE_AZURE_VOICES_V1;
  }
  if (gender === "male") {
    return MALE_AZURE_VOICES_V1;
  }
  return NEUTRAL_AZURE_VOICES_V1;
}

function desiredStylesForActorV1(
  input: HarthmereVoiceActorInputV1,
  actorKind: HarthmereVoiceActorKindV1
) {
  const text = [
    input.role,
    input.kind,
    input.displayName,
    input.name,
    input.background,
    input.voiceStyle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (actorKind === "robot") {
    return ["conversation", "chat", "friendly", "hopeful", "relieved"];
  }
  if (actorKind === "creature" || actorKind === "undead") {
    return ["whispering", "sad", "unfriendly", "hopeful"];
  }
  if (actorKind === "animal") {
    return ["friendly", "hopeful", "conversation", "chat"];
  }
  if (/\b(doctor|doc|healer|nurse|chapel|chaplain|priest|medic)\b/.test(text)) {
    return ["empathetic", "relieved", "friendly", "conversation", "chat"];
  }
  if (/\b(guard|captain|sergeant|watch|law|clerk|warden)\b/.test(text)) {
    return ["serious", "hopeful", "conversation", "chat", "friendly"];
  }
  if (
    /\b(merchant|market|shop|vendor|owner|customer|inn|tavern|cook|baker)\b/.test(
      text
    )
  ) {
    return ["friendly", "conversation", "chat", "cheerful", "relieved"];
  }
  if (/\b(child|young|shy|quiet|soft|gentle)\b/.test(text)) {
    return ["shy", "friendly", "empathetic", "conversation", "chat"];
  }
  if (/\b(sad|grief|widow|grave|mourn|lost|worry|afraid)\b/.test(text)) {
    return ["empathetic", "sad", "hopeful", "relieved", "conversation"];
  }
  return ["conversation", "chat", "friendly", "empathetic", "hopeful"];
}

function styleForActorV1(input: {
  candidate: HarthmereAzureVoiceCandidateV1;
  actor: HarthmereVoiceActorInputV1;
  actorKind: HarthmereVoiceActorKindV1;
}) {
  const styles = input.candidate.styles ?? [];
  if (styles.length === 0) {
    return undefined;
  }
  const desiredStyles = desiredStylesForActorV1(input.actor, input.actorKind);
  return desiredStyles.find((style) => styles.includes(style)) ?? styles[0];
}

function styleDegreeForActorV1(
  hash: number,
  actorKind: HarthmereVoiceActorKindV1,
  style: string | undefined
) {
  if (!style) {
    return undefined;
  }
  const base =
    actorKind === "creature" || actorKind === "undead"
      ? 0.7
      : actorKind === "robot"
      ? 0.75
      : 0.8;
  const spread = ((hash >>> 18) % 6) * 0.05;
  return (base + spread).toFixed(2);
}

function prosodyForActorV1(hash: number, actorKind: HarthmereVoiceActorKindV1) {
  if (actorKind === "robot") {
    return {
      rate: signedPercentV1(-5 + (hash % 9)),
      pitch: signedPercentV1(-3 + ((hash >>> 5) % 7)),
      sentenceBreakMs: 100 + ((hash >>> 10) % 8) * 15,
    };
  }
  if (actorKind === "creature" || actorKind === "undead") {
    return {
      rate: signedPercentV1(-14 + (hash % 8)),
      pitch: signedPercentV1(-8 + ((hash >>> 5) % 6)),
      sentenceBreakMs: 150 + ((hash >>> 10) % 10) * 20,
    };
  }
  if (actorKind === "animal") {
    return {
      rate: signedPercentV1(-8 + (hash % 10)),
      pitch: signedPercentV1(-4 + ((hash >>> 5) % 9)),
      sentenceBreakMs: 120 + ((hash >>> 10) % 8) * 18,
    };
  }
  return {
    rate: signedPercentV1(-5 + (hash % 9)),
    pitch: signedPercentV1(-3 + ((hash >>> 5) % 7)),
    sentenceBreakMs: 110 + ((hash >>> 10) % 9) * 12,
  };
}

export function buildHarthmereAzureVoiceParameterIdV1(input: {
  voiceName: string;
  style?: string;
  styleDegree?: string;
  role?: string;
  rate: string;
  pitch: string;
  volume?: string;
  sentenceBreakMs?: number;
  actorKey?: string;
}) {
  const parts = [
    ["voice", input.voiceName],
    ["style", input.style],
    ["styleDegree", input.styleDegree],
    ["role", input.role],
    ["rate", input.rate],
    ["pitch", input.pitch],
    ["volume", input.volume ?? "default"],
    ["break", String(input.sentenceBreakMs ?? 120)],
  ].filter((part): part is [string, string] => Boolean(part[1]));
  if (input.actorKey) {
    parts.push(["actor", input.actorKey]);
  }
  return `azure-speech-v1|${parts
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("|")}`;
}

export function parseHarthmereAzureVoiceIdV1(
  voiceId: string | undefined
): ParsedHarthmereAzureVoiceV1 | undefined {
  const trimmed = voiceId?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (
    /^[a-z]{2}-[A-Z]{2}-.+((Neural)|(MultilingualNeural)|(MAI-Voice-\d+))$/i.test(
      trimmed
    )
  ) {
    return {
      provider: "azure-speech",
      voiceName: trimmed,
      rate: "+0%",
      pitch: "+0%",
      volume: "default",
      sentenceBreakMs: 120,
    };
  }
  if (!trimmed.startsWith("azure-speech-v1|")) {
    return undefined;
  }
  const values: Record<string, string> = {};
  for (const part of trimmed.slice("azure-speech-v1|".length).split("|")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    values[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  if (!values.voice) {
    return undefined;
  }
  return {
    provider: "azure-speech",
    voiceName: values.voice,
    style: values.style,
    styleDegree: values.styleDegree,
    role: values.role,
    rate: values.rate ?? "+0%",
    pitch: values.pitch ?? "+0%",
    volume: values.volume ?? "default",
    sentenceBreakMs: Number(values.break ?? 120),
    ...(values.actor ? { actorKey: values.actor } : {}),
  };
}

export function harthmereAzureVoiceIdOrFallbackV1(input: {
  voiceId?: string;
  fallbackVoiceId: string;
}) {
  return input.voiceId && parseHarthmereAzureVoiceIdV1(input.voiceId)
    ? input.voiceId
    : input.fallbackVoiceId;
}

export function harthmereVoiceProfileForActorV1(
  input: HarthmereVoiceActorInputV1
): HarthmereNpcVoiceProfileV1 {
  const actorKey =
    actorKeyForVoiceInputV1(input) ||
    `${input.source}:unknown:${displayNameForVoiceInputV1(
      input
    ).toLowerCase()}`;
  const hash = stableHarthmereVoiceHashV1(
    [actorKey, input.role, input.kind, input.background, input.voiceStyle]
      .filter(Boolean)
      .join("|")
  );
  const actorKind = inferActorKindV1(input);
  const inferredGender = inferGenderV1(input, actorKind);
  const voicePool = voicePoolForProfileV1(inferredGender, actorKind);
  const voiceCandidate = pickStableV1(voicePool, hash);
  const azureVoiceName = voiceCandidate.voiceName;
  const style = styleForActorV1({
    candidate: voiceCandidate,
    actor: input,
    actorKind,
  });
  const styleDegree = styleDegreeForActorV1(hash, actorKind, style);
  const prosody = prosodyForActorV1(hash, actorKind);
  const displayName = displayNameForVoiceInputV1(input);
  const voiceParameterId = buildHarthmereAzureVoiceParameterIdV1({
    voiceName: azureVoiceName,
    style,
    styleDegree,
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: "default",
    sentenceBreakMs: prosody.sentenceBreakMs,
    actorKey,
  });

  return {
    version: HARTHMERE_NPC_VOICE_PROFILES_VERSION_V1,
    actorKey,
    displayName,
    inferredGender,
    actorKind,
    azureVoiceName,
    style,
    styleDegree,
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: "default",
    sentenceBreakMs: prosody.sentenceBreakMs,
    voiceParameterId,
    assignmentRationale:
      `${displayName} is treated as ${actorKind}; voice casting uses ` +
      `${inferredGender} presentation when authored sex is not explicit.`,
  };
}

export function stripHarthmereSpeechMarkupV1(text: string | undefined) {
  return normalizeVoiceTextV1(text)
    .replace(/\{break\}/gi, ". ")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/[\u201c\u201d]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeSsmlV1(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampPercentV1(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percentNumberV1(value: string | undefined) {
  const parsed = Number(String(value ?? "0").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function withSignedPercentDeltaV1(input: {
  value: string;
  delta: number;
  min: number;
  max: number;
}) {
  return signedPercentV1(
    clampPercentV1(
      Math.round(percentNumberV1(input.value) + input.delta),
      input.min,
      input.max
    )
  );
}

function styleDegreeWithDeltaV1(
  styleDegree: string | undefined,
  delta: number | undefined
) {
  if (!styleDegree || !delta) {
    return styleDegree;
  }
  const parsed = Number(styleDegree);
  if (!Number.isFinite(parsed)) {
    return styleDegree;
  }
  return Math.max(0.55, Math.min(1.12, parsed + delta)).toFixed(2);
}

function lineDeliveryDeltasV1(text: string) {
  const clean = stripHarthmereSpeechMarkupV1(text).toLowerCase();
  let rateDelta = 0;
  let pitchDelta = 0;
  let breakDeltaMs = 0;
  if (/[!?]/.test(clean)) {
    rateDelta += 1;
    pitchDelta += 1;
    breakDeltaMs -= 8;
  }
  if (
    /\b(now|fast|quick|hurry|urgent|danger|muck|helix|guard|convoy|patrol|fix it|get me home)\b/.test(
      clean
    )
  ) {
    rateDelta += 2;
    breakDeltaMs -= 14;
  }
  if (
    /\.\.\.|just\.{0,3}|please|lost|afraid|won't|can't|quiet|home folded/.test(
      clean
    )
  ) {
    rateDelta -= 2;
    pitchDelta -= 1;
    breakDeltaMs += 22;
  }
  return { rateDelta, pitchDelta, breakDeltaMs };
}

function ssmlTextWithSentenceBreaksV1(input: {
  text: string;
  sentenceBreakMs: number;
  phraseBreakRatio: number;
  commaBreakRatio: number;
  ellipsisBreakRatio: number;
}) {
  const clean = stripHarthmereSpeechMarkupV1(input.text);
  if (!clean) {
    return "";
  }
  const sentenceBreak = Math.max(0, input.sentenceBreakMs);
  const phraseBreak = Math.max(
    0,
    Math.round(sentenceBreak * input.phraseBreakRatio)
  );
  const commaBreak = Math.max(
    0,
    Math.round(sentenceBreak * input.commaBreakRatio)
  );
  const ellipsisBreak = Math.max(
    sentenceBreak,
    Math.round(sentenceBreak * input.ellipsisBreakRatio)
  );
  const sentenceToken = "%%HARTHMERE_SENTENCE_BREAK_V1%%";
  const phraseToken = "%%HARTHMERE_PHRASE_BREAK_V1%%";
  const commaToken = "%%HARTHMERE_COMMA_BREAK_V1%%";
  const ellipsisToken = "%%HARTHMERE_ELLIPSIS_BREAK_V1%%";
  const marked = clean
    .replace(/\.{3,}\s*/g, `...${ellipsisToken}`)
    .replace(/([.!?])\s+/g, `$1${sentenceToken}`)
    .replace(/([;:—–-])\s+/g, `$1${phraseToken}`)
    .replace(/(,)\s+/g, `$1${commaToken}`);
  return marked
    .split(
      new RegExp(
        `(${sentenceToken}|${phraseToken}|${commaToken}|${ellipsisToken})`,
        "g"
      )
    )
    .map((part) => {
      if (part === sentenceToken) {
        return `<break time="${sentenceBreak}ms"/>`;
      }
      if (part === phraseToken) {
        return `<break time="${phraseBreak}ms"/>`;
      }
      if (part === commaToken) {
        return commaBreak > 0 ? `<break time="${commaBreak}ms"/>` : "";
      }
      if (part === ellipsisToken) {
        return `<break time="${ellipsisBreak}ms"/>`;
      }
      return escapeSsmlV1(part);
    })
    .join("");
}

export function buildAzureSpeechSsmlV1(input: {
  text: string;
  voice: ParsedHarthmereAzureVoiceV1;
  language?: string;
}) {
  const locale = input.language?.trim() || "en-US";
  const delivery = harthmereSpeechDeliveryForActorV1({
    actorKey: input.voice.actorKey,
    text: input.text,
  });
  const lineDeltas = lineDeliveryDeltasV1(input.text);
  const sentenceBreakMs = Math.max(
    45,
    input.voice.sentenceBreakMs +
      delivery.sentenceBreakDeltaMs +
      lineDeltas.breakDeltaMs
  );
  const body = ssmlTextWithSentenceBreaksV1({
    text: input.text,
    sentenceBreakMs,
    phraseBreakRatio: delivery.phraseBreakRatio,
    commaBreakRatio: delivery.commaBreakRatio,
    ellipsisBreakRatio: delivery.ellipsisBreakRatio,
  });
  if (!body) {
    return "";
  }
  const rate = withSignedPercentDeltaV1({
    value: input.voice.rate,
    delta: delivery.rateDelta + lineDeltas.rateDelta,
    min: -16,
    max: 10,
  });
  const pitch = withSignedPercentDeltaV1({
    value: input.voice.pitch,
    delta: delivery.pitchDelta + lineDeltas.pitchDelta,
    min: -10,
    max: 8,
  });
  const volume = delivery.volume ?? input.voice.volume;
  const styleDegree = styleDegreeWithDeltaV1(
    input.voice.styleDegree,
    delivery.styleDegreeDelta
  );
  const prosody = [
    `<prosody rate="${escapeSsmlV1(rate)}" pitch="${escapeSsmlV1(
      pitch
    )}" volume="${escapeSsmlV1(volume)}">`,
    body,
    "</prosody>",
  ].join("");
  const voiceBody = input.voice.style
    ? [
        `<mstts:express-as style="${escapeSsmlV1(input.voice.style)}"${
          styleDegree ? ` styledegree="${escapeSsmlV1(styleDegree)}"` : ""
        }${
          input.voice.role ? ` role="${escapeSsmlV1(input.voice.role)}"` : ""
        }>`,
        prosody,
        "</mstts:express-as>",
      ].join("")
    : prosody;
  return [
    `<speak version="1.0" xml:lang="${escapeSsmlV1(
      locale
    )}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts">`,
    `<voice name="${escapeSsmlV1(input.voice.voiceName)}">`,
    voiceBody,
    "</voice>",
    "</speak>",
  ].join("");
}
