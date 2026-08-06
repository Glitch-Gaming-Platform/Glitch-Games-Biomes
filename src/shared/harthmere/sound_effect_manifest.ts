import {
  HARTHMERE_CREATURE_SOUND_EFFECT_INPUTS,
  harthmereCreatureSoundEffectIdForIdentity,
  type HarthmereCreatureSoundPhase,
} from "@/shared/harthmere/creature_sound_profiles";

export const HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION =
  "harthmere-sound-effects-elevenlabs-v10-projectile-lifecycles" as const;

export const HARTHMERE_SOUND_EFFECT_EVENT =
  "biomes:harthmere-sound-effect" as const;

export const HARTHMERE_UNDERWATER_AMBIENCE_SOUND_ID =
  "underwater_ambience" as const;
export const HARTHMERE_CAMPFIRE_AMBIENCE_SOUND_ID =
  "campfire_ambience" as const;
export const HARTHMERE_CH1_PORTAL_AMBIENCE_SOUND_ID =
  "ch1_portal_ambience" as const;
export const HARTHMERE_GIANT_BOSS_STOMP_SOUND_ID = "giant_boss_stomp" as const;

export const HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS = 22;
export const HARTHMERE_CH1_PORTAL_AMBIENCE_RADIUS_METERS = 28;

export type HarthmereSoundAuthority =
  "client_presentation" | "native_ecs" | "anima" | "gaia" | "server_receipt";

export type HarthmereSoundCategory =
  | "existing"
  | "combat"
  | "ranged"
  | "magic"
  | "farming"
  | "fishing"
  | "world"
  | "cooking"
  | "creature"
  | "movement";

export interface HarthmereSoundEffectDefinition {
  id: string;
  label: string;
  category: HarthmereSoundCategory;
  description: string;
  authority: readonly HarthmereSoundAuthority[];
  trigger: string;
  path: string;
  mobilePath?: string;
  source: "existing" | "elevenlabs";
  durationSeconds: number;
  loop: boolean;
  prompt?: string;
  promptInfluence?: number;
}

const GENERATED_ROOT = "/assets/harthmere/audio/sfx";

export function harthmereGeneratedSoundPath(id: string) {
  return `${GENERATED_ROOT}/${id}.webm`;
}

export function harthmereGeneratedMobileSoundPath(id: string) {
  return `${GENERATED_ROOT}/${id}.m4a`;
}

function existing(
  id: string,
  label: string,
  description: string,
  path: string,
  durationSeconds: number,
  trigger: string,
  loop = false
): HarthmereSoundEffectDefinition {
  return {
    id,
    label,
    category: "existing",
    description,
    authority: ["client_presentation"],
    trigger,
    path,
    source: "existing",
    durationSeconds,
    loop,
  };
}

function generated(input: {
  id: string;
  label: string;
  category: Exclude<HarthmereSoundCategory, "existing">;
  description: string;
  authority: readonly HarthmereSoundAuthority[];
  trigger: string;
  durationSeconds: number;
  prompt: string;
  loop?: boolean;
  promptInfluence?: number;
}): HarthmereSoundEffectDefinition {
  return {
    ...input,
    path: harthmereGeneratedSoundPath(input.id),
    mobilePath: harthmereGeneratedMobileSoundPath(input.id),
    source: "elevenlabs",
    loop: input.loop ?? false,
    promptInfluence: input.promptInfluence ?? 0.72,
  };
}

const EXISTING_SOUNDS: readonly HarthmereSoundEffectDefinition[] = [
  existing(
    "melee_swing",
    "Melee Swing",
    "Existing generic light and heavy melee weapon swing family.",
    "audio/swing-1",
    0.53,
    "Client attack animation start."
  ),
  existing(
    "terrain_break",
    "Terrain Break",
    "Existing terrain destruction sound family.",
    "audio/block-break-1",
    0.63,
    "Confirmed terrain destruction."
  ),
  existing(
    "terrain_hit_stone",
    "Stone Hit",
    "Existing stone contact family.",
    "audio/block-hit-stone-1",
    0.2,
    "Destroy animation contact frame."
  ),
  existing(
    "terrain_hit_wood",
    "Wood Hit",
    "Existing wood contact family.",
    "audio/block-hit-wood-1",
    0.1,
    "Destroy animation contact frame."
  ),
  existing(
    "terrain_hit_dirt",
    "Dirt Hit",
    "Existing dirt contact family.",
    "audio/block-hit-dirt-1",
    0.26,
    "Destroy animation contact frame."
  ),
  existing(
    "plant_hit",
    "Plant Hit",
    "Existing vegetation impact and break family.",
    "audio/plant-hit-1",
    0.71,
    "Confirmed flora destruction."
  ),
  existing(
    "place_block",
    "Place Block",
    "Existing block placement sound family.",
    "audio/place-block-1",
    0.3,
    "Successful voxel placement."
  ),
  existing(
    "fishing_cast",
    "Fishing Cast",
    "Existing rod cast and line release.",
    "audio/fish-cast",
    1.54,
    "Fishing cast release."
  ),
  existing(
    "fishing_lure_water",
    "Fishing Lure Water Entry",
    "Existing lure landing in water.",
    "audio/fish-cast-land-water",
    0.92,
    "Fishing lure reaches the water surface."
  ),
  existing(
    "fishing_reel",
    "Fishing Reel",
    "Existing reel mechanism loop.",
    "audio/fish-reel",
    3.03,
    "Fishing reel input while the catch game is active."
  ),
  existing(
    "eat",
    "Eat",
    "Existing food consumption completion sound.",
    "audio/buff-eat",
    2.91,
    "Successful food consumption."
  ),
  existing(
    "drink",
    "Drink",
    "Existing drink consumption completion sound.",
    "audio/buff-drink",
    2.78,
    "Successful drink consumption."
  ),
  existing(
    "spoiled_food",
    "Spoiled Food",
    "Existing spoiled-food rejection effect.",
    "audio/spoiled-food",
    5.21,
    "Spoiled food result."
  ),
  existing(
    "craft_success",
    "Craft Success",
    "Existing short crafting success cue.",
    "audio/craft-success",
    0.25,
    "Server-confirmed crafting completion."
  ),
  existing(
    "blueprint_complete",
    "Blueprint Complete",
    "Existing blueprint completion stinger.",
    "audio/blueprint-complete",
    1.01,
    "Server-confirmed blueprint completion."
  ),
  existing(
    "player_warp",
    "Player Warp",
    "Existing player warp and teleport effect.",
    "audio/player-warp",
    2.41,
    "Warp emote or teleport completion."
  ),
  existing(
    "treasure_reveal",
    "Treasure Reveal",
    "Existing bright collection accent reused for revealing treasure.",
    "audio/bling-collect",
    0.23,
    "Treasure reveal modal opens."
  ),
  existing(
    "take_photo",
    "Take Photo",
    "Existing camera shutter reused by authored photo interactions.",
    "audio/camera-shutter",
    0.25,
    "Photo interaction succeeds."
  ),
  existing(
    "splash",
    "Splash",
    "Existing water-entry splash family.",
    "audio/splash-1",
    1.72,
    "Player or object enters water."
  ),
  existing(
    HARTHMERE_CAMPFIRE_AMBIENCE_SOUND_ID,
    "Campfire Ambience",
    "Existing seamless wood-fire crackle used only near a placed campfire.",
    "audio/campfire",
    14.747,
    `The local player is within ${HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS} metres of a rendered campfire.`,
    true
  ),
];

type GeneratedRow = readonly [
  id: string,
  label: string,
  category: Exclude<HarthmereSoundCategory, "existing">,
  description: string,
  authority: readonly HarthmereSoundAuthority[],
  trigger: string,
  durationSeconds: number,
  prompt: string,
  loop?: boolean,
];

