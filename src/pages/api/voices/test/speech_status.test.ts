import { speechStatusForEnv } from "@/pages/api/voices/speech_status";
import assert from "assert";

describe("voice speech status", () => {
  it("reports Azure/OpenAI and ElevenLabs capabilities independently", () => {
    assert.deepEqual(speechStatusForEnv({}), {
      speechToText: false,
      textToSpeech: false,
      openAITextToSpeech: false,
      elevenLabsTextToSpeech: false,
      generatedChat: false,
    });
    assert.deepEqual(
      speechStatusForEnv({
        AZURE_SPEECH_KEY: "speech-key",
        AZURE_SPEECH_REGION: "eastus2",
      }),
      {
        speechToText: true,
        textToSpeech: true,
        openAITextToSpeech: true,
        elevenLabsTextToSpeech: false,
        generatedChat: false,
      }
    );
    assert.deepEqual(
      speechStatusForEnv({
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
        AZURE_OPENAI_API_KEY: "openai-key",
        AZURE_OPENAI_DEPLOYMENT: "gpt-5.5",
      }),
      {
        speechToText: false,
        textToSpeech: false,
        openAITextToSpeech: false,
        elevenLabsTextToSpeech: false,
        generatedChat: true,
      }
    );
    assert.deepEqual(
      speechStatusForEnv({
        AZURE_SPEECH_KEY: "speech-key",
        AZURE_SPEECH_REGION: "eastus2",
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
        AZURE_OPENAI_API_KEY: "openai-key",
        AZURE_OPENAI_DEPLOYMENT: "gpt-5.5",
      }),
      {
        speechToText: true,
        textToSpeech: true,
        openAITextToSpeech: true,
        elevenLabsTextToSpeech: false,
        generatedChat: true,
      }
    );
    assert.deepEqual(
      speechStatusForEnv({ ELEVENLABS_API_KEY: "elevenlabs-key" }),
      {
        speechToText: false,
        textToSpeech: true,
        openAITextToSpeech: false,
        elevenLabsTextToSpeech: true,
        generatedChat: false,
      }
    );
  });
});
