import { harthmereEffectiveMagicImpactFamily } from "@/shared/harthmere/magic_impact";
import type { HarthmereProjectileVisualDefinition } from "@/shared/harthmere/projectile_visual_manifest";
import {
  HARTHMERE_MAGIC_FAMILY_LIFECYCLE_SOUND_MAP,
  HARTHMERE_PROJECTILE_SOUND_MAP,
} from "@/shared/harthmere/sound_effect_manifest";

export const HARTHMERE_PROJECTILE_EXPLOSION_AUDIO_PROFILE = Object.freeze({
  volumeMultiplier: 1.15,
  refDistance: 7,
  maxDistance: 96,
  rolloffFactor: 0.65,
});

export function resolveHarthmereProjectileLifecycleSounds(input: {
  definition: Pick<HarthmereProjectileVisualDefinition, "id" | "family">;
  damageType?: unknown;
}) {
  const mapped = HARTHMERE_PROJECTILE_SOUND_MAP[input.definition.id];
  if (!mapped) return undefined;

  const effectiveFamily = harthmereEffectiveMagicImpactFamily(
    input.definition.family,
    input.damageType
  );
  const shouldUseFamilyOverride =
    effectiveFamily !== input.definition.family &&
    (input.definition.family === "physical" ||
      input.definition.family === "energy");
  const familyOverride = shouldUseFamilyOverride
    ? HARTHMERE_MAGIC_FAMILY_LIFECYCLE_SOUND_MAP[effectiveFamily]
    : undefined;

  return {
    launch: mapped.launch,
    flight: familyOverride?.flight ?? mapped.flight,
    impact: mapped.impact,
    explosion: familyOverride?.explosion ?? mapped.explosion,
    effectiveFamily,
  };
}
