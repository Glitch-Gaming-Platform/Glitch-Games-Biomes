import { zSpeechToTextRequest } from "@/pages/api/voices/speech_to_text";
import { zSpeechStatusResponse } from "@/pages/api/voices/speech_status";
import { zChatVoiceRequest } from "@/pages/api/voices/text_to_speech";
import { zVoicesListResponse } from "@/pages/api/voices/voices_list";
import assert from "assert";

describe("voice API schemas", () => {
  it("requires text and voice for text-to-speech requests", () => {
    assert.equal(
      zChatVoiceRequest.safeParse({
        text: "Hello",
        voice: "azure-speech-v1|voice=en-US-AvaNeural",
        language: "en-US",
      }).success,
      true
    );
    assert.equal(zChatVoiceRequest.safeParse({ text: "Hello" }).success, false);
    assert.equal(
      zChatVoiceRequest.safeParse({
        voice: "azure-speech-v1|voice=en-US-AvaNeural",
      }).success,
      false
    );
  });

  it("requires base64 audio for speech-to-text requests", () => {
    assert.equal(
      zSpeechToTextRequest.safeParse({
        audioBase64: "UklGRg==",
        mimeType: "audio/wav",
        language: "en-US",
      }).success,
      true
    );
    assert.equal(zSpeechToTextRequest.safeParse({}).success, false);
  });

  it("validates voice capability and voices-list response shapes", () => {
    assert.equal(
      zSpeechStatusResponse.safeParse({
        speechToText: true,
        textToSpeech: true,
        generatedChat: true,
      }).success,
      true
    );
    assert.equal(
      zVoicesListResponse.safeParse({
        voices: [{ name: "Ava", voiceId: "en-US-AvaNeural" }],
      }).success,
      true
    );
    assert.equal(
      zVoicesListResponse.safeParse({
        voices: [{ name: "Ava" }],
      }).success,
      false
    );
  });
});
