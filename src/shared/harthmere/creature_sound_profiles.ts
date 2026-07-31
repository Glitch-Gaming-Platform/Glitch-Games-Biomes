// HARTHMERE_CREATURE_SOUND_PROFILES
//
// One lore-aware four-cue audio identity per named creature archetype. Numbered
// spawn copies intentionally share their archetype profile: Rabbit 1 and Rabbit
// 92 are the same species, while a Wild Rabbit, Muckmeadow Rabbit, and
// Rootling each have different files and prompts.

export type HarthmereCreatureSoundPhase = "idle" | "attack" | "hit" | "death";

export type HarthmereCreatureSoundSize =
  | "tiny"
  | "small"
  | "medium"
  | "large"
  | "huge"
  | "colossal";

export type HarthmereCreatureSoundGroup =
  | "boss"
  | "sentinel"
  | "mucker"
  | "hex"
  | "livestock"
  | "bandit"
  | "animal"
  | "undead"
  | "forest_monster"
  | "dungeon_creature";

export interface HarthmereCreatureSoundProfile {
  id: string;
  displayName: string;
  aliases: readonly string[];
  entityIds: readonly number[];
  group: HarthmereCreatureSoundGroup;
  size: HarthmereCreatureSoundSize;
  lore: string;
  signature: string;
  idleIntervalSeconds: readonly [minimum: number, maximum: number];
  attackEvery: readonly [minimum: number, maximum: number];
}

export interface HarthmereCreatureSoundEffectInput {
  id: string;
  label: string;
  category: "creature";
  description: string;
  authority: readonly ["native_ecs", "anima", "client_presentation"];
  trigger: string;
  durationSeconds: number;
  prompt: string;
  loop: false;
  promptInfluence: number;
}

type ProfileSeed = {
  displayName: string;
  group: HarthmereCreatureSoundGroup;
  aliases?: readonly string[];
  entityIds?: readonly number[];
  size?: HarthmereCreatureSoundSize;
  lore?: string;
  signature?: string;
};

const names = (
  group: HarthmereCreatureSoundGroup,
  values: readonly string[]
): ProfileSeed[] => values.map((displayName) => ({ displayName, group }));

