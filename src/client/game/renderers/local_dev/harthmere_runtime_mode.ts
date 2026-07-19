export function shouldRenderHarthmereRuntimeAssets() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  try {
    return window.localStorage.getItem("biomes.harthmereAssets") === "1";
  } catch {
    return false;
  }
}
