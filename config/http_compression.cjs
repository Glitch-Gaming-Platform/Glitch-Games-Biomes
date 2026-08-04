// HARTHMERE_ASSET_TRANSPORT_COMPRESSION (2026-08-04 asset loading audit, finding 1)
//
// Next's `compress` option controls the gzip middleware inside `next start`.
// This used to be `compress: !isProd` in next.config.js, which is only safe when
// something upstream compresses instead. Upstream did: the retired GKE
// deployment terminated behind `deploy/k8/nginx.conf`, which sets `gzip on`.
//
// Production now runs `next start` directly (scripts/glitch/run-glitch-web.sh)
// on Azure Container Apps, whose ingress does NOT compress responses, and
// Dockerfile.biomes contains no proxy. So the Node process is the origin and the
// only place compression can happen. With it disabled, the game route shipped
// 11.99 MB of JavaScript instead of 2.86 MB, the service worker 6.88 MB instead
// of 1.93 MB, and the block/flora atlases 2.80 MB instead of 0.19 MB (base64 of
// image data compresses ~15x). That is roughly 24 MB of avoidable transfer on
// every cold load.
//
// Keep this as a function rather than a literal so the reasoning travels with
// the value and so `config/test/http_compression.test.ts` can assert the
// production answer specifically. If a compressing CDN/ingress is ever put in
// front of the origin, this may be revisited -- but it must be revisited HERE,
// with the deployment evidence, not silently flipped in next.config.js.
//
// Verify against a live origin with:
//   curl -sI -H 'Accept-Encoding: gzip' <origin>/_next/static/chunks/<chunk>.js \
//     | grep -i content-encoding

/**
 * Whether the Next.js server should gzip its own responses.
 *
 * @param {{ NODE_ENV?: string, BIOMES_ORIGIN_HAS_COMPRESSING_PROXY?: string }} env
 *   Process environment. `BIOMES_ORIGIN_HAS_COMPRESSING_PROXY=1` is the single
 *   documented escape hatch for a deployment that terminates behind a proxy
 *   which already compresses (an nginx sidecar, Front Door with compression
 *   enabled). It is opt-in and unset everywhere by default, so the safe answer
 *   -- compress at the origin -- is what ships.
 * @returns {boolean}
 */
function shouldCompressHttpResponses(env = {}) {
  return env.BIOMES_ORIGIN_HAS_COMPRESSING_PROXY !== "1";
}

module.exports = { shouldCompressHttpResponses };