const GENERATED_ROWS: readonly GeneratedRow[] = [
  [
    "shield_raise",
    "Shield Raise",
    "combat",
    "A shield is quickly brought into a guarding position.",
    ["client_presentation", "native_ecs"],
    "Guard or block begins.",
    0.6,
    "Dry close-up medieval shield raise, leather strap tension, wood and iron rim movement, short defensive whoosh, no music, no speech, isolated video game sound effect.",
  ],
  [
    "shield_block",
    "Shield Block",
    "combat",
    "A steel weapon strikes an iron-rimmed wooden shield.",
    ["native_ecs", "anima"],
    "Authoritative blocked hit or block contact frame.",
    0.8,
    "Dry close-up medieval shield block: a steel sword strikes a sturdy iron-rimmed wooden shield, sharp metallic clang with a short wooden thud, no music, no voice, isolated video game sound effect.",
  ],
  [
    "shield_bash",
    "Shield Bash",
    "combat",
    "A shield drives forward and collides with an armored body.",
    ["native_ecs", "anima"],
    "Shield Bash contact.",
    0.85,
    "Forceful medieval shield bash, fast wooden and iron shield whoosh into an armored body, dense blunt impact, very short stun accent, no music, no speech.",
  ],
  [
    "parry",
    "Weapon Parry",
    "combat",
    "A precise blade-on-blade defensive parry.",
    ["native_ecs", "anima"],
    "Authoritative parry contact.",
    0.55,
    "Precise medieval sword parry, two steel blades meet in a crisp bright ring with a tiny scrape, dry close-up, no music, no voice.",
  ],
  [
    "guard_break",
    "Guard Break",
    "combat",
    "A defended stance collapses under a heavy strike.",
    ["native_ecs", "anima"],
    "Guard resource reaches zero or an interrupt breaks guard.",
    0.9,
    "Heavy medieval guard break, strained shield and metal impact followed by a cracking collapse and short low thump, dry game combat sound, no music, no speech.",
  ],
  [
    "critical_hit",
    "Critical Hit",
    "combat",
    "A compact accent layered over a successful critical hit.",
    ["native_ecs", "anima"],
    "Authoritative critical damage result.",
    0.55,
    "Compact fantasy RPG critical hit accent, sharp metallic bite, dense impact and very short bright tonal sting, no melody, no voice, isolated UI-combat layer.",
  ],
  [
    "armor_hit",
    "Armor Hit",
    "combat",
    "A weapon lands against worn metal armor.",
    ["native_ecs", "anima"],
    "Confirmed damage against armored target.",
    0.55,
    "Dry close-up weapon impact on medieval metal armor, hard denting clang with muted body thud, no music, no speech, isolated combat effect.",
  ],
  [
    "flesh_hit",
    "Unarmored Hit",
    "combat",
    "A restrained fantasy combat body impact without gore.",
    ["native_ecs", "anima"],
    "Confirmed damage against unarmored target.",
    0.5,
    "Restrained non-gory fantasy melee impact on an unarmored body, dense cloth and body thud, short and game-ready, no music, no vocalization.",
  ],
  [
    "melee_hit_unarmed_slap",
    "Bare-Handed Melee Hit",
    "combat",
    "A compact finger snap for a confirmed bare-handed melee hit.",
    ["client_presentation", "native_ecs"],
    "Confirmed player melee damage with no held item.",
    0.15,
    "One single dry human finger snap at extremely close range, crisp thumb-and-middle-finger snap with a sharp skin click and tiny fleshy transient, exactly one snap, no hand clap, no slap, no repeated snaps, no percussion, no voice, no room reverb, no echo, isolated game combat sound.",
  ],
  [
    "melee_hit_tool_wood",
    "Tool Melee Hit",
    "combat",
    "A compact axe-like wood strike for a confirmed hit with a tool.",
    ["client_presentation", "native_ecs"],
    "Confirmed player melee damage with a held tool.",
    0.15,
    "One single axe head striking solid dry wood, short woody chop crack, tight hard transient, no swing, no debris, no voice, no reverb, no echo, no tail, isolated game combat sound.",
  ],
  [
    "melee_hit_weapon_clink",
    "Weapon Melee Hit",
    "combat",
    "A compact steel sword-blade strike against a solid metal object for a confirmed weapon hit.",
    ["client_presentation", "native_ecs"],
    "Confirmed player melee damage with a held weapon.",
    0.15,
    "One steel sword blade edge striking a solid iron or steel object at close range, unmistakable sword-on-metal clash, hard bright metallic impact with a dense blade clang and a very short high-frequency ring, not a coin clink, not cutlery, not glass, no sword swing whoosh, no voice, no reverb, isolated game combat sound.",
  ],
  [
    "dodge_roll",
    "Dodge Roll",
    "movement",
    "Cloth, light armor, and ground movement during a quick evasive roll.",
    ["client_presentation", "native_ecs"],
    "Native movement action accepted and dodge animation begins.",
    0.85,
    "Fast evasive combat roll across dry ground, cloth and light leather armor movement, brief ground scrape and recovery step, no music, no voice.",
  ],
  [
    "charge",
    "Combat Charge",
    "combat",
    "A short armored rush ending in a body collision.",
    ["native_ecs", "anima"],
    "Charge ability begins and reaches contact.",
    1.2,
    "Short armored medieval combat charge, accelerating boots and armor rattle, rushing air, ending with a solid body collision, no music, no speech.",
  ],
  [
    "taunt",
    "Taunt",
    "combat",
    "A nonverbal threat pulse used to draw enemy attention.",
    ["native_ecs", "anima"],
    "Taunt is accepted by combat authority.",
    0.95,
    "Fantasy RPG taunt effect, brief wordless armored exertion and low threatening pulse, forceful but not musical, no intelligible speech.",
  ],
  [
    "last_stand",
    "Last Stand",
    "combat",
    "A desperate defensive surge with breath, heartbeat, and armor resonance.",
    ["native_ecs"],
    "Last Stand buff is applied.",
    1.35,
    "Desperate fantasy warrior last stand, one heavy heartbeat, controlled breath, armor tightening and low heroic resonance, no melody, no intelligible speech.",
  ],
  [
    "guard_ally",
    "Guard Ally",
    "combat",
    "A shield locks into a protective position beside an ally.",
    ["native_ecs"],
    "Guard Ally buff is applied.",
    0.95,
    "Medieval shield planted protectively beside an ally, leather grip, wood and iron lock, short protective resonance, no music, no voice.",
  ],
  [
    "backstab",
    "Backstab",
    "combat",
    "A quiet fast dagger attack from behind.",
    ["native_ecs"],
    "Backstab contact is confirmed.",
    0.7,
    "Quiet fantasy rogue backstab, subtle dagger draw, fast close stab through cloth and a subdued critical accent, non-gory, no music, no voice.",
  ],
  [
    "poison_blade",
    "Poison Blade",
    "combat",
    "A blade is coated with venom and lands a poisoned strike.",
    ["native_ecs"],
    "Poison Blade is applied.",
    0.9,
    "Fantasy rogue poison blade, wet venom brushed across steel, faint toxic hiss, then a quick blade contact, no music, no speech.",
  ],
  [
    "vanish",
    "Vanish",
    "magic",
    "A rogue disappears in a compact smoke burst.",
    ["native_ecs"],
    "Vanish stealth state begins.",
    0.8,
    "Fantasy rogue vanish, compact smoke poof, reverse airy whoosh and rapidly fading shimmer, no music, no voice, clean game effect.",
  ],
  [
    "flowing_kick",
    "Flowing Kick",
    "combat",
    "A martial kick with cloth movement and a firm impact.",
    ["native_ecs"],
    "Flowing Kick contact.",
    0.7,
    "Fast martial arts kick, cloth snap and short air cut ending in a firm padded body impact, no music, no vocalization.",
  ],
  [
    "whirlwind_slash",
    "Whirlwind Slash",
    "combat",
    "A complete circular blade attack.",
    ["native_ecs"],
    "Whirlwind Slash animation begins.",
    1.1,
    "Fantasy warrior whirlwind slash, rapid circular steel blade whoosh with two passing air cuts and a strong final sweep, no music, no voice.",
  ],
  [
    "cleave",
    "Cleave",
    "combat",
    "A broad committed two-handed cutting attack.",
    ["native_ecs", "anima"],
    "Cleave animation begins.",
    0.85,
    "Broad committed two-handed medieval weapon cleave, deep air displacement and heavy cutting pass, dry isolated game combat sound, no impact, no music.",
  ],
  [
    "player_downed",
    "Player Downed",
    "combat",
    "The player loses balance and falls into a downed state.",
    ["native_ecs"],
    "Authoritative health enters downed state.",
    1.0,
    "Armored adventurer collapses to the ground, gear and cloth movement with a restrained low defeat pulse, no speech, no music.",
  ],
  [
    "player_death",
    "Player Death",
    "combat",
    "A restrained final body fall and defeat cue.",
    ["native_ecs"],
    "Authoritative death state begins.",
    1.35,
    "Restrained fantasy player death sound, body and equipment fall onto ground followed by a short dark low-frequency fade, no speech, no melody.",
  ],
  [
    "player_revive",
    "Player Revive",
    "magic",
    "Breath and energy return as a player revives.",
    ["native_ecs"],
    "Authoritative revive succeeds.",
    1.3,
    "Fantasy player revive, returning breath, soft rising life energy and a grounded recovery chime, hopeful but not musical, no speech.",
  ],

  [
    "bow_empty_click",
    "Empty Bow Click",
    "ranged",
    "A dry nock and string click communicates that no backpack arrow is available.",
    ["client_presentation", "native_ecs"],
    "A selected bow is fired without an arrow in backpack storage.",
    0.5,
    "Close dry medieval bow handling click with an empty string pluck and wooden grip tick, clearly no arrow launch, no impact, no voice, no music.",
  ],
  [
    "magic_empty_fizzle",
    "Insufficient Mana Fizzle",
    "magic",
    "A compact failed-cast cue communicates that the caster lacks mana.",
    ["client_presentation", "native_ecs", "anima"],
    "A player or NPC attempts a spell whose mana cost exceeds current mana.",
    0.5,
    "Short fantasy magic failure fizzle, weak energy sputter collapsing into a muted crystalline click, no successful spell release, no voice, no music.",
  ],
  [
    "bow_nock",
    "Nock Arrow",
    "ranged",
    "An arrow is placed against a bow string.",
    ["client_presentation", "native_ecs"],
    "Bow aiming begins.",
    0.5,
    "Close-up wooden bow arrow nock, arrow shaft taps the bow and clicks onto a taut string, dry isolated game sound, no music.",
  ],
  [
    "bow_draw",
    "Bow Draw",
    "ranged",
    "A wooden bow bends under increasing string tension.",
    ["client_presentation", "native_ecs"],
    "Aimed shot charge or held bow draw.",
    1.0,
    "Close-up medieval wooden bow slowly drawing, string tension rising, wood limbs creaking lightly, no release, no music, no voice.",
  ],
  [
    "bow_release",
    "Bow Release",
    "ranged",
    "A normal hunting bow releases one arrow.",
    ["native_ecs", "anima"],
    "Normal bow projectile launches.",
    0.6,
    "Medieval hunting bow release, taut string snap and wooden limb vibration, single arrow launch, dry and close, no impact, no music.",
  ],
  [
    "bow_release_heavy",
    "Heavy Bow Release",
    "ranged",
    "A fully drawn powerful arrow is released.",
    ["native_ecs"],
    "Aimed Shot launches.",
    0.8,
    "Powerful fully drawn war bow release, strained wood and deep string snap launching one heavy arrow, no impact, no music, no voice.",
  ],
  [
    "bow_release_multi",
    "Multi-Shot Release",
    "ranged",
    "Several arrows launch in a rapid fan.",
    ["native_ecs"],
    "Multi-Shot launches.",
    0.9,
    "Fantasy archer multi-shot, one bow release followed by several tightly layered arrow launches spreading into a fan, no impacts, no music.",
  ],
  [
    "arrow_flyby",
    "Arrow Flyby",
    "ranged",
    "A fast arrow passes close to the listener.",
    ["client_presentation"],
    "Physical arrow passes the listener.",
    0.55,
    "Single fast medieval arrow flyby, thin wooden shaft whistle and feather flutter, no bow release, no impact, no music.",
  ],
  [
    "arrow_impact_flesh",
    "Arrow Impact Body",
    "ranged",
    "A restrained non-gory arrow impact on an unarmored target.",
    ["native_ecs", "anima"],
    "Physical arrow damage is confirmed.",
    0.55,
    "Restrained non-gory arrow impact into cloth and body, wooden shaft vibration, compact game combat sound, no music, no voice.",
  ],
  [
    "arrow_impact_hard",
    "Arrow Impact Hard Surface",
    "ranged",
    "An arrow strikes armor, wood, or stone and rattles.",
    ["native_ecs", "anima"],
    "Arrow misses into terrain or strikes armor.",
    0.55,
    "Medieval arrow hits a hard surface, sharp tip contact, wooden shaft rattle and short ricochet, dry isolated game sound, no music.",
  ],
  [
    "crossbow_cock",
    "Cock Crossbow",
    "ranged",
    "A crossbow string and trigger mechanism are armed.",
    ["client_presentation", "native_ecs"],
    "Crossbow reload begins.",
    1.0,
    "Medieval crossbow cocking mechanism, ratchet clicks, wood strain, string locks into trigger, dry close-up, no music, no speech.",
  ],
  [
    "crossbow_release",
    "Crossbow Release",
    "ranged",
    "A loaded crossbow fires a bolt.",
    ["native_ecs", "anima"],
    "Crossbow projectile launches.",
    0.65,
    "Medieval crossbow fires, hard trigger click, powerful string snap and wooden stock vibration, no impact, no music.",
  ],
  [
    "bolt_flyby",
    "Crossbow Bolt Flyby",
    "ranged",
    "A heavy bolt passes close by.",
    ["client_presentation"],
    "Crossbow bolt passes the listener.",
    0.5,
    "Heavy crossbow bolt flyby, short aggressive air whistle and feather vibration, no launch, no impact, no music.",
  ],
  [
    "bolt_impact",
    "Crossbow Bolt Impact",
    "ranged",
    "A heavy bolt strikes a target.",
    ["native_ecs", "anima"],
    "Crossbow damage or hard impact is confirmed.",
    0.6,
    "Heavy medieval crossbow bolt impact, dense piercing thud with wooden shaft vibration, restrained and non-gory, no music, no voice.",
  ],
  [
    "dart_throw",
    "Dart Throw",
    "ranged",
    "A small weighted dart is snapped forward by hand.",
    ["native_ecs", "anima"],
    "Thrown dart launches.",
    0.5,
    "Fast hand-thrown steel dart release, glove movement and sharp air flick, no impact, no music, no voice.",
  ],
  [
    "dart_flyby",
    "Dart Flyby",
    "ranged",
    "A thin thrown dart cuts through the air.",
    ["client_presentation"],
    "Dart passes the listener.",
    0.5,
    "Thin steel dart flyby, very short high air whistle, no launch, no impact, no music.",
  ],
  [
    "dart_impact",
    "Dart Impact",
    "ranged",
    "A small steel dart lands in a target.",
    ["native_ecs", "anima"],
    "Dart contact is confirmed.",
    0.5,
    "Small steel dart impact into leather and cloth, compact piercing tick and slight metal vibration, non-gory, no music.",
  ],
  [
    "hunters_mark",
    "Hunter's Mark",
    "magic",
    "A hunter magically identifies and marks a target.",
    ["native_ecs"],
    "Hunter's Mark projectile launches or mark applies.",
    0.85,
    "Fantasy hunter target mark, focused airy pulse, distant subtle hunting horn texture and sharp target lock shimmer, no melody, no speech.",
  ],
  [
    "bear_trap_place",
    "Place Bear Trap",
    "world",
    "A sprung metal jaw trap is set on the ground.",
    ["native_ecs"],
    "Bear Trap placement is accepted.",
    0.85,
    "Medieval bear trap placed and armed, iron jaws opened, spring tension and mechanism click, dry close-up, no music.",
  ],
  [
    "bear_trap_trigger",
    "Bear Trap Trigger",
    "combat",
    "A metal jaw trap snaps shut.",
    ["native_ecs", "anima"],
    "Bear Trap is authoritatively triggered.",
    0.7,
    "Heavy iron bear trap snaps shut with violent spring force and chain rattle, dry isolated game sound, no scream, no music.",
  ],

  [
    "frost_barrier",
    "Frost Barrier",
    "magic",
    "Ice rapidly forms into a defensive barrier.",
    ["native_ecs"],
    "Frost Barrier buff is applied.",
    1.1,
    "Fantasy frost barrier forms rapidly, crystalline ice growth, glassy frozen shimmer and short settling crack, no music, no voice.",
  ],
  [
    "heal",
    "Heal",
    "magic",
    "Warm restorative magic pulses into a living target.",
    ["native_ecs"],
    "Heal or Minor Heal succeeds.",
    1.0,
    "Warm fantasy healing spell, soft rising shimmer, gentle life pulse and clean completion chime, no choir, no melody, no speech.",
  ],
  [
    "rejuvenation",
    "Rejuvenation",
    "magic",
    "Nature healing settles into a target over time.",
    ["native_ecs"],
    "Rejuvenation effect is applied.",
    1.15,
    "Fantasy nature rejuvenation, fresh leaves and soft organic energy swirl, gentle repeating healing pulse, no birds, no music, no speech.",
  ],
  [
    "blessing",
    "Blessing",
    "magic",
    "A compact holy blessing is bestowed.",
    ["native_ecs"],
    "Blessing buff is applied.",
    1.0,
    "Compact holy blessing, warm radiant swell and one clear small bell resonance, reverent but not musical, no choir, no speech.",
  ],
  [
    "resurrection",
    "Resurrection",
    "magic",
    "Spiritual energy restores a fallen ally.",
    ["native_ecs"],
    "Resurrection succeeds.",
    1.8,
    "Fantasy resurrection, low spiritual gathering, returning breath, rising radiant energy and powerful life-restored completion, no speech, no song.",
  ],
  [
    "shield_of_faith",
    "Shield of Faith",
    "magic",
    "A holy protective shield forms around the caster.",
    ["native_ecs"],
    "Shield of Faith buff is applied.",
    1.0,
    "Holy shield of faith forms, bright metallic energy arcs into a protective shell with a resonant lock, no music, no choir, no speech.",
  ],
  [
    "raise_skeleton",
    "Raise Skeleton",
    "magic",
    "Bones assemble from disturbed earth under necromantic power.",
    ["native_ecs"],
    "Raise Skeleton summon succeeds.",
    1.6,
    "Dark fantasy skeleton summoning, dry earth disturbance, bones rattling and assembling, necromantic seal completes, no speech, no music.",
  ],
  [
    "bear_form",
    "Bear Form",
    "magic",
    "A druid transforms into a heavy bear form.",
    ["native_ecs"],
    "Bear Form toggles on.",
    1.4,
    "Fantasy druid transforms into a bear, organic magical surge, body and fur transformation, ending with a deep bear growl and heavy stance, no speech.",
  ],
  [
    "song_of_courage",
    "Song of Courage",
    "magic",
    "A brief instrumental phrase inspires nearby allies.",
    ["native_ecs"],
    "Song of Courage party buff is applied.",
    1.5,
    "Very short medieval bard courage flourish on lute and hand drum, confident rising phrase with magical buff shimmer, no singing, no speech, isolated ability cue.",
  ],
  [
    "center_self",
    "Center Self",
    "magic",
    "A controlled breath restores martial focus.",
    ["native_ecs"],
    "Center Self defensive state is applied.",
    1.2,
    "Martial artist centers themselves, controlled inhale and exhale, cloth settling and one low meditation chime, no words, no music bed.",
  ],
  [
    "summon_wisp",
    "Summon Wisp",
    "magic",
    "A small magical wisp ignites and arrives.",
    ["native_ecs"],
    "Summon Wisp succeeds.",
    1.1,
    "Tiny fantasy wisp summoning, airy magical spiral, soft ignition and bright floating arrival chime, no music, no speech.",
  ],
  [
    "bond_mend",
    "Bond Mend",
    "magic",
    "A magical bond heals a companion animal.",
    ["native_ecs"],
    "Bond Mend succeeds.",
    1.0,
    "Gentle fantasy pet bond healing, soft hand contact, warm magical pulse and relieved animal breath, no speech, no music.",
  ],
  [
    "mana_shield",
    "Mana Shield",
    "magic",
    "Arcane energy expands into a defensive shell.",
    ["native_ecs"],
    "Mana Shield buff is applied.",
    1.0,
    "Arcane mana shield expands around a mage, glassy energy bloom, stable magical hum and short locking pulse, no music, no voice.",
  ],
  [
    "cleanse",
    "Cleanse",
    "magic",
    "A harmful magical effect breaks apart and washes away.",
    ["native_ecs"],
    "Cleanse removes a status effect.",
    1.0,
    "Fantasy cleanse spell, brittle corrupted energy cracks apart then dissolves in a clean bright wash, no music, no voice.",
  ],
  [
    "read_runes",
    "Read Runes",
    "magic",
    "Ancient runes activate and reveal their meaning.",
    ["server_receipt"],
    "Read Runes interaction is confirmed.",
    1.15,
    "Ancient stone runes activate one by one, fingertip scrape, low arcane pulses and a final knowledge reveal shimmer, no speech, no music.",
  ],
  [
    "speak_with_dead",
    "Speak With Dead",
    "magic",
    "A spectral connection opens to the dead.",
    ["server_receipt", "native_ecs"],
    "Speak With Dead succeeds.",
    1.25,
    "Dark fantasy speak with dead, cold spectral breath, distant unintelligible whisper texture and a low connection pulse, no intelligible words, no music.",
  ],
  [
    "speak_with_animals",
    "Speak With Animals",
    "magic",
    "A gentle magical call opens communication with an animal.",
    ["server_receipt", "native_ecs"],
    "Speak With Animals succeeds.",
    1.0,
    "Gentle fantasy speak with animals ability, soft natural whistle, warm magic shimmer and quiet animal acknowledgment, no intelligible speech, no music.",
  ],
  [
    "rumor_song",
    "Rumor Song",
    "magic",
    "A short bard phrase reveals useful information.",
    ["server_receipt", "native_ecs"],
    "Rumor Song succeeds.",
    1.2,
    "Short curious medieval lute phrase with a subtle secret-discovery shimmer, no singing, no speech, isolated bard ability cue.",
  ],
  [
    "tame_animal",
    "Tame Animal",
    "world",
    "A calm interaction earns an animal's trust.",
    ["native_ecs"],
    "Tame Animal succeeds.",
    1.0,
    "Calm animal taming interaction, gentle hand and feed movement, animal sniff, then a soft trusting response, no speech, no music.",
  ],
  [
    "track_beast",
    "Track Beast",
    "world",
    "The player inspects tracks and finds a direction.",
    ["server_receipt", "native_ecs"],
    "Track Beast succeeds.",
    0.95,
    "Fantasy ranger tracking, hand brushes dirt and leaves, subtle footprint discovery and concise directional confirmation pulse, no speech, no music.",
  ],
  [
    "deploy_turret",
    "Deploy Turret",
    "world",
    "A compact mechanical turret unfolds and powers on.",
    ["native_ecs"],
    "Deploy Turret placement succeeds.",
    1.3,
    "Compact fantasy engineering turret deploys, metal parts unfold, gears lock, legs plant and a small power core activates, no gunfire, no music.",
  ],
  [
    "repair_kit",
    "Use Repair Kit",
    "world",
    "Tools tighten and restore a damaged object.",
    ["native_ecs", "server_receipt"],
    "Repair Kit ability succeeds.",
    1.0,
    "Fantasy repair kit in use, tool pouch movement, wrench tightening, two light hammer taps and a clean mechanical completion, no music, no speech.",
  ],
  [
    "command_pet",
    "Command Pet",
    "world",
    "A concise whistle directs a companion.",
    ["native_ecs"],
    "Command Pet is accepted.",
    0.75,
    "Short clear animal command whistle followed by a quiet pet acknowledgment, no spoken words, no music, isolated game ability sound.",
  ],
  [
    "pick_lock",
    "Pick Lock",
    "world",
    "Lockpicks manipulate tumblers until the lock opens.",
    ["server_receipt", "native_ecs"],
    "Pick Lock succeeds.",
    1.5,
    "Close-up medieval lockpicking, delicate metal pick scrapes and tumbler clicks, ending in a satisfying lock release, no music, no speech.",
  ],
  [
    "disarm_trap",
    "Disarm Trap",
    "world",
    "A dangerous mechanism is safely released.",
    ["server_receipt", "native_ecs"],
    "Disarm Trap succeeds.",
    1.2,
    "Close-up trap disarm, careful metal tool movements, spring tension slowly released and a safe final click, no trigger snap, no music.",
  ],

  [
    "till_soil",
    "Till Soil",
    "farming",
    "A hoe cuts into soil and turns a planting row.",
    ["client_presentation", "native_ecs", "gaia"],
    "Validated till action reaches its completion frame; Gaia remains terrain authority.",
    0.85,
    "Close-up garden hoe strikes and turns moist soil, metal tool contact, dirt crumble and short earth movement, no music, no voice.",
  ],
  [
    "plant_seed",
    "Plant Seed",
    "farming",
    "Seeds are scattered into a small hole and covered.",
    ["client_presentation", "native_ecs", "gaia"],
    "Validated plant action publishes its native event.",
    0.75,
    "Close-up hand planting seeds, tiny seeds scatter into soft soil, fingers cover and pat the earth, no music, no voice.",
  ],
  [
    "water_plant",
    "Water Plant",
    "farming",
    "Water pours from a can over leaves and soil.",
    ["client_presentation", "native_ecs", "gaia"],
    "Validated water action publishes its native event.",
    1.5,
    "Garden watering can pours a steady stream onto plant leaves and soil, clear droplets and damp earth, seamless short loop, no music, no voice.",
    true,
  ],
  [
    "refill_watering_can",
    "Refill Watering Can",
    "farming",
    "A watering can fills from a natural water source.",
    ["client_presentation", "native_ecs"],
    "Validated watering-can refill action.",
    1.4,
    "Metal watering can dips into water and fills with a hollow rising water sound, gentle slosh as it lifts, no music, no voice.",
  ],
  [
    "fertilize_plant",
    "Fertilize Plant",
    "farming",
    "Fertilizer is scattered around a plant and absorbed by the soil.",
    ["client_presentation", "native_ecs", "gaia"],
    "Validated fertilize action publishes its native event.",
    0.9,
    "Garden fertilizer granules scatter around a plant, soft soil contact and a faint organic absorption fizz, no music, no voice.",
  ],
  [
    "harvest_crop",
    "Harvest Crop",
    "farming",
    "A mature crop is pulled and collected.",
    ["native_ecs", "gaia"],
    "Gaia-confirmed harvest creates the authoritative drop.",
    0.85,
    "Mature garden crop harvested by hand, leaves rustle, stem snaps cleanly and produce drops into a basket, no music, no voice.",
  ],
  [
    "harvest_root",
    "Harvest Root Vegetable",
    "farming",
    "A root vegetable pulls free from compact soil.",
    ["native_ecs", "gaia"],
    "Gaia-confirmed root crop harvest.",
    0.9,
    "Root vegetable pulled from soil, brief strain, earthy pop and loose dirt falling away, no music, no voice.",
  ],
  [
    "harvest_grain",
    "Harvest Grain",
    "farming",
    "Dry grain stalks are cut and bundled.",
    ["native_ecs", "gaia"],
    "Gaia-confirmed grain harvest.",
    0.9,
    "Dry grain stalks cut with a small sickle, crisp stems and bundle rustle, no music, no voice.",
  ],
  [
    "harvest_fruit",
    "Harvest Fruit",
    "farming",
    "Fruit is plucked from leafy growth.",
    ["native_ecs", "gaia"],
    "Gaia-confirmed fruit harvest.",
    0.75,
    "Fruit plucked from a leafy plant, leaves rustle, stem pops and fruit settles into a basket, no music, no voice.",
  ],
  [
    "compost",
    "Compost",
    "farming",
    "Organic material drops into compost and is mixed.",
    ["server_receipt", "gaia"],
    "Compost action is confirmed.",
    1.0,
    "Organic garden scraps drop into a wooden compost bin, damp rustle, shovel mix and soft earthy settling, no music, no voice.",
  ],
  [
    "muck_cleanup",
    "Muck Cleanup",
    "farming",
    "Sticky corrupted muck is scraped and reclaimed.",
    ["native_ecs", "gaia"],
    "Authoritative cleanup tool use changes terrain.",
    1.0,
    "Sticky fantasy muck scraped from ground, wet pull and shovel movement followed by a clean reclaimed-earth response, no music, no voice.",
  ],
  [
    "crop_failed",
    "Crop Failed",
    "farming",
    "A dead crop dries and collapses.",
    ["gaia"],
    "Client observes Gaia crop state change to failed.",
    0.8,
    "Dry failed crop wilts and crumbles, brittle leaves and a soft dusty collapse, no music, no voice.",
  ],
  [
    "crop_ready",
    "Crop Ready",
    "farming",
    "A subtle natural cue marks a mature crop.",
    ["gaia"],
    "Client observes Gaia crop state become harvestable.",
    0.7,
    "Subtle mature crop ready cue, fresh leaves unfurl and a tiny natural shimmer, quiet and non-musical, no voice.",
  ],

  [
    "fishing_bite",
    "Fishing Bite",
    "fishing",
    "A fish tugs the line and dips the bobber.",
    ["client_presentation", "native_ecs"],
    "Fishing state enters bite.",
    0.65,
    "Fishing bobber dips sharply as a fish bites, small water plop and tight line twitch, clear gameplay alert, no music, no voice.",
  ],
  [
    "fishing_hook_set",
    "Set Fishing Hook",
    "fishing",
    "The rod snaps upward and the line becomes taut.",
    ["client_presentation", "native_ecs"],
    "Player successfully responds to a bite.",
    0.7,
    "Fishing rod snaps upward to set the hook, taut line twang and small water disturbance, no music, no voice.",
  ],
  [
    "fishing_line_tension",
    "Fishing Line Tension",
    "fishing",
    "A hooked fish strains the line and rod.",
    ["client_presentation"],
    "Catch game line tension is high.",
    1.2,
    "Taut fishing line under strain, rod wood creaks and line vibrates, seamless short loop, no reel mechanism, no music.",
    true,
  ],
  [
    "fishing_struggle",
    "Fish Struggle",
    "fishing",
    "A hooked fish thrashes near the surface.",
    ["client_presentation"],
    "Catch game fish makes an active struggle.",
    1.2,
    "Hooked fish struggling near the water surface, quick splashes and tight line movement, seamless short loop, no music.",
    true,
  ],
  [
    "fishing_catch",
    "Catch Fish",
    "fishing",
    "A fish leaves the water and lands in hand.",
    ["native_ecs"],
    "Authoritative catch reward is granted.",
    1.0,
    "Successful fishing catch, fish bursts from water with a wet splash, brief flap and restrained reward accent, no music, no voice.",
  ],
  [
    "fishing_treasure",
    "Catch Fishing Treasure",
    "fishing",
    "A heavy treasure object is pulled from the water.",
    ["native_ecs"],
    "Authoritative treasure catch is granted.",
    1.2,
    "Heavy treasure chest pulled from water, rope strain, water draining, solid wooden landing and short treasure shimmer, no music.",
  ],
  [
    "fishing_escape",
    "Fish Escapes",
    "fishing",
    "The line suddenly goes slack as the fish escapes.",
    ["native_ecs"],
    "Catch result is failure without a broken line.",
    0.85,
    "Fishing line suddenly goes slack, small recoil and fish splashes away, concise failure cue, no music, no voice.",
  ],
  [
    "fishing_line_break",
    "Fishing Line Break",
    "fishing",
    "An overstressed fishing line snaps.",
    ["native_ecs"],
    "Fishing failure reports a broken line.",
    0.75,
    "Overstressed fishing line snaps sharply, rod recoils and loose line whips through air, no music, no voice.",
  ],
  [
    "fishing_land_impact",
    "Fishing Lure Hits Land",
    "fishing",
    "A hook or lure hits dry terrain.",
    ["client_presentation"],
    "Cast lands outside water.",
    0.6,
    "Small fishing lure strikes dry dirt and stone, light metal tick and short bounce, no splash, no music.",
  ],
  [
    "fishing_bait_attach",
    "Attach Fishing Bait",
    "fishing",
    "Bait is placed securely on a hook.",
    ["client_presentation"],
    "Bait selection is confirmed.",
    0.55,
    "Close-up fishing bait attached to a small metal hook, soft handling and tiny hook click, no music, no voice.",
  ],
  [
    "fishing_bait_consumed",
    "Fishing Bait Consumed",
    "fishing",
    "A fish nibbles bait from the hook underwater.",
    ["native_ecs"],
    "Fishing authority consumes bait.",
    0.6,
    "Small underwater fish nibble removes bait from a hook, tiny bubbles and subtle line tick, no music.",
  ],
  [
    "fishing_show",
    "Show Caught Fish",
    "fishing",
    "A caught fish flaps briefly while displayed.",
    ["client_presentation"],
    "Fishing show animation begins.",
    0.75,
    "Freshly caught fish gives two wet flaps while being held, restrained and close-up, no music, no voice.",
  ],

  [
    "open_container_wood",
    "Open Wooden Container",
    "world",
    "A wooden chest, crate, or box opens.",
    ["native_ecs", "server_receipt"],
    "Authoritative container open succeeds.",
    0.8,
    "Medieval wooden chest or crate opens, latch click, wood creak and lid stop, dry close-up, no music.",
  ],
  [
    "open_container_metal",
    "Open Metal Container",
    "world",
    "A metal lockbox or strongbox opens.",
    ["native_ecs", "server_receipt"],
    "Authoritative metal container open succeeds.",
    0.8,
    "Heavy medieval metal lockbox opens, latch release, hinge movement and short iron resonance, no music.",
  ],
  [
    "open_container_cloth",
    "Open Cloth Container",
    "world",
    "A satchel or bag is opened.",
    ["native_ecs", "server_receipt"],
    "Authoritative bag or satchel open succeeds.",
    0.65,
    "Canvas and leather satchel opens, buckle release and cloth rustle, close-up isolated game sound, no music.",
  ],
  [
    "open_door",
    "Open Wooden Door",
    "world",
    "A sturdy wooden door opens on hinges.",
    ["server_receipt"],
    "Server-confirmed door interaction.",
    1.0,
    "Sturdy medieval wooden door opens, iron latch clicks and hinges creak briefly, no footsteps, no music.",
  ],
  [
    "open_gate",
    "Open Heavy Gate",
    "world",
    "A large gate releases and swings open.",
    ["server_receipt"],
    "Server-confirmed gate interaction.",
    1.2,
    "Heavy medieval wood and iron gate opens, bar releases, hinges groan and structure settles, no music, no voice.",
  ],
  [
    "open_board",
    "Open Notice Board",
    "world",
    "Paper and wood movement accompanies opening a jobs or wanted board.",
    ["server_receipt"],
    "Jobs or wanted board opens.",
    0.65,
    "Medieval notice board interaction, parchment rustle, small wooden tap and concise UI reveal, no music, no voice.",
  ],
  [
    "read_object",
    "Read Object",
    "world",
    "A page, sign, ledger, or inscription is examined.",
    ["server_receipt"],
    "Server-confirmed read interaction.",
    0.7,
    "Quiet medieval reading interaction, parchment or ledger page movement and a subtle knowledge confirmation tick, no music, no speech.",
  ],
  [
    "gather_resource",
    "Gather Resource",
    "world",
    "A natural world resource is picked and stored.",
    ["native_ecs", "server_receipt", "gaia"],
    "Authoritative gathering succeeds.",
    0.75,
    "Hand gathers a small natural resource, leaves and stems rustle, item drops into a pouch, no music, no voice.",
  ],
  [
    "repair_wood",
    "Repair Wood",
    "world",
    "A damaged wooden structure is repaired.",
    ["server_receipt", "native_ecs"],
    "Server-confirmed repair on a wooden target.",
    1.0,
    "Medieval wood repair, wooden piece aligned, three controlled mallet taps and structure settling, no music, no voice.",
  ],
  [
    "repair_stone",
    "Repair Stone",
    "world",
    "A damaged stone structure is repaired.",
    ["server_receipt", "native_ecs"],
    "Server-confirmed repair on a stone target.",
    1.0,
    "Medieval stone repair, masonry piece set, mortar scrape and two firm mallet taps, no music, no voice.",
  ],
  [
    "repair_metal",
    "Repair Metal",
    "world",
    "A damaged metal object is repaired.",
    ["server_receipt", "native_ecs"],
    "Server-confirmed repair on a metal target.",
    1.0,
    "Medieval metal repair, wrench tension and two small hammer strikes ending in a stable metal ring, no music, no voice.",
  ],
  [
    "use_object",
    "Use World Object",
    "world",
    "A generic table, desk, pot, or mechanism is operated.",
    ["server_receipt"],
    "Server-confirmed generic use interaction.",
    0.7,
    "Short physical interaction with a medieval world object, hand contact, wood and small mechanism movement, no music, no voice.",
  ],
  [
    "practice_action",
    "Practice Action",
    "world",
    "A training object is struck or manipulated.",
    ["server_receipt"],
    "Server-confirmed practice interaction.",
    0.8,
    "Fantasy training practice interaction, controlled movement and padded target contact with a concise progress tick, no music, no speech.",
  ],
  [
    "inspect_object",
    "Inspect Object",
    "world",
    "An object is closely inspected without changing it.",
    ["server_receipt"],
    "Server-confirmed inspect interaction.",
    0.55,
    "Quiet object inspection cue, subtle handling movement and a very small neutral confirmation tick, no music, no voice.",
  ],
  [
    "check_outfit",
    "Check Outfit",
    "world",
    "Cloth and accessories shift while an outfit is examined.",
    ["server_receipt"],
    "Outfit inspection succeeds.",
    0.7,
    "Close-up medieval clothing adjustment, fabric rustle, leather strap and small buckle movement, no music, no speech.",
  ],
  [
    "shape_terrain",
    "Shape Terrain",
    "world",
    "A tool chips and reshapes a solid block.",
    ["native_ecs"],
    "Shape event is published after local validation.",
    0.75,
    "Hand tool chisels and reshapes a stone block, short scrape, chip impacts and compact settling sound, no music, no voice.",
  ],
  [
    "dye_object",
    "Dye Object",
    "world",
    "Dye liquid is applied to a surface or fabric.",
    ["native_ecs"],
    "Dye event is published after local validation.",
    0.7,
    "Fantasy dye applied to material, liquid stir, wet brush or dip and soft fabric movement, no music, no voice.",
  ],
  [
    "bucket_scoop",
    "Scoop Water",
    "world",
    "A bucket fills from a water source.",
    ["native_ecs"],
    "Water scoop succeeds.",
    0.9,
    "Wooden or metal bucket scoops water, hollow splash, rising fill and short slosh, no music, no voice.",
  ],
  [
    "bucket_dump",
    "Dump Water",
    "world",
    "A bucket pours its water onto terrain.",
    ["native_ecs", "gaia"],
    "Water dump event is accepted.",
    1.0,
    "Full bucket pours water onto ground, broad splash, flowing water and empty bucket movement, no music, no voice.",
  ],
  [
    "weapon_equip",
    "Equip Weapon",
    "world",
    "A weapon is drawn and readied.",
    ["client_presentation", "native_ecs"],
    "Equipped weapon changes to drawn state.",
    0.7,
    "Medieval weapon drawn from leather sheath and readied, steel movement, leather friction and short grip adjustment, no music, no voice.",
  ],
  [
    "weapon_unequip",
    "Unequip Weapon",
    "world",
    "A weapon is safely put away.",
    ["client_presentation", "native_ecs"],
    "Equipped weapon changes to sheathed state.",
    0.75,
    "Medieval weapon returned to leather sheath, steel slide, leather friction and secure final seat, no music, no voice.",
  ],
  [
    "cooking_start",
    "Start Cooking",
    "cooking",
    "Ingredients are placed into the selected cooking station.",
    ["server_receipt"],
    "Cook enqueue succeeds.",
    0.8,
    "Medieval cooking begins, ingredients placed into cookware, utensil tap and small fire response, no music, no voice.",
  ],
  [
    "cooking_collect",
    "Collect Cooked Food",
    "cooking",
    "Finished food is lifted from a cooking station.",
    ["server_receipt"],
    "Cook collect succeeds.",
    0.8,
    "Finished medieval meal collected from cookware, lid or pan movement, serving utensil and pleasant short completion, no music, no voice.",
  ],
  [
    "cooking_cancel",
    "Cancel Cooking",
    "cooking",
    "A cooking job is stopped and ingredients are removed.",
    ["server_receipt"],
    "Cook cancel succeeds.",
    0.7,
    "Cooking stopped, pot or pan moved off heat, utensil scrape and fire settling, neutral result, no music, no voice.",
  ],
  [
    "cookpot_loop",
    "Cookpot Bubbling",
    "cooking",
    "A stew or soup bubbles in a cookpot.",
    ["client_presentation"],
    "Cookpot has an active cooking job.",
    2.0,
    "Close-up medieval cookpot simmering, gentle liquid bubbles and occasional soft pot tick, seamless loop, no music, no voices.",
    true,
  ],
  [
    "oven_loop",
    "Oven Cooking",
    "cooking",
    "Food bakes in a hot wood-fired oven.",
    ["client_presentation"],
    "Oven has an active cooking job.",
    2.0,
    "Close-up wood-fired oven cooking ambience, low fire, soft baking sizzle and tiny brick resonance, seamless loop, no music.",
    true,
  ],
  [
    "food_chop",
    "Chop Ingredients",
    "cooking",
    "Ingredients are cut on a wooden board.",
    ["server_receipt"],
    "Field or kitchen preparation recipe begins.",
    1.0,
    "Kitchen knife chops vegetables on a wooden cutting board in three quick controlled cuts, close-up, no music, no voice.",
  ],
  [
    "food_grind",
    "Grind Ingredients",
    "cooking",
    "Ingredients are milled or ground.",
    ["server_receipt"],
    "Grinding or milling recipe begins.",
    1.2,
    "Stone mortar or small hand mill grinding dry ingredients, coarse scrape and granular movement, seamless short action, no music.",
    true,
  ],
  [
    "cooking_burned",
    "Cooking Burned",
    "cooking",
    "Food overheats and burns.",
    ["server_receipt"],
    "Cooking failure or spoil result is confirmed.",
    0.9,
    "Food burns in a hot pan, harsh sizzle, brief smoke puff and disappointed failure tick, no voice, no music.",
  ],

  [
    "animal_bite",
    "Animal Bite",
    "creature",
    "A medium animal snaps its jaws in an attack.",
    ["anima"],
    "Anima attack emote resolves as Bite.",
    0.6,
    "Medium wild animal bite attack, fast jaw snap, teeth click and short air movement, no victim sound, no music.",
  ],
  [
    "animal_claw",
    "Animal Claw",
    "creature",
    "A large paw or claw swipes through the air.",
    ["anima"],
    "Anima attack emote resolves as Claw.",
    0.65,
    "Large animal claw swipe, heavy paw movement and sharp air cut, no impact, no roar, no music.",
  ],
  [
    "animal_scratch",
    "Animal Scratch",
    "creature",
    "A small creature rapidly scratches.",
    ["anima"],
    "Anima attack emote resolves as Scratch.",
    0.6,
    "Small animal scratch attack, two quick claw swipes and light air movement, no victim, no music.",
  ],
  [
    "animal_pounce",
    "Animal Pounce",
    "creature",
    "An animal leaps forward and lands heavily.",
    ["anima"],
    "Anima attack emote resolves as Pounce.",
    0.9,
    "Predatory animal pounce, fast leap through brush and heavy four-paw landing, no roar, no music.",
  ],
  [
    "animal_kick",
    "Animal Kick",
    "creature",
    "A hoofed animal delivers a backward kick.",
    ["anima"],
    "Anima attack emote resolves as Kick.",
    0.65,
    "Hoofed animal backward kick, rapid leg movement and strong hoof impact through air, no victim voice, no music.",
  ],
  [
    "animal_charge",
    "Animal Charge",
    "creature",
    "A heavy animal rushes forward.",
    ["anima"],
    "Anima attack emote resolves as Charge.",
    1.0,
    "Heavy wild animal short charge, rapid hooves on earth, breath and rushing body movement, no collision, no music.",
  ],
  [
    "animal_peck",
    "Animal Peck",
    "creature",
    "A bird makes a quick peck attack.",
    ["anima"],
    "Anima attack emote resolves as Peck.",
    0.5,
    "Bird peck attack, quick wing movement and two sharp beak taps, no music, no human voice.",
  ],
  [
    "animal_tail_whip",
    "Animal Tail Whip",
    "creature",
    "A heavy tail sweeps through the air.",
    ["anima"],
    "Anima attack emote resolves as TailWhip.",
    0.7,
    "Large creature tail whip, muscular sweep and deep fast air whoosh, no impact, no roar, no music.",
  ],
  [
    "wolf_attack",
    "Wolf Attack",
    "creature",
    "A wolf growls and lunges.",
    ["anima"],
    "Wolf attack animation begins.",
    0.8,
    "Wild wolf attack, short aggressive growl and forward lunge with paw movement, no victim sound, no music.",
  ],
  [
    "wolf_hit",
    "Wolf Hit",
    "creature",
    "A wolf reacts to being struck.",
    ["anima"],
    "Authoritative wolf health damage is observed.",
    0.65,
    "Wolf hit reaction, brief realistic canine yelp and body movement, restrained, no music.",
  ],
  [
    "wolf_death",
    "Wolf Death",
    "creature",
    "A wolf gives a final yelp and falls.",
    ["anima"],
    "Authoritative wolf death is observed.",
    1.1,
    "Wolf death reaction, short final canine yelp and body falling onto earth, restrained, no music.",
  ],
  [
    "wolf_howl",
    "Wolf Howl",
    "creature",
    "A lone wolf howls.",
    ["anima"],
    "Wolf Howl or idle social animation.",
    1.8,
    "Single realistic wolf howl in open woodland, concise and isolated, no other animals, no music.",
  ],
  [
    "bear_attack",
    "Bear Attack",
    "creature",
    "A bear roars and swipes.",
    ["anima"],
    "Bear attack animation begins.",
    0.9,
    "Large bear attack, deep short roar and heavy paw swipe, close and forceful, no victim, no music.",
  ],
  [
    "bear_hit",
    "Bear Hit",
    "creature",
    "A bear grunts from a hit.",
    ["anima"],
    "Authoritative bear health damage is observed.",
    0.7,
    "Large bear hit reaction, deep pained grunt and heavy body movement, restrained, no music.",
  ],
  [
    "bear_death",
    "Bear Death",
    "creature",
    "A bear groans and collapses.",
    ["anima"],
    "Authoritative bear death is observed.",
    1.3,
    "Large bear death, deep fading groan and heavy body collapse onto earth, restrained, no music.",
  ],
  [
    "bear_roar",
    "Bear Roar",
    "creature",
    "A bear gives a territorial roar.",
    ["anima"],
    "Bear Roar animation.",
    1.4,
    "Single realistic territorial bear roar, powerful and close, no movement, no music.",
  ],
  [
    "boar_attack",
    "Boar Attack",
    "creature",
    "A boar snorts and lunges.",
    ["anima"],
    "Boar attack animation begins.",
    0.8,
    "Wild boar attack, angry snort and fast hoof lunge through dirt, no collision, no music.",
  ],
  [
    "boar_hit",
    "Boar Hit",
    "creature",
    "A boar squeals when struck.",
    ["anima"],
    "Authoritative boar health damage is observed.",
    0.65,
    "Wild boar hit reaction, short realistic squeal and body movement, restrained, no music.",
  ],
  [
    "boar_death",
    "Boar Death",
    "creature",
    "A boar falls after a final squeal.",
    ["anima"],
    "Authoritative boar death is observed.",
    1.1,
    "Wild boar death, brief final squeal and heavy body fall onto dirt, restrained, no music.",
  ],
  [
    "deer_alert",
    "Deer Alert",
    "creature",
    "A deer gives a short alarm call.",
    ["anima"],
    "Deer becomes alert or begins fleeing.",
    0.75,
    "Realistic deer alarm call with a quick hoof shift in forest ground, isolated, no music.",
  ],
  [
    "deer_hit",
    "Deer Hit",
    "creature",
    "A deer reacts to being struck.",
    ["anima"],
    "Authoritative deer health damage is observed.",
    0.65,
    "Deer hit reaction, short realistic bleat and hoof movement, restrained, no music.",
  ],
  [
    "deer_death",
    "Deer Death",
    "creature",
    "A deer falls to the ground.",
    ["anima"],
    "Authoritative deer death is observed.",
    1.0,
    "Deer death reaction, brief breathy cry and body falling onto forest ground, restrained, no music.",
  ],
  [
    "goat_bleat",
    "Goat Bleat",
    "creature",
    "A goat gives a short natural bleat.",
    ["anima"],
    "Goat idle social animation.",
    0.8,
    "Single realistic goat bleat, close and isolated, no farm ambience, no music.",
  ],
  [
    "sheep_bleat",
    "Sheep Bleat",
    "creature",
    "A sheep gives a short natural bleat.",
    ["anima"],
    "Sheep idle social animation.",
    0.8,
    "Single realistic sheep bleat, close and isolated, no farm ambience, no music.",
  ],
  [
    "livestock_hit",
    "Livestock Hit",
    "creature",
    "A cow, goat, or sheep reacts to a hit.",
    ["anima"],
    "Authoritative livestock damage is observed.",
    0.7,
    "Medium farm animal hit reaction, restrained startled grunt or bleat and body movement, no music.",
  ],
  [
    "livestock_death",
    "Livestock Death",
    "creature",
    "A livestock animal falls.",
    ["anima"],
    "Authoritative livestock death is observed.",
    1.1,
    "Medium farm animal death reaction, short fading call and heavy body fall, restrained, no music.",
  ],
  [
    "horse_neigh",
    "Horse Neigh",
    "creature",
    "A horse gives a clear natural neigh.",
    ["anima"],
    "Horse Neigh animation.",
    1.1,
    "Single realistic horse neigh, close and isolated, no stable ambience, no music.",
  ],
  [
    "horse_hit",
    "Horse Hit",
    "creature",
    "A horse reacts to a hit.",
    ["anima"],
    "Authoritative horse damage is observed.",
    0.75,
    "Horse hit reaction, brief startled whinny and hoof movement, restrained, no music.",
  ],
  [
    "horse_death",
    "Horse Death",
    "creature",
    "A horse falls to the ground.",
    ["anima"],
    "Authoritative horse death is observed.",
    1.2,
    "Horse death reaction, short fading whinny and large body fall onto earth, restrained, no music.",
  ],
  [
    "bird_chirp",
    "Bird Chirp",
    "creature",
    "A small bird gives a concise chirp.",
    ["anima"],
    "Bird Chirp animation.",
    0.6,
    "Single small woodland bird chirp, close and isolated, no ambience, no music.",
  ],
  [
    "bird_flap",
    "Bird Wing Flap",
    "creature",
    "A bird launches or dodges with its wings.",
    ["anima"],
    "Bird takeoff, dodge, or flee animation.",
    0.65,
    "Small bird rapid wing flap and light air movement, close-up and isolated, no chirping, no music.",
  ],
  [
    "bird_hit",
    "Bird Hit",
    "creature",
    "A bird reacts to a hit.",
    ["anima"],
    "Authoritative bird damage is observed.",
    0.55,
    "Small bird hit reaction, brief startled squawk and wing flutter, restrained, no music.",
  ],
  [
    "bird_death",
    "Bird Death",
    "creature",
    "A bird flutters to the ground.",
    ["anima"],
    "Authoritative bird death is observed.",
    0.9,
    "Small bird death reaction, brief squawk, loose wing flutter and light ground landing, restrained, no music.",
  ],
  [
    "cat_meow",
    "Cat Meow",
    "creature",
    "A cat gives a short natural meow.",
    ["anima"],
    "Cat Meow animation.",
    0.7,
    "Single realistic domestic cat meow, close and isolated, no ambience, no music.",
  ],
  [
    "cat_hiss",
    "Cat Hiss",
    "creature",
    "A cat hisses defensively.",
    ["anima"],
    "Cat alert or attack animation.",
    0.65,
    "Single realistic defensive cat hiss, close and isolated, no music.",
  ],
  [
    "small_animal_hit",
    "Small Animal Hit",
    "creature",
    "A cat, fox, rabbit, or rat reacts to a hit.",
    ["anima"],
    "Authoritative small-animal damage is observed.",
    0.55,
    "Small animal hit reaction, brief restrained yelp or squeak and body movement, no music.",
  ],
  [
    "small_animal_death",
    "Small Animal Death",
    "creature",
    "A small animal falls.",
    ["anima"],
    "Authoritative small-animal death is observed.",
    0.85,
    "Small animal death reaction, short fading yelp or squeak and light body fall, restrained, no music.",
  ],
  [
    "fox_bark",
    "Fox Bark",
    "creature",
    "A fox gives a short sharp bark.",
    ["anima"],
    "Fox social or alert animation.",
    0.7,
    "Single realistic fox bark, sharp and close, no woodland ambience, no music.",
  ],
  [
    "rat_squeak",
    "Rat Squeak",
    "creature",
    "A rat gives a short squeak.",
    ["anima"],
    "Rat social or alert animation.",
    0.55,
    "Single realistic rat squeak, close and isolated, no ambience, no music.",
  ],
  [
    "snake_hiss",
    "Snake Hiss",
    "creature",
    "A snake gives a warning hiss.",
    ["anima"],
    "Snake alert animation.",
    0.75,
    "Single realistic snake warning hiss, close and dry, no jungle ambience, no music.",
  ],
  [
    "snake_strike",
    "Snake Strike",
    "creature",
    "A snake rapidly strikes and bites.",
    ["anima"],
    "Snake Bite attack animation.",
    0.6,
    "Fast snake strike, scale movement, sharp hiss and quick bite snap, no victim, no music.",
  ],
  [
    "snake_hit",
    "Snake Hit",
    "creature",
    "A snake reacts to being struck.",
    ["anima"],
    "Authoritative snake damage is observed.",
    0.55,
    "Snake hit reaction, short hiss burst and body movement across ground, no music.",
  ],
  [
    "snake_death",
    "Snake Death",
    "creature",
    "A snake collapses and becomes still.",
    ["anima"],
    "Authoritative snake death is observed.",
    0.8,
    "Snake death reaction, fading hiss and body settling onto ground, restrained, no music.",
  ],
  [
    "undead_idle",
    "Undead Idle",
    "creature",
    "An undead creature breathes and shifts unnaturally.",
    ["anima"],
    "Undead enters idle animation.",
    1.2,
    "Dark fantasy undead idle, dry breath, faint bone and cloth movement, unsettling but quiet, seamless short loop, no speech, no music.",
    true,
  ],
  [
    "undead_attack",
    "Undead Attack",
    "creature",
    "An undead creature lunges with a scratch.",
    ["anima"],
    "Undead attack animation begins.",
    0.8,
    "Dark fantasy undead attack, dry guttural breath, ragged cloth and fast claw scratch, no intelligible speech, no music.",
  ],
  [
    "undead_hit",
    "Undead Hit",
    "creature",
    "An undead body rattles under a hit.",
    ["anima"],
    "Authoritative undead damage is observed.",
    0.65,
    "Undead hit reaction, dry body impact, bones and ragged cloth rattle, no speech, no music.",
  ],
  [
    "undead_death",
    "Undead Death",
    "creature",
    "An undead body collapses into a loose heap.",
    ["anima"],
    "Authoritative undead death is observed.",
    1.1,
    "Undead death, bones and ragged body collapse into a loose heap with dusty settling, no speech, no music.",
  ],
  [
    "bandit_alert",
    "Bandit Alert",
    "creature",
    "A bandit reacts to spotting a threat without intelligible speech.",
    ["anima"],
    "Bandit enters combat.",
    0.75,
    "Medieval bandit combat alert, sharp wordless exertion, leather armor and weapon ready movement, no intelligible speech, no music.",
  ],
  [
    "bandit_hit",
    "Bandit Hit",
    "creature",
    "A bandit reacts to damage.",
    ["anima"],
    "Authoritative bandit damage is observed.",
    0.65,
    "Medieval bandit hit reaction, restrained wordless grunt, leather and light armor impact, no intelligible speech, no music.",
  ],
  [
    "bandit_death",
    "Bandit Death",
    "creature",
    "A bandit falls after a final hit.",
    ["anima"],
    "Authoritative bandit death is observed.",
    1.1,
    "Medieval bandit death reaction, short wordless breath and armored body fall, restrained, no intelligible speech, no music.",
  ],
  [
    "hex_idle",
    "Hex Idle",
    "creature",
    "A Hex creature emits a corrupted magical hum.",
    ["anima"],
    "Hex enters idle animation.",
    1.2,
    "Corrupted fantasy Hex creature idle, unstable arcane hum, faint crystalline clicks and dark energy flutter, seamless loop, no speech, no music.",
    true,
  ],
  [
    "hex_cast",
    "Hex Cast",
    "creature",
    "A Hex creature gathers corrupted magic.",
    ["anima"],
    "Hex attack or ranged cast animation begins.",
    0.9,
    "Corrupted fantasy Hex caster gathers unstable arcane energy, jagged charge and sharp release preparation, no impact, no speech, no music.",
  ],
  [
    "hex_hit",
    "Hex Hit",
    "creature",
    "A Hex shell cracks when damaged.",
    ["anima"],
    "Authoritative Hex damage is observed.",
    0.7,
    "Corrupted Hex creature hit reaction, crystalline shell crack, unstable magic sputter and body recoil, no speech, no music.",
  ],
  [
    "hex_death",
    "Hex Death",
    "creature",
    "A Hex creature fractures and loses its energy.",
    ["anima"],
    "Authoritative Hex death is observed.",
    1.2,
    "Corrupted Hex creature death, crystalline fracture, dark arcane energy collapses and fragments settle, no speech, no music.",
  ],
  [
    "boss_phase",
    "Boss Phase Change",
    "creature",
    "A boss enters a more dangerous combat phase.",
    ["anima"],
    "Authoritative boss phase changes.",
    1.5,
    "Fantasy boss phase transition, massive low pulse, armor or stone movement and rising dangerous energy, dramatic but no music, no speech.",
  ],
  [
    "boss_stagger",
    "Boss Stagger",
    "creature",
    "A large boss loses balance under a powerful hit.",
    ["anima"],
    "Authoritative boss stagger begins.",
    1.0,
    "Large fantasy boss stagger, heavy armored recoil, deep body impact and unstable footing, no speech, no music.",
  ],
  [
    "boss_defeat",
    "Boss Defeat",
    "creature",
    "A major enemy collapses and its power dissipates.",
    ["anima"],
    "Authoritative boss death is observed.",
    1.8,
    "Major fantasy boss defeat, huge body collapse, armor and debris impact, dark power dissipating into silence, no speech, no music.",
  ],
  [
    HARTHMERE_GIANT_BOSS_STOMP_SOUND_ID,
    "Giant Boss Stomp",
    "movement",
    "A massive grounded boss foot or root column plants with enough weight to shake loose earth and debris.",
    ["client_presentation", "anima"],
    "A grounded giant boss advances far enough to complete its next authored stride.",
    1.0,
    "Colossal fantasy monster footstep, one enormous root-and-stone foot plants into damp earth, deep controlled sub-bass thud, bark and rock debris, short ground shock, game-ready, no roar, no voice, no music.",
  ],

  [
    "jump",
    "Player Jump",
    "movement",
    "A short exertion of boots, clothing, and air at takeoff.",
    ["client_presentation", "native_ecs"],
    "Native jump starts.",
    0.5,
    "Player jump takeoff, boots push from ground, cloth and light gear movement with a short air lift, no voice, no music.",
  ],
  [
    "land_soft",
    "Soft Landing",
    "movement",
    "The player lands safely with a small gear movement.",
    ["client_presentation", "native_ecs"],
    "Ground contact after a short fall.",
    0.55,
    "Adventurer soft landing on earth, two boots contact, cloth and light gear settle, no voice, no music.",
  ],
  [
    "land_hard",
    "Hard Landing",
    "movement",
    "A heavy landing communicates fall force.",
    ["native_ecs"],
    "Authoritative fall damage or high-impact landing.",
    0.8,
    "Armored adventurer hard landing, heavy boots and body impact, gear rattle and short low thump, no voice, no music.",
  ],
  [
    HARTHMERE_UNDERWATER_AMBIENCE_SOUND_ID,
    "Underwater Ambience",
    "world",
    "A seamless submerged sound bed of muffled currents, bubbles, and restrained swimming movement.",
    ["client_presentation"],
    "The local camera enters water; the loop stops immediately after surfacing.",
    8,
    "Seamless fantasy game underwater ambience loop, deep muffled river current, soft pressure movement, sparse small bubbles and distant water resonance, calm and restrained, no splash entry, no animals, no voice, no music.",
    true,
  ],
  [
    HARTHMERE_CH1_PORTAL_AMBIENCE_SOUND_ID,
    "Chapter 1 Portal Ambience",
    "world",
    "A restrained seamless low whoosh and unstable aperture resonance heard only near an active Chapter 1 Fracture Gate.",
    ["client_presentation"],
    `An active Chapter 1 Fracture Gate is visible within ${HARTHMERE_CH1_PORTAL_AMBIENCE_RADIUS_METERS} metres of the local player.`,
    8,
    "Seamless dark fantasy portal ambience loop, low soft air whoosh through a narrow dimensional aperture, deep restrained sub resonance, faint unstable glassy shimmer, ominous but quiet, no impact, no voice, no music.",
    true,
  ],
  [
    "climb",
    "Climb",
    "movement",
    "Hands, boots, cloth, and gear move against a climbable surface.",
    ["client_presentation", "native_ecs"],
    "Climbing movement is active.",
    1.2,
    "Adventurer climbing a rough surface, hand grips, boot scrapes, cloth and light gear movement, seamless short loop, no voice, no music.",
    true,
  ],
];

