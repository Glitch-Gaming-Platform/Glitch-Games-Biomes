import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BOSS_VISUAL_ASSETS_VERSION =
  "harthmere-boss-visual-assets-v6-polished-motion" as const;

export const HARTHMERE_BOSS_REQUIRED_ANIMATION_CLIPS = [
  "Idle",
  "Walk",
  "Run",
  "Sprint",
  "Jump",
  "Fly",
  "Attack",
  "HeavyAttack",
  "RangedAttack",
  "AreaAttack",
  "HitReact",
  "Stunned",
  "BossStaggerLight",
  "BossStaggerMedium",
  "BossStaggerHeavy",
  "Roar",
  "PhaseTransition",
  "Summon",
  "Enrage",
  "WipeReset",
  "Death",
] as const;

export type HarthmereBossAnimationClip =
  (typeof HARTHMERE_BOSS_REQUIRED_ANIMATION_CLIPS)[number];

export type HarthmereBossVisualId =
  | "muck_scarred_helix"
  | "gilded_bull"
  | "ninth_winter"
  | "failed_apprentice"
  | "first_choir"
  | "echo_singer"
  | "vyrahel_vein_keeper"
  | "thaedryn_bellbound"
  | "hex_wraith"
  | "alpha_mucker"
  | "root_crowned_dead";

export interface HarthmereBossVisualAsset {
  id: HarthmereBossVisualId;
  displayName: string;
  /** Lower-case label fragments used by ECS, jobs-board, and quest actors. */
  labelAliases: readonly string[];
  /** Stable ECS identities whose old placeholder labels cannot be renamed. */
  entityIds?: readonly number[];
  assetUrl: string;
  voxSource: string;
  /** Intended authoritative collision/render dimensions in world meters. */
  worldSize: Vec3;
  /** Attacks selected in order for successive authoritative attack events. */
  attackClips: readonly HarthmereBossAnimationClip[];
  /** Bespoke authored attacks cycled by static/local encounter actors. */
  combatSpecialClips?: readonly string[];
  /** Lore/mechanic-specific clips exported in addition to the shared contract. */
  specialClips: readonly string[];
  silhouette: string;
  palette: readonly string[];
}

const boss = (definition: HarthmereBossVisualAsset): HarthmereBossVisualAsset =>
  Object.freeze(definition);

/**
 * The eleven bosses that are actually referenced by live Harthmere encounters.
 * This is intentionally not a catalog of unused art concepts: labels must route
 * through an existing quest, encounter seed, jobs-board hunt, or public event.
 */
