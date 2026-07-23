import {
  buildAzureSpeechSsml,
  parseHarthmereAzureVoiceId,
} from "@/shared/harthmere/npc_voice_profiles";

export const AZURE_SPEECH_SYNTHESIS_POLICY_VERSION =
  "azure-speech-mp3-48khz-192kbps-v1";

export interface AzureSpeechConfig {
  key: string;
  region: string;
}

export interface AzureSpeechSynthesisResult {
  audio: Buffer;
  contentType: string;
}

export interface AzureSpeechVoiceListEntry {
  Name?: string;
  ShortName?: string;
  Gender?: string;
  Locale?: string;
}

export function azureSpeechConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): AzureSpeechConfig | undefined {
  const key = (
    env.AZURE_SPEECH_KEY ??
    env.AZURE_AI_SPEECH_KEY ??
    env.AZURE_COGNITIVE_SERVICES_KEY ??
    ""
  ).trim();
  const region = (
    env.AZURE_SPEECH_REGION ??
    env.AZURE_AI_SPEECH_REGION ??
    env.AZURE_COGNITIVE_SERVICES_REGION ??
    ""
  ).trim();
  if (!key || !region) {
    return undefined;
  }
  return { key, region };
}

function azureSpeechTtsEndpoint(config: AzureSpeechConfig) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

function azureSpeechVoicesEndpoint(config: AzureSpeechConfig) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

function azureSpeechSttEndpoint(config: AzureSpeechConfig, language: string) {
  const url = new URL(
    `https://${config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
  );
  url.searchParams.set("language", language);
  return url.toString();
}

async function errorText(response: Response) {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return response.statusText;
  }
}

export async function listAzureSpeechVoices(input?: {
  config?: AzureSpeechConfig;
}): Promise<AzureSpeechVoiceListEntry[] | undefined> {
  const config = input?.config ?? azureSpeechConfigFromEnv();
  if (!config) {
    return undefined;
  }
  const response = await fetch(azureSpeechVoicesEndpoint(config), {
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Azure Speech voices list failed: ${response.status} ${await errorText(
        response
      )}`
    );
  }
  return (await response.json()) as AzureSpeechVoiceListEntry[];
}

export async function synthesizeAzureSpeech(input: {
  text: string;
  voice: string;
  language?: string;
  config?: AzureSpeechConfig;
}): Promise<AzureSpeechSynthesisResult | undefined> {
  const config = input.config ?? azureSpeechConfigFromEnv();
  const parsedVoice = parseHarthmereAzureVoiceId(input.voice);
  if (!config || !parsedVoice || !input.text.trim()) {
    return undefined;
  }
  const ssml = buildAzureSpeechSsml({
    text: input.text,
    voice: parsedVoice,
    language: input.language,
  });
  if (!ssml.trim()) {
    return undefined;
  }
  const response = await fetch(azureSpeechTtsEndpoint(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/ssml+xml",
      "Ocp-Apim-Subscription-Key": config.key,
      "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
      "User-Agent": "biomes-harthmere-azure-speech",
    },
    body: ssml,
  });
  if (!response.ok) {
    throw new Error(
      `Azure Speech synthesis failed: ${response.status} ${await errorText(
        response
      )}`
    );
  }
  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

export async function transcribeAzureSpeech(input: {
  audio: Buffer;
  mimeType?: string;
  language?: string;
  config?: AzureSpeechConfig;
}): Promise<string | undefined> {
  const config = input.config ?? azureSpeechConfigFromEnv();
  if (!config || input.audio.length === 0) {
    return undefined;
  }
  const mimeType = input.mimeType?.toLowerCase() ?? "audio/wav";
  if (!mimeType.includes("wav")) {
    throw new Error(
      `Azure Speech short recognition expects WAV audio, got ${mimeType}`
    );
  }
  const response = await fetch(
    azureSpeechSttEndpoint(config, input.language ?? "en-US"),
    {
      method: "POST",
      headers: {
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Ocp-Apim-Subscription-Key": config.key,
        Accept: "application/json",
      },
      body: input.audio as unknown as BodyInit,
    }
  );
  if (!response.ok) {
    throw new Error(
      `Azure Speech recognition failed: ${response.status} ${await errorText(
        response
      )}`
    );
  }
  const json = (await response.json()) as {
    RecognitionStatus?: string;
    DisplayText?: string;
  };
  if (json.RecognitionStatus && json.RecognitionStatus !== "Success") {
    return "";
  }
  return json.DisplayText?.trim() ?? "";
}
