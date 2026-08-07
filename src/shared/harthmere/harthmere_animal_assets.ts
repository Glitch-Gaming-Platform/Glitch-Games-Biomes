import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_AAA_ANIMAL_ASSET_VERSION =
  "harthmere-aaa-animal-assets-v1" as const;

export const HARTHMERE_AAA_ANIMAL_ROOT =
  "/assets/harthmere/glb/creatures/animals" as const;

export type HarthmereAnimalAssetSpec = {
  readonly assetUrl?: string;
  readonly galoisFallback: string;
  readonly size: Vec3;
  readonly sizeTier: "small" | "medium" | "large";
  readonly combatHp: number;
  readonly meatUnits: number;
  readonly attackDamage: number;
  readonly killXp: number;
};

const aaa = (
  species: string,
  galoisFallback: string,
  size: Vec3,
  sizeTier: HarthmereAnimalAssetSpec["sizeTier"],
  combatHp: number,
  meatUnits: number,
  attackDamage: number,
  killXp: number
): HarthmereAnimalAssetSpec => ({
  assetUrl: `${HARTHMERE_AAA_ANIMAL_ROOT}/${species}.glb`,
  galoisFallback,
  size,
  sizeTier,
  combatHp,
  meatUnits,
  attackDamage,
  killXp,
});

export const HARTHMERE_ANIMAL_ASSET_SPECS = {
  // Cow, sheep, and rabbit intentionally retain their proven native assets.
  cow: {
    assetUrl: undefined,
    galoisFallback: "npcs/cow",
    size: [1.3, 1.5, 2.0],
    sizeTier: "large",
    combatHp: 270,
    meatUnits: 12,
    attackDamage: 66,
    killXp: 50,
  },
  sheep: {
    assetUrl: undefined,
    galoisFallback: "npcs/sheep",
    size: [0.95, 1.0, 1.35],
    sizeTier: "medium",
    combatHp: 110,
    meatUnits: 4,
    attackDamage: 30,
    killXp: 20,
  },
  rabbit: {
    assetUrl: undefined,
    galoisFallback: "npcs/rabbit",
    size: [0.5, 0.5, 0.7],
    sizeTier: "small",
    combatHp: 22,
    meatUnits: 1,
    attackDamage: 15,
    killXp: 5,
  },
  chicken: aaa(
    "chicken",
    "npcs/chicken",
    [0.62, 0.78, 0.72],
    "small",
    35,
    1,
    12,
    7
  ),
  deer: aaa("deer", "npcs/cow", [0.92, 1.7, 2.05], "large", 125, 5, 28, 24),
  stag: aaa("stag", "npcs/cow", [1.02, 2.0, 2.32], "large", 190, 7, 44, 38),
  squirrel: aaa(
    "squirrel",
    "npcs/mouse",
    [0.42, 0.5, 0.72],
    "small",
    18,
    1,
    6,
    4
  ),
  songbird: aaa(
    "songbird",
    "npcs/bird",
    [0.3, 0.34, 0.4],
    "small",
    12,
    1,
    5,
    3
  ),
  pigeon: aaa("pigeon", "npcs/bird", [0.4, 0.46, 0.52], "small", 18, 1, 7, 4),
  crow: aaa("crow", "npcs/bird", [0.46, 0.56, 0.66], "small", 26, 1, 10, 6),
  duck: aaa("duck", "npcs/duck", [0.58, 0.62, 0.82], "small", 30, 1, 10, 6),
  goose: aaa("goose", "npcs/duck", [0.68, 1.02, 1.02], "medium", 62, 2, 20, 12),
  frog: aaa("frog", "npcs/mouse", [0.58, 0.34, 0.66], "small", 20, 1, 8, 5),
  fox: aaa("fox", "npcs/dog_1", [0.7, 0.84, 1.42], "medium", 80, 3, 24, 18),
  otter: aaa("otter", "npcs/cat", [0.62, 0.62, 1.42], "medium", 70, 3, 20, 15),
  cat: aaa("cat", "npcs/cat", [0.54, 0.72, 1.05], "medium", 48, 2, 16, 10),
  mouse: aaa("mouse", "npcs/mouse", [0.26, 0.24, 0.42], "small", 12, 1, 5, 3),
  rat: aaa("rat", "npcs/mouse", [0.34, 0.3, 0.62], "small", 24, 1, 10, 6),
  boar: aaa("boar", "npcs/cow", [1.04, 0.96, 1.62], "large", 180, 7, 46, 36),
  badger: aaa("badger", "npcs/cow", [0.8, 0.62, 1.34], "medium", 92, 4, 28, 20),
  pig: aaa("pig", "npcs/cow", [0.96, 0.86, 1.42], "large", 125, 6, 28, 24),
  dog: aaa("dog", "npcs/dog_1", [0.8, 0.94, 1.4], "medium", 90, 3, 28, 20),
  hound: aaa("hound", "npcs/dog_1", [0.9, 1.08, 1.58], "large", 140, 5, 38, 30),
  wolf: aaa("wolf", "npcs/dog_1", [0.94, 1.12, 1.7], "large", 155, 5, 42, 34),
  snake: aaa("snake", "npcs/mouse", [0.38, 0.32, 1.62], "small", 42, 1, 18, 12),
  bear: aaa("bear", "npcs/cow", [1.34, 1.52, 2.08], "large", 320, 12, 68, 55),
  horse: aaa("horse", "npcs/cow", [1.22, 2.08, 2.48], "large", 260, 10, 54, 44),
  spider: aaa(
    "spider",
    "npcs/mouse",
    [1.18, 0.52, 1.28],
    "medium",
    95,
    2,
    30,
    22
  ),
  river_lurker: aaa(
    "river_lurker",
    "npcs/cow",
    [1.02, 0.62, 2.22],
    "large",
    230,
    8,
    58,
    45
  ),
} as const satisfies Record<string, HarthmereAnimalAssetSpec>;

