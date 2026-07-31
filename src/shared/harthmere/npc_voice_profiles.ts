// HARTHMERE_NPC_VOICE_PROFILES
//
// Deterministic voice casting for Harthmere NPCs and living entities. The
// resulting `voiceParameterId` remains an Azure-compatible descriptor for the
// existing provider, and now also carries actor metadata used to select a
// matching ElevenLabs voice. It is safe to store in the ECS Voice component or
// a static recording manifest.

import { harthmereSpeechDeliveryForActor } from "@/shared/harthmere/npc_speech_delivery";
import { snapshotGroveNpcStableVoiceEntityId } from "@/shared/harthmere/snapshot_grove_ids";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_NPC_VOICE_PROFILES_VERSION =
  "harthmere-npc-voice-profiles" as const;

export type HarthmereVoiceGender = "female" | "male" | "neutral";
export type HarthmereVoiceActorKind =
  | "humanoid"
  | "robot"
  | "creature"
  | "animal"
  | "undead";

export interface HarthmereVoiceActorInput {
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

export interface HarthmereNpcVoiceProfile {
  version: typeof HARTHMERE_NPC_VOICE_PROFILES_VERSION;
  actorKey: string;
  displayName: string;
  inferredGender: HarthmereVoiceGender;
  actorKind: HarthmereVoiceActorKind;
  deliveryStyle?: string;
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

export interface ParsedHarthmereAzureVoice {
  provider: "azure-speech";
  voiceName: string;
  // Provider-neutral casting metadata is embedded alongside the Azure voice
  // fields so ElevenLabs can reuse the same deterministic NPC profile.
  gender?: HarthmereVoiceGender;
  actorKind?: HarthmereVoiceActorKind;
  deliveryStyle?: string;
  style?: string;
  styleDegree?: string;
  role?: string;
  rate: string;
  pitch: string;
  volume: string;
  sentenceBreakMs: number;
  actorKey?: string;
}

interface HarthmereAzureVoiceCandidate {
  voiceName: string;
  styles?: readonly string[];
}

const FEMALE_AZURE_VOICES = [
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
] as const satisfies readonly HarthmereAzureVoiceCandidate[];

const MALE_AZURE_VOICES = [
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
] as const satisfies readonly HarthmereAzureVoiceCandidate[];

const NEUTRAL_AZURE_VOICES = [
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
] as const satisfies readonly HarthmereAzureVoiceCandidate[];

export const HARTHMERE_AZURE_VOICE_NAMES = [
  ...FEMALE_AZURE_VOICES.map((voice) => voice.voiceName),
  ...MALE_AZURE_VOICES.map((voice) => voice.voiceName),
  ...NEUTRAL_AZURE_VOICES.map((voice) => voice.voiceName),
] as const;

function isHarthmereVoiceGender(
  value: string | undefined
): value is HarthmereVoiceGender {
  return value === "female" || value === "male" || value === "neutral";
}

function isHarthmereVoiceActorKind(
  value: string | undefined
): value is HarthmereVoiceActorKind {
  return (
    value === "humanoid" ||
    value === "robot" ||
    value === "creature" ||
    value === "animal" ||
    value === "undead"
  );
}

function azureVoiceGenderFromName(
  voiceName: string
): HarthmereVoiceGender | undefined {
  // Older stored voice IDs predate explicit gender metadata. Recover it from
  // the curated Azure pools when possible without rejecting legacy entities.
  if (FEMALE_AZURE_VOICES.some((voice) => voice.voiceName === voiceName)) {
    return "female";
  }
  if (MALE_AZURE_VOICES.some((voice) => voice.voiceName === voiceName)) {
    return "male";
  }
  if (NEUTRAL_AZURE_VOICES.some((voice) => voice.voiceName === voiceName)) {
    return "neutral";
  }
  return undefined;
}

function normalizeVoiceText(text: string | undefined) {
  return (text ?? "").trim().replace(/\s+/g, " ");
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value}%`;
}

export function stableHarthmereVoiceHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickStable<T>(values: readonly T[], hash: number): T {
  return values[hash % values.length];
}

function actorKeyForVoiceInput(input: HarthmereVoiceActorInput) {
  const numericEntityId = Number(input.entityId);
  const stableEntityId =
    input.source === "runtime_entity" && Number.isSafeInteger(numericEntityId)
      ? snapshotGroveNpcStableVoiceEntityId(numericEntityId as BiomesId)
      : input.entityId;
  return [input.source, input.id, stableEntityId, input.displayName, input.name]
    .filter((value) => value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value).trim().toLowerCase())
    .join(":");
}

function displayNameForVoiceInput(input: HarthmereVoiceActorInput) {
  return normalizeVoiceText(input.displayName ?? input.name) || "Unknown";
}

function inferActorKind(
  input: HarthmereVoiceActorInput
): HarthmereVoiceActorKind {
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

// Keep this cast list intentionally curated from authored character sources;
// unreviewed fantasy names continue through the stable unknown-name fallback.
const FEMALE_VOICE_GIVEN_NAMES = new Set([
  "ada",
  "andriana",
  "anse",
  "anwen",
  "avelina",
  "bessa",
  "bree",
  "brenna",
  "briony",
  "calla",
  "cinta",
  "coralie",
  "coretta",
  "cressa",
  "dawn",
  "edda",
  "elowen",
  "emily",
  "erena",
  "esa",
  "gizela",
  "greta",
  "hana",
  "helsa",
  "helna",
  "henrietta",
  "iris",
  "iselle",
  "iva",
  "jackie",
  "jane",
  "julienne",
  "lila",
  "lina",
  "liss",
  "lune",
  "mab",
  "maelle",
  "mara",
  "mira",
  "nadia",
  "nel",
  "nessa",
  "nia",
  "odette",
  "patsy",
  "pera",
  "rinna",
  "rosalyn",
  "saff",
  "selka",
  "sella",
  "sera",
  "sophia",
  "sora",
  "tamsin",
  "tisa",
  "veneth",
  "veska",
  "wen",
  "yenna",
  "ysabet",
]);

// The matching male list follows the same evidence rule as the female list.
const MALE_VOICE_GIVEN_NAMES = new Set([
  "alen",
  "billy",
  "bram",
  "bramwell",
  "bren",
  "cael",
  "carlo",
  "cob",
  "corvin",
  "doran",
  "dov",
  "drake",
  "edrik",
  "eli",
  "garr",
  "garrik",
  "goran",
  "greb",
  "gus",
  "hadrin",
  "halden",
  "hallr",
  "halpen",
  "harlo",
  "henrick",
  "hob",
  "huck",
  "hul",
  "jax",
  "jory",
  "lon",
  "lucien",
  "luis",
  "marl",
  "merl",
  "mott",
  "nilo",
  "nyle",
  "orren",
  "osric",
  "ovis",
  "pell",
  "ren",
  "richard",
  "rolf",
  "ruel",
  "rusk",
  "sael",
  "selwyn",
  "taye",
  "teague",
  "teak",
  "teo",
  "tomas",
  "tovin",
  "vance",
  "walt",
  "wat",
]);

function genderFromStrongTitle(text: string): HarthmereVoiceGender | undefined {
  const normalized = text.toLowerCase();
  const female =
    /\b(mother|daughter|sister|wife|widow|lady|madam|mistress|matron|aunt|girl|woman|priestess|forewoman|queen|goodwife|patroness|mrs|ms)\b/.test(
      normalized
    );
  const male =
    /\b(father|son|brother|husband|widower|lord|sir|boy|man|jarl|king|mr)\b/.test(
      normalized
    );
  return female === male ? undefined : female ? "female" : "male";
}

/** Strong, auditable evidence from a displayed name; undefined means unknown. */
export function harthmereStrongVoiceGenderForNameForTest(
  displayName: string | undefined
): HarthmereVoiceGender | undefined {
  const normalized = normalizeVoiceText(displayName).toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const titled = genderFromStrongTitle(normalized);
  if (titled) {
    return titled;
  }
  const tokens = normalized.match(/[a-z][a-z'-]*/g) ?? [];
  for (const token of tokens) {
    if (FEMALE_VOICE_GIVEN_NAMES.has(token)) {
      return "female";
    }
    if (MALE_VOICE_GIVEN_NAMES.has(token)) {
      return "male";
    }
  }
  return undefined;
}

function inferGender(
  input: HarthmereVoiceActorInput,
  actorKind: HarthmereVoiceActorKind
): HarthmereVoiceGender {
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

  // Displayed identity is stronger evidence than incidental relatives or
  // pronouns in a backstory. This prevents, for example, a widower mentioning
  // his wife from being cast as female, and lets titled names such as
  // "Foreman Calla" reach the actual given-name dictionary.
  const identityGender = harthmereStrongVoiceGenderForNameForTest(
    displayNameForVoiceInput(input)
  );
  if (identityGender) {
    return identityGender;
  }

  const roleText = [input.role, input.voiceStyle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Roles describe the actor; family nouns in prose often describe somebody
  // else and must not recast an otherwise ambiguous character.
  const contextualTitleGender = genderFromStrongTitle(roleText);
  if (contextualTitleGender) {
    return contextualTitleGender;
  }

  const contextualText = [input.role, input.background, input.voiceStyle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const femalePronoun = /\b(she|her|hers)\b/.test(contextualText);
  const malePronoun = /\b(he|him|his)\b/.test(contextualText);
  if (femalePronoun !== malePronoun) {
    return femalePronoun ? "female" : "male";
  }

  // Keep unknown fantasy names stable across inference improvements. This is
  // intentionally the same complete identity seed used by the legacy caster.
  const fallbackSeed = [
    input.displayName,
    input.name,
    input.role,
    input.background,
    input.voiceStyle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return stableHarthmereVoiceHash(fallbackSeed) % 2 === 0 ? "female" : "male";
}

function voicePoolForProfile(
  gender: HarthmereVoiceGender,
  actorKind: HarthmereVoiceActorKind
): readonly HarthmereAzureVoiceCandidate[] {
  if (
    actorKind === "robot" ||
    actorKind === "creature" ||
    actorKind === "animal"
  ) {
    return NEUTRAL_AZURE_VOICES;
  }
  if (gender === "female") {
    return FEMALE_AZURE_VOICES;
  }
  if (gender === "male") {
    return MALE_AZURE_VOICES;
  }
  return NEUTRAL_AZURE_VOICES;
}

function desiredStylesForActor(
  input: HarthmereVoiceActorInput,
  actorKind: HarthmereVoiceActorKind
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

function styleForActor(input: {
  candidate: HarthmereAzureVoiceCandidate;
  actor: HarthmereVoiceActorInput;
  actorKind: HarthmereVoiceActorKind;
}) {
  const styles = input.candidate.styles ?? [];
  if (styles.length === 0) {
    return undefined;
  }
  const desiredStyles = desiredStylesForActor(input.actor, input.actorKind);
  return desiredStyles.find((style) => styles.includes(style)) ?? styles[0];
}

function styleDegreeForActor(
  hash: number,
  actorKind: HarthmereVoiceActorKind,
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

function prosodyForActor(hash: number, actorKind: HarthmereVoiceActorKind) {
  if (actorKind === "robot") {
    return {
      rate: signedPercent(-5 + (hash % 9)),
      pitch: signedPercent(-3 + ((hash >>> 5) % 7)),
      sentenceBreakMs: 100 + ((hash >>> 10) % 8) * 15,
    };
  }
  if (actorKind === "creature" || actorKind === "undead") {
    return {
      rate: signedPercent(-14 + (hash % 8)),
      pitch: signedPercent(-8 + ((hash >>> 5) % 6)),
      sentenceBreakMs: 150 + ((hash >>> 10) % 10) * 20,
    };
  }
  if (actorKind === "animal") {
    return {
      rate: signedPercent(-8 + (hash % 10)),
      pitch: signedPercent(-4 + ((hash >>> 5) % 9)),
      sentenceBreakMs: 120 + ((hash >>> 10) % 8) * 18,
    };
  }
  return {
    rate: signedPercent(-5 + (hash % 9)),
    pitch: signedPercent(-3 + ((hash >>> 5) % 7)),
    sentenceBreakMs: 110 + ((hash >>> 10) % 9) * 12,
  };
}

export function buildHarthmereAzureVoiceParameterId(input: {
  voiceName: string;
  gender?: HarthmereVoiceGender;
  actorKind?: HarthmereVoiceActorKind;
  deliveryStyle?: string;
  style?: string;
  styleDegree?: string;
  role?: string;
  rate: string;
  pitch: string;
  volume?: string;
  sentenceBreakMs?: number;
  actorKey?: string;
}) {
  // Keep the original descriptor format so ECS data remains backward
  // compatible while adding metadata consumed by other TTS providers.
  const parts = [
    ["voice", input.voiceName],
    ["gender", input.gender],
    ["kind", input.actorKind],
    ["delivery", input.deliveryStyle],
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
  return `azure-speech|${parts
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("|")}`;
}

export function parseHarthmereAzureVoiceId(
  voiceId: string | undefined
): ParsedHarthmereAzureVoice | undefined {
  const trimmed = voiceId?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (
    /^[a-z]{2}-[A-Z]{2}-.+((Neural)|(MultilingualNeural)|(MAI-Voice-\d+))$/i.test(
      trimmed
    )
  ) {
    // Raw Azure short names are still accepted for old/admin-authored entities.
    const gender = azureVoiceGenderFromName(trimmed);
    return {
      provider: "azure-speech",
      voiceName: trimmed,
      ...(gender ? { gender } : {}),
      rate: "+0%",
      pitch: "+0%",
      volume: "default",
      sentenceBreakMs: 120,
    };
  }
  if (!trimmed.startsWith("azure-speech|")) {
    return undefined;
  }
  const values: Record<string, string> = {};
  for (const part of trimmed.slice("azure-speech|".length).split("|")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    values[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  if (!values.voice) {
    return undefined;
  }
  const gender = isHarthmereVoiceGender(values.gender)
    ? values.gender
    : azureVoiceGenderFromName(values.voice);
  const actorKind = isHarthmereVoiceActorKind(values.kind)
    ? values.kind
    : undefined;
  return {
    // Optional fields are omitted instead of emitted as undefined so existing
    // callers and serialized test fixtures retain their previous shapes.
    provider: "azure-speech",
    voiceName: values.voice,
    ...(gender ? { gender } : {}),
    ...(actorKind ? { actorKind } : {}),
    ...(values.delivery ? { deliveryStyle: values.delivery } : {}),
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

export function harthmereAzureVoiceIdOrFallback(input: {
  voiceId?: string;
  fallbackVoiceId: string;
}) {
  return input.voiceId && parseHarthmereAzureVoiceId(input.voiceId)
    ? input.voiceId
    : input.fallbackVoiceId;
}

export function harthmereVoiceProfileForActor(
  input: HarthmereVoiceActorInput
): HarthmereNpcVoiceProfile {
  const actorKey =
    actorKeyForVoiceInput(input) ||
    `${input.source}:unknown:${displayNameForVoiceInput(input).toLowerCase()}`;
  const hash = stableHarthmereVoiceHash(
    [actorKey, input.role, input.kind, input.background, input.voiceStyle]
      .filter(Boolean)
      .join("|")
  );
  const actorKind = inferActorKind(input);
  const inferredGender = inferGender(input, actorKind);
  const deliveryStyle =
    actorKind === "humanoid" &&
    (displayNameForVoiceInput(input).toLowerCase() === "huck" ||
      /\b(country|southern|country drawl|southern drawl)\b/i.test(
        input.voiceStyle ?? ""
      ))
      ? "country"
      : undefined;
  const voicePool = voicePoolForProfile(inferredGender, actorKind);
  const voiceCandidate = pickStable(voicePool, hash);
  const azureVoiceName = voiceCandidate.voiceName;
  const style = styleForActor({
    candidate: voiceCandidate,
    actor: input,
    actorKind,
  });
  const styleDegree = styleDegreeForActor(hash, actorKind, style);
  const prosody = prosodyForActor(hash, actorKind);
  const displayName = displayNameForVoiceInput(input);
  const voiceParameterId = buildHarthmereAzureVoiceParameterId({
    // Embed the inferred cast metadata once at profile creation. Both Azure
    // and ElevenLabs then stay stable for the same NPC identity.
    voiceName: azureVoiceName,
    gender: inferredGender,
    actorKind,
    deliveryStyle,
    style,
    styleDegree,
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: "default",
    sentenceBreakMs: prosody.sentenceBreakMs,
    actorKey,
  });

  return {
    version: HARTHMERE_NPC_VOICE_PROFILES_VERSION,
    actorKey,
    displayName,
    inferredGender,
    actorKind,
    deliveryStyle,
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
      `${inferredGender} presentation when authored sex is not explicit.` +
      (deliveryStyle ? ` Delivery is ${deliveryStyle}.` : ""),
  };
}

export function stripHarthmereSpeechMarkup(text: string | undefined) {
  return normalizeVoiceText(text)
    .replace(/\{break\}/gi, ". ")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/[\u201c\u201d]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeSsml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampPercent(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percentNumber(value: string | undefined) {
  const parsed = Number(String(value ?? "0").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function withSignedPercentDelta(input: {
  value: string;
  delta: number;
  min: number;
  max: number;
}) {
  return signedPercent(
    clampPercent(
      Math.round(percentNumber(input.value) + input.delta),
      input.min,
      input.max
    )
  );
}

function styleDegreeWithDelta(
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

function lineDeliveryDeltas(text: string) {
  const clean = stripHarthmereSpeechMarkup(text).toLowerCase();
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

function ssmlTextWithSentenceBreaks(input: {
  text: string;
  sentenceBreakMs: number;
  phraseBreakRatio: number;
  commaBreakRatio: number;
  ellipsisBreakRatio: number;
}) {
  const clean = stripHarthmereSpeechMarkup(input.text);
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
  const sentenceToken = "%%HARTHMERE_SENTENCE_BREAK%%";
  const phraseToken = "%%HARTHMERE_PHRASE_BREAK%%";
  const commaToken = "%%HARTHMERE_COMMA_BREAK%%";
  const ellipsisToken = "%%HARTHMERE_ELLIPSIS_BREAK%%";
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
      return escapeSsml(part);
    })
    .join("");
}

export function buildAzureSpeechSsml(input: {
  text: string;
  voice: ParsedHarthmereAzureVoice;
  language?: string;
}) {
  const locale = input.language?.trim() || "en-US";
  const delivery = harthmereSpeechDeliveryForActor({
    actorKey: input.voice.actorKey,
    text: input.text,
  });
  const lineDeltas = lineDeliveryDeltas(input.text);
  const sentenceBreakMs = Math.max(
    45,
    input.voice.sentenceBreakMs +
      delivery.sentenceBreakDeltaMs +
      lineDeltas.breakDeltaMs
  );
  const body = ssmlTextWithSentenceBreaks({
    text: input.text,
    sentenceBreakMs,
    phraseBreakRatio: delivery.phraseBreakRatio,
    commaBreakRatio: delivery.commaBreakRatio,
    ellipsisBreakRatio: delivery.ellipsisBreakRatio,
  });
  if (!body) {
    return "";
  }
  const rate = withSignedPercentDelta({
    value: input.voice.rate,
    delta: delivery.rateDelta + lineDeltas.rateDelta,
    min: -16,
    max: 10,
  });
  const pitch = withSignedPercentDelta({
    value: input.voice.pitch,
    delta: delivery.pitchDelta + lineDeltas.pitchDelta,
    min: -10,
    max: 8,
  });
  const volume = delivery.volume ?? input.voice.volume;
  const styleDegree = styleDegreeWithDelta(
    input.voice.styleDegree,
    delivery.styleDegreeDelta
  );
  const prosody = [
    `<prosody rate="${escapeSsml(rate)}" pitch="${escapeSsml(
      pitch
    )}" volume="${escapeSsml(volume)}">`,
    body,
    "</prosody>",
  ].join("");
  const voiceBody = input.voice.style
    ? [
        `<mstts:express-as style="${escapeSsml(input.voice.style)}"${
          styleDegree ? ` styledegree="${escapeSsml(styleDegree)}"` : ""
        }${input.voice.role ? ` role="${escapeSsml(input.voice.role)}"` : ""}>`,
        prosody,
        "</mstts:express-as>",
      ].join("")
    : prosody;
  return [
    `<speak version="1.0" xml:lang="${escapeSsml(
      locale
    )}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts">`,
    `<voice name="${escapeSsml(input.voice.voiceName)}">`,
    voiceBody,
    "</voice>",
    "</speak>",
  ].join("");
}
