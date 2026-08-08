export function isBossPromoCaptureSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  const promoId = params.get("cutscenePromo");
  return (
    promoId?.startsWith("boss-") === true ||
    params.get("cutscenePromoBatch") === "boss-marketing"
  );
}
