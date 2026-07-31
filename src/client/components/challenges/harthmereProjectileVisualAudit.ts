import { HARTHMERE_PROJECTILE_VISUALS } from "@/shared/harthmere/projectile_visual_manifest";

export const HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES = [
  {
    label: "Physical shots",
    ids: HARTHMERE_PROJECTILE_VISUALS.slice(0, 6).map(({ id }) => id),
  },
  {
    label: "Arcane and energy",
    ids: HARTHMERE_PROJECTILE_VISUALS.slice(6, 12).map(({ id }) => id),
  },
  {
    label: "Fire, lightning, and holy",
    ids: HARTHMERE_PROJECTILE_VISUALS.slice(12, 18).map(({ id }) => id),
  },
  {
    label: "Judgment, dark, and nature",
    ids: HARTHMERE_PROJECTILE_VISUALS.slice(18, 24).map(({ id }) => id),
  },
  {
    label: "Control, hex, and boss",
    ids: HARTHMERE_PROJECTILE_VISUALS.slice(24).map(({ id }) => id),
  },
] as const;

export function shouldShowHarthmereProjectileVisualAudit(input: {
  hostname: string;
  search: string;
}) {
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(input.hostname);
  const params = new URLSearchParams(input.search);
  return (
    localHost &&
    params.get("harthmere_native_ecs_e2e") === "1" &&
    params.get("harthmere_projectile_visual_audit") === "1"
  );
}