const BOSS_SEEDS: readonly ProfileSeed[] = [
  {
    displayName: "Muck-Scarred Helix",
    group: "boss",
    aliases: ["Muck Scarred Helix"],
    entityIds: [8_810_000_000_019_014],
    size: "huge",
    lore: "A low six-limbed breach predator split around a living double helix, with a scar-grown demolition maul, siphon maw, spore organs, and barbed tunneling tail.",
    signature:
      "very deep wet chitin groans, a rotating toxic helix hum, scar tissue strain, and a radial maw rasp",
  },
  {
    displayName: "The Gilded Bull",
    group: "boss",
    aliases: ["Gilded Bull"],
    entityIds: [8_810_000_003_000_006],
    size: "huge",
    lore: "A Sun Court war automaton with breakaway horns, piston legs, an exposed sunburst core, and a segmented counterweight tail.",
    signature:
      "massive bronze piston movement, stressed ceremonial metal, a hot solar-core resonance, and bull-like mechanical bellows",
  },
  {
    displayName: "The Ninth Winter",
    group: "boss",
    aliases: ["Ninth Winter"],
    entityIds: [8_810_000_003_000_012],
    size: "colossal",
    lore: "Ash Hall itself walking: a towering black-ice reliquary lashed in roof beams and carrying nine unfinished mornings.",
    signature:
      "cathedral-scale black ice stress, frozen roof beams, ash snow, and a distant failed-dawn resonance",
  },
  {
    displayName: "The Failed Apprentice",
    group: "boss",
    aliases: ["Failed Apprentice"],
    size: "huge",
    lore: "A ruined Bellward suspended inside the broken bell-frame that killed them, with dragging chains and failed-binding shards.",
    signature:
      "broken bronze bell resonance, dragging chain, spectral breath, and orbiting glassy binding shards",
  },
  {
    displayName: "The First Choir",
    group: "boss",
    aliases: [
      "First Choir",
      "First Choir Crone",
      "First Choir Stonemason",
      "First Choir Apprentice",
    ],
    size: "large",
    lore: "Three corrupted Bellbinders sing around one suspended spectral bell: chapel crone, stone mason, and gray-clad youth.",
    signature:
      "three layered wordless spectral voices, one suspended ghost bell, chapel stone vibration, and unstable harmony",
  },
  {
    displayName: "The Echo-Singer",
    group: "boss",
    aliases: ["Echo Singer", "Echo-Singer"],
    size: "huge",
    lore: "A hovering cracked bell-prism predator assembled from copied masks, mirrored tuning blades, and delayed silhouettes.",
    signature:
      "cracked prism resonance, mirrored metal blades, three delayed mask echoes, and a hollow copied voice texture",
  },
  {
    displayName: "Vyrahel, the Vein-Keeper",
    group: "boss",
    aliases: ["Vyrahel the Vein-Keeper", "Vyrahel"],
    size: "colossal",
    lore: "An ancient vein-keeping dragon whose crystal armor, breath, wings, tail, and subterranean movement guard the world's deep currents.",
    signature:
      "enormous draconic breath, deep crystal-vein resonance, armored scale movement, wing pressure, and subterranean rumble",
  },
  {
    displayName: "Thaedryn the Bellbound",
    group: "boss",
    aliases: ["Thaedryn", "The Bellbound"],
    entityIds: [8_810_000_000_019_120],
    size: "colossal",
    lore: "A roughly two-hundred-foot old-bronze river dragon with vellum cathedral wings, four binding bells, and a river-long tail.",
    signature:
      "ancient bronze dragon breath, river resonance, vast vellum wings, four strained binding bells, and intelligent candle-fire vocal tone",
  },
  {
    displayName: "Hex Wraith",
    group: "boss",
    aliases: ["Hex Wraith Bounty"],
    entityIds: [8_810_000_000_019_543],
    size: "large",
    lore: "A tall hollow songline revenant beneath a torn cowl, with orbiting hex tablets, lantern ribs, and no visible feet.",
    signature:
      "hollow spectral breath, orbiting stone hex tablets, lantern-rib resonance, torn cloth, and grave-violet magic",
  },
  {
    displayName: "Alpha Mucker",
    group: "boss",
    aliases: ["Alpha Mucker Bounty"],
    entityIds: [8_810_000_000_019_509],
    size: "colossal",
    lore: "A fourteen-meter walking tree with grasping branches, root-column legs, seed artillery, stolen road stones, and an exposed Muckheart.",
    signature:
      "colossal charred timber, root columns tearing earth, a wet crimson Muckheart pulse, storm canopy, and stolen masonry",
  },
  {
    displayName: "The Root-Crowned Dead",
    group: "boss",
    aliases: ["Root-Crowned Dead", "Root Crowned Dead"],
    size: "huge",
    lore: "An ancient dead sovereign fused to a corrupted root throne, defending the Deep Old Wood through sap, roots, and hungry rootling spirits.",
    signature:
      "ancient undead breath, a wooden crown splitting under pressure, grave-dry bones, corrupted sap, and throne roots grinding through soil",
  },
];

const SENTINEL_SEEDS = names("sentinel", [
  "West Muck Breach Sentinel",
  "Watchtower Muck Clearing Sentinel",
  "Old Wood Mucker Copse Sentinel",
  "Gravewood Pale Muck Sentinel",
]);

const MUCKER_SEEDS = names("mucker", [
  "West Breach Muckling",
  "Watchtower Muckling",
  "Old Wood Mucker",
  "Road Muckwad",
  "Watchtower Clearing Mucker",
  "Old Wood Copse Mucker",
  "Mossy Muckling",
  "Cobbled Muckling",
  "Gravewood Pale Muckling",
  "Open Wilds Mucker",
  "Wilds Pack Mucker",
  "Road Pack Muckling",
  "Salt-Cured Mucker",
]);

const HEX_SEEDS = names("hex", [
  "West Breach Lesser Hexer",
  "Old Wood Lesser Hexer",
  "Road Lesser Hexer",
  "Watchtower Clearing Hexer",
  "Old Wood Copse Hexer",
  "Gravewood Pale Hexer",
  "Open Wilds Hex",
  "Wilds Pack Hex",
  "Road Pack Hex",
  "Cistern Hexer",
  "Under-Ice Hexer",
]);

