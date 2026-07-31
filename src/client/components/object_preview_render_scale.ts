export function objectPreviewRenderScale({
  renderScale,
  devicePixelRatio,
  lowMemory,
}: {
  renderScale?: number;
  devicePixelRatio: number;
  lowMemory: boolean;
}) {
  if (renderScale !== undefined) {
    return renderScale;
  }
  return lowMemory ? Math.min(1, devicePixelRatio) : devicePixelRatio;
}
