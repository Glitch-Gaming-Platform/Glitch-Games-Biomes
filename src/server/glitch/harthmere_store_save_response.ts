const HARTHMERE_STORE_SAVE_RESPONSE_FIELDS = [
  "id",
  "version",
  "slot_index",
  "save_type",
  "size_bytes",
  "is_conflicted",
  "created_at",
  "updated_at",
] as const;

export function compactHarthmereStoreSaveResponse(raw: any) {
  const save = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  if (!save || typeof save !== "object") {
    return raw;
  }
  const data: Record<string, unknown> = {};
  for (const key of HARTHMERE_STORE_SAVE_RESPONSE_FIELDS) {
    if (save[key] !== undefined) {
      data[key] = save[key];
    }
  }
  return { ok: true, data };
}
