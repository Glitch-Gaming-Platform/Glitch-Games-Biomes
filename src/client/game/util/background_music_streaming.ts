// HARTHMERE_BACKGROUND_MUSIC_STREAMING (2026-08-04 asset loading audit, finding 4)
//
// WHY MUSIC IS NOT AN AudioBuffer ANY MORE (on desktop)
//
// `THREE.AudioLoader` fetches, then `decodeAudioData`s, then keeps the whole
// track resident as Float32 PCM. That is the right shape for a 40 KB footstep
// and the wrong shape for an 8-minute loop:
//
//   muck-music-1.webm   7.96 MB compressed  ~=  196 MB decoded (48 kHz stereo f32)
//   music-1.webm        7.81 MB             ~=  190 MB
//   cave-music-loop     6.10 MB             ~=  150 MB
//   *.mp3 loops         4.13 MB             ~=   91 MB each
//
// Desktop preloaded TEN background tracks at boot and started them all playing
// at gain 0, so that decoded audio was resident for the whole session. Streaming
// through an HTMLAudioElement keeps a small rolling buffer instead: the decoded
// footprint of a streamed track is a few hundred KB regardless of length.
//
// WHY IT STILL GOES THROUGH WebAudio
//
// The element is wired into the existing graph with
// `THREE.Audio.setMediaElementSource`, NOT played standalone. That keeps every
// behaviour the music system already had:
//
//   * per-track gain ramps -> the crossfade in `setBackgroundMusicTrack`;
//   * `listener.gain` ducking during NPC voice lines;
//   * mute;
//   * `createRecordingStream`, which mirrors `listener.gain` into a MediaStream
//     for cutscene capture -- music played outside the graph would silently
//     vanish from every recorded cutscene.
//
// WHY MOBILE STREAMS TOO
//
// A physical iPhone 12 mini proved that even one decoded Grove track costs
// roughly 190 MB and leaves WebContent too close to its 1.5 GiB jetsam limit
// during ordinary movement. Releasing the decoded track recovered about
// 220 MB of physical footprint in the live process. Modern iOS exposes the
// same MediaElementAudioSourceNode path used on desktop, so phones stream when
// that API is present and retain the decoded fallback only for runtimes that
// cannot create the media source or reject playback.

/** The slice of HTMLAudioElement this module and its tests rely on. */
export interface BackgroundMusicMediaElement {
  src: string;
  loop: boolean;
  preload: string;
  crossOrigin: string | null;
  autoplay: boolean;
  volume: number;
  play(): Promise<void> | void;
  pause(): void;
  load?(): void;
  removeAttribute?(name: string): void;
}

export interface BackgroundMusicStreamingEnvironment {
  /** `window.Audio` in the browser; injected in tests. */
  audioElementCtor?: new (src?: string) => BackgroundMusicMediaElement;
  /** `AudioContext.prototype.createMediaElementSource` presence probe. */
  mediaElementSourceSupported?: boolean;
}

/**
 * Whether this runtime can stream music into the WebAudio graph at all.
 * Requires both an <audio> element constructor and MediaElementAudioSourceNode.
 */
export function backgroundMusicStreamingSupported(
  env: BackgroundMusicStreamingEnvironment
): boolean {
  return (
    Boolean(env.audioElementCtor) && env.mediaElementSourceSupported === true
  );
}

/**
 * Policy: stream long-form music on every supported browser. The caller keeps
 * the decoded fallback for older/hostile runtimes.
 */
export function shouldStreamBackgroundMusic(
  _mobileDevice: boolean,
  env: BackgroundMusicStreamingEnvironment
): boolean {
  return backgroundMusicStreamingSupported(env);
}

/**
 * Build a looping, streaming media element for one background track.
 *
 * The element is deliberately created muted-by-gain rather than muted-by-volume:
 * volume stays at 1 so the WebAudio gain node upstream of it remains the single
 * authority on loudness (crossfades, ducking, mute all live there).
 */
export function createStreamingMusicElement(
  url: string,
  env: BackgroundMusicStreamingEnvironment
): BackgroundMusicMediaElement {
  const ctor = env.audioElementCtor;
  if (!ctor) {
    throw new Error(
      "createStreamingMusicElement called without an audio element constructor"
    );
  }
  const element = new ctor();
  element.loop = true;
  // "auto" lets the browser buffer ahead so a crossfade does not stall, while
  // still streaming rather than holding the decoded whole.
  element.preload = "auto";
  element.autoplay = false;
  element.volume = 1;
  // Galois audio normally resolves to the static asset host. A media element
  // connected to WebAudio produces silence for a cross-origin response unless
  // CORS mode is selected before assigning src, even when ordinary <audio>
  // playback of the same URL would work.
  element.crossOrigin = "anonymous";
  element.src = url;
  return element;
}

/**
 * Start playback.
 *
 * Music is started from `resumeAudio()`, which already runs after the gesture
 * that resumed the AudioContext, so this normally succeeds. A rejection must
 * propagate: keeping a media element whose `play()` failed would mark a
 * permanently silent track as loaded and prevent the decoded-buffer fallback.
 */
export async function startStreamingMusicElement(
  element: BackgroundMusicMediaElement
): Promise<void> {
  await element.play();
}

/**
 * Stop a streamed track and let the browser drop its buffered media.
 *
 * Clearing `src` and calling `load()` is the documented way to make a media
 * element release its network resources and decoded buffer; without it a paused
 * element can hold both for the rest of the session, which would reintroduce the
 * memory this change exists to remove.
 */
export function releaseStreamingMusicElement(
  element: BackgroundMusicMediaElement
) {
  try {
    element.pause();
  } catch {
    // Element may already be detached.
  }
  try {
    element.removeAttribute?.("src");
    element.src = "";
    element.load?.();
  } catch {
    // Safari throws if the element is mid-teardown; nothing else to do.
  }
}