const PROJECTILE_ROWS = [
  ["spark", "Spark", "Arcane electrical spark projectile."],
  ["fireball", "Fireball", "Burning magical fire projectile."],
  ["meteor", "Meteor", "Large falling fire-and-stone projectile."],
  ["lightning_bolt", "Lightning Bolt", "Instant jagged lightning projectile."],
  ["holy_light", "Holy Light", "Clean radiant holy projectile."],
  ["smite", "Smite", "Forceful descending holy strike."],
  ["judgment", "Judgment", "Rune-bound holy weapon projectile."],
  ["consecrate", "Consecrate", "Holy ground-targeted rune impact."],
  ["life_drain", "Life Drain", "Dark siphoning projectile and channel."],
  [
    "entangling_roots",
    "Entangling Roots",
    "Nature seed projectile and erupting roots.",
  ],
  [
    "indisworm_poison_spit",
    "Indisworm Poison Spit",
    "Pressurized corrosive venom launched by a cavern Indisworm.",
  ],
  ["mocking_verse", "Mocking Verse", "Bardic sonic projectile."],
  [
    "curse_of_weakness",
    "Curse of Weakness",
    "Dark weakening curse projectile.",
  ],
  ["polymorph", "Polymorph", "Whimsical transformation projectile."],
  ["fear", "Fear", "Dread-filled spectral projectile."],
  ["charm", "Charm", "Warm swaying enchantment projectile."],
  ["hex_bolt", "Hex Bolt", "Unstable corrupted arcane projectile."],
  [
    "thaedryn_resonance",
    "Thaedryn Resonance",
    "Boss-scale bell resonance shard.",
  ],
  [
    "photon_sidearm_pulse",
    "Photon Sidearm Pulse",
    "Compact coherent blue photon sidearm pulse.",
  ],
  [
    "pulse_carbine_burst",
    "Pulse Carbine Burst",
    "Rapid three-pulse cyan service-carbine burst.",
  ],
  [
    "helix_projector_beam",
    "Helix Projector Beam",
    "Twin-emitter green spiraling armor-piercing beam.",
  ],
  [
    "nova_cannon_bolt",
    "Nova Cannon Bolt",
    "Dense orange plasma-laser siege bolt.",
  ],
  [
    "singularity_lance_beam",
    "Singularity Lance Beam",
    "Fully charged white-violet gravitational lance.",
  ],
] as const;

