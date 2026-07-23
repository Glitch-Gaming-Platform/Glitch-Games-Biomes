import {
  parseHarthmereAzureVoiceId,
  stableHarthmereVoiceHash,
  type HarthmereVoiceActorKind,
  type HarthmereVoiceGender,
} from "@/shared/harthmere/npc_voice_profiles";

export const ELEVENLABS_DEFAULT_MODEL_ID = "eleven_v3";
export const ELEVENLABS_DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

// Defaults favor natural delivery and broadly playable browser audio. Operators
// can override both through server environment variables.
const ELEVENLABS_DEFAULT_API_BASE_URL = "https://api.elevenlabs.io";
const ELEVENLABS_VOICE_CACHE_TTL_MS = 30 * 60_000;
const ELEVENLABS_MAX_VOICE_PAGES = 5;
const ELEVENLABS_REQUEST_TIMEOUT_MS = 20_000;

export interface ElevenLabsConfig {
  apiKey: string;
  apiBaseUrl: string;
  modelId: string;
  outputFormat: string;
  voiceIds: string[];
  femaleVoiceIds: string[];
  maleVoiceIds: string[];
  neutralVoiceIds: string[];
}

export interface ElevenLabsVoice {
  voice_id: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
  high_quality_base_model_ids?: string[];
  is_legacy?: boolean;
  recording_quality?: "studio" | "good" | "ok" | "poor" | "bad";
}

export interface ElevenLabsSynthesisResult {
  audio: Buffer;
  contentType: string;
  voiceId: string;
}

// These verified premade IDs remain useful as a last-resort cast when an API
// key is intentionally restricted to TTS and cannot call voice discovery.
// Legacy IDs in the pool are routed by ElevenLabs to their current replacements.
const FALLBACK_ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  {
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    category: "premade",
    labels: { gender: "female" },
  },
  {
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    category: "premade",
    labels: { gender: "female" },
  },
  {
    voice_id: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    category: "premade",
    labels: { gender: "female" },
  },
  {
    voice_id: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    category: "premade",
    labels: { gender: "female" },
  },
  {
    voice_id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    category: "premade",
    labels: { gender: "male" },
  },
  {
    voice_id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    category: "premade",
    labels: { gender: "male" },
  },
  {
    voice_id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    category: "premade",
    labels: { gender: "male" },
  },
  {
    voice_id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    category: "premade",
    labels: { gender: "male" },
  },
  {
    voice_id: "VR6AewLTigWG4xSOukaG",
    name: "Arnold",
    category: "premade",
    labels: { gender: "male" },
  },
  {
    voice_id: "yoZ06aMxZJJ28mfd3POQ",
    name: "Sam",
    category: "premade",
    labels: { gender: "male" },
  },
];

