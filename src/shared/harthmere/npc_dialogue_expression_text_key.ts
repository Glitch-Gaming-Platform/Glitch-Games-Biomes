// Exact authored dialogue lookup without bundling the authored corpus. The
// length suffix makes accidental 32-bit hash collisions substantially easier
// to detect and the authoring contract test rejects every collision outright.

export function normalizeHarthmereDialogueExpressionText(text: string): string {
  let normalized = text.trim();
  if (normalized.startsWith("<text>") && normalized.endsWith("</text>")) {
    normalized = normalized.slice("<text>".length, -"</text>".length).trim();
  }
  return normalized.replace(/\s+/g, " ");
}

export function harthmereDialogueExpressionTextKey(text: string): string {
  const normalized = normalizeHarthmereDialogueExpressionText(text);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0)
    .toString(16)
    .padStart(8, "0")}:${normalized.length.toString(36)}`;
}