const PROJECTILE_SOUND_IDENTITIES: Readonly<Record<string, string>> = {
  spark: "white-purple electricity and crystalline arcane crackle",
  fireball: "hot flame, embers and a dense fire roar",
  meteor: "massive burning stone, deep air pressure and debris",
  lightning_bolt: "extremely fast branching electricity and sharp thunder",
  holy_light: "clean white-gold radiant energy and a small bell-like shimmer",
  smite: "forceful white-gold holy energy with a hammer-like weight",
  judgment: "golden runes, holy metal resonance and focused force",
  consecrate: "descending sacred rune, radiant ground ring and holy pulse",
  life_drain: "dark red-purple siphoning energy and reversed breath-like flow",
  entangling_roots: "thorny seed magic, dirt rupture and twisting roots",
  indisworm_poison_spit:
    "pressurized wet venom, acidic bubbles, sticky membrane flutter and a sharp toxic hiss",
  mocking_verse: "magical musical-note energy and oscillating sonic waves",
  curse_of_weakness:
    "broken violet curse rune, shadow flutter and decaying energy",
  polymorph:
    "teal whimsical transformation magic, soft woolly poof and rune shimmer",
  fear: "dark horned spectral energy, reversed whisper texture and dread pulse",
  charm: "pink arcane heart energy, warm pulse and swaying shimmer",
  hex_bolt: "corrupted green-purple crystalline energy with unstable crackle",
  thaedryn_resonance:
    "huge bronze bell resonance, orbiting stone shards and deep pressure wave",
  photon_sidearm_pulse:
    "tight blue photon snap, compact capacitor chirp and precise military energy discharge",
  pulse_carbine_burst:
    "three rapid cyan compressed-energy pulses, crisp cycling electronics and controlled recoil",
  helix_projector_beam:
    "two rotating green emitters braiding into a spiraling beam with harmonic electrical texture",
  nova_cannon_bolt:
    "dense orange plasma-laser charge, heavy magnetic release and hot expanding pressure",
  singularity_lance_beam:
    "contained gravity charge, rising white-violet harmonic, vacuum pull and immense focused release",
};

