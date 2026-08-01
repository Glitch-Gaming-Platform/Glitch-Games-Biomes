import { HARTHMERE_PROJECTILE_VISUALS } from "@/shared/harthmere/projectile_visual_manifest";

export const HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES = [
  {
    label: "Physical shots",
    ids: [
      "hunter_bow_shot",
      "quick_shot",
      "aimed_shot",
      "multi_shot",
      "bandit_archer_shot",
      "ranged_shot",
    ],
  },
  {
    label: "Thrown, arcane, and light energy",
    ids: [
      "smoke_bomb_throw",
      "spark",
      "photon_sidearm_pulse",
      "pulse_carbine_burst",
      "helix_projector_beam",
      "nova_cannon_bolt",
    ],
  },
  {
    label: "Gravity, fire, lightning, and holy",
    ids: [
      "singularity_lance_beam",
      "fireball",
      "meteor",
      "lightning_bolt",
      "holy_light",
      "smite",
    ],
  },
  {
    label: "Holy, dark, nature, creature, and sonic",
    ids: [
      "judgment",
      "consecrate",
      "life_drain",
      "entangling_roots",
      "indisworm_poison_spit",
      "mocking_verse",
    ],
  },
  {
    label: "Dark, marks, control, and hex",
    ids: [
      "curse_of_weakness",
      "hunters_mark",
      "polymorph",
      "fear",
      "charm",
      "hex_bolt",
    ],
  },
  {
    label: "Boss projectiles",
    ids: [
      "thaedryn_resonance",
    ],
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