const LIVESTOCK_SEEDS = names("livestock", [
  "Muckmeadow Cow",
  "Muckmeadow Sheep",
  "Muckmeadow Rabbit",
  "Muckmeadow Cow Guarded Herd",
  "Muckmeadow Sheep Guarded Herd",
  "Muckmeadow Rabbit Guarded Herd",
  "Open Wilds Muckmeadow Cow",
  "Open Wilds Muckmeadow Sheep",
  "Open Wilds Muckmeadow Rabbit",
  "Far North Wilds Shelf Cow",
  "Far North Wilds Shelf Sheep",
  "Far North Wilds Shelf Rabbit",
  "North Reach Pinefall Cow",
  "North Reach Pinefall Sheep",
  "North Reach Pinefall Rabbit",
  "High Downs Terrace Cow",
  "High Downs Terrace Sheep",
  "High Downs Terrace Rabbit",
  "East Marches Flat Cow",
  "East Marches Flat Sheep",
  "East Marches Flat Rabbit",
  "Old Wood West Clearing Cow",
  "Old Wood West Clearing Sheep",
  "Old Wood West Clearing Rabbit",
  "South Reach Meadow Cow",
  "South Reach Meadow Sheep",
  "South Reach Meadow Rabbit",
  "Harthmere Forest Cow",
  "Harthmere Forest Sheep",
  "Harthmere Forest Rabbit",
  "Harthmere Cow",
  "Harthmere Sheep",
  "Harthmere Rabbit",
  "Road Muckmeadow Cow",
  "Road Muckmeadow Sheep",
  "Road Muckmeadow Rabbit",
]);

const BANDIT_SEEDS = names("bandit", [
  "Road Bandit Scout",
  "Wilds Bandit Ambusher",
  "Bandit Trapper",
  "Connector Road Bandit Scout",
  "Watchtower Ridge Scout",
  "Watchtower Ridge Bruiser",
  "Briarfen Road Thief",
  "Captured Bandit Prisoner",
  "Bandit Road Scout",
  "Bandit Hedge Archer",
  "Bandit Knife Thief",
  "Bandit Snare Setter",
  "Bandit Wagon Raider",
  "Bandit False Beggar",
  "Outlaw Brute",
  "Bandit Quartermaster",
  "Former Guard Captain",
  "Smuggler-Bandit Liaison",
]);

const ANIMAL_SEEDS = names("animal", [
  "Wild Rabbit",
  "Greenmere Deer",
  "Red Squirrel",
  "Hedge Songbird",
  "Briarfen Frog",
  "River Duck",
  "Red Fox",
  "River Otter",
  "Field Mouse",
  "Wild Boar",
  "Black Bear",
  "Water Snake",
  "Old Badger",
  "Rutting Stag",
  "Farm Dog",
  "Angry Goose",
  "Gray Wolf",
  "Dire Wolf",
  "Reed Cat",
  "River Lurker",
  "Giant Spider",
  "Carrion Crow",
  "Rot-Sick Deer",
  "Pale Wolf",
  "Moss-Covered Boar",
  "Black-Eyed Crow",
  "Thornback Spider",
  "Root-Bound Bear",
  "Bell-Mad Hound",
  "Gate Chicken",
  "Pasture Sheep",
  "Pasture Cow",
  "Stable Horse",
  // Legacy combat anchors that are not exact compendium names.
  "Mudden Drain Rat",
  "Road Wolf",
  "Diseased Boar",
  "Forest Wolf",
  "Briarfen Water Snake",
  "Gravewood Pale Wolf",
]);

const UNDEAD_SEEDS = names("undead", [
  "Fresh Risen",
  "Grave-Caked Walker",
  "Bell-Woken Dead",
  "Drowned Corpse",
  "Bone Crawler",
  "Mourning Wraith",
  "Hollow Sexton",
  "Root-Bound Dead",
  "Old Soldier Wight",
  "Bell-Woken Zombie",
]);

const FOREST_MONSTER_SEEDS = names("forest_monster", [
  "Rootling",
  "Thorn Imp",
  "Webbed Matron",
  "Rot-Stag",
  "Witch-Crow",
  "Hollow Treant",
  "Mossback Bear",
]);