function projectilePrompt(
  id: string,
  label: string,
  phase: "launch" | "impact"
) {
  const identity = PROJECTILE_SOUND_IDENTITIES[id];
  return phase === "launch"
    ? `${label} fantasy game projectile launch, ${identity}, compact cast charge and clear release, no impact, no music, no intelligible speech.`
    : `${label} fantasy game projectile impact, ${identity}, decisive contact and short dissipating tail, no launch, no music, no intelligible speech.`;
}

function projectileLifecyclePrompt(
  id: string,
  label: string,
  phase: "flight" | "explosion"
) {
  const identity = PROJECTILE_SOUND_IDENTITIES[id];
  return phase === "flight"
    ? `${label} fantasy game projectile continuously moving through the air, ${identity}, sustained forward motion with a stable readable body and subtle evolving texture, begins already in flight, no cast charge, no weapon release, no collision, no explosion, no voice, no music.`
    : `${label} fantasy game explosion lifecycle, ${identity}, immediate energetic burst followed by a rich evolving dissipation that smoothly loses intensity and reaches silence at the end, no cast charge, no projectile flight, no separate weapon release, no voice, no music.`;
}

const PROJECTILE_SOUNDS: readonly HarthmereSoundEffectDefinition[] =
  PROJECTILE_ROWS.flatMap(([id, label, description]) => [
    generated({
      id: `${id}_launch`,
      label: `${label} Launch`,
      category:
        id.includes("sidearm") ||
        id.includes("carbine") ||
        id.includes("projector") ||
        id.includes("cannon") ||
        id.includes("lance") ||
        id === "indisworm_poison_spit"
          ? "ranged"
          : "magic",
      description: `${description} Launch and cast-release layer.`,
      authority:
        id === "hex_bolt" || id === "thaedryn_resonance"
          ? ["anima"]
          : ["native_ecs", "anima"],
      trigger: "Authoritative ability presentation launches its projectile.",
      durationSeconds:
        id === "meteor" || id === "thaedryn_resonance" ? 1.2 : 0.85,
      prompt: projectilePrompt(id, label, "launch"),
    }),
    generated({
      id: `${id}_impact`,
      label: `${label} Impact`,
      category: id === "indisworm_poison_spit" ? "ranged" : "magic",
      description: `${description} Target or ground impact layer.`,
      authority:
        id === "hex_bolt" || id === "thaedryn_resonance"
          ? ["anima"]
          : ["native_ecs", "anima"],
      trigger: "Projectile renderer reaches the authoritative visual target.",
      durationSeconds:
        id === "meteor" || id === "thaedryn_resonance" || id === "consecrate"
          ? 1.4
          : 1.0,
      prompt: projectilePrompt(id, label, "impact"),
    }),
  ]);

