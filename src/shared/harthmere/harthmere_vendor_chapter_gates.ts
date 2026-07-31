export const HARTHMERE_MAGIC_VENDOR_ID = "wyrm_candle_magic_shop" as const;

export const HARTHMERE_MAGIC_VENDOR_UNLOCK_CHAPTER = 2;

// Chapter 1 is the currently released purchase surface. Keep this centralized
// so Chapter 2 can open the magic shop without removing an authority safeguard.
export const HARTHMERE_RELEASED_PURCHASE_CHAPTER = 1;

export function isHarthmereVendorPurchaseAvailable(
  vendorId: string,
  chapter = HARTHMERE_RELEASED_PURCHASE_CHAPTER
) {
  return (
    vendorId !== HARTHMERE_MAGIC_VENDOR_ID ||
    chapter >= HARTHMERE_MAGIC_VENDOR_UNLOCK_CHAPTER
  );
}