export type HarthmereAnimalAssetSpecies =
  keyof typeof HARTHMERE_ANIMAL_ASSET_SPECS;

const SPECIES_ALIASES: Readonly<Record<string, HarthmereAnimalAssetSpecies>> = {
  bunny: "rabbit",
  hare: "rabbit",
  doe: "deer",
  fawn: "deer",
  buck: "stag",
  songbird: "songbird",
  bird: "songbird",
  puppy: "dog",
  canine: "dog",
  foxhound: "hound",
  feline: "cat",
  kitten: "cat",
  boar: "boar",
  hog: "boar",
  piglet: "pig",
  water_snake: "snake",
  serpent: "snake",
  field_mouse: "mouse",
  brown_rat: "rat",
  river_lurker: "river_lurker",
  lurker: "river_lurker",
  bull: "cow",
  calf: "cow",
  ox: "cow",
  ewe: "sheep",
  ram: "sheep",
  lamb: "sheep",
  pony: "horse",
};

export function normalizeHarthmereAnimalAssetSpecies(
  raw: string | undefined
): HarthmereAnimalAssetSpecies | undefined {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (normalized in HARTHMERE_ANIMAL_ASSET_SPECS) {
    return normalized as HarthmereAnimalAssetSpecies;
  }
  return SPECIES_ALIASES[normalized];
}

const LABEL_RULES: ReadonlyArray<
  readonly [RegExp, HarthmereAnimalAssetSpecies]
> = [
  [/river lurker|lurker/, "river_lurker"],
  [/thornback spider|giant spider|web spider|spider/, "spider"],
  [/hedge songbird|songbird/, "songbird"],
  [/red squirrel|squirrel/, "squirrel"],
  [/field mouse|\bmouse\b/, "mouse"],
  [/\brat\b/, "rat"],
  [/river otter|\botter\b/, "otter"],
  [/old badger|\bbadger\b/, "badger"],
  [/rutting stag|\bstag\b|\bbuck\b/, "stag"],
  [/\bdeer\b|\bdoe\b|\bfawn\b/, "deer"],
  [/bell[- ]mad hound|\bhound\b/, "hound"],
  [/\bwolf\b/, "wolf"],
  [/farm dog|\bdog\b/, "dog"],
  [/reed cat|\bcat\b/, "cat"],
  [/black[- ]eyed crow|carrion crow|\bcrow\b/, "crow"],
  [/\bpigeon\b/, "pigeon"],
  [/river duck|\bduck\b/, "duck"],
  [/angry goose|\bgoose\b/, "goose"],
  [/gate chicken|\bchicken\b|\bhen\b|\brooster\b/, "chicken"],
  [/briarfen frog|\bfrog\b/, "frog"],
  [/water snake|\bsnake\b|\bserpent\b/, "snake"],
  [/red fox|\bfox\b/, "fox"],
  [/moss[- ]covered boar|wild boar|\bboar\b/, "boar"],
  [/\bpig\b|\bpiglet\b/, "pig"],
  [/root[- ]bound bear|black bear|\bbear\b/, "bear"],
  [/stable horse|\bhorse\b|\bpony\b/, "horse"],
  [/\bcow\b|\bbovine\b|\bcattle\b|\bbull\b|\bcalf\b/, "cow"],
  [/\bsheep\b|\bewe\b|\bram\b|\blamb\b/, "sheep"],
  [/\brabbit\b|\bbunny\b|\bhare\b/, "rabbit"],
];

export function harthmereAnimalAssetSpeciesForLabel(
  label: string | undefined
): HarthmereAnimalAssetSpecies | undefined {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();
  return LABEL_RULES.find(([pattern]) => pattern.test(normalized))?.[1];
}

export function harthmereAnimalAssetSpec(
  species: string | undefined,
  label?: string
): HarthmereAnimalAssetSpec | undefined {
  const normalized =
    normalizeHarthmereAnimalAssetSpecies(species) ??
    harthmereAnimalAssetSpeciesForLabel(label);
  return normalized ? HARTHMERE_ANIMAL_ASSET_SPECS[normalized] : undefined;
}

export function harthmereAnimalAssetUrl(
  species: string | undefined,
  label?: string
): string | undefined {
  return harthmereAnimalAssetSpec(species, label)?.assetUrl;
}