const PROJECTILE_LIFECYCLE_SOUNDS: readonly HarthmereSoundEffectDefinition[] =
  PROJECTILE_ROWS.flatMap(([id, label, description]) => [
    generated({
      id: `${id}_flight`,
      label: `${label} Flight`,
      category:
        id.includes("sidearm") ||
        id.includes("carbine") ||
        id.includes("projector") ||
        id.includes("cannon") ||
        id.includes("lance") ||
        id === "indisworm_poison_spit"
          ? "ranged"
          : "magic",
      description: `${description} Dedicated in-flight lifecycle layer, separate from its cast and release.`,
      authority: ["client_presentation"],
      trigger:
        "Projectile renderer begins the authoritative visible flight interval.",
      durationSeconds: 1.4,
      prompt: projectileLifecyclePrompt(id, label, "flight"),
    }),
    generated({
      id: `${id}_explosion`,
      label: `${label} Explosion`,
      category: id === "indisworm_poison_spit" ? "ranged" : "magic",
      description: `${description} Dedicated explosion lifecycle layer, separate from target contact.`,
      authority: ["client_presentation"],
      trigger:
        "A successful magic impact begins its authoritative explosion visual.",
      durationSeconds: 1.4,
      prompt: projectileLifecyclePrompt(id, label, "explosion"),
    }),
  ]);

