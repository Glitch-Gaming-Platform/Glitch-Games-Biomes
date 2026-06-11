import {
  buildAzureSpeechSsmlV1,
  parseHarthmereAzureVoiceIdV1,
} from "@/shared/harthmere/npc_voice_profiles_v1";

export interface AzureSpeechConfigV1 {
  key: string;
  region: string;
}

export interface AzureSpeechSynthesisResultV1 {
  audio: Buffer;
  contentType: string;
}

export interface AzureSpeechVoiceListEntryV1 {
  Name?: string;
  ShortName?: string;
  Gender?: string;
  Locale?: string;
}

export function azureSpeechConfigFromEnvV1(
  env: Record<string, string | undefined> = process.env
): AzureSpeechConfigV1 | undefined {
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

function azureSpeechTtsEndpointV1(config: AzureSpeechConfigV1) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

function azureSpeechVoicesEndpointV1(config: AzureSpeechConfigV1) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

function azureSpeechSttEndpointV1(
  config: AzureSpeechConfigV1,
  language: string
) {
  const url = new URL(
    `https://${config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
  );
  url.searchParams.set("language", language);
  return url.toString();
}

async function errorTextV1(response: Response) {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return response.statusText;
  }
}

export async function listAzureSpeechVoicesV1(input?: {
  config?: AzureSpeechConfigV1;
}): Promise<AzureSpeechVoiceListEntryV1[] | undefined> {
  const config = input?.config ?? azureSpeechConfigFromEnvV1();
  if (!config) {
    return undefined;
  }
  const response = await fetch(azureSpeechVoicesEndpointV1(config), {
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Azure Speech voices list failed: ${response.status} ${await errorTextV1(
        response
      )}`
    );
  }
  return (await response.json()) as AzureSpeechVoiceListEntryV1[];
}

export async function synthesizeAzureSpeechV1(input: {
  text: string;
  voice: string;
  language?: string;
  config?: AzureSpeechConfigV1;
}): Promise<AzureSpeechSynthesisResultV1 | undefined> {
  const config = input.config ?? azureSpeechConfigFromEnvV1();
  const parsedVoice = parseHarthmereAzureVoiceIdV1(input.voice);
  if (!config || !parsedVoice || !input.text.trim()) {
    return undefined;
  }
  const ssml = buildAzureSpeechSsmlV1({
    text: input.text,
    voice: parsedVoice,
    language: input.language,
  });
  if (!ssml.trim()) {
    return undefined;
  }
  const response = await fetch(azureSpeechTtsEndpointV1(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/ssml+xml",
      "Ocp-Apim-Subscription-Key": config.key,
      "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
      "User-Agent": "biomes-harthmere-azure-speech-v1",
    },
    body: ssml,
  });
  if (!response.ok) {
    throw new Error(
      `Azure Speech synthesis failed: ${response.status} ${await errorTextV1(
        response
      )}`
    );
  }
  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

export async function transcribeAzureSpeechV1(input: {
  audio: Buffer;
  mimeType?: string;
  language?: string;
  config?: AzureSpeechConfigV1;
}): Promise<string | undefined> {
  const config = input.config ?? azureSpeechConfigFromEnvV1();
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
    azureSpeechSttEndpointV1(config, input.language ?? "en-US"),
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
      `Azure Speech recognition failed: ${response.status} ${await errorTextV1(
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
