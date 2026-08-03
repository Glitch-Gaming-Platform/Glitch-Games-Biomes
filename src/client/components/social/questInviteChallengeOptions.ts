import {
  questInviteOptionsFromTrackableQuests,
  type HarthmereQuestInviteOption,
} from "@/client/components/biomes_ui/adapters/questInviteAdapter";
import { bibleQuestIdForNativeId } from "@/shared/harthmere/bible/bible_quest_ids";
import { groveQuestIdForNativeId } from "@/shared/harthmere/grove/grove_quest_ids";

function vec3FromUnknown(value: unknown): [number, number, number] | undefined {
  const raw = Array.isArray(value) ? value : undefined;
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const x = Number(raw[0]);
  const y = Number(raw[1]);
  const z = Number(raw[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

function markerWorldPositionFromProgress(
  progress: unknown
): [number, number, number] | undefined {
  const rawProgress = progress as any;
  const navigationAid = rawProgress?.navigationAid;
  const candidates = [
    navigationAid?.target?.position,
    navigationAid?.position,
    navigationAid?.pos,
    navigationAid?.target,
    rawProgress?.payload?.location,
    rawProgress?.payload?.position,
    rawProgress?.location,
    rawProgress?.position,
  ];
  for (const candidate of candidates) {
    const position = vec3FromUnknown(candidate);
    if (position) return position;
  }
  return undefined;
}

export function questInviteOptionsFromChallengeBundles(
  challenges: unknown[]
): HarthmereQuestInviteOption[] {
  return questInviteOptionsFromTrackableQuests(
    challenges.flatMap((challenge: any) => {
      if (String(challenge?.state ?? "") !== "in_progress") return [];
      const biscuit = challenge?.biscuit ?? {};
      const questId =
        groveQuestIdForNativeId(biscuit.id) ??
        bibleQuestIdForNativeId(biscuit.id);
      if (!questId) return [];
      const title =
        biscuit.displayName ?? biscuit.name ?? biscuit.label ?? biscuit.id;
      return [
        {
          questId,
          title: String(title ?? "Quest"),
          area: String(biscuit.questCategory ?? biscuit.group ?? "Quest"),
          objectiveText:
            challenge?.progress?.progressString ??
            challenge?.progress?.description ??
            `Join ${String(title ?? "this quest")} together.`,
          reward: Array.isArray(challenge?.progress?.rewards)
            ? `${challenge.progress.rewards.length} rewards`
            : undefined,
          markerWorldPosition: markerWorldPositionFromProgress(
            challenge?.progress
          ),
        },
      ];
    })
  );
}