export const HARTHMERE_BOSS_VISUAL_ASSETS: readonly HarthmereBossVisualAsset[] =
  Object.freeze([
    boss({
      id: "muck_scarred_helix",
      displayName: "Muck-Scarred Helix",
      labelAliases: ["muck-scarred helix", "muck scarred helix"],
      assetUrl: "/assets/harthmere/glb/bosses/muck_scarred_helix.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/muck_scarred_helix.vox",
      worldSize: [6.8, 4.8, 8.4],
      attackClips: ["HeavyAttack", "RangedAttack", "AreaAttack"],
      specialClips: [
        "BreachStalk",
        "MaulCrush",
        "SiphonVolley",
        "HelixPulse",
        "SporeCast",
        "Burrow",
        "Rupture",
        "BreachCollapse",
      ],
      silhouette:
        "A low six-limbed breach predator split around a living double helix, with a scar-grown demolition maul, radial siphon maw, spore organs, and barbed tunneling tail.",
      palette: [
        "oil-black muck hide",
        "violet-black chitin",
        "layered scar tissue",
        "toxic chartreuse helix",
        "breach violet",
      ],
    }),
    boss({
      id: "gilded_bull",
      displayName: "The Gilded Bull",
      labelAliases: ["the gilded bull", "gilded bull"],
      assetUrl: "/assets/harthmere/glb/bosses/gilded_bull.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/gilded_bull.vox",
      worldSize: [3.9, 2.7, 5.6],
      attackClips: ["HeavyAttack", "RangedAttack", "AreaAttack"],
      specialClips: [
        "PatrolScan",
        "Charge",
        "PillarCrash",
        "HornBreak",
        "SunCoreBeam",
        "HoofQuake",
        "Unbalanced",
        "CoreRupture",
      ],
      silhouette:
        "A five-and-a-half-meter Sun Court war automaton: low armored wedge, arena-spanning breakaway horns, articulated piston legs, offset sunburst core, and a segmented counterweight tail.",
      palette: [
        "blackened bronze chassis",
        "layered aged bronze",
        "ceremonial sun gold",
        "ivory repair ceramic",
        "turquoise Weight core",
      ],
    }),
    boss({
      id: "ninth_winter",
      displayName: "The Ninth Winter",
      labelAliases: ["the ninth winter", "ninth winter"],
      assetUrl: "/assets/harthmere/glb/bosses/ninth_winter.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/ninth_winter.vox",
      worldSize: [14.0, 13.0, 8.0],
      attackClips: ["RangedAttack", "AreaAttack", "Summon"],
      specialClips: [
        "HearthFails",
        "Blizzard",
        "TimeLoop",
        "RoofbeamSweep",
        "YearBreaks",
        "Shatter",
        "Rainfall",
        "MeltDeath",
      ],
      silhouette:
        "Ash Hall itself walking: a thirteen-meter arched ice reliquary lashed in roof beams, carrying nine mismatched unfinished mornings above a dark failed-dawn chamber.",
      palette: [
        "black glacial ice",
        "old blue ice",
        "ash snow",
        "roof timber and iron",
        "failed-dawn white",
        "rain blue",
      ],
    }),
    boss({
      id: "failed_apprentice",
      displayName: "The Failed Apprentice",
      labelAliases: ["the failed apprentice", "failed apprentice"],
      assetUrl: "/assets/harthmere/glb/bosses/failed_apprentice.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/failed_apprentice.vox",
      worldSize: [4.8, 5.6, 3.8],
      attackClips: ["HeavyAttack", "RangedAttack", "AreaAttack"],
      combatSpecialClips: [
        "BellFist",
        "ShardCast",
        "FailedWard",
        "WrongNote",
        "LastLesson",
      ],
      specialClips: [
        "ChainLurch",
        "BellFist",
        "ShardCast",
        "FailedWard",
        "WrongNote",
        "BellCrack",
        "BindingTear",
        "LastLesson",
        "BellCollapse",
      ],
      silhouette:
        "A ruined young Bellward suspended inside the enormous broken bell-frame that killed them, with a conductor arm, bell-fist, dragging chains, split shell, and orbiting failed-binding shards.",
      palette: [
        "apprentice gray",
        "old bone",
        "broken bronze",
        "verdigris",
        "failed-voice violet",
      ],
    }),
    boss({
      id: "first_choir",
      displayName: "The First Choir",
      labelAliases: [
        "the first choir",
        "first choir",
        "first choir crone",
        "first choir stonemason",
        "first choir apprentice",
      ],
      assetUrl: "/assets/harthmere/glb/bosses/first_choir.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/first_choir.vox",
      worldSize: [4.2, 2.7, 4.2],
      attackClips: ["RangedAttack", "AreaAttack", "Summon"],
      specialClips: ["Chant", "HarmonyBreak"],
      silhouette:
        "Three distinct corrupted Bellbinders singing around one suspended spectral bell: chapel crone, stone mason, and gray-clad youth.",
      palette: ["chapel umber", "mason stone", "apprentice gray", "choir cyan"],
    }),
    boss({
      id: "echo_singer",
      displayName: "The Echo-Singer",
      labelAliases: ["the echo-singer", "echo-singer", "echo singer"],
      assetUrl: "/assets/harthmere/glb/bosses/echo_singer.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/echo_singer.vox",
      worldSize: [6.2, 5.6, 5.8],
      attackClips: ["HeavyAttack", "RangedAttack", "AreaAttack"],
      combatSpecialClips: [
        "CopyMelee",
        "CopyRanged",
        "CopyGuard",
        "EchoDelay",
        "MirrorStep",
        "ResonanceOverload",
      ],
      specialClips: [
        "Listen",
        "CopyMelee",
        "CopyRanged",
        "CopyGuard",
        "EchoDelay",
        "EssenceDive",
        "MirrorStep",
        "ResonanceOverload",
        "Silence",
      ],
      silhouette:
        "A hovering cracked bell-prism predator assembled from three copied masks, oversized mirrored tuning blades, delayed incomplete silhouettes, and intersecting resonance rings.",
      palette: [
        "echo void",
        "mirror silver",
        "resonance cyan",
        "memory magenta",
        "guard gold",
      ],
    }),
    boss({
      id: "vyrahel_vein_keeper",
      displayName: "Vyrahel, the Vein-Keeper",
      labelAliases: [
        "vyrahel, the vein-keeper",
        "vyrahel the vein-keeper",
        "vyrahel",
      ],
      assetUrl: "/assets/harthmere/glb/bosses/vyrahel_vein_keeper.glb",
      voxSource:
        "src/galois/data/npcs/harthmere_bosses/vyrahel_vein_keeper.vox",
      worldSize: [3.8, 2.6, 6.4],
      attackClips: ["Attack", "RangedAttack", "Jump"],
      combatSpecialClips: [
        "TailFeint",
        "VeinBreath",
        "WingBurst",
        "BurrowRush",
        "CrystalGuard",
      ],
      specialClips: [
        "VeinProwl",
        "CrystalGuard",
        "VeinBreath",
        "BurrowRush",
        "TailFeint",
        "WingBurst",
        "MercyWindow",
        "Yield",
        "VeinFade",
      ],
      silhouette:
        "An eight-foot young vein-dragon with a narrow intelligent head, sprinting digitigrade legs, folding crystal shoulder shields, braking wings, digging claws, and a long mineral tail.",
      palette: [
        "dark vein scale",
        "burnished amber",
        "hot vein crystal",
        "blood-vellum membrane",
        "deep slate",
      ],
    }),
    boss({
      id: "thaedryn_bellbound",
      displayName: "Thaedryn the Bellbound",
      labelAliases: ["thaedryn the bellbound", "thaedryn"],
      assetUrl: "/assets/harthmere/glb/bosses/thaedryn_bellbound.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/thaedryn_bellbound.vox",
      worldSize: [20.0, 14.0, 58.0],
      attackClips: ["HeavyAttack", "RangedAttack", "AreaAttack"],
      specialClips: [
        "SleeperSweep",
        "SoundCloud",
        "RiverBreath",
        "ChainBreak",
        "HalfWake",
        "WingGust",
        "VeinSummon",
        "BellboundRise",
        "Greeting",
        "Rebind",
        "Slay",
        "Wake",
      ],
      silhouette:
        "A roughly two-hundred-foot old-bronze river dragon curled through the Wyrm's Bed, with pale stone patches, folded vellum cathedral wings, intelligent candle eyes, four independent binding bells, and a river-long finned tail.",
      palette: [
        "old bronze scales",
        "pale river-stone patches",
        "vellum wing membrane",
        "binding iron",
        "bell gold",
        "candle-flame voice amber",
        "river-blue resonance",
      ],
    }),
    boss({
      id: "hex_wraith",
      displayName: "Hex Wraith",
      labelAliases: ["hex wraith", "hex wraith bounty"],
      entityIds: [8_810_000_000_019_543],
      assetUrl: "/assets/harthmere/glb/bosses/hex_wraith.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/hex_wraith.vox",
      worldSize: [2.5, 3.8, 2.5],
      attackClips: ["RangedAttack", "AreaAttack", "Summon"],
      specialClips: ["Teleport", "HexVolley"],
      silhouette:
        "A tall hollow songline revenant beneath a torn cowl, with orbiting hex tablets, lantern ribs, and no visible feet.",
      palette: ["grave violet", "pale ectoplasm", "moss green", "sigil white"],
    }),
    boss({
      id: "alpha_mucker",
      displayName: "Alpha Mucker",
      labelAliases: ["alpha mucker", "alpha mucker bounty"],
      entityIds: [8_810_000_000_019_509],
      assetUrl: "/assets/harthmere/glb/bosses/alpha_mucker.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/alpha_mucker.vox",
      worldSize: [12.0, 14.0, 11.0],
      attackClips: ["HeavyAttack", "RangedAttack", "AreaAttack"],
      combatSpecialClips: [
        "BranchSlam",
        "SeedBarrage",
        "RoadUproot",
        "RootCage",
        "MuckheartPulse",
        "CanopyRage",
      ],
      specialClips: [
        "RootMarch",
        "BranchSlam",
        "RoadUproot",
        "SeedBarrage",
        "RootCage",
        "MuckheartPulse",
        "CanopyRage",
        "HeartExposed",
        "Timberfall",
      ],
      silhouette:
        "A fourteen-meter evil walking tree rooted in the Old Wood Muck Patch, with grasping branch arms, two root-column legs, a dragging taproot, storm canopy, seed artillery, stolen road stones, and an exposed Muckheart.",
      palette: [
        "charred old-wood bark",
        "muck-black roots",
        "sick canopy green",
        "toxic sap",
        "Muckheart crimson",
        "stolen road stone",
      ],
    }),
    boss({
      id: "root_crowned_dead",
      displayName: "The Root-Crowned Dead",
      labelAliases: [
        "the root-crowned dead",
        "root-crowned dead",
        "root crowned dead",
      ],
      assetUrl: "/assets/harthmere/glb/bosses/root_crowned_dead.glb",
      voxSource: "src/galois/data/npcs/harthmere_bosses/root_crowned_dead.vox",
      worldSize: [4.5, 5.5, 4.5],
      attackClips: ["AreaAttack", "RangedAttack", "Summon"],
      specialClips: ["RootEruption", "SpawnRootlings"],
      silhouette:
        "A towering dead forester overtaken by a root throne, hollow-chested and antler-crowned, with branch arms and roots erupting from its stride.",
      palette: ["dead oak", "old bone", "moss", "corruption crimson"],
    }),
  ]);