const SPECIAL_PROJECTILE_LIFECYCLE_SOUNDS: readonly HarthmereSoundEffectDefinition[] =
  [
    generated({
      id: "hunters_mark_flight",
      label: "Hunter's Mark Flight",
      category: "magic",
      description:
        "A dedicated focused tracking pulse follows the mark projectile in flight.",
      authority: ["client_presentation"],
      trigger: "Hunter's Mark begins its visible projectile flight.",
      durationSeconds: 1.4,
      prompt:
        "Fantasy hunter tracking mark continuously moving through the air, narrow focused wind stream, subtle distant horn-colored resonance and a precise target-seeking shimmer, starts already in motion, no cast, no bow release, no collision, no explosion, no speech, no music.",
    }),
    generated({
      id: "hunters_mark_explosion",
      label: "Hunter's Mark Explosion",
      category: "magic",
      description:
        "A dedicated target-lock burst and fading tracking aura for the mark impact.",
      authority: ["client_presentation"],
      trigger: "Hunter's Mark begins its successful magic impact visual.",
      durationSeconds: 1.4,
      prompt:
        "Fantasy hunter tracking mark impact explosion, sharp focused target-lock burst, airy circular pulse and subtle horn-colored magical resonance that steadily fades to silence, no cast, no projectile flight, no bow release, no speech, no music.",
    }),
    generated({
      id: "smoke_bomb_explosion",
      label: "Smoke Bomb Explosion",
      category: "ranged",
      description:
        "A dedicated alchemical smoke bloom follows the existing dart contact sound.",
      authority: ["client_presentation"],
      trigger: "A smoke bomb begins its successful smoke explosion visual.",
      durationSeconds: 1.4,
      prompt:
        "Small fantasy alchemical smoke bomb explosion lifecycle, tight powder pop, rapidly expanding dense dark smoke, dry particulate rush and restrained chemical hiss that smoothly fades to silence, no throw, no dart flight, no separate impact tick, no voice, no music.",
    }),
  ];

const MAGIC_FAMILY_LIFECYCLE_ROWS = [
  [
    "arcane",
    "glassy violet-blue arcane current, crystalline harmonics and controlled rune energy",
  ],
  ["fire", "roaring flame, hot embers and turbulent burning air"],
  [
    "lightning",
    "fast branching electricity, charged air and sharp high-voltage crackle",
  ],
  [
    "holy",
    "clean white-gold radiant energy, warm power and restrained bell-like shimmer",
  ],
  [
    "dark",
    "shadowy red-purple energy, reversed breath-like pull and decaying spectral texture",
  ],
  [
    "nature",
    "thorny seed magic, twisting roots, leaves, soil and living green energy",
  ],
  [
    "sonic",
    "compressed musical resonance, oscillating pressure waves and bright harmonic vibration",
  ],
  [
    "gravity",
    "white-violet spacetime tension, vacuum pull, deep pressure and contained singularity energy",
  ],
] as const;

const MAGIC_FAMILY_LIFECYCLE_SOUNDS: readonly HarthmereSoundEffectDefinition[] =
  MAGIC_FAMILY_LIFECYCLE_ROWS.flatMap(([family, identity]) => [
    generated({
      id: `${family}_projectile_flight`,
      label: `${family[0].toUpperCase()}${family.slice(1)} Projectile Flight`,
      category: "magic",
      description: `A dedicated ${family} lifecycle for magic attacks whose reusable projectile mesh belongs to another family.`,
      authority: ["client_presentation"],
      trigger:
        "A magic attack uses a physical or energy projectile visual with this authoritative damage family.",
      durationSeconds: 1.4,
      prompt: `Fantasy ${family} magic projectile continuously moving through the air, ${identity}, sustained forward motion with a stable readable body and subtle evolving texture, begins already in flight, no cast charge, no weapon release, no collision, no explosion, no voice, no music.`,
    }),
    generated({
      id: `${family}_explosion`,
      label: `${family[0].toUpperCase()}${family.slice(1)} Explosion`,
      category: "magic",
      description: `A dedicated ${family} explosion for magic attacks whose reusable projectile mesh belongs to another family.`,
      authority: ["client_presentation"],
      trigger:
        "A successful magic impact uses a physical or energy projectile visual with this authoritative damage family.",
      durationSeconds: 1.4,
      prompt: `Fantasy ${family} magic explosion lifecycle, ${identity}, immediate energetic burst followed by a rich evolving dissipation that smoothly loses intensity and reaches silence at the end, no cast charge, no projectile flight, no separate weapon release, no voice, no music.`,
    }),
  ]);

