import {
  azureSpeechConfigFromEnv,
  listAzureSpeechVoices,
  synthesizeAzureSpeech,
  transcribeAzureSpeech,
} from "@/server/shared/azure_speech";
import assert from "assert";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response
) {
  (globalThis as any).fetch = (
    url: string | URL | Request,
    init?: RequestInit
  ) => handler(String(url), init);
}

describe("Azure Speech helpers", () => {
  afterEach(() => {
    (globalThis as any).fetch = ORIGINAL_FETCH;
  });

  it("treats Azure Speech env vars as optional", () => {
    assert.equal(azureSpeechConfigFromEnv({}), undefined);
    assert.equal(
      azureSpeechConfigFromEnv({
        AZURE_SPEECH_KEY: "key",
      }),
      undefined
    );
    assert.deepEqual(
      azureSpeechConfigFromEnv({
        AZURE_SPEECH_KEY: "key",
        AZURE_SPEECH_REGION: "eastus2",
      }),
      {
        key: "key",
        region: "eastus2",
      }
    );
    assert.deepEqual(
      azureSpeechConfigFromEnv({
        AZURE_AI_SPEECH_KEY: "key",
        AZURE_AI_SPEECH_REGION: "westus",
      }),
      {
        key: "key",
        region: "westus",
      }
    );
  });

  it("does not call Azure when synthesis config, text, or voice is missing", async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return new Response();
    });

    assert.equal(
      await synthesizeAzureSpeech({
        text: "",
        voice: "en-US-AvaNeural",
        config: { key: "key", region: "eastus2" },
      }),
      undefined
    );
    assert.equal(
      await synthesizeAzureSpeech({
        text: "Hello",
        voice: "not-an-azure-voice",
        config: { key: "key", region: "eastus2" },
      }),
      undefined
    );
    assert.equal(called, false);
  });

  it("posts escaped SSML to the Azure text-to-speech endpoint", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    mockFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(Buffer.from("mp3-bytes"), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    });

    const result = await synthesizeAzureSpeech({
      text: 'Hello friend & "traveler".',
      voice: "en-US-AvaNeural",
      language: "en-US",
      config: { key: "speech-key", region: "eastus2" },
    });

    assert.equal(
      capturedUrl,
      "https://eastus2.tts.speech.microsoft.com/cognitiveservices/v1"
    );
    assert.equal(capturedInit?.method, "POST");
    assert.equal(
      (capturedInit?.headers as Record<string, string>)[
        "Ocp-Apim-Subscription-Key"
      ],
      "speech-key"
    );
    assert.match(String(capturedInit?.body), /en-US-AvaNeural/);
    assert.match(
      String(capturedInit?.body),
      /Hello friend &amp; &quot;traveler&quot;\./
    );
    assert.equal(result?.contentType, "audio/mpeg");
    assert.equal(result?.audio.toString(), "mp3-bytes");
  });

  it("posts expressive Azure SSML when the voice id carries a speaking style", async () => {
    let capturedBody = "";
    mockFetch((_url, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(Buffer.from("mp3-bytes"), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    });

    await synthesizeAzureSpeech({
      text: "Keep your voice low. The board has fresh work.",
      voice:
        "azure-speech|voice=en-US-LunaNeural|style=conversation|styleDegree=0.95|rate=-3%25|pitch=%2B1%25|volume=default|break=150|actor=test",
      language: "en-US",
      config: { key: "speech-key", region: "eastus2" },
    });

    assert.match(
      capturedBody,
      /xmlns:mstts="https:\/\/www\.w3\.org\/2001\/mstts"/
    );
    assert.match(capturedBody, /<mstts:express-as style="conversation"/);
    assert.match(capturedBody, /styledegree="0\.95"/);
    assert.match(capturedBody, /<prosody rate="-3%" pitch="\+1%"/);
  });

  it("throws with Azure text when text-to-speech fails", async () => {
    mockFetch(() => new Response("bad voice", { status: 400 }));

    await assert.rejects(
      () =>
        synthesizeAzureSpeech({
          text: "Hello",
          voice: "en-US-AvaNeural",
          config: { key: "key", region: "eastus2" },
        }),
      /Azure Speech synthesis failed: 400 bad voice/
    );
  });

  it("does not call Azure for empty transcription audio", async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return new Response();
    });

    assert.equal(
      await transcribeAzureSpeech({
        audio: Buffer.alloc(0),
        mimeType: "audio/wav",
        config: { key: "key", region: "eastus2" },
      }),
      undefined
    );
    assert.equal(called, false);
  });

  it("rejects non-WAV speech input before calling Azure", async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return new Response();
    });

    await assert.rejects(
      () =>
        transcribeAzureSpeech({
          audio: Buffer.from("not-wav"),
          mimeType: "audio/webm",
          config: { key: "key", region: "eastus2" },
        }),
      /expects WAV audio/
    );
    assert.equal(called, false);
  });

  it("posts WAV audio to Azure speech-to-text with the requested language", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    mockFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return Response.json({
        RecognitionStatus: "Success",
        DisplayText: "  Hello there.  ",
      });
    });

    const text = await transcribeAzureSpeech({
      audio: Buffer.from("wav"),
      mimeType: "audio/wav",
      language: "fr-FR",
      config: { key: "speech-key", region: "eastus2" },
    });

    assert.match(
      capturedUrl,
      /^https:\/\/eastus2\.stt\.speech\.microsoft\.com\/speech\/recognition\/conversation\/cognitiveservices\/v1\?language=fr-FR$/
    );
    assert.equal(capturedInit?.method, "POST");
    assert.equal(
      (capturedInit?.headers as Record<string, string>)[
        "Ocp-Apim-Subscription-Key"
      ],
      "speech-key"
    );
    assert.equal(text, "Hello there.");
  });

  it("returns an empty transcript for recognized non-success statuses", async () => {
    mockFetch(() =>
      Response.json({
        RecognitionStatus: "NoMatch",
        DisplayText: "ignored",
      })
    );

    assert.equal(
      await transcribeAzureSpeech({
        audio: Buffer.from("wav"),
        mimeType: "audio/wav",
        config: { key: "key", region: "eastus2" },
      }),
      ""
    );
  });

  it("throws with Azure text when speech-to-text fails", async () => {
    mockFetch(() => new Response("bad audio", { status: 415 }));

    await assert.rejects(
      () =>
        transcribeAzureSpeech({
          audio: Buffer.from("wav"),
          mimeType: "audio/wav",
          config: { key: "key", region: "eastus2" },
        }),
      /Azure Speech recognition failed: 415 bad audio/
    );
  });

  it("lists Azure voices and surfaces list failures", async () => {
    mockFetch((url, init) => {
      assert.equal(
        url,
        "https://eastus2.tts.speech.microsoft.com/cognitiveservices/voices/list"
      );
      assert.equal(
        (init?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"],
        "speech-key"
      );
      return Response.json([
        {
          Name: "Ava",
          ShortName: "en-US-AvaNeural",
          Gender: "Female",
          Locale: "en-US",
        },
      ]);
    });

    assert.deepEqual(
      await listAzureSpeechVoices({
        config: { key: "speech-key", region: "eastus2" },
      }),
      [
        {
          Name: "Ava",
          ShortName: "en-US-AvaNeural",
          Gender: "Female",
          Locale: "en-US",
        },
      ]
    );

    mockFetch(() => new Response("no quota", { status: 429 }));
    await assert.rejects(
      () =>
        listAzureSpeechVoices({
          config: { key: "speech-key", region: "eastus2" },
        }),
      /Azure Speech voices list failed: 429 no quota/
    );
  });
});
