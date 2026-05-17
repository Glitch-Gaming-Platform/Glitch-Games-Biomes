import emojiData from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";

export const HARTHMERE_EMOJI_MART_COMPAT_VERSION = "emoji-mart-v5-react18-compat-v1";

export interface HarthmereEmojiSearchResult {
  id?: string;
  name: string;
  native: string;
  shortcodes?: string;
}

let emojiMartInitialized = false;

export function initHarthmereEmojiMart(): void {
  if (emojiMartInitialized) {
    return;
  }
  init({ data: emojiData });
  emojiMartInitialized = true;
}

function emojiRecordById(id: string): any | undefined {
  return (emojiData as any)?.emojis?.[id];
}

export function getHarthmereEmojiNativeById(id: string): string {
  const record = emojiRecordById(id);
  const skin = record?.skins?.[0];
  return skin?.native || record?.native || "";
}

export function getHarthmereEmojiNameById(id: string): string {
  const record = emojiRecordById(id);
  return record?.name || id;
}

export async function searchHarthmereEmoji(
  query: string,
  limit = 5
): Promise<HarthmereEmojiSearchResult[]> {
  initHarthmereEmojiMart();
  const rows = await SearchIndex.search(query);
  return (rows || [])
    .map((row: any) => {
      const native = row?.skins?.[0]?.native || row?.native || "";
      return {
        id: row?.id,
        name: row?.name || row?.id || query,
        native,
        shortcodes: row?.shortcodes,
      } as HarthmereEmojiSearchResult;
    })
    .filter((row: HarthmereEmojiSearchResult) => Boolean(row.native))
    .slice(0, limit);
}
