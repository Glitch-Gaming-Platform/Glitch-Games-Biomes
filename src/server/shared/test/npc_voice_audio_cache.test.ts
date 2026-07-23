import {
  NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION,
  clearNpcVoiceAudioManifestCacheForTest,
  findCachedNpcVoiceAudio,
  npcVoiceAudioCacheKey,
  npcVoiceRuntimeRelativePath,
  resolveNpcVoiceAudioUrl,
} from "@/server/shared/npc_voice_audio_cache";
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

describe("NPC voice audio cache", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "biomes-voice-cache-"));
    clearNpcVoiceAudioManifestCacheForTest();
  });

  afterEach(() => {
    clearNpcVoiceAudioManifestCacheForTest();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("uses every sound-affecting input in a stable content key", () => {
    const base = {
      provider: "elevenlabs",
      synthesisIdentity: "policy-v1|eleven_v3|mp3_44100_128",
      text: "Hello from Harthmere.",
      voice: "actor:rosalyn",
      language: "en-US",
    };
    assert.equal(npcVoiceAudioCacheKey(base), npcVoiceAudioCacheKey(base));
    assert.notEqual(
      npcVoiceAudioCacheKey(base),
      npcVoiceAudioCacheKey({ ...base, text: "A different line." })
    );
    assert.notEqual(
      npcVoiceAudioCacheKey(base),
      npcVoiceAudioCacheKey({ ...base, voice: "actor:billy" })
    );
    assert.notEqual(
      npcVoiceAudioCacheKey(base),
      npcVoiceAudioCacheKey({ ...base, synthesisIdentity: "policy-v2" })
    );
  });

  it("finds a committed catalog recording through its manifest", () => {
    const cacheKey = "a".repeat(64);
    const relativePath =
      "harthmere/voices/generated/current/rosalyn/line-01.mp3";
    fs.mkdirSync(path.join(root, "public", path.dirname(relativePath)), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, "public", relativePath), "catalog-audio");
    const manifestPath = path.join(
      root,
      "public/harthmere/voices/generated/current/manifest.json"
    );
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION,
        provider: "elevenlabs",
        synthesisIdentity: "policy-v1",
        generatedAt: new Date(0).toISOString(),
        recordings: [{ cacheKey, path: relativePath }],
      })
    );

    assert.equal(
      findCachedNpcVoiceAudio({ cacheKey, provider: "elevenlabs", root }),
      `/${relativePath}`
    );
  });

  it("collapses concurrent synthesis and returns saved runtime MP3 bytes directly", async () => {
    const cacheKey = "b".repeat(64);
    let generationCount = 0;
    const request = () =>
      resolveNpcVoiceAudioUrl({
        cacheKey,
        provider: "elevenlabs",
        root,
        generate: async () => {
          generationCount += 1;
          await new Promise((resolve) => {
            setTimeout(resolve, 5);
          });
          return {
            audio: Buffer.from([1, 2, 3, 4]),
            contentType: "audio/mpeg",
          };
        },
      });

    const [first, second] = await Promise.all([request(), request()]);
    assert.equal(generationCount, 1);
    assert.equal(first, second);
    assert.ok(
      first.startsWith("data:audio/mpeg;base64,"),
      "runtime audio must not depend on a follow-up public-file request"
    );
    const relativePath = npcVoiceRuntimeRelativePath({
      cacheKey,
      provider: "elevenlabs",
    });
    assert.deepEqual(
      fs.readFileSync(path.join(root, "public", relativePath)),
      Buffer.from([1, 2, 3, 4])
    );
    assert.deepEqual(
      Buffer.from(first.split(",")[1], "base64"),
      Buffer.from([1, 2, 3, 4])
    );

    const cached = await request();
    assert.equal(cached, first);
    assert.equal(generationCount, 1);
  });

  it("accepts alternate English cache keys for one committed recording", () => {
    const primaryKey = "c".repeat(64);
    const alternateKey = "d".repeat(64);
    const relativePath =
      "harthmere/voices/generated/current/jackie/road-ahead.mp3";
    fs.mkdirSync(path.join(root, "public", path.dirname(relativePath)), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, "public", relativePath), "quest-audio");
    const manifestPath = path.join(
      root,
      "public/harthmere/voices/generated/current/manifest.json"
    );
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION,
        provider: "elevenlabs",
        synthesisIdentity: "policy-v1",
        generatedAt: new Date(0).toISOString(),
        recordings: [
          {
            cacheKey: primaryKey,
            cacheKeys: [alternateKey],
            path: relativePath,
          },
        ],
      })
    );

    assert.equal(
      findCachedNpcVoiceAudio({
        cacheKey: alternateKey,
        provider: "elevenlabs",
        root,
      }),
      `/${relativePath}`
    );
  });
});
