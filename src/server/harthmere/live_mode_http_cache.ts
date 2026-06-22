export const HARTHMERE_LIVE_MODE_NO_STORE_CACHE_CONTROL =
  "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";

export interface HarthmereLiveModeCacheResponse {
  setHeader(name: string, value: string | string[]): void;
  removeHeader?(name: string): void;
}

export function disableHarthmereLiveModeHttpCaching(
  response: HarthmereLiveModeCacheResponse
) {
  response.setHeader(
    "Cache-Control",
    HARTHMERE_LIVE_MODE_NO_STORE_CACHE_CONTROL
  );
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Vary", ["Cookie", "X-Glitch-Install-Id"]);
  response.removeHeader?.("ETag");
  response.removeHeader?.("Last-Modified");
}