function parseVoiceIds(...values: (string | undefined)[]) {
  // Accept comma- or whitespace-separated deployment values and deduplicate
  // them so secret-store formatting does not change the cast.
  return [
    ...new Set(
      values
        .flatMap((value) => (value ?? "").split(/[\s,]+/))
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}

function normalizedApiBaseUrl(value: string | undefined) {
  return (value?.trim() || ELEVENLABS_DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function elevenLabsConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): ElevenLabsConfig | undefined {
  const apiKey = (
    env.ELEVENLABS_API_KEY ??
    env.ELEVEN_LABS_API_KEY ??
    env.XI_API_KEY ??
    ""
  ).trim();
  if (!apiKey) {
    // ElevenLabs is optional; absence means text-only output for that selected
    // provider rather than a server startup failure.
    return undefined;
  }
  return {
    apiKey,
    apiBaseUrl: normalizedApiBaseUrl(env.ELEVENLABS_API_BASE_URL),
    modelId: env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_DEFAULT_MODEL_ID,
    outputFormat:
      env.ELEVENLABS_OUTPUT_FORMAT?.trim() || ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
    voiceIds: parseVoiceIds(env.ELEVENLABS_VOICE_ID, env.ELEVENLABS_VOICE_IDS),
    femaleVoiceIds: parseVoiceIds(env.ELEVENLABS_FEMALE_VOICE_IDS),
    maleVoiceIds: parseVoiceIds(env.ELEVENLABS_MALE_VOICE_IDS),
    neutralVoiceIds: parseVoiceIds(env.ELEVENLABS_NEUTRAL_VOICE_IDS),
  };
}

async function errorText(response: Response) {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return response.statusText;
  }
}

async function fetchElevenLabs(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit
) {
  // Bound all provider calls so a stalled upstream cannot hold an authenticated
  // API request open indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ELEVENLABS_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface ElevenLabsVoiceListResponse {
  voices?: ElevenLabsVoice[];
  has_more?: boolean;
  next_page_token?: string | null;
}

export async function listElevenLabsVoices(input?: {
  config?: ElevenLabsConfig;
  fetchImpl?: typeof fetch;
}): Promise<ElevenLabsVoice[] | undefined> {
  const config = input?.config ?? elevenLabsConfigFromEnv();
  if (!config) {
    return undefined;
  }
  const fetchImpl = input?.fetchImpl ?? fetch;
  const voices: ElevenLabsVoice[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < ELEVENLABS_MAX_VOICE_PAGES; page += 1) {
    // The current voice API is paginated. Capping pages avoids runaway account
    // scans while still covering up to 500 available voices.
    const url = new URL(`${config.apiBaseUrl}/v2/voices`);
    url.searchParams.set("page_size", "100");
    url.searchParams.set("include_total_count", "false");
    if (nextPageToken) {
      url.searchParams.set("next_page_token", nextPageToken);
    }
    const response = await fetchElevenLabs(fetchImpl, url.toString(), {
      headers: { "xi-api-key": config.apiKey },
    });
    if (!response.ok) {
      throw new Error(
        `ElevenLabs voices list failed: ${response.status} ${await errorText(
          response
        )}`
      );
    }
    const json = (await response.json()) as ElevenLabsVoiceListResponse;
    voices.push(...(json.voices ?? []));
    nextPageToken = json.next_page_token ?? undefined;
    if (!json.has_more || !nextPageToken) {
      break;
    }
  }

  return voices.filter((voice) => voice.voice_id?.trim());
}

let voiceCache:
  | {
      identity: string;
      expiresAt: number;
      promise: Promise<ElevenLabsVoice[]>;
    }
  | undefined;

export function clearElevenLabsVoiceCacheForTest() {
  voiceCache = undefined;
}

async function cachedElevenLabsVoices(
  config: ElevenLabsConfig,
  fetchImpl: typeof fetch
) {
  // Voice metadata changes far less often than dialogue. Cache the in-flight
  // promise as well as the result to collapse simultaneous NPC requests.
  const identity = `${config.apiBaseUrl}|${config.apiKey}`;
  const now = Date.now();
  if (
    voiceCache &&
    voiceCache.identity === identity &&
    voiceCache.expiresAt > now
  ) {
    return voiceCache.promise;
  }
  const promise = listElevenLabsVoices({ config, fetchImpl })
    .then((voices) => voices ?? [])
    .catch(() => {
      // Restricted production keys may allow TTS but deny voices_read. Cache
      // that empty discovery result so every NPC line does not pay for another
      // predictable 401 before using the verified fallback cast.
      return [];
    });
  voiceCache = {
    identity,
    expiresAt: now + ELEVENLABS_VOICE_CACHE_TTL_MS,
    promise,
  };
  return promise;
}

function configuredVoices(config: ElevenLabsConfig) {
  // Explicit deployment pools take precedence over account discovery, which
  // lets production pin a reviewed cast without exposing IDs to the client.
  const byId = new Map<string, ElevenLabsVoice>();
  const add = (voiceId: string, gender?: HarthmereVoiceGender) => {
    byId.set(voiceId, {
      voice_id: voiceId,
      category: "configured",
      ...(gender ? { labels: { gender } } : {}),
    });
  };
  config.voiceIds.forEach((voiceId) => add(voiceId));
  config.femaleVoiceIds.forEach((voiceId) => add(voiceId, "female"));
  config.maleVoiceIds.forEach((voiceId) => add(voiceId, "male"));
  config.neutralVoiceIds.forEach((voiceId) => add(voiceId, "neutral"));
  return [...byId.values()];
}

function normalizedVoiceGender(voice: ElevenLabsVoice) {
  const gender = voice.labels?.gender?.trim().toLowerCase();
  if (gender === "female" || gender === "feminine" || gender === "woman") {
    return "female" as const;
  }
  if (gender === "male" || gender === "masculine" || gender === "man") {
    return "male" as const;
  }
  if (gender === "neutral" || gender === "non-binary") {
    return "neutral" as const;
  }
  return undefined;
}

function voiceQualityScore(voice: ElevenLabsVoice, modelId: string) {
  // Prefer model-compatible professional/studio voices while retaining a wide
  // enough top-quality pool for NPC-to-NPC variation.
  let score = 0;
  if (voice.high_quality_base_model_ids?.includes(modelId)) {
    score += 20;
  }
  if (voice.category === "professional" || voice.category === "high_quality") {
    score += 12;
  } else if (voice.category === "premade") {
    score += 8;
  }
  if (voice.recording_quality === "studio") {
    score += 6;
  } else if (voice.recording_quality === "good") {
    score += 3;
  } else if (voice.recording_quality === "poor") {
    score -= 4;
  } else if (voice.recording_quality === "bad") {
    score -= 8;
  }
  if (voice.is_legacy) {
    score -= 3;
  }
  return score;
}

function sortedNaturalVoices(voices: ElevenLabsVoice[], modelId: string) {
  return [...voices].sort((a, b) => {
    const qualityDifference =
      voiceQualityScore(b, modelId) - voiceQualityScore(a, modelId);
    if (qualityDifference !== 0) {
      return qualityDifference;
    }
    return `${a.name ?? ""}|${a.voice_id}`.localeCompare(
      `${b.name ?? ""}|${b.voice_id}`
    );
  });
}

export function selectElevenLabsVoiceForActor(input: {
  voices: ElevenLabsVoice[];
  voiceProfileId: string;
  modelId?: string;
}) {
  const parsed = parseHarthmereAzureVoiceId(input.voiceProfileId);
  const desiredGender = parsed?.gender;
  const sorted = sortedNaturalVoices(
    input.voices.filter((voice) => voice.voice_id?.trim()),
    input.modelId ?? ELEVENLABS_DEFAULT_MODEL_ID
  );
  if (sorted.length === 0) {
    return undefined;
  }
  const matchingGender = desiredGender
    ? sorted.filter((voice) => normalizedVoiceGender(voice) === desiredGender)
    : [];
  const genderPool = matchingGender.length > 0 ? matchingGender : sorted;
  // Do not let a single premium voice collapse the whole town into one speaker;
  // include voices close to the best quality score, then hash by actor identity.
  const bestScore = voiceQualityScore(
    genderPool[0],
    input.modelId ?? ELEVENLABS_DEFAULT_MODEL_ID
  );
  const pool = genderPool.filter(
    (voice) =>
      voiceQualityScore(voice, input.modelId ?? ELEVENLABS_DEFAULT_MODEL_ID) >=
      bestScore - 8
  );
  const actorSeed = parsed?.actorKey ?? input.voiceProfileId;
  return pool[stableHarthmereVoiceHash(actorSeed) % pool.length];
}

function speedForVoiceRate(rate: string | undefined) {
  // ElevenLabs sounds most human close to its default speed. Preserve only a
  // small amount of the actor's Azure rate variation around a 0.97 baseline;
  // directly mapping percentages made slower NPCs sound conspicuously synthetic.
  const percent = Number(String(rate ?? "0").replace("%", ""));
  if (!Number.isFinite(percent)) {
    return 0.97;
  }
  return (
    Math.round(Math.max(0.94, Math.min(1.01, 0.97 + percent / 500)) * 100) / 100
  );
}

function stabilityForActorKind(kind: HarthmereVoiceActorKind | undefined) {
  // Stay inside ElevenLabs' natural conversational range. The previous 0.42
  // humanoid setting wandered too much between words; 0.55 keeps expression
  // while producing steadier, person-like phrasing.
  if (kind === "robot") {
    return 0.63;
  }
  if (kind === "creature" || kind === "undead") {
    return 0.5;
  }
  if (kind === "animal") {
    return 0.52;
  }
  return 0.55;
}

function decodeCommonSpeechEntities(text: string) {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function addNaturalParagraphBreaks(text: string) {
  // Dialogue normally arrives as one short game line. For unusually long
  // lines, insert a paragraph pause after every two sentences so the model can
  // reset its breath and cadence without changing any spoken words.
  return text
    .split(/\n{2,}/)
    .flatMap((paragraph) => {
      const sentences =
        paragraph
          .match(/[^.!?]+(?:\.{3}|[.!?]+|$)/g)
          ?.map((sentence) => sentence.trim()) ?? [];
      if (sentences.length <= 2) {
        return [paragraph.trim()];
      }
      const groups: string[] = [];
      for (let index = 0; index < sentences.length; index += 2) {
        groups.push(sentences.slice(index, index + 2).join(" "));
      }
      return groups;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function elevenLabsSpokenTextForTest(text: string | undefined) {
  if (!text?.trim()) {
    return "";
  }
  const withStructuralPauses = text
    .replace(/\{break\}/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:text|p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  const clean = decodeCommonSpeechEntities(withStructuralPauses)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/!{2,}/g, "!")
    .replace(/\?{2,}/g, "?")
    .replace(/\.{4,}/g, "...")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  // Written listening/thinking cues should remain visible in the dialog but
  // should not be literally narrated by the NPC voice.
  if (/^\[[^\]]{1,160}\][.!?…]*$/.test(clean)) {
    return "";
  }
  return addNaturalParagraphBreaks(clean);
}

export function elevenLabsNaturalVoiceSettingsForTest(input: {
  actorKind?: HarthmereVoiceActorKind;
  rate?: string;
}) {
  return {
    stability: stabilityForActorKind(input.actorKind),
    similarity_boost: 0.82,
    // Style exaggeration frequently causes artifacts and uneven pacing. The
    // voice and punctuation provide expression without this extra control.
    style: 0,
    use_speaker_boost: true,
    speed: speedForVoiceRate(input.rate),
  };
}

function languageCodeForModel(language: string | undefined, modelId: string) {
  // Multilingual v2 infers language and does not accept language_code. Other
  // configured models receive the base ISO language when available.
  if (!language || modelId === "eleven_multilingual_v2") {
    return undefined;
  }
  const languageCode = language.trim().split(/[-_]/)[0]?.toLowerCase();
  return /^[a-z]{2,3}$/.test(languageCode ?? "") ? languageCode : undefined;
}

function contentTypeForOutputFormat(outputFormat: string) {
  if (outputFormat.startsWith("mp3_")) {
    return "audio/mpeg";
  }
  if (outputFormat.startsWith("opus_")) {
    return "audio/ogg; codecs=opus";
  }
  if (outputFormat.startsWith("wav_")) {
    return "audio/wav";
  }
  if (outputFormat.startsWith("pcm_")) {
    return "audio/L16";
  }
  return "application/octet-stream";
}

export async function synthesizeElevenLabsSpeech(input: {
  text: string;
  voiceProfileId: string;
  language?: string;
  config?: ElevenLabsConfig;
  fetchImpl?: typeof fetch;
}): Promise<ElevenLabsSynthesisResult | undefined> {
  const config = input.config ?? elevenLabsConfigFromEnv();
  const text = elevenLabsSpokenTextForTest(input.text);
  if (!config || !text) {
    return undefined;
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const explicitlyConfigured = configuredVoices(config);
  let availableVoices = explicitlyConfigured;
  if (availableVoices.length === 0) {
    // Account discovery produces the most natural available cast and adapts
    // automatically as operators add or remove approved voices. Restricted
    // keys resolve to a cached empty result and use the fallback below.
    availableVoices = await cachedElevenLabsVoices(config, fetchImpl);
  }
  if (availableVoices.length === 0) {
    availableVoices = FALLBACK_ELEVENLABS_VOICES;
  }
  const voice = selectElevenLabsVoiceForActor({
    voices: availableVoices,
    voiceProfileId: input.voiceProfileId,
    modelId: config.modelId,
  });
  if (!voice) {
    return undefined;
  }

  const parsed = parseHarthmereAzureVoiceId(input.voiceProfileId);
  const languageCode = languageCodeForModel(input.language, config.modelId);
  const url = new URL(
    `${config.apiBaseUrl}/v1/text-to-speech/${encodeURIComponent(
      voice.voice_id
    )}`
  );
  url.searchParams.set("output_format", config.outputFormat);
  const body = {
    text,
    model_id: config.modelId,
    ...(languageCode ? { language_code: languageCode } : {}),
    // Normalize dates, numbers, and abbreviations before synthesis so they are
    // read as a person would say them instead of as raw written tokens.
    apply_text_normalization: "on",
    voice_settings: elevenLabsNaturalVoiceSettingsForTest({
      actorKind: parsed?.actorKind,
      rate: parsed?.rate,
    }),
    seed: stableHarthmereVoiceHash(
      `${parsed?.actorKey ?? input.voiceProfileId}`
    ),
  };
  const response = await fetchElevenLabs(fetchImpl, url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg, audio/*;q=0.9, application/octet-stream;q=0.8",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `ElevenLabs synthesis failed: ${response.status} ${await errorText(
        response
      )}`
    );
  }
  const responseContentType = response.headers.get("content-type");
  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType:
      // ElevenLabs commonly returns application/octet-stream. Derive the
      // browser-playable MIME type from the requested output format in that case.
      !responseContentType || responseContentType.includes("octet-stream")
        ? contentTypeForOutputFormat(config.outputFormat)
        : responseContentType,
    voiceId: voice.voice_id,
  };
}
