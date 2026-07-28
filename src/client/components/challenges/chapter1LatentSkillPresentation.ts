import type { Ch1LatentSkillId } from "@/shared/harthmere/ch1_latent_skills";

export const CHAPTER1_LATENT_SKILL_USED_EVENT =
  "chapter1-latent-skill-used" as const;

export interface Chapter1LatentSkillUsePresentation {
  skillId: Ch1LatentSkillId;
  usedAtMs: number;
  result: string;
}

export function publishChapter1LatentSkillUse(
  use: Chapter1LatentSkillUsePresentation
) {
  window.dispatchEvent(
    new CustomEvent<Chapter1LatentSkillUsePresentation>(
      CHAPTER1_LATENT_SKILL_USED_EVENT,
      { detail: use }
    )
  );
}
