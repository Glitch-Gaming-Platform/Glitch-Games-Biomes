import {
  MOBILE_AAC_MIME_TYPE,
  MOBILE_OPUS_MIME_TYPE,
  isAppleMobileAudioEnvironment,
  mobileAacVariantUrl,
  shouldPreferMobileAacForBufferedAudio,
  shouldPreferMobileAacForVoice,
  type MobileAudioCapabilityEnvironment,
} from "@/client/game/util/mobile_audio_variants";
import assert from "assert";

function support(...types: string[]): MobileAudioCapabilityEnvironment {
  return {
    canPlayType: (type) => (types.includes(type) ? "probably" : ""),
  };
}

describe("mobile audio variants", () => {
  it("recognizes iPhone and touch-capable iPad desktop user agents", () => {
    assert.equal(
      isAppleMobileAudioEnvironment({ userAgent: "Mozilla/5.0 (iPhone)" }),
      true
    );
    assert.equal(
      isAppleMobileAudioEnvironment({
        userAgent: "Mozilla/5.0 (Macintosh)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
      true
    );
    assert.equal(
      isAppleMobileAudioEnvironment({
        userAgent: "Mozilla/5.0 (Linux; Android 15)",
        platform: "Linux armv8l",
      }),
      false
    );
  });

  it("uses AAC for Apple buffered effects and keeps Opus on capable Android", () => {
    const both = support(MOBILE_AAC_MIME_TYPE, MOBILE_OPUS_MIME_TYPE);
    assert.equal(
      shouldPreferMobileAacForBufferedAudio(true, {
        ...both,
        userAgent: "Mozilla/5.0 (iPhone)",
      }),
      true
    );
    assert.equal(
      shouldPreferMobileAacForBufferedAudio(true, {
        ...both,
        userAgent: "Mozilla/5.0 (Linux; Android 15)",
      }),
      false
    );
    assert.equal(
      shouldPreferMobileAacForBufferedAudio(
        true,
        support(MOBILE_AAC_MIME_TYPE)
      ),
      true
    );
    assert.equal(
      shouldPreferMobileAacForBufferedAudio(false, {
        ...both,
        userAgent: "Mozilla/5.0 (iPhone)",
      }),
      false
    );
  });

  it("requests smaller AAC speech on every compatible mobile browser", () => {
    assert.equal(
      shouldPreferMobileAacForVoice(true, support(MOBILE_AAC_MIME_TYPE)),
      true
    );
    assert.equal(
      shouldPreferMobileAacForVoice(false, support(MOBILE_AAC_MIME_TYPE)),
      false
    );
    assert.equal(shouldPreferMobileAacForVoice(true, support()), false);
  });

  it("maps only committed short-audio families and preserves query strings", () => {
    assert.equal(
      mobileAacVariantUrl("/assets/harthmere/audio/sfx/armor_hit.webm?v=1"),
      "/assets/harthmere/audio/sfx/armor_hit.m4a?v=1"
    );
    assert.equal(
      mobileAacVariantUrl(
        "https://example.test/buckets/biomes-static/asset_data/audio/footstep.a1.webm"
      ),
      "/assets/harthmere/audio/mobile/core/footstep.a1.m4a"
    );
    assert.equal(
      mobileAacVariantUrl("/assets/harthmere/audio/music.webm"),
      undefined
    );
    assert.equal(
      mobileAacVariantUrl(
        "/buckets/biomes-static/asset_data/audio/music-1.862847abfd758428088e428e836de7a8.webm"
      ),
      undefined
    );
    assert.equal(
      mobileAacVariantUrl("/harthmere/voices/generated/current/line.mp3"),
      undefined
    );
  });
});
