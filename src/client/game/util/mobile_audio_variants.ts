export const MOBILE_AAC_MIME_TYPE = 'audio/mp4; codecs="mp4a.40.2"';
export const MOBILE_OPUS_MIME_TYPE = 'audio/webm; codecs="opus"';
const CORE_LONG_FORM_MUSIC_BASENAME =
  /^(?:music-1|muck-music-1|cave-music-loop)\.[^.]+$/i;

export interface MobileAudioCapabilityEnvironment {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  canPlayType?: (type: string) => string;
}

function canPlay(env: MobileAudioCapabilityEnvironment, type: string): boolean {
  return Boolean(env.canPlayType?.(type));
}

export function isAppleMobileAudioEnvironment(
  env: MobileAudioCapabilityEnvironment
) {
  const userAgent = env.userAgent ?? "";
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1)
  );
}

export function browserMobileAudioCapabilityEnvironment(): MobileAudioCapabilityEnvironment {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const audio =
    typeof document === "undefined"
      ? undefined
      : document.createElement("audio");
  return {
    userAgent: nav?.userAgent,
    platform: nav?.platform,
    maxTouchPoints: nav?.maxTouchPoints,
    canPlayType: audio ? (type) => audio.canPlayType(type) : undefined,
  };
}

/**
 * Short effects stay Opus on capable Android browsers because Opus is already
 * compact and efficient there. Apple mobile WebKit, or a mobile browser that
 * cannot decode WebM/Opus, uses the AAC-LC compatibility variant instead.
 */
export function shouldPreferMobileAacForBufferedAudio(
  mobileDevice: boolean,
  env: MobileAudioCapabilityEnvironment
) {
  if (!mobileDevice || !canPlay(env, MOBILE_AAC_MIME_TYPE)) {
    return false;
  }
  return (
    isAppleMobileAudioEnvironment(env) || !canPlay(env, MOBILE_OPUS_MIME_TYPE)
  );
}

/**
 * Committed NPC speech is streamed through an HTMLAudioElement. The reviewed
 * AAC-LC catalogue is substantially smaller than its high-bitrate MP3 source,
 * so every compatible mobile browser may request it. Desktop keeps MP3.
 */
export function shouldPreferMobileAacForVoice(
  mobileDevice: boolean,
  env: MobileAudioCapabilityEnvironment
) {
  return mobileDevice && canPlay(env, MOBILE_AAC_MIME_TYPE);
}

/**
 * Runtime audio variants are emitted beside their original public asset. Keep
 * the logical resource key unchanged and only replace the fetched URL, so
 * gameplay ownership, volume routing, and desktop paths are untouched.
 */
export function mobileAacVariantUrl(url: string): string | undefined {
  const parsed = url.match(/^([^?#]+)([?#].*)?$/);
  if (!parsed) {
    return undefined;
  }
  const pathname = parsed[1];
  const suffix = parsed[2] ?? "";
  const eligible = /\/assets\/harthmere\/audio\/sfx\/[^/]+\.webm$/i.test(
    pathname
  );
  if (eligible) {
    return `${pathname.slice(0, -5)}.m4a${suffix}`;
  }
  const coreMatch =
    pathname.match(
      /\/buckets\/biomes-static\/asset_data\/audio\/.*\/([^/]+)\.webm$/i
    ) ??
    pathname.match(
      /\/buckets\/biomes-static\/asset_data\/audio\/([^/]+)\.webm$/i
    );
  if (!coreMatch || CORE_LONG_FORM_MUSIC_BASENAME.test(coreMatch[1])) {
    return undefined;
  }
  return `/assets/harthmere/audio/mobile/core/${coreMatch[1]}.m4a${suffix}`;
}