function normalizeBossLabel(label: string | undefined): string {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
}

export function harthmereBossVisualForLabel(
  label: string | undefined
): HarthmereBossVisualAsset | undefined {
  const normalized = normalizeBossLabel(label);
  if (!normalized) {
    return undefined;
  }
  return HARTHMERE_BOSS_VISUAL_ASSETS.find((visual) =>
    visual.labelAliases.some((alias) => normalized.includes(alias))
  );
}

export function harthmereBossVisualAssetUrlForLabel(
  label: string | undefined
): string | undefined {
  return harthmereBossVisualForLabel(label)?.assetUrl;
}

export function harthmereBossVisualForEntity(
  label: string | undefined,
  entityId: number | undefined
): HarthmereBossVisualAsset | undefined {
  const fromLabel = harthmereBossVisualForLabel(label);
  if (fromLabel) {
    return fromLabel;
  }
  if (!Number.isFinite(entityId)) {
    return undefined;
  }
  return HARTHMERE_BOSS_VISUAL_ASSETS.find((visual) =>
    visual.entityIds?.includes(Number(entityId))
  );
}

export function harthmereBossStaticAssetKeyForLabel(
  label: string | undefined
): string | undefined {
  const visual = harthmereBossVisualForLabel(label);
  return visual ? `boss_${visual.id}` : undefined;
}

export function harthmereBossWorldSizeForLabel(
  label: string | undefined
): Vec3 | undefined {
  const size = harthmereBossVisualForLabel(label)?.worldSize;
  return size ? [...size] : undefined;
}

export function harthmereBossAttackClipForEvent(
  label: string | undefined,
  eventSeed: number
): HarthmereBossAnimationClip | undefined {
  return harthmereBossAttackClipForEntityEvent(label, undefined, eventSeed);
}

export function harthmereBossAttackClipForEntityEvent(
  label: string | undefined,
  entityId: number | undefined,
  eventSeed: number
): HarthmereBossAnimationClip | undefined {
  const clips = harthmereBossVisualForEntity(label, entityId)?.attackClips;
  if (!clips?.length) {
    return undefined;
  }
  const index = Math.abs(Math.trunc(eventSeed)) % clips.length;
  return clips[index];
}
