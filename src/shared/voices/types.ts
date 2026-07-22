import { z } from "zod";

// Persisted player-facing TTS choices. "openai" names the existing
// OpenAI/Azure voice stack without invalidating previously stored settings.
export const zNpcVoiceProvider = z.enum(["elevenlabs", "openai"]);
export type NpcVoiceProvider = z.infer<typeof zNpcVoiceProvider>;

export const zChatVoice = z.object({
  text: z.string(),
  voice: z.string(),
  url: z.string(),
});

export type ChatVoice = z.infer<typeof zChatVoice>;

export const zTranslation = z.object({
  original: z.string(),
  translated: z.string(),
  language: z.string(),
});

export type Translation = z.infer<typeof zTranslation>;