const DUNGEON_CREATURE_SEEDS = names("dungeon_creature", [
  "Unfinished Stalker",
]);

function slug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeHarthmereCreatureSoundIdentity(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferredSize(seed: ProfileSeed): HarthmereCreatureSoundSize {
  if (seed.size) return seed.size;
  const text = normalizeHarthmereCreatureSoundIdentity(seed.displayName);
  if (seed.group === "sentinel") return "large";
  if (seed.group === "mucker") {
    if (/muckling|muckwad/.test(text)) return "small";
    return "large";
  }
  if (seed.group === "hex") {
    return /lesser/.test(text) ? "small" : "medium";
  }
  if (seed.group === "bandit") {
    return /brute|bruiser|wagon raider|captain|quartermaster/.test(text)
      ? "large"
      : "medium";
  }
  if (seed.group === "undead") {
    if (/crawler/.test(text)) return "small";
    if (/wraith/.test(text)) return "large";
    return "medium";
  }
  if (seed.group === "forest_monster") {
    if (/rootling|imp|crow/.test(text)) return "small";
    if (/matron|stag|bear/.test(text)) return "large";
    if (/treant/.test(text)) return "huge";
    return "medium";
  }
  if (seed.group === "dungeon_creature") return "large";
  if (/rabbit|mouse|rat|squirrel|songbird|frog|crow|chicken/.test(text)) {
    return "tiny";
  }
  if (/fox|cat|otter|badger|snake|duck|goose|hound|dog/.test(text)) {
    return "small";
  }
  if (/dire wolf|lurker|giant spider|thornback spider/.test(text)) {
    return "large";
  }
  if (/cow|horse|bear|boar|stag/.test(text)) return "large";
  return "medium";
}

function placeTexture(text: string) {
  if (/west breach/.test(text)) return "mineral grit and open breach wind";
  if (/watchtower/.test(text)) return "old timber, tar, and watchtower stone";
  if (/old wood|forest|moss|root/.test(text))
    return "wet roots, old bark, and leaf mold";
  if (/gravewood|pale|grave/.test(text))
    return "grave-dry wood, chalky soil, and cold air";
  if (/road|connector/.test(text)) return "road gravel, dust, and leather";
  if (/cistern|under ice|winter/.test(text))
    return "cold stone, trapped water, and brittle ice";
  if (/river|briarfen|water|drowned/.test(text))
    return "shallow water, reeds, and damp mud";
  if (/far north|pinefall/.test(text)) return "pine needles and cold hill air";
  if (/high downs|terrace/.test(text)) return "dry hill grass and open wind";
  if (/east marches|flat/.test(text)) return "flat grassland and dry soil";
  if (/south reach|meadow|pasture/.test(text))
    return "soft meadow grass and farm earth";
  return "dry ground and restrained natural body movement";
}

function animalSignature(name: string) {
  const text = normalizeHarthmereCreatureSoundIdentity(name);
  const corrupted =
    /rot sick|pale|moss covered|black eyed|thornback|root bound|bell mad|diseased/.test(
      text
    )
      ? " with a subtle corrupted undertone"
      : "";
  if (/rabbit/.test(text))
    return `rabbit squeaks, nose breath, and fast hind-foot movement${corrupted}`;
  if (/deer/.test(text))
    return `deer bleats, nasal alarm breath, and light hoof movement${corrupted}`;
  if (/stag/.test(text))
    return `deep stag bell, forceful nasal breath, and heavy antlered hoof movement${corrupted}`;
  if (/squirrel/.test(text))
    return "tiny squirrel chirrs, tooth chatter, and fast claw movement on bark";
  if (/songbird/.test(text))
    return "small hedge-bird chirps, wing flutter, and a light beak snap";
  if (/frog/.test(text))
    return "wet frog croaks, throat-sac pulses, and small muddy body movement";
  if (/duck/.test(text))
    return "duck quacks, bill clacks, webbed-foot movement, and short wing flaps";
  if (/goose/.test(text))
    return "loud defensive goose honks, bill clacks, hissing breath, and heavy wing beats";
  if (/fox/.test(text))
    return "sharp fox barks, breathy yelps, paw scrapes, and light fur movement";
  if (/otter/.test(text))
    return "river-otter chirps, rough growls, wet fur movement, and quick claws";
  if (/mouse/.test(text))
    return "tiny mouse squeaks, fast breath, and delicate foot scrabble";
  if (/rat/.test(text))
    return "drain-rat squeaks, incisors, wet claw scrabble, and sewer breath";
  if (/boar/.test(text))
    return `boar grunts, tusk snaps, heavy nasal breath, and hoof churn${corrupted}`;
  if (/bear/.test(text))
    return `large bear growls, chesty roars, heavy breath, and massive paw movement${corrupted}`;
  if (/snake/.test(text))
    return `dry snake hisses, scale movement, and a sudden jaw strike${corrupted}`;
  if (/badger/.test(text))
    return "old badger snarls, coarse breath, claw digging, and dense compact body movement";
  if (/dog/.test(text))
    return "farm-dog barks, warning growls, panting breath, and collar movement";
  if (/hound/.test(text))
    return `hound snarls, broken baying, hard panting, and clawed lunges${corrupted}`;
  if (/dire wolf/.test(text))
    return "very large wolf snarls, deep pack howls, heavy breath, and powerful clawed lunges";
  if (/wolf/.test(text))
    return `wolf growls, restrained howls, breath, and clawed paw movement${corrupted}`;
  if (/cat/.test(text))
    return "reed-cat hisses, rough feline growls, short yowls, and quick paw movement";
  if (/lurker/.test(text))
    return "amphibious predator croaks, throat clicks, wet hide movement, and a low ambush growl";
  if (/spider/.test(text))
    return `large spider leg taps, chitin clicks, dry mandible movement, and silk tension${corrupted}`;
  if (/crow/.test(text))
    return `crow caws, beak clicks, wing beats, and rough feather movement${corrupted}`;
  if (/chicken/.test(text))
    return "chicken clucks, alarm squawks, wing flaps, and scratching feet";
  if (/sheep/.test(text))
    return "sheep bleats, wool movement, hoof steps, and breath";
  if (/cow/.test(text))
    return "large cow lows, heavy breath, hoof movement, and hide movement";
  if (/horse/.test(text))
    return "horse neighs, snorts, hoof movement, and tack-free body motion";
  return "distinct natural creature vocalization, breath, and body movement";
}

function inferredSignature(seed: ProfileSeed) {
  if (seed.signature) return seed.signature;
  const text = normalizeHarthmereCreatureSoundIdentity(seed.displayName);
  const place = placeTexture(text);
  if (seed.group === "sentinel") {
    return `old security-robot servos, protected-area warning pulses, restrained electric relays, and ${place}`;
  }
  if (seed.group === "mucker") {
    const body = /muckling/.test(text)
      ? "small wet peat chirps, sticky body folds, and quick rootlike feet"
      : /muckwad/.test(text)
      ? "squat tar-bubble grunts, dense sludge movement, and gravel dragged through muck"
      : "large wet peat groans, tarry breath, rootlike limbs, and heavy sludge movement";
    return `${body}, colored by ${place}`;
  }
  if (seed.group === "hex") {
    const body = /lesser/.test(text)
      ? "small corrupted arcane chirps, brittle crystal clicks, and unstable energy flutter"
      : "hollow corrupted magical calls, crystalline shell stress, dark energy flutter, and casting breath";
    return `${body}, colored by ${place}`;
  }
  if (seed.group === "livestock" || seed.group === "animal") {
    return `${animalSignature(seed.displayName)}, colored by ${place}`;
  }
  if (seed.group === "bandit") {
    const role = /brute|bruiser|wagon raider/.test(text)
      ? "deep wordless exertion, heavy leather and scavenged armor, and a large body"
      : /archer/.test(text)
      ? "controlled breath, a low wordless warning, leather bracers, and light footwork"
      : /captain|quartermaster|liaison|former guard/.test(text)
      ? "commanding wordless exertion, layered armor, disciplined movement, and controlled breath"
      : /prisoner/.test(text)
      ? "weary breath, chain movement, cloth, and defensive wordless reactions"
      : "rough wordless exertion, leather armor, cloth, and quick criminal footwork";
    return `${role}, colored by ${place}`;
  }
  if (seed.group === "undead") {
    if (/wraith/.test(text))
      return "large spectral mourning breath, cloth in still air, distant bell harmonics, and no physical footsteps";
    if (/crawler/.test(text))
      return "small dry bones, rapid clawed crawling, tooth clicks, and grave dust";
    if (/drowned/.test(text))
      return "waterlogged undead breath, trapped water, soaked cloth, and heavy wet body movement";
    if (/wight|soldier/.test(text))
      return "old armored undead breath, dry mail, disciplined dead movement, and a faint burial bell";
    if (/root bound/.test(text))
      return "dry undead breath, roots tightening through bone, bark scrape, and grave soil";
    if (/sexton/.test(text))
      return "hollow chapel breath, old keys, burial cloth, and a cracked handbell resonance";
    return "dry undead breath, bone and cloth movement, grave soil, and a faint bell-woken resonance";
  }
  if (seed.group === "forest_monster") {
    if (/rootling/.test(text))
      return "small living roots, bark chirps, twig claws, and damp soil";
    if (/thorn imp/.test(text))
      return "small thorny cackles without speech, dry briars, leaf snaps, and quick claw movement";
    if (/matron/.test(text))
      return "large spider chitin, many heavy leg taps, wet mandibles, and thick web tension";
    if (/rot stag/.test(text))
      return "large corrupted stag bell, rotten antler creaks, heavy hoof movement, and sick breath";
    if (/witch crow/.test(text))
      return "witch-crow caws, whispered magical texture without words, feather movement, and tiny curse sparks";
    if (/treant/.test(text))
      return "huge hollow trunk groans, branch strain, root movement, and dead leaves";
    if (/bear/.test(text))
      return "large mossback bear growls, bark-crusted hide, heavy paws, and deep forest breath";
  }
  if (seed.group === "dungeon_creature") {
    return "large unfinished humanoid-predator breath, half-formed wood and ice joints, dragging steps, and an incomplete resonant cry";
  }
  return "distinct creature breath, body movement, and a lore-specific vocal texture";
}

function inferredLore(seed: ProfileSeed) {
  if (seed.lore) return seed.lore;
  if (seed.group === "mucker")
    return `${seed.displayName} is a Muck-born territorial creature shaped by its local breach, road, forest, or grave-soil habitat.`;
  if (seed.group === "hex")
    return `${seed.displayName} is a corrupted magical creature whose shell and voice are sustained by unstable Hex energy.`;
  if (seed.group === "livestock")
    return `${seed.displayName} is a living Harthmere animal whose voice reflects its species, body size, and grazing territory.`;
  if (seed.group === "bandit")
    return `${seed.displayName} is a distinct road threat whose breath, armor, and combat exertion reflect their role and build.`;
  if (seed.group === "sentinel")
    return `${seed.displayName} is an old security construct assigned to protect a specific Muck containment area.`;
  if (seed.group === "animal")
    return `${seed.displayName} belongs to the Wilds ecology; its temperament and corruption state determine its reactions.`;
  if (seed.group === "undead")
    return `${seed.displayName} is tied to Harthmere graves, bells, drowned places, disturbed relics, and night behavior.`;
  if (seed.group === "forest_monster")
    return `${seed.displayName} protects or haunts corrupted Old Wood groves, rare resources, storms, and overharvested territory.`;
  return `${seed.displayName} is a hostile Chapter 1 dungeon creature with an authored material and movement identity.`;
}

function idleInterval(size: HarthmereCreatureSoundSize) {
  switch (size) {
    case "tiny":
      return [12, 28] as const;
    case "small":
      return [15, 34] as const;
    case "huge":
      return [28, 52] as const;
    case "colossal":
      return [35, 65] as const;
    case "large":
      return [22, 45] as const;
    default:
      return [18, 40] as const;
  }
}

function profile(seed: ProfileSeed): HarthmereCreatureSoundProfile {
  const size = inferredSize(seed);
  return Object.freeze({
    id: slug(seed.displayName),
    displayName: seed.displayName,
    aliases: [
      seed.displayName,
      seed.displayName.replace(/^the\s+/i, ""),
      ...(seed.aliases ?? []),
    ],
    entityIds: seed.entityIds ?? [],
    group: seed.group,
    size,
    lore: inferredLore(seed),
    signature: inferredSignature(seed),
    idleIntervalSeconds: idleInterval(size),
    attackEvery:
      seed.group === "boss"
        ? ([2, 4] as const)
        : seed.group === "bandit"
        ? ([3, 5] as const)
        : ([3, 6] as const),
  });
}

export const HARTHMERE_CREATURE_SOUND_PROFILES: readonly HarthmereCreatureSoundProfile[] =
  Object.freeze(
    [
      ...BOSS_SEEDS,
      ...SENTINEL_SEEDS,
      ...MUCKER_SEEDS,
      ...HEX_SEEDS,
      ...LIVESTOCK_SEEDS,
      ...BANDIT_SEEDS,
      ...ANIMAL_SEEDS,
      ...UNDEAD_SEEDS,
      ...FOREST_MONSTER_SEEDS,
      ...DUNGEON_CREATURE_SEEDS,
    ].map(profile)
  );

const PROFILE_BY_ENTITY_ID = new Map<number, HarthmereCreatureSoundProfile>();
for (const entry of HARTHMERE_CREATURE_SOUND_PROFILES) {
  for (const entityId of entry.entityIds)
    PROFILE_BY_ENTITY_ID.set(entityId, entry);
}

const PROFILE_ALIASES = HARTHMERE_CREATURE_SOUND_PROFILES.flatMap((entry) =>
  entry.aliases.map((alias) => ({
    alias: normalizeHarthmereCreatureSoundIdentity(alias),
    profile: entry,
  }))
).sort((a, b) => b.alias.length - a.alias.length);

export function harthmereCreatureSoundProfileForIdentity(input: {
  text?: unknown;
  entityId?: number;
}) {
  if (input.entityId !== undefined) {
    const exact = PROFILE_BY_ENTITY_ID.get(Number(input.entityId));
    if (exact) return exact;
  }
  const text = ` ${normalizeHarthmereCreatureSoundIdentity(input.text)} `;
  if (text.trim().length === 0) return undefined;
  return PROFILE_ALIASES.find(({ alias }) => text.includes(` ${alias} `))
    ?.profile;
}

export function harthmereCreatureSoundEffectId(
  profile: Pick<HarthmereCreatureSoundProfile, "id">,
  phase: HarthmereCreatureSoundPhase
) {
  return `creature_${profile.id}_${phase}`;
}

export function harthmereCreatureSoundEffectIdForIdentity(
  input: { text?: unknown; entityId?: number },
  phase: HarthmereCreatureSoundPhase
) {
  const resolved = harthmereCreatureSoundProfileForIdentity(input);
  return resolved ? harthmereCreatureSoundEffectId(resolved, phase) : undefined;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableRange(minimum: number, maximum: number, seed: string) {
  if (maximum <= minimum) return minimum;
  return minimum + (stableHash(seed) % (maximum - minimum + 1));
}

export function harthmereCreatureIdleDelayMs(
  profile: HarthmereCreatureSoundProfile,
  identity: string | number,
  sequence: number
) {
  const seconds = stableRange(
    profile.idleIntervalSeconds[0],
    profile.idleIntervalSeconds[1],
    `${profile.id}:${identity}:idle:${sequence}`
  );
  return seconds * 1000;
}

export function harthmereCreatureAttackCadence(
  profile: HarthmereCreatureSoundProfile,
  identity: string | number
) {
  return stableRange(
    profile.attackEvery[0],
    profile.attackEvery[1],
    `${profile.id}:${identity}:attack-cadence`
  );
}

export function harthmereCreatureShouldPlayAttackSound(
  profile: HarthmereCreatureSoundProfile,
  identity: string | number,
  attackCount: number
) {
  if (attackCount <= 1) return true;
  const cadence = harthmereCreatureAttackCadence(profile, identity);
  return (attackCount - 1) % cadence === 0;
}

export function harthmereCreatureAttackEventKey(
  attackTime: number | undefined,
  secondsSinceEpoch: number
) {
  if (!Number.isFinite(attackTime) || !Number.isFinite(secondsSinceEpoch)) {
    return undefined;
  }
  const ageSeconds = secondsSinceEpoch - Number(attackTime);
  if (ageSeconds < -0.25 || ageSeconds > 2) {
    return undefined;
  }
  return Math.round(Number(attackTime) * 1000);
}

const SIZE_TONE: Readonly<Record<HarthmereCreatureSoundSize, string>> = {
  tiny: "tiny, high, light, very short",
  small: "small-bodied, quick, light, short",
  medium: "medium-bodied, grounded, concise",
  large: "large-bodied, low, weighty, forceful",
  huge: "huge-bodied, very low, heavy, resonant",
  colossal: "colossal, sub-heavy, cathedral-scale, slow and powerful",
};

const PHASE_DURATION: Readonly<
  Record<
    HarthmereCreatureSoundSize,
    Record<HarthmereCreatureSoundPhase, number>
  >
> = {
  tiny: { idle: 0.65, attack: 0.55, hit: 0.5, death: 0.8 },
  small: { idle: 0.8, attack: 0.65, hit: 0.55, death: 0.95 },
  medium: { idle: 1.0, attack: 0.8, hit: 0.65, death: 1.15 },
  large: { idle: 1.2, attack: 0.95, hit: 0.8, death: 1.4 },
  huge: { idle: 1.45, attack: 1.15, hit: 0.95, death: 1.75 },
  colossal: { idle: 1.7, attack: 1.35, hit: 1.1, death: 2.2 },
};

function phaseDescription(
  profile: HarthmereCreatureSoundProfile,
  phase: HarthmereCreatureSoundPhase
) {
  switch (phase) {
    case "idle":
      return `${profile.displayName} makes an occasional non-combat idle sound.`;
    case "attack":
      return `${profile.displayName} makes a battle vocalization on only some attacks.`;
    case "hit":
      return `${profile.displayName} reacts audibly to authoritative damage.`;
    case "death":
      return `${profile.displayName} makes its unique final sound and collapses.`;
  }
}

function phaseTrigger(
  profile: HarthmereCreatureSoundProfile,
  phase: HarthmereCreatureSoundPhase
) {
  switch (phase) {
    case "idle":
      return `While ${profile.displayName} remains outside attack mode, play at deterministic ${profile.idleIntervalSeconds[0]}-${profile.idleIntervalSeconds[1]} second intervals.`;
    case "attack":
      return `On the first attack and then every deterministic ${profile.attackEvery[0]}-${profile.attackEvery[1]} attacks while Anima reports combat.`;
    case "hit":
      return "When authoritative ECS health records a nonlethal hit.";
    case "death":
      return "Once when authoritative ECS health reaches zero.";
  }
}

function phasePrompt(
  profile: HarthmereCreatureSoundProfile,
  phase: HarthmereCreatureSoundPhase
) {
  const common = `${profile.displayName}. ${
    SIZE_TONE[profile.size]
  } ${profile.group.replace(/_/g, " ")}. Lore-derived sound identity: ${
    profile.signature
  }.`;
  switch (phase) {
    case "idle":
      return `${common} One isolated occasional idle vocalization with subtle body movement. Calm or watchful; no ambience, music, attack, or intelligible speech.`;
    case "attack":
      return `${common} One isolated battle vocalization or body-powered threat. No weapon or projectile impact, victim, ambience, music, or intelligible speech.`;
    case "hit":
      return `${common} One isolated brief hit reaction from the creature: pain, recoil, material stress, and breath. No attacker weapon, gore, music, or intelligible speech.`;
    case "death":
      return `${common} One isolated final reaction and body collapse appropriate to its material and mass. Restrained, non-gory, no music or intelligible speech.`;
  }
}

export const HARTHMERE_CREATURE_SOUND_EFFECT_INPUTS: readonly HarthmereCreatureSoundEffectInput[] =
  Object.freeze(
    HARTHMERE_CREATURE_SOUND_PROFILES.flatMap((entry) =>
      (["idle", "attack", "hit", "death"] as const).map((phase) => ({
        id: harthmereCreatureSoundEffectId(entry, phase),
        label: `${entry.displayName} ${
          phase[0].toUpperCase() + phase.slice(1)
        }`,
        category: "creature" as const,
        description: phaseDescription(entry, phase),
        authority: ["native_ecs", "anima", "client_presentation"] as const,
        trigger: phaseTrigger(entry, phase),
        durationSeconds: PHASE_DURATION[entry.size][phase],
        prompt: phasePrompt(entry, phase),
        loop: false as const,
        promptInfluence: 0.78,
      }))
    )
  );
