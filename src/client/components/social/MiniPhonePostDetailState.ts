import type { FeedPostBundle } from "@/shared/types";

export type MiniPhonePostDetailLoadState = "loading" | "missing" | "ready";

export function miniPhonePostDetailLoadState(
  post: FeedPostBundle | null | undefined
): MiniPhonePostDetailLoadState {
  if (post === undefined) {
    return "loading";
  }
  if (post === null) {
    return "missing";
  }
  return "ready";
}
