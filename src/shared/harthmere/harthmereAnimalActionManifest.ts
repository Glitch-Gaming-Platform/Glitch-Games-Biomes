export type HarthmereAnimalSpecies =
  | "cat" | "dog" | "wolf" | "fox" | "rabbit" | "deer" | "boar" | "bear"
  | "horse" | "cow" | "sheep" | "goat" | "pig" | "chicken" | "pigeon" | "rat"
  | "stag" | "hound";

export type HarthmereAnimalVariant = string;

export const HARTHMERE_ANIMAL_ACTION_CLIPS = [
  "Idle",
  "Walk",
  "Walking",
  "Run",
  "Running",
  "Flee",
  "Attack",
  "HeavyAttack",
  "Bite",
  "Claw",
  "Kick",
  "Charge",
  "Pounce",
  "Peck",
  "Scratch",
  "TailWhip",
  "ShieldBlock",
  "Block",
  "HitReact",
  "Death",
  "Revive",
  "Sleep",
  "Sit",
  "Stand",
  "Jump",
  "Fall",
  "Falling",
  "Landing",
  "Dodging",
  "SidestepLeft",
  "SidestepRight",
  "Sidestep",
  "TurnLeft",
  "TurnRight",
  "Graze",
  "Eat",
  "Drink",
  "Sniff",
  "LookAround",
  "Roar",
  "Howl",
  "Growl",
  "Bark",
  "Meow",
  "Bleat",
  "Moo",
  "Neigh",
  "Chirp",
  "Spawn",
  "Despawn",
  "Stunned",
  "Swim",
  "Trot",
  "Canter"
] as const;

export const HARTHMERE_ANIMAL_ACTION_MANIFEST_PATH =
  "/assets/harthmere/gltf/creatures/animal_action_variants/harthmere_animal_action_manifest.json";

export const HARTHMERE_ANIMAL_VARIANT_ROOT =
  "/assets/harthmere/gltf/creatures/animal_action_variants";

export function getHarthmereAnimalVariantPath(
  species: HarthmereAnimalSpecies,
  variant: HarthmereAnimalVariant = "default"
): string {
  const safeSpecies = String(species || "dog").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const safeVariant = String(variant || "default").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `${HARTHMERE_ANIMAL_VARIANT_ROOT}/harthmere_animal_${safeSpecies}_${safeVariant}.gltf`;
}

export function normalizeHarthmereAnimalActionName(action: string): string {
  const key = String(action || "Idle").toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    idle: "Idle", walk: "Walk", walking: "Walk", run: "Run", running: "Run", flee: "Flee",
    attack: "Attack", bite: "Bite", claw: "Claw", heavyattack: "HeavyAttack", charge: "Charge",
    pounce: "Pounce", hit: "HitReact", hitreact: "HitReact", death: "Death", die: "Death",
    revive: "Revive", dodge: "Dodging", dodging: "Dodging", sidestep: "Sidestep",
    jump: "Jump", fall: "Fall", falling: "Fall", eat: "Eat", graze: "Graze", drink: "Drink",
    sleep: "Sleep", sit: "Sit",
  };
  return aliases[key] ?? "Idle";
}