const ENERGY_WEAPON_SPECIAL_SOUNDS: readonly HarthmereSoundEffectDefinition[] =
  [
    generated({
      id: "photon_shield_overheat",
      label: "Photon Shield Overheat",
      category: "ranged",
      description: "A critical photon pulse overloads an enemy shield system.",
      authority: ["native_ecs", "client_presentation"],
      trigger:
        "Server-authoritative Photon Sidearm critical applies shield overheat.",
      durationSeconds: 1.0,
      prompt:
        "Science-fiction enemy shield overheat, stressed blue energy barrier crackle, rising electrical whine and short protective-field collapse, no weapon shot, no voice, no music.",
    }),
    generated({
      id: "pulse_carbine_overcharge",
      label: "Pulse Carbine Tenth-Shot Overcharge",
      category: "ranged",
      description:
        "The carbine's tenth accepted shot releases a stronger pulse.",
      authority: ["native_ecs", "client_presentation"],
      trigger: "Server pulse counter reaches the tenth accepted carbine shot.",
      durationSeconds: 0.8,
      prompt:
        "Science-fiction rifle overcharge confirmation, bright cyan capacitor step-up, three tight energy pulses ending in one stronger bass-rich pulse, no impact, no voice, no music.",
    }),
    generated({
      id: "helix_energy_burn",
      label: "Helix Energy Burn",
      category: "ranged",
      description:
        "Residual green helical energy burns through armor over time.",
      authority: ["native_ecs", "anima", "client_presentation"],
      trigger: "Anima presents an authoritative Energy Burn tick.",
      durationSeconds: 1.2,
      prompt:
        "Science-fiction green energy burn on metal armor, rotating electrical sizzle, harmonic crackle and brief molten stress, controlled and game-readable, no scream, no music.",
    }),
    generated({
      id: "nova_cannon_mini_nova",
      label: "Nova Cannon Mini Nova",
      category: "ranged",
      description:
        "A defeated target collapses into a compact orange energy nova.",
      authority: ["native_ecs", "client_presentation"],
      trigger:
        "A Nova Cannon primary target dies in the authoritative hit transaction.",
      durationSeconds: 1.5,
      prompt:
        "Compact science-fiction miniature nova explosion, orange plasma implosion followed by bright expanding energy blast, hot debris and short pressure tail, no voice, no music.",
    }),
    generated({
      id: "singularity_gravity_collapse",
      label: "Singularity Gravity Collapse",
      category: "ranged",
      description:
        "A charged lance hit pulls nearby targets inward and detonates.",
      authority: ["native_ecs", "client_presentation"],
      trigger: "Server validates a fully charged Singularity Lance impact.",
      durationSeconds: 2.0,
      prompt:
        "Science-fiction miniature gravitational collapse, deep vacuum suction, rising violet spacetime distortion, sudden white implosion and massive contained shockwave, no voice, no music.",
    }),
  ];

const GENERATED_SOUNDS: readonly HarthmereSoundEffectDefinition[] = [
  ...GENERATED_ROWS.map(
    ([
      id,
      label,
      category,
      description,
      authority,
      trigger,
      durationSeconds,
      prompt,
      loop,
    ]) =>
      generated({
        id,
        label,
        category,
        description,
        authority,
        trigger,
        durationSeconds,
        prompt,
        loop,
      })
  ),
  ...HARTHMERE_CREATURE_SOUND_EFFECT_INPUTS.map((input) => generated(input)),
  ...PROJECTILE_SOUNDS,
  ...PROJECTILE_LIFECYCLE_SOUNDS,
  ...SPECIAL_PROJECTILE_LIFECYCLE_SOUNDS,
  ...MAGIC_FAMILY_LIFECYCLE_SOUNDS,
  ...ENERGY_WEAPON_SPECIAL_SOUNDS,
];

export const HARTHMERE_SOUND_EFFECT_MANIFEST = [
  ...EXISTING_SOUNDS,
  ...GENERATED_SOUNDS,
] as const satisfies readonly HarthmereSoundEffectDefinition[];

export type HarthmereSoundEffectId =
  (typeof HARTHMERE_SOUND_EFFECT_MANIFEST)[number]["id"];

const SOUND_BY_ID = new Map(
  HARTHMERE_SOUND_EFFECT_MANIFEST.map((definition) => [
    definition.id,
    definition,
  ])
);

export function getHarthmereSoundEffect(id: unknown) {
  return SOUND_BY_ID.get(String(id ?? ""));
}

export const HARTHMERE_PROJECTILE_SOUND_MAP: Readonly<
  Record<
    string,
    { launch: string; flight?: string; impact: string; explosion?: string }
  >
> = {
  hunter_bow_shot: {
    launch: "bow_release",
    flight: "arrow_flyby",
    impact: "arrow_impact_flesh",
  },
  quick_shot: {
    launch: "bow_release",
    flight: "arrow_flyby",
    impact: "arrow_impact_flesh",
  },
  aimed_shot: {
    launch: "bow_release_heavy",
    flight: "arrow_flyby",
    impact: "arrow_impact_flesh",
  },
  multi_shot: {
    launch: "bow_release_multi",
    flight: "arrow_flyby",
    impact: "arrow_impact_flesh",
  },
  bandit_archer_shot: {
    launch: "bow_release",
    flight: "arrow_flyby",
    impact: "arrow_impact_flesh",
  },
  ranged_shot: {
    launch: "crossbow_release",
    flight: "bolt_flyby",
    impact: "bolt_impact",
  },
  smoke_bomb_throw: {
    launch: "dart_throw",
    flight: "dart_flyby",
    impact: "dart_impact",
    explosion: "smoke_bomb_explosion",
  },
  hunters_mark: {
    launch: "hunters_mark",
    flight: "hunters_mark_flight",
    impact: "hunters_mark",
    explosion: "hunters_mark_explosion",
  },
  hunter_mark: {
    launch: "hunters_mark",
    flight: "hunters_mark_flight",
    impact: "hunters_mark",
    explosion: "hunters_mark_explosion",
  },
  ...Object.fromEntries(
    PROJECTILE_ROWS.map(([id]) => [
      id,
      {
        launch: `${id}_launch`,
        flight: `${id}_flight`,
        impact: `${id}_impact`,
        explosion: `${id}_explosion`,
      },
    ])
  ),
};

export const HARTHMERE_MAGIC_FAMILY_LIFECYCLE_SOUND_MAP: Readonly<
  Record<string, { flight: string; explosion: string }>
> = Object.fromEntries(
  MAGIC_FAMILY_LIFECYCLE_ROWS.map(([family]) => [
    family,
    {
      flight: `${family}_projectile_flight`,
      explosion: `${family}_explosion`,
    },
  ])
);

export const HARTHMERE_OBJECT_INTERACTION_SOUND_MAP: Readonly<
  Record<string, string>
> = {
  open_container: "open_container_wood",
  open_door: "open_door",
  open_gate: "open_gate",
  open_jobs_board: "open_board",
  open_wanted_board: "open_board",
  read: "read_object",
  craft: "craft_success",
  cook: "cooking_start",
  use: "use_object",
  gather: "gather_resource",
  repair: "repair_wood",
  recover: "gather_resource",
  tend: "water_plant",
  practice: "practice_action",
  check_outfit: "check_outfit",
  take_photo: "take_photo",
  inspect: "inspect_object",
};

export const HARTHMERE_ABILITY_SOUND_MAP: Readonly<Record<string, string>> = {
  shield_bash: "shield_bash",
  taunt: "taunt",
  cleave: "cleave",
  charge: "charge",
  last_stand: "last_stand",
  guard_ally: "guard_ally",
  backstab: "backstab",
  vanish: "vanish",
  poison_blade: "poison_blade",
  pick_lock: "pick_lock",
  disarm_trap: "disarm_trap",
  bear_trap: "bear_trap_place",
  tame_animal: "tame_animal",
  frost_barrier: "frost_barrier",
  heal: "heal",
  minor_heal: "heal",
  rejuvenation: "rejuvenation",
  blessing: "blessing",
  resurrection: "resurrection",
  shield_of_faith: "shield_of_faith",
  raise_skeleton: "raise_skeleton",
  bear_form: "bear_form",
  song_of_courage: "song_of_courage",
  flowing_kick: "flowing_kick",
  center_self: "center_self",
  deploy_turret: "deploy_turret",
  repair_kit: "repair_kit",
  trap_wire: "bear_trap_place",
  summon_wisp: "summon_wisp",
  command_pet: "command_pet",
  bond_mend: "bond_mend",
  guarded_block: "shield_raise",
  mana_shield: "mana_shield",
  read_runes: "read_runes",
  cleanse: "cleanse",
  speak_with_dead: "speak_with_dead",
  speak_with_animals: "speak_with_animals",
  rumor_song: "rumor_song",
  track_beast: "track_beast",
  riposte: "parry",
  whirlwind_slash: "whirlwind_slash",
};

export interface HarthmereSoundEffectEventDetail {
  id: string;
  position?: readonly number[];
  idempotent?: boolean;
  preloadOnly?: boolean;
  durationSeconds?: number;
  fadeOutSeconds?: number;
  volumeMultiplier?: number;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
}

export function emitHarthmereSoundEffect(
  id: string,
  options: Omit<HarthmereSoundEffectEventDetail, "id"> = {}
) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_SOUND_EFFECT_EVENT, {
      detail: { id, ...options } satisfies HarthmereSoundEffectEventDetail,
    })
  );
}

export function preloadHarthmereSoundEffect(id: string) {
  emitHarthmereSoundEffect(id, { preloadOnly: true });
}

export function shouldPlayHarthmereWaterEntrySplash(input: {
  swimming: boolean;
  wasSwimming: boolean;
  flying: boolean;
}) {
  return input.swimming && !input.wasSwimming && !input.flying;
}

export function harthmereProximityAmbienceIsAudible(
  distanceMeters: number,
  radiusMeters: number
) {
  return (
    Number.isFinite(distanceMeters) &&
    Number.isFinite(radiusMeters) &&
    radiusMeters > 0 &&
    distanceMeters >= 0 &&
    distanceMeters <= radiusMeters
  );
}

export function harthmereNpcSoundIdForText(
  textValue: unknown,
  phase: "idle" | "attack" | "hit" | "death"
) {
  return harthmereNpcSoundIdForIdentity({ text: textValue }, phase);
}

export function harthmereNpcSoundIdForIdentity(
  input: { text?: unknown; entityId?: number },
  phase: HarthmereCreatureSoundPhase
) {
  const unique = harthmereCreatureSoundEffectIdForIdentity(input, phase);
  if (unique) return unique;

  const textValue = input.text;
  const text = String(textValue ?? "").toLowerCase();
  if (/thaedryn|boss|helix/.test(text)) {
    return phase === "death"
      ? "boss_defeat"
      : phase === "hit"
        ? "boss_stagger"
        : phase === "attack"
          ? "boss_phase"
          : undefined;
  }
  if (/hex|hexer/.test(text)) return `hex_${phase}`;
  if (/undead|zombie|corpse|drowned/.test(text)) return `undead_${phase}`;
  if (/wolf|hound|dog/.test(text)) {
    return phase === "idle" ? "wolf_howl" : `wolf_${phase}`;
  }
  if (/bear/.test(text)) {
    return phase === "idle" ? "bear_roar" : `bear_${phase}`;
  }
  if (/boar/.test(text)) {
    return phase === "idle" ? undefined : `boar_${phase}`;
  }
  if (/stag|deer/.test(text)) {
    return phase === "idle"
      ? "deer_alert"
      : phase === "attack"
        ? "animal_charge"
        : `deer_${phase}`;
  }
  if (/horse/.test(text)) {
    return phase === "idle"
      ? "horse_neigh"
      : phase === "attack"
        ? "animal_kick"
        : `horse_${phase}`;
  }
  if (/cow|goat|sheep/.test(text)) {
    if (phase === "idle") {
      if (/goat/.test(text)) return "goat_bleat";
      if (/sheep/.test(text)) return "sheep_bleat";
      return undefined;
    }
    return phase === "attack" ? "animal_kick" : `livestock_${phase}`;
  }
  if (/bird|crow|pigeon|chicken|duck/.test(text)) {
    return phase === "idle"
      ? "bird_chirp"
      : phase === "attack"
        ? "animal_peck"
        : `bird_${phase}`;
  }
  if (/snake/.test(text)) {
    return phase === "idle"
      ? "snake_hiss"
      : phase === "attack"
        ? "snake_strike"
        : `snake_${phase}`;
  }
  if (/cat/.test(text)) {
    return phase === "idle"
      ? "cat_meow"
      : phase === "attack"
        ? "cat_hiss"
        : phase === "death"
          ? "small_animal_death"
          : "small_animal_hit";
  }
  if (/fox/.test(text)) {
    return phase === "idle"
      ? "fox_bark"
      : phase === "attack"
        ? "animal_scratch"
        : phase === "death"
          ? "small_animal_death"
          : "small_animal_hit";
  }
  if (/rat|rabbit|mouse/.test(text)) {
    return phase === "idle"
      ? "rat_squeak"
      : phase === "attack"
        ? "animal_scratch"
        : phase === "death"
          ? "small_animal_death"
          : "small_animal_hit";
  }
  if (/bandit|outlaw|trapper|ambusher|scout/.test(text)) {
    return phase === "idle" || phase === "attack"
      ? "bandit_alert"
      : `bandit_${phase}`;
  }
  return undefined;
}
