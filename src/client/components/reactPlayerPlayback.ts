// React Player 3.4.0 controls provider custom elements imperatively. Twitch's
// custom element does not create its iframe until after its first load turn,
// so `playing=true` on mount can call play() while the iframe field is still
// undefined. Only allow autoplay after that exact source emitted metadata.
export function reactPlayerPlaybackReady(
  requestedSource: string | undefined,
  readySource: string | undefined,
  blocked = false
): boolean {
  return !blocked && !!requestedSource && requestedSource === readySource;
}
